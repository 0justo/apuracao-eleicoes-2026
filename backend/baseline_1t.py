"""Gerenciador de Cache Local da Linha de Base do 1º Turno de 2026 (EA11, EA12, EA14, EA15, EA20).

Extrai e persiste localmente em `backend/data/baseline_1t_2026.json`:
- Mapeamento oficial de municípios (`EA12`: código TSE 5 dígitos, código IBGE 7 dígitos `cdi`, nome, capital).
- Resultado do 1º turno de 2026 para Presidente (`6257`, cargo `1`) por UF e município.
- Resultado do 1º turno de 2026 para Governador (`6259`, cargo `3`) nos estados com 2º turno (por UF e município).
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from backend.models import parse_tse_int
from backend.tse_client import DiscoveredElectionConfig, TSEClient, UF_NAMES


def extract_ea20_summary(payload: dict[str, Any]) -> dict[str, Any]:
    """Extrai métricas essenciais de um arquivo EA20 (-u.json) do TSE."""
    s_block = payload.get("s") or {}
    e_block = payload.get("e") or {}
    v_block = payload.get("v") or {}

    total_sections = parse_tse_int(s_block.get("ts"))
    counted_sections = parse_tse_int(s_block.get("st"))
    total_electorate = parse_tse_int(e_block.get("te"))
    turnout = parse_tse_int(e_block.get("c"))
    abstention = parse_tse_int(e_block.get("a"))

    total_votes = parse_tse_int(v_block.get("tv"))
    valid_votes = parse_tse_int(v_block.get("vv"))
    blank_votes = parse_tse_int(v_block.get("vb"))
    null_votes = parse_tse_int(v_block.get("tvn"))
    annulled_votes = parse_tse_int(v_block.get("van")) + parse_tse_int(
        v_block.get("vansj")
    )

    blank_null_rate = (
        round((blank_votes + null_votes) / total_votes, 6)
        if total_votes > 0
        else 0.048
    )

    candidates_votes: dict[str, int] = {}
    candidates_meta: list[dict[str, Any]] = []

    carg_list = payload.get("carg") or []
    if carg_list:
        for agr in carg_list[0].get("agr", []):
            coalition_nm = str(agr.get("nm", ""))
            for par in agr.get("par", []):
                party_sg = str(par.get("sg", ""))
                party_nm = str(par.get("nm", ""))
                for cand in par.get("cand", []):
                    c_num = str(cand.get("n", "")).strip()
                    c_vap = parse_tse_int(cand.get("vap"))
                    candidates_votes[c_num] = candidates_votes.get(c_num, 0) + c_vap
                    vs_list = cand.get("vs") or []
                    vice_nmu = str(vs_list[0].get("nmu", "")) if vs_list else ""
                    vice_sgp = str(vs_list[0].get("sgp", "")) if vs_list else ""
                    candidates_meta.append(
                        {
                            "seq": parse_tse_int(cand.get("seq"), 99),
                            "n": c_num,
                            "sqcand": str(cand.get("sqcand", "")),
                            "nm": str(cand.get("nm", "")),
                            "nmu": str(cand.get("nmu", "")),
                            "sg": party_sg,
                            "party_nm": party_nm,
                            "coalition_nm": coalition_nm,
                            "vice_nmu": vice_nmu,
                            "vice_sgp": vice_sgp,
                            "e": str(cand.get("e", "n")),
                            "st": str(cand.get("st", "")),
                            "vap": c_vap,
                            "pvap": str(cand.get("pvap", "0,00")),
                            "pvapn": str(cand.get("pvapn", "0")),
                        }
                    )

    candidates_meta.sort(key=lambda c: c["seq"])

    return {
        "dg": str(payload.get("dg", "")),
        "hg": str(payload.get("hg", "")),
        "dt": str(payload.get("dt", "")),
        "ht": str(payload.get("ht", "")),
        "ts": total_sections,
        "st": counted_sections,
        "pst": str(s_block.get("pst", "0,00")),
        "pstn": str(s_block.get("pstn", "0")),
        "te": total_electorate,
        "est": parse_tse_int(e_block.get("est")),
        "c": turnout,
        "pcn": str(e_block.get("pcn", "0")),
        "a": abstention,
        "pan": str(e_block.get("pan", "0")),
        "tv": total_votes,
        "vv": valid_votes,
        "pvvn": str(v_block.get("pvvn", "0")),
        "vb": blank_votes,
        "pvbn": str(v_block.get("pvbn", "0")),
        "tvn": null_votes,
        "ptvnn": str(v_block.get("ptvnn", "0")),
        "annulled": annulled_votes,
        "blank_null_rate": blank_null_rate,
        "candidates_votes": candidates_votes,
        "candidates_meta": candidates_meta,
    }


class Baseline1TStore:
    """Gerencia o cache persistente em disco dos resultados do 1º turno de 2026."""

    def __init__(self, cache_path: Path) -> None:
        self.cache_path = cache_path
        self.data: dict[str, Any] = {
            "cycle": "ele2026",
            "municipalities_by_uf": {},
            "pres_1t": {"br": {}, "ufs": {}, "mun": {}},
            "gov_1t": {"ufs": {}, "mun": {}},
        }
        if self.cache_path.exists():
            try:
                self.data = json.loads(self.cache_path.read_text(encoding="utf-8"))
            except Exception:
                pass

    def is_ready(self, discovered: DiscoveredElectionConfig) -> bool:
        if not self.data.get("pres_1t", {}).get("br"):
            return False
        if len(self.data.get("pres_1t", {}).get("ufs", {})) < 27:
            return False
        for uf in discovered.gov_2t_ufs:
            if uf not in self.data.get("gov_1t", {}).get("ufs", {}):
                return False
            if uf not in self.data.get("gov_1t", {}).get("mun", {}):
                return False
        return True

    def save(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.cache_path.with_suffix(".tmp")
        tmp_path.write_text(
            json.dumps(self.data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        tmp_path.replace(self.cache_path)

    async def ensure_loaded(
        self, client: TSEClient, discovered: DiscoveredElectionConfig
    ) -> dict[str, Any]:
        """Garante que a base do 1º turno de 2026 (UF + municípios) esteja em cache local."""
        if self.is_ready(discovered):
            return self.data

        # 1. Busca catálogo de municípios (EA12)
        cm_url = client.url_mun_cm(discovered.pres_code_1t, cycle=discovered.cycle)
        cm_payload = await client.fetch_json(cm_url, min_interval_seconds=3600)

        muns_by_uf: dict[str, list[dict[str, Any]]] = {}
        for abr in cm_payload.get("abr", []):
            uf_cd = str(abr.get("cd", "")).lower()
            muns_by_uf[uf_cd] = [
                {
                    "cd": str(m.get("cd", "")),
                    "cdi": str(m.get("cdi", "")),
                    "nm": str(m.get("nm", "")),
                    "c": str(m.get("c", "n")) == "s",
                }
                for m in abr.get("mu", [])
            ]
        self.data["municipalities_by_uf"] = muns_by_uf

        # 2. Busca Presidente 1º Turno (Nacional + 27 UFs + ZZ)
        br_1t_url = client.url_resultado_u(
            discovered.pres_code_1t, "1", "br", cycle=discovered.cycle
        )
        br_1t_payload = await client.fetch_json(br_1t_url, min_interval_seconds=3600)
        self.data["pres_1t"]["br"] = extract_ea20_summary(br_1t_payload)

        all_ufs = [uf for uf in UF_NAMES.keys() if uf != "br"]

        async def _fetch_pres_uf_1t(uf_code: str) -> tuple[str, dict[str, Any]]:
            url = client.url_resultado_u(
                discovered.pres_code_1t, "1", uf_code, cycle=discovered.cycle
            )
            payload = await client.fetch_json(url, min_interval_seconds=3600)
            return uf_code, extract_ea20_summary(payload)

        pres_uf_results = await asyncio.gather(
            *[_fetch_pres_uf_1t(u) for u in all_ufs]
        )
        for uf_code, summary in pres_uf_results:
            self.data["pres_1t"]["ufs"][uf_code] = summary

        # 3. Busca Governador 1º Turno nas UFs que têm 2º turno (ex.: AC, AM, DF, ES, RN, TO)
        async def _fetch_gov_uf_1t(uf_code: str) -> tuple[str, dict[str, Any]]:
            url = client.url_resultado_u(
                discovered.gov_code_1t, "3", uf_code, cycle=discovered.cycle
            )
            payload = await client.fetch_json(url, min_interval_seconds=3600)
            return uf_code, extract_ea20_summary(payload)

        gov_uf_results = await asyncio.gather(
            *[_fetch_gov_uf_1t(u) for u in discovered.gov_2t_ufs]
        )
        for uf_code, summary in gov_uf_results:
            self.data["gov_1t"]["ufs"][uf_code] = summary

        # 4. Para os estados com 2º turno de governador, busca os arquivos municipais do 1º turno
        # (Governador e Presidente) para ter a linha de base exata de cada município.
        for uf_code in discovered.gov_2t_ufs:
            uf_muns = muns_by_uf.get(uf_code, [])
            if (
                uf_code in self.data["gov_1t"]["mun"]
                and len(self.data["gov_1t"]["mun"][uf_code]) == len(uf_muns)
                and uf_code in self.data["pres_1t"]["mun"]
                and len(self.data["pres_1t"]["mun"][uf_code]) == len(uf_muns)
            ):
                continue

            async def _fetch_mun_pair(
                u: str, m_cd: str
            ) -> tuple[str, dict[str, Any], dict[str, Any]]:
                gov_url = client.url_resultado_u(
                    discovered.gov_code_1t, "3", u, m_cd, cycle=discovered.cycle
                )
                pres_url = client.url_resultado_u(
                    discovered.pres_code_1t, "1", u, m_cd, cycle=discovered.cycle
                )
                g_pay, p_pay = await asyncio.gather(
                    client.fetch_json(gov_url, min_interval_seconds=3600),
                    client.fetch_json(pres_url, min_interval_seconds=3600),
                )
                return m_cd, extract_ea20_summary(g_pay), extract_ea20_summary(p_pay)

            pair_results = await asyncio.gather(
                *[_fetch_mun_pair(uf_code, m["cd"]) for m in uf_muns]
            )
            self.data["gov_1t"]["mun"][uf_code] = {}
            self.data["pres_1t"]["mun"][uf_code] = {}
            for m_cd, g_sum, p_sum in pair_results:
                self.data["gov_1t"]["mun"][uf_code][m_cd] = g_sum
                self.data["pres_1t"]["mun"][uf_code][m_cd] = p_sum

        self.save()
        return self.data

    async def ensure_pres_municipalities_1t_for_uf(
        self, client: TSEClient, discovered: DiscoveredElectionConfig, uf_code: str
    ) -> dict[str, dict[str, Any]]:
        """Carrega sob demanda (e salva em cache) o 1º turno municipal de Presidente para uma UF."""
        uf_l = uf_code.lower()
        uf_muns = self.data.get("municipalities_by_uf", {}).get(uf_l, [])
        existing = self.data.get("pres_1t", {}).get("mun", {}).get(uf_l, {})
        if existing and len(existing) >= len(uf_muns):
            return existing

        async def _fetch_one(m_cd: str) -> tuple[str, dict[str, Any]]:
            url = client.url_resultado_u(
                discovered.pres_code_1t, "1", uf_l, m_cd, cycle=discovered.cycle
            )
            payload = await client.fetch_json(url, min_interval_seconds=3600)
            return m_cd, extract_ea20_summary(payload)

        results = await asyncio.gather(*[_fetch_one(m["cd"]) for m in uf_muns])
        self.data.setdefault("pres_1t", {}).setdefault("mun", {})[uf_l] = {
            m_cd: summary for m_cd, summary in results
        }
        self.save()
        return self.data["pres_1t"]["mun"][uf_l]
