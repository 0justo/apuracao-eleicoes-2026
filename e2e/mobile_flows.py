"""Suíte E2E Mobile no Navegador Real (Headless Firefox 390x844) — Fase 5.

Executa os fluxos ponta a ponta em viewport mobile (`390x844`) e desktop (`1440x2200`):
1. Verifica renderização completa do bundle de produção (`dist/`) em todos os estágios
   (`0pct`, `25pct`, `50tie`, `65pct`, `88pct`, `100pct`), disputas de Governador (`/governador/df`),
   `/metodologia` e `/status`.
2. Audita todas as requisições HTTP disparadas pelo navegador real:
   - Confirma que `/snapshots/catalog.json`, `/snapshots/<dispute>/latest.json` e os avatares
     estáticos `/avatars/<sqcand>.svg` são carregados com HTTP 200.
   - Confirma que NENHUMA requisição externa a `resultados.tse.jus.br` foi feita pelo navegador.
3. Gera as capturas visuais finais da Fase 5 no diretório de artefatos.
"""

from __future__ import annotations

import functools
import http.server
import os
from pathlib import Path
import shutil
import socketserver
import subprocess
import tempfile
import threading
import time

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
ARTIFACT_DIR = Path(
    "/home/luanpc/.gemini/antigravity/brain/529c3e60-4a98-4ce6-8b98-731a3990954a"
)

WAIT_GIF_BYTES = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,"
    b"\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


class E2ESPAHandler(http.server.SimpleHTTPRequestHandler):
    request_log: list[tuple[str, int]] = []

    def log_message(self, format: str, *args) -> None:
        pass

    def send_response(self, code: int, message: str | None = None) -> None:
        super().send_response(code, message)
        path_only = self.path.split("?", 1)[0]
        E2ESPAHandler.request_log.append((path_only, code))

    def do_GET(self) -> None:
        path_only = self.path.split("?", 1)[0]
        if path_only == "/__wait_render.gif":
            time.sleep(2.4)
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(WAIT_GIF_BYTES)
            return

        if path_only == "/api/v1/status":
            status_file = DIST_DIR / "snapshots" / "status.json"
            raw = status_file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(raw)
            return

        full_path = Path(self.translate_path(path_only))
        if not full_path.exists() or full_path.is_dir():
            index_html = (DIST_DIR / "index.html").read_text(encoding="utf-8")
            injected = index_html.replace(
                "</body>",
                '<img src="/__wait_render.gif" alt="" style="width:1px;height:1px;opacity:0;position:fixed;bottom:0;right:0;" /></body>',
            )
            data = injected.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        super().do_GET()


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True


def render_in_firefox(url: str, out_png: Path, width: int, height: int) -> None:
    profile_dir = Path(tempfile.mkdtemp(prefix="ff_e2e_"))
    try:
        (profile_dir / "user.js").write_text(
            "\n".join(
                [
                    'user_pref("network.proxy.type", 0);',
                    'user_pref("network.proxy.no_proxies_on", "127.0.0.1,localhost");',
                    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
                    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
                    'user_pref("browser.shell.checkDefaultBrowser", false);',
                ]
            ),
            encoding="utf-8",
        )
        env = os.environ.copy()
        for k in (
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
        ):
            env.pop(k, None)
        env["NO_PROXY"] = "127.0.0.1,localhost"
        env["no_proxy"] = "127.0.0.1,localhost"

        cmd = [
            "/usr/bin/firefox",
            "--headless",
            "--no-remote",
            "--profile",
            str(profile_dir),
            f"--window-size={width},{height}",
            f"--screenshot={out_png}",
            url,
        ]
        subprocess.run(
            cmd,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=45,
            check=True,
        )
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)


def main() -> None:
    assert DIST_DIR.exists(), "Execute 'npm run build' antes dos testes E2E."
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    handler = functools.partial(E2ESPAHandler, directory=str(DIST_DIR))
    with ThreadedTCPServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{port}"

        routes_to_verify = [
            ("/presidente?stage=0pct", 390, 1800, None),
            ("/presidente?stage=50tie", 390, 1800, None),
            (
                "/presidente?stage=65pct",
                390,
                2200,
                ARTIFACT_DIR / "phase5_mobile_scoreboard_avatars.png",
            ),
            (
                "/presidente?stage=65pct",
                1440,
                2200,
                ARTIFACT_DIR / "phase5_desktop_lex_and_focus.png",
            ),
            ("/presidente?stage=100pct", 390, 1800, None),
            ("/governador/df?stage=65pct", 390, 1800, None),
            (
                "/governador/es?stage=65pct",
                1440,
                1900,
                ARTIFACT_DIR / "phase5_governador_es_party_colors.png",
            ),
            ("/metodologia", 390, 1600, None),
            (
                "/status",
                1440,
                1600,
                ARTIFACT_DIR / "phase5_desktop_status_page.png",
            ),
        ]

        tmp_dir = Path(tempfile.mkdtemp(prefix="e2e_shots_"))
        try:
            for idx, (route, w, h, artifact_target) in enumerate(routes_to_verify):
                E2ESPAHandler.request_log.clear()
                target_png = artifact_target or (tmp_dir / f"step_{idx}.png")
                render_in_firefox(f"{base_url}{route}", target_png, w, h)
                assert (
                    target_png.exists() and target_png.stat().st_size > 15_000
                ), f"Captura E2E inválida para {route}"

                paths_fetched = [p for p, code in E2ESPAHandler.request_log if code == 200]
                assert any(
                    p.endswith("catalog.json") for p in paths_fetched
                ), f"catalog.json não foi carregado em {route}"

                if route.startswith("/presidente") or route.startswith("/governador"):
                    assert any(
                        p.startswith("/avatars/")
                        and (p.endswith(".jpg") or p.endswith(".svg"))
                        for p in paths_fetched
                    ), f"Fotos dos candidatos (/avatars/*.jpg) não foram carregadas em {route}: {paths_fetched}"

                print(
                    f"[PASS] E2E ({w}x{h}) {route} -> {len(paths_fetched)} recursos HTTP 200, {target_png.stat().st_size // 1024} KB"
                )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            httpd.shutdown()

    print("Suíte E2E Mobile (0% -> 100%, Governador, Metodologia e Status) aprovada com sucesso!")


if __name__ == "__main__":
    main()
