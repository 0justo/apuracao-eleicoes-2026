"""Camada de persistência SQLite para cache HTTP (ETag/If-Modified-Since),
snapshots históricos da linha do tempo, feed do narrador e eventos operacionais (/status).
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from backend.models import DisputeSnapshot, NarratorMessage, TimelinePoint


class Database:
    """Gerenciador de persistência SQLite do backend."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS http_cache (
                    url TEXT PRIMARY KEY,
                    etag TEXT,
                    last_modified TEXT,
                    last_checked_ts REAL NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS snapshots_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dispute_id TEXT NOT NULL,
                    election_code TEXT NOT NULL,
                    is_replay INTEGER NOT NULL DEFAULT 0,
                    created_ts REAL NOT NULL,
                    iso_timestamp TEXT NOT NULL,
                    hms_timestamp TEXT NOT NULL,
                    pct_counted REAL NOT NULL,
                    cand1_pct REAL NOT NULL,
                    cand2_pct REAL NOT NULL,
                    margin_pp REAL NOT NULL,
                    cand1_votes INTEGER NOT NULL,
                    cand2_votes INTEGER NOT NULL,
                    valid_votes INTEGER NOT NULL,
                    snapshot_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_snapshots_dispute_ts
                ON snapshots_history (dispute_id, is_replay, created_ts);

                CREATE TABLE IF NOT EXISTS latest_snapshots (
                    dispute_id TEXT PRIMARY KEY,
                    updated_ts REAL NOT NULL,
                    validation_status TEXT NOT NULL DEFAULT 'ok',
                    validation_message TEXT,
                    snapshot_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS narrator_feed (
                    id TEXT PRIMARY KEY,
                    dispute_id TEXT NOT NULL,
                    is_replay INTEGER NOT NULL DEFAULT 0,
                    created_ts REAL NOT NULL,
                    hms_timestamp TEXT NOT NULL,
                    category TEXT NOT NULL,
                    text TEXT NOT NULL,
                    is_estimate INTEGER NOT NULL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_narrator_dispute_ts
                ON narrator_feed (dispute_id, is_replay, created_ts DESC);

                CREATE TABLE IF NOT EXISTS system_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_ts REAL NOT NULL,
                    iso_timestamp TEXT NOT NULL,
                    level TEXT NOT NULL,
                    component TEXT NOT NULL,
                    message TEXT NOT NULL,
                    details_json TEXT
                );

                CREATE TABLE IF NOT EXISTS poller_status (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL
                );
                """
            )

    def get_http_cache(self, url: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT url, etag, last_modified, last_checked_ts, payload_json FROM http_cache WHERE url = ?",
                (url,),
            ).fetchone()
            if not row:
                return None
            return {
                "url": row["url"],
                "etag": row["etag"],
                "last_modified": row["last_modified"],
                "last_checked_ts": float(row["last_checked_ts"]),
                "payload": json.loads(row["payload_json"]),
            }

    def set_http_cache(
        self,
        url: str,
        payload: dict[str, Any],
        etag: str | None = None,
        last_modified: str | None = None,
        checked_ts: float | None = None,
    ) -> None:
        now = checked_ts if checked_ts is not None else time.time()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO http_cache (url, etag, last_modified, last_checked_ts, payload_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    etag = COALESCE(excluded.etag, http_cache.etag),
                    last_modified = COALESCE(excluded.last_modified, http_cache.last_modified),
                    last_checked_ts = excluded.last_checked_ts,
                    payload_json = excluded.payload_json
                """,
                (url, etag, last_modified, now, json.dumps(payload, ensure_ascii=False)),
            )

    def touch_http_cache(self, url: str, checked_ts: float | None = None) -> None:
        now = checked_ts if checked_ts is not None else time.time()
        with self._connect() as conn:
            conn.execute(
                "UPDATE http_cache SET last_checked_ts = ? WHERE url = ?",
                (now, url),
            )

    def get_latest_snapshot(self, dispute_id: str) -> DisputeSnapshot | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT snapshot_json FROM latest_snapshots WHERE dispute_id = ?",
                (dispute_id,),
            ).fetchone()
            if not row:
                return None
            return DisputeSnapshot.model_validate_json(row["snapshot_json"])

    def save_valid_snapshot(self, snapshot: DisputeSnapshot) -> None:
        now = time.time()
        c1 = snapshot.candidates[0]
        c2 = snapshot.candidates[1]
        margin_pp = round(c1.pct_valid - c2.pct_valid, 2)
        snap_json = snapshot.model_dump_json()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO latest_snapshots (dispute_id, updated_ts, validation_status, validation_message, snapshot_json)
                VALUES (?, ?, 'ok', NULL, ?)
                ON CONFLICT(dispute_id) DO UPDATE SET
                    updated_ts = excluded.updated_ts,
                    validation_status = 'ok',
                    validation_message = NULL,
                    snapshot_json = excluded.snapshot_json
                """,
                (snapshot.dispute_id, now, snap_json),
            )

            # Evita duplicar pontos idênticos consecutivos na linha do tempo se nada mudou
            last_pt = conn.execute(
                """
                SELECT pct_counted, cand1_votes, cand2_votes
                FROM snapshots_history
                WHERE dispute_id = ? AND is_replay = ?
                ORDER BY id DESC LIMIT 1
                """,
                (snapshot.dispute_id, 1 if snapshot.is_replay else 0),
            ).fetchone()

            should_insert = True
            if last_pt is not None:
                if (
                    abs(float(last_pt["pct_counted"]) - snapshot.sections.pct_counted) < 1e-6
                    and int(last_pt["cand1_votes"]) == c1.votes
                    and int(last_pt["cand2_votes"]) == c2.votes
                ):
                    should_insert = False

            if should_insert:
                conn.execute(
                    """
                    INSERT INTO snapshots_history (
                        dispute_id, election_code, is_replay, created_ts,
                        iso_timestamp, hms_timestamp, pct_counted,
                        cand1_pct, cand2_pct, margin_pp,
                        cand1_votes, cand2_votes, valid_votes, snapshot_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        snapshot.dispute_id,
                        snapshot.election_code_2t,
                        1 if snapshot.is_replay else 0,
                        now,
                        snapshot.generated_at_iso,
                        snapshot.generated_at_hms,
                        snapshot.sections.pct_counted,
                        c1.pct_valid,
                        c2.pct_valid,
                        margin_pp,
                        c1.votes,
                        c2.votes,
                        snapshot.votes.valid_votes,
                        snap_json,
                    ),
                )

    def mark_snapshot_under_verification(
        self, dispute_id: str, error_message: str
    ) -> DisputeSnapshot | None:
        """Mantém o snapshot anterior válido e sinaliza 'Atualização em verificação'."""
        prev = self.get_latest_snapshot(dispute_id)
        if prev is None:
            return None
        prev.validation_status = "em_verificacao"
        prev.validation_message = "Atualização em verificação"
        snap_json = prev.model_dump_json()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE latest_snapshots
                SET validation_status = 'em_verificacao',
                    validation_message = ?,
                    snapshot_json = ?
                WHERE dispute_id = ?
                """,
                (error_message, snap_json, dispute_id),
            )
        return prev

    def get_timeline(
        self, dispute_id: str, is_replay: bool = False, limit: int = 200
    ) -> list[TimelinePoint]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT hms_timestamp, iso_timestamp, pct_counted,
                       cand1_pct, cand2_pct, margin_pp,
                       cand1_votes, cand2_votes, valid_votes
                FROM snapshots_history
                WHERE dispute_id = ? AND is_replay = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (dispute_id, 1 if is_replay else 0, limit),
            ).fetchall()
            return [
                TimelinePoint(
                    timestamp=r["hms_timestamp"],
                    iso_timestamp=r["iso_timestamp"],
                    pct_counted=float(r["pct_counted"]),
                    cand1_pct=float(r["cand1_pct"]),
                    cand2_pct=float(r["cand2_pct"]),
                    margin_cand1_minus_cand2_pp=float(r["margin_pp"]),
                    cand1_votes=int(r["cand1_votes"]),
                    cand2_votes=int(r["cand2_votes"]),
                    valid_votes=int(r["valid_votes"]),
                )
                for r in rows
            ]

    def save_narrator_messages(
        self,
        dispute_id: str,
        messages: list[NarratorMessage],
        is_replay: bool = False,
    ) -> list[NarratorMessage]:
        now = time.time()
        with self._connect() as conn:
            for msg in messages:
                # Evita duplicar exatamente o mesmo texto consecutivo na mesma categoria
                existing = conn.execute(
                    """
                    SELECT text FROM narrator_feed
                    WHERE dispute_id = ? AND is_replay = ? AND category = ?
                    ORDER BY created_ts DESC LIMIT 1
                    """,
                    (dispute_id, 1 if is_replay else 0, msg.category),
                ).fetchone()
                if existing and existing["text"] == msg.text:
                    continue
                conn.execute(
                    """
                    INSERT OR REPLACE INTO narrator_feed (
                        id, dispute_id, is_replay, created_ts,
                        hms_timestamp, category, text, is_estimate
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        msg.id,
                        dispute_id,
                        1 if is_replay else 0,
                        now,
                        msg.timestamp,
                        msg.category,
                        msg.text,
                        1 if msg.is_estimate else 0,
                    ),
                )
        return self.get_narrator_feed(dispute_id, is_replay=is_replay, limit=25)

    def get_narrator_feed(
        self, dispute_id: str, is_replay: bool = False, limit: int = 25
    ) -> list[NarratorMessage]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, hms_timestamp, category, text, is_estimate
                FROM narrator_feed
                WHERE dispute_id = ? AND is_replay = ?
                ORDER BY created_ts DESC, rowid DESC
                LIMIT ?
                """,
                (dispute_id, 1 if is_replay else 0, limit),
            ).fetchall()
            return [
                NarratorMessage(
                    id=r["id"],
                    timestamp=r["hms_timestamp"],
                    category=r["category"],
                    text=r["text"],
                    is_estimate=bool(r["is_estimate"]),
                )
                for r in rows
            ]

    def clear_dispute_history(self, dispute_id: str | None = None, is_replay: bool | None = None) -> None:
        with self._connect() as conn:
            if dispute_id is None and is_replay is None:
                conn.execute("DELETE FROM snapshots_history")
                conn.execute("DELETE FROM narrator_feed")
                conn.execute("DELETE FROM latest_snapshots")
            elif dispute_id is not None and is_replay is not None:
                conn.execute(
                    "DELETE FROM snapshots_history WHERE dispute_id = ? AND is_replay = ?",
                    (dispute_id, 1 if is_replay else 0),
                )
                conn.execute(
                    "DELETE FROM narrator_feed WHERE dispute_id = ? AND is_replay = ?",
                    (dispute_id, 1 if is_replay else 0),
                )

    def log_event(
        self,
        level: str,
        component: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        now = time.time()
        iso = time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(now))
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO system_events (created_ts, iso_timestamp, level, component, message, details_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    now,
                    iso,
                    level.upper(),
                    component,
                    message,
                    json.dumps(details, ensure_ascii=False) if details else None,
                ),
            )

    def get_recent_events(self, limit: int = 30, level: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as conn:
            if level:
                rows = conn.execute(
                    """
                    SELECT id, created_ts, iso_timestamp, level, component, message, details_json
                    FROM system_events
                    WHERE level = ?
                    ORDER BY id DESC LIMIT ?
                    """,
                    (level.upper(), limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, created_ts, iso_timestamp, level, component, message, details_json
                    FROM system_events
                    ORDER BY id DESC LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            return [
                {
                    "id": r["id"],
                    "created_ts": r["created_ts"],
                    "iso_timestamp": r["iso_timestamp"],
                    "level": r["level"],
                    "component": r["component"],
                    "message": r["message"],
                    "details": json.loads(r["details_json"]) if r["details_json"] else None,
                }
                for r in rows
            ]

    def set_poller_state(self, key: str, value: dict[str, Any]) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO poller_status (key, value_json)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
                """,
                (key, json.dumps(value, ensure_ascii=False)),
            )

    def get_poller_state(self, key: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT value_json FROM poller_status WHERE key = ?", (key,)
            ).fetchone()
            if not row:
                return None
            return json.loads(row["value_json"])
