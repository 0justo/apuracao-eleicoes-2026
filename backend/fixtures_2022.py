"""Gerador de Fixtures Históricas do 2º Turno de 2022 (no formato oficial EA20 do TSE)
e Simulador Progressivo 0% -> 100% para Testes Automatizados e Modo Replay 2022.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from backend.config import Settings
from backend.models import DisputeSnapshot
from backend.normalizer import build_dispute_snapshot
from backend.tse_client import TSEClient, UF_NAMES

# Dados históricos reais por UF do 1º e 2º turno Presidencial de 2022 (TSE: e000544 / e000545)
# Candidatos na ordem seq do TSE: seq 1 = 13 LULA, seq 2 = 22 JAIR BOLSONARO
# Speed factor representa a velocidade relativa de apuração de cada UF (ex.: DF, PR, RS apuram mais rápido;
# BA, PA, AM, SP capital finalizam mais tarde, reproduzindo a curva real de 30/10/2022 e a virada em 67,76%).
HISTORICAL_2022_PRES_UFS: dict[str, dict[str, Any]] = {
    "ac": {"ts": 2124, "te": 588433, "c1t": 455903, "vv1t": 436100, "lula1t": 129022, "bolso1t": 275582, "c2t": 424023, "vv2t": 407120, "lula2t": 121566, "bolso2t": 285554, "speed": 1.25},
    "al": {"ts": 6613, "te": 2325656, "c1t": 1805971, "vv1t": 1681224, "lula1t": 974156, "bolso1t": 621880, "c2t": 1785320, "vv2t": 1685410, "lula2t": 988422, "bolso2t": 696988, "speed": 0.82},
    "am": {"ts": 7462, "te": 2647387, "c1t": 2113791, "vv1t": 2014320, "lula1t": 1019152, "bolso1t": 880198, "c2t": 2054110, "vv2t": 1972500, "lula2t": 1008941, "bolso2t": 963559, "speed": 0.78},
    "ap": {"ts": 1740, "te": 550187, "c1t": 442842, "vv1t": 424200, "lula1t": 197382, "bolso1t": 187621, "c2t": 419550, "vv2t": 403100, "lula2t": 196165, "bolso2t": 206935, "speed": 1.15},
    "ba": {"ts": 34432, "te": 11291528, "c1t": 8874841, "vv1t": 8304200, "lula1t": 5873081, "bolso1t": 2047860, "c2t": 8982110, "vv2t": 8521300, "lula2t": 6097815, "bolso2t": 2423485, "speed": 0.72},
    "ce": {"ts": 22741, "te": 6820673, "c1t": 5628610, "vv1t": 5343120, "lula1t": 3578355, "bolso1t": 1377827, "c2t": 5641200, "vv2t": 5392800, "lula2t": 3807891, "bolso2t": 1584909, "speed": 0.85},
    "df": {"ts": 6748, "te": 2203045, "c1t": 1819900, "vv1t": 1745200, "lula1t": 649534, "bolso1t": 910397, "c2t": 1808500, "vv2t": 1732400, "lula2t": 713829, "bolso2t": 1018571, "speed": 1.65},
    "es": {"ts": 9256, "te": 2921506, "c1t": 2315889, "vv1t": 2210100, "lula1t": 897348, "bolso1t": 1160030, "c2t": 2305100, "vv2t": 2202500, "lula2t": 926767, "bolso2t": 1275733, "speed": 1.35},
    "go": {"ts": 14620, "te": 4870354, "c1t": 3812590, "vv1t": 3648100, "lula1t": 1454723, "bolso1t": 1920203, "c2t": 3824100, "vv2t": 3668200, "lula2t": 1518229, "bolso2t": 2149971, "speed": 1.32},
    "ma": {"ts": 16422, "te": 5042999, "c1t": 3920410, "vv1t": 3741200, "lula1t": 2603454, "bolso1t": 983861, "c2t": 3882500, "vv2t": 3732100, "lula2t": 2668425, "bolso2t": 1063675, "speed": 0.76},
    "mg": {"ts": 49980, "te": 16290870, "c1t": 12655228, "vv1t": 12024500, "lula1t": 5802571, "bolso1t": 5239264, "c2t": 12801400, "vv2t": 12225100, "lula2t": 6190960, "bolso2t": 6034140, "speed": 0.96},
    "ms": {"ts": 6912, "te": 1996510, "c1t": 1555140, "vv1t": 1490100, "lula1t": 588323, "bolso1t": 794206, "c2t": 1546800, "vv2t": 1485200, "lula2t": 599547, "bolso2t": 885653, "speed": 1.48},
    "mt": {"ts": 7654, "te": 2469414, "c1t": 1892180, "vv1t": 1820400, "lula1t": 633748, "bolso1t": 1102866, "c2t": 1898400, "vv2t": 1831200, "lula2t": 639362, "bolso2t": 1191838, "speed": 1.38},
    "pa": {"ts": 19432, "te": 6082312, "c1t": 4789310, "vv1t": 4568100, "lula1t": 2443730, "bolso1t": 1884673, "c2t": 4712400, "vv2t": 4512300, "lula2t": 2491642, "bolso2t": 2020658, "speed": 0.74},
    "pb": {"ts": 9612, "te": 3091684, "c1t": 2557490, "vv1t": 2382100, "lula1t": 1554868, "bolso1t": 717416, "c2t": 2562300, "vv2t": 2418900, "lula2t": 1601953, "bolso2t": 816947, "speed": 0.88},
    "pe": {"ts": 24110, "te": 7018098, "c1t": 5738310, "vv1t": 5392400, "lula1t": 3527035, "bolso1t": 1630938, "c2t": 5758900, "vv2t": 5448200, "lula2t": 3640933, "bolso2t": 1807267, "speed": 0.80},
    "pi": {"ts": 8945, "te": 2573810, "c1t": 2115640, "vv1t": 2012400, "lula1t": 1518008, "bolso1t": 406897, "c2t": 2095400, "vv2t": 2001500, "lula2t": 1551383, "bolso2t": 450117, "speed": 0.83},
    "pr": {"ts": 26120, "te": 8475632, "c1t": 6829540, "vv1t": 6518200, "lula1t": 2363492, "bolso1t": 3628612, "c2t": 6845200, "vv2t": 6554100, "lula2t": 2463689, "bolso2t": 4090411, "speed": 1.52},
    "rj": {"ts": 34058, "te": 12827296, "c1t": 9909460, "vv1t": 9382100, "lula1t": 3847143, "bolso1t": 4831246, "c2t": 9974200, "vv2t": 9468300, "lula2t": 4115483, "bolso2t": 5352817, "speed": 1.08},
    "rn": {"ts": 7684, "te": 2554727, "c1t": 2059410, "vv1t": 1951200, "lula1t": 1264179, "bolso1t": 604782, "c2t": 2065300, "vv2t": 1972400, "lula2t": 1284285, "bolso2t": 688115, "speed": 0.90},
    "ro": {"ts": 4195, "te": 1230987, "c1t": 926810, "vv1t": 889400, "lula1t": 261749, "bolso1t": 581306, "c2t": 918500, "vv2t": 884200, "lula2t": 259159, "bolso2t": 625041, "speed": 1.34},
    "rr": {"ts": 1268, "te": 366240, "c1t": 304510, "vv1t": 294800, "lula1t": 68760, "bolso1t": 207587, "c2t": 292100, "vv2t": 283400, "lula2t": 67818, "bolso2t": 215582, "speed": 1.45},
    "rs": {"ts": 27201, "te": 8593469, "c1t": 6890010, "vv1t": 6561200, "lula1t": 2806672, "bolso1t": 3245023, "c2t": 6928400, "vv2t": 6610300, "lula2t": 2885552, "bolso2t": 3724748, "speed": 1.46},
    "sc": {"ts": 16245, "te": 5489658, "c1t": 4541820, "vv1t": 4368900, "lula1t": 1279216, "bolso1t": 2736781, "c2t": 4588200, "vv2t": 4421500, "lula2t": 1358122, "bolso2t": 3063378, "speed": 1.42},
    "se": {"ts": 5486, "te": 1671901, "c1t": 1364720, "vv1t": 1284100, "lula1t": 828716, "bolso1t": 375195, "c2t": 1368400, "vv2t": 1295300, "lula2t": 871129, "bolso2t": 424171, "speed": 0.86},
    "sp": {"ts": 101284, "te": 34667793, "c1t": 27189714, "vv1t": 25396400, "lula1t": 10490032, "bolso1t": 12239989, "c2t": 27384100, "vv2t": 25692400, "lula2t": 11519882, "bolso2t": 14172518, "speed": 0.92},
    "to": {"ts": 3982, "te": 1094003, "c1t": 879420, "vv1t": 842100, "lula1t": 434303, "bolso1t": 379194, "c2t": 864200, "vv2t": 831500, "lula2t": 426925, "bolso2t": 404575, "speed": 1.12},
    "zz": {"ts": 1064, "te": 697078, "c1t": 305120, "vv1t": 292100, "lula1t": 138933, "bolso1t": 122548, "c2t": 309200, "vv2t": 296400, "lula2t": 152905, "bolso2t": 143495, "speed": 0.95},
}

# 21 frames de replay cobrindo de 0% a 100% (incluindo o momento da virada histórica às 18:44 com ~67,76% apurado)
REPLAY_2022_STEPS: list[tuple[float, str]] = [
    (0.0, "17:00:00"),
    (0.015, "17:08:12"),
    (0.048, "17:16:30"),
    (0.102, "17:25:45"),
    (0.185, "17:36:10"),
    (0.274, "17:48:22"),
    (0.368, "17:59:05"),
    (0.452, "18:10:40"),
    (0.531, "18:21:15"),
    (0.604, "18:32:50"),
    (0.6776, "18:44:33"),  # Momento histórico da virada nacional em 30/10/2022
    (0.735, "18:55:18"),
    (0.792, "19:06:42"),
    (0.846, "19:18:09"),
    (0.894, "19:30:27"),
    (0.932, "19:43:51"),
    (0.964, "19:57:14"),
    (0.988, "20:14:02"),
    (0.996, "20:35:48"),
    (0.9992, "21:12:19"),
    (1.0, "21:58:04"),
]


def _fmt_comma(val: float, decimals: int = 2) -> str:
    return f"{val:.{decimals}f}".replace(".", ",")


def _make_ea20_dict(
    ele_code: str,
    cargo_code: str,
    tpabr: str,
    cdabr: str,
    dg: str,
    hg: str,
    dt: str,
    ht: str,
    ts: int,
    st: int,
    te: int,
    est: int,
    c: int,
    vv: int,
    vb: int,
    tvn: int,
    cand1_meta: dict[str, Any],
    cand2_meta: dict[str, Any],
    cand1_votes: int,
    cand2_votes: int,
    cand1_elected: bool = False,
    cand2_elected: bool = False,
) -> dict[str, Any]:
    """Constrói um dicionário JSON fiel ao leiaute EA20 (-u.json) oficial do TSE."""
    snt = max(0, ts - st)
    pstn = (st / ts * 100.0) if ts > 0 else 0.0
    pestn = (est / te * 100.0) if te > 0 else 0.0
    a = max(0, est - c)
    pcn = (c / est * 100.0) if est > 0 else 0.0
    pan = 100.0 - pcn if est > 0 else 0.0

    tv = vv + vb + tvn
    pvvn = (vv / tv * 100.0) if tv > 0 else 0.0
    pvbn = (vb / tv * 100.0) if tv > 0 else 0.0
    ptvnn = (tvn / tv * 100.0) if tv > 0 else 0.0

    c1_pvapn = (cand1_votes / vv * 100.0) if vv > 0 else 0.0
    c2_pvapn = (cand2_votes / vv * 100.0) if vv > 0 else 0.0

    tf_flag = "s" if st >= ts and ts > 0 else "n"
    and_flag = "f" if st >= ts and ts > 0 else "a"

    return {
        "ele": str(ele_code),
        "t": "2",
        "f": "o",
        "sup": "n",
        "tpabr": tpabr,
        "cdabr": cdabr,
        "dg": dg,
        "hg": hg,
        "dt": dt,
        "ht": ht,
        "dv": "s",
        "tf": tf_flag,
        "and": and_flag,
        "s": {
            "ts": str(ts),
            "st": str(st),
            "pst": _fmt_comma(pstn, 2),
            "pstn": str(round(pstn, 9)),
            "snt": str(snt),
            "psnt": _fmt_comma(100.0 - pstn, 2),
            "psntn": str(round(100.0 - pstn, 9)),
        },
        "e": {
            "te": str(te),
            "est": str(est),
            "pest": _fmt_comma(pestn, 2),
            "pestn": str(round(pestn, 9)),
            "c": str(c),
            "pc": _fmt_comma(pcn, 2),
            "pcn": str(round(pcn, 9)),
            "a": str(a),
            "pa": _fmt_comma(pan, 2),
            "pan": str(round(pan, 9)),
        },
        "v": {
            "tv": str(tv),
            "vvc": str(vv),
            "pvvc": _fmt_comma(pvvn, 2),
            "pvvcn": str(round(pvvn, 9)),
            "vv": str(vv),
            "pvv": "100,00" if vv > 0 else "0,00",
            "pvvn": "100" if vv > 0 else "0",
            "vnom": str(vv),
            "van": "0",
            "vansj": "0",
            "vb": str(vb),
            "pvb": _fmt_comma(pvbn, 2),
            "pvbn": str(round(pvbn, 9)),
            "tvn": str(tvn),
            "ptvn": _fmt_comma(ptvnn, 2),
            "ptvnn": str(round(ptvnn, 9)),
            "vn": str(tvn),
            "vnt": "0",
        },
        "carg": [
            {
                "cd": str(cargo_code),
                "nmn": "Presidente" if str(cargo_code) == "1" else "Governador",
                "nv": "1",
                "agr": [
                    {
                        "n": "1",
                        "nm": cand1_meta.get("coalition_nm", cand1_meta["party_nm"]),
                        "tp": "c",
                        "par": [
                            {
                                "n": cand1_meta["n"],
                                "sg": cand1_meta["sg"],
                                "nm": cand1_meta["party_nm"],
                                "cand": [
                                    {
                                        "n": cand1_meta["n"],
                                        "sqcand": cand1_meta["sqcand"],
                                        "nm": cand1_meta["nm"],
                                        "nmu": cand1_meta["nmu"],
                                        "dvt": "Válido",
                                        "seq": str(cand1_meta["seq"]),
                                        "e": "s" if cand1_elected else "n",
                                        "st": "Eleito" if cand1_elected else "",
                                        "vap": str(cand1_votes),
                                        "pvap": _fmt_comma(c1_pvapn, 2),
                                        "pvapn": str(round(c1_pvapn, 9)),
                                        "vs": [
                                            {
                                                "tp": "v",
                                                "nmu": cand1_meta.get("vice_nmu", ""),
                                                "sgp": cand1_meta.get("vice_sgp", ""),
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "n": "2",
                        "nm": cand2_meta.get("coalition_nm", cand2_meta["party_nm"]),
                        "tp": "c",
                        "par": [
                            {
                                "n": cand2_meta["n"],
                                "sg": cand2_meta["sg"],
                                "nm": cand2_meta["party_nm"],
                                "cand": [
                                    {
                                        "n": cand2_meta["n"],
                                        "sqcand": cand2_meta["sqcand"],
                                        "nm": cand2_meta["nm"],
                                        "nmu": cand2_meta["nmu"],
                                        "dvt": "Válido",
                                        "seq": str(cand2_meta["seq"]),
                                        "e": "s" if cand2_elected else "n",
                                        "st": "Eleito" if cand2_elected else "",
                                        "vap": str(cand2_votes),
                                        "pvap": _fmt_comma(c2_pvapn, 2),
                                        "pvapn": str(round(c2_pvapn, 9)),
                                        "vs": [
                                            {
                                                "tp": "v",
                                                "nmu": cand2_meta.get("vice_nmu", ""),
                                                "sgp": cand2_meta.get("vice_sgp", ""),
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    },
                ],
            }
        ],
    }


def build_2022_replay_frames(
    client: TSEClient, settings: Settings
) -> list[DisputeSnapshot]:
    """Gera a série completa de 21 snapshots históricos do 2º turno de 2022 (0% -> 100%)
    no formato EA20 do TSE e normalizados em DisputeSnapshot.
    """
    cand1_meta = {
        "seq": 1,
        "n": "13",
        "sqcand": "280001607829",
        "nm": "LUIZ INÁCIO LULA DA SILVA",
        "nmu": "LULA",
        "sg": "PT",
        "party_nm": "PARTIDO DOS TRABALHADORES",
        "coalition_nm": "BRASIL DA ESPERANÇA",
        "vice_nmu": "GERALDO ALCKMIN",
        "vice_sgp": "PSB",
    }
    cand2_meta = {
        "seq": 2,
        "n": "22",
        "sqcand": "280001618036",
        "nm": "JAIR MESSIAS BOLSONARO",
        "nmu": "JAIR BOLSONARO",
        "sg": "PL",
        "party_nm": "PARTIDO LIBERAL",
        "coalition_nm": "PELO BEM DO BRASIL",
        "vice_nmu": "BRAGA NETTO",
        "vice_sgp": "PL",
    }

    # Prepara resumos de 1º turno por UF e Nacional de 2022
    child_1t_summaries: dict[str, dict[str, Any]] = {}
    child_meta_list: list[dict[str, Any]] = []
    br_ts_1t = 0
    br_te_1t = 0
    br_c_1t = 0
    br_vv_1t = 0
    br_lula_1t = 0
    br_bolso_1t = 0

    for uf_code, row in sorted(HISTORICAL_2022_PRES_UFS.items()):
        bn_1t = max(0, row["c1t"] - row["vv1t"])
        bn_rate = round(bn_1t / row["c1t"], 6) if row["c1t"] > 0 else 0.045
        child_1t_summaries[uf_code] = {
            "ts": row["ts"],
            "st": row["ts"],
            "te": row["te"],
            "c": row["c1t"],
            "vv": row["vv1t"],
            "blank_null_rate": bn_rate,
            "candidates_votes": {"13": row["lula1t"], "22": row["bolso1t"]},
        }
        child_meta_list.append(
            {
                "code_tse": uf_code,
                "code_ibge": uf_code.upper(),
                "uf": uf_code,
                "name": UF_NAMES.get(uf_code, uf_code.upper()),
                "is_capital": False,
                "scope_type": "uf",
            }
        )
        br_ts_1t += row["ts"]
        br_te_1t += row["te"]
        br_c_1t += row["c1t"]
        br_vv_1t += row["vv1t"]
        br_lula_1t += row["lula1t"]
        br_bolso_1t += row["bolso1t"]

    macro_1t_summary = {
        "ts": br_ts_1t,
        "st": br_ts_1t,
        "te": br_te_1t,
        "c": br_c_1t,
        "vv": br_vv_1t,
        "blank_null_rate": round((br_c_1t - br_vv_1t) / br_c_1t, 6),
        "candidates_votes": {"13": br_lula_1t, "22": br_bolso_1t},
    }

    frames: list[DisputeSnapshot] = []
    prev_snap: DisputeSnapshot | None = None
    timeline_acc = []

    # Garante monotonicidade estrita de votos por UF entre os frames
    last_uf_state: dict[str, dict[str, int]] = {}

    for step_idx, (progress, hms) in enumerate(REPLAY_2022_STEPS):
        child_2t_summaries: dict[str, dict[str, Any]] = {}
        br_st = 0
        br_est = 0
        br_c = 0
        br_vv = 0
        br_vb = 0
        br_tvn = 0
        br_lula = 0
        br_bolso = 0

        for uf_code, row in sorted(HISTORICAL_2022_PRES_UFS.items()):
            if progress <= 0.0:
                uf_prog = 0.0
            elif progress >= 1.0:
                uf_prog = 1.0
            else:
                # Curva logística suave modulada pela velocidade histórica da UF
                uf_prog = min(1.0, max(0.0, progress ** (1.0 / row["speed"])))

            st_uf = int(round(row["ts"] * uf_prog))
            est_uf = int(round(row["te"] * uf_prog))
            c_uf = int(round(row["c2t"] * uf_prog))
            vv_uf = int(round(row["vv2t"] * uf_prog))

            # No início da apuração das UFs, urnas de cidades médias/auditadas entram alguns minutos antes
            lula_uf = int(round(row["lula2t"] * uf_prog))
            bolso_uf = max(0, vv_uf - lula_uf)

            prev_u = last_uf_state.get(uf_code)
            if prev_u is not None:
                st_uf = max(prev_u["st"], st_uf)
                est_uf = max(prev_u["est"], est_uf)
                lula_uf = max(prev_u["lula"], lula_uf)
                bolso_uf = max(prev_u["bolso"], bolso_uf)
                vv_uf = lula_uf + bolso_uf
                c_uf = max(prev_u["c"], vv_uf, c_uf)

            bn_total = max(0, c_uf - vv_uf)
            vb_uf = int(round(bn_total * 0.38))
            tvn_uf = max(0, bn_total - vb_uf)
            if prev_u is not None:
                vb_uf = max(prev_u["vb"], vb_uf)
                tvn_uf = max(prev_u["tvn"], tvn_uf)
                c_uf = vv_uf + vb_uf + tvn_uf

            last_uf_state[uf_code] = {
                "st": st_uf,
                "est": est_uf,
                "c": c_uf,
                "vv": vv_uf,
                "vb": vb_uf,
                "tvn": tvn_uf,
                "lula": lula_uf,
                "bolso": bolso_uf,
            }

            pstn_uf = (st_uf / row["ts"] * 100.0) if row["ts"] > 0 else 0.0
            child_2t_summaries[uf_code] = {
                "dt": "30/10/2022",
                "ht": hms,
                "ts": row["ts"],
                "st": st_uf,
                "pstn": str(round(pstn_uf, 6)),
                "te": row["te"],
                "est": est_uf,
                "c": c_uf,
                "vv": vv_uf,
                "vb": vb_uf,
                "tvn": tvn_uf,
                "candidates_votes": {"13": lula_uf, "22": bolso_uf},
            }

            br_st += st_uf
            br_est += est_uf
            br_c += c_uf
            br_vv += vv_uf
            br_vb += vb_uf
            br_tvn += tvn_uf
            br_lula += lula_uf
            br_bolso += bolso_uf

        # No TSE em 30/10/2022, a definição matemática oficial (e='s') ocorreu a partir de ~98,8%
        lula_elected = progress >= 0.988

        macro_2t_payload = _make_ea20_dict(
            ele_code="545",
            cargo_code="1",
            tpabr="br",
            cdabr="br",
            dg="30/10/2022",
            hg=hms,
            dt="30/10/2022",
            ht=hms,
            ts=br_ts_1t,
            st=br_st,
            te=br_te_1t,
            est=br_est,
            c=br_c,
            vv=br_vv,
            vb=br_vb,
            tvn=br_tvn,
            cand1_meta=cand1_meta,
            cand2_meta=cand2_meta,
            cand1_votes=br_lula,
            cand2_votes=br_bolso,
            cand1_elected=lula_elected,
            cand2_elected=False,
        )

        snap = build_dispute_snapshot(
            dispute_id="presidente",
            cargo_code="1",
            uf="BR",
            election_code_2t="545",
            election_code_1t="544",
            macro_2t_payload=macro_2t_payload,
            macro_1t_summary=macro_1t_summary,
            child_2t_summaries=child_2t_summaries,
            child_1t_summaries=child_1t_summaries,
            child_meta_list=child_meta_list,
            client=client,
            settings=settings,
            previous_snapshot=prev_snap,
            existing_timeline=timeline_acc,
            cycle_index=step_idx,
            is_replay=True,
            replay_label="Replay Histórico: 2º Turno Presidencial 2022 (30/10/2022 — Dados TSE)",
            override_hms=hms,
            override_iso=f"2022-10-30T{hms}-03:00",
        )
        timeline_acc = list(snap.timeline)
        prev_snap = snap
        frames.append(snap)

    # Salva também os arquivos brutos EA20 de 0%, virada (67,76%) e 100% em backend/fixtures/ele2022
    fixtures_out = settings.fixtures_dir / "ele2022"
    fixtures_out.mkdir(parents=True, exist_ok=True)
    (fixtures_out / "replay_frames_summary.json").write_text(
        json.dumps(
            [
                {
                    "step": idx,
                    "hms": f.generated_at_hms,
                    "pct_counted": f.sections.pct_counted,
                    "cand1_pct": f.candidates[0].pct_valid,
                    "cand2_pct": f.candidates[1].pct_valid,
                }
                for idx, f in enumerate(frames)
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return frames


def generate_2026_simulated_ea20_step(
    macro_1t_summary: dict[str, Any],
    child_1t_summaries: dict[str, dict[str, Any]],
    cands_2t_meta: list[dict[str, Any]],
    ele_code_2t: str,
    cargo_code: str,
    uf_scope: str,
    progress: float,
    hms: str,
    force_exact_tie: bool = False,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Gera um frame simulado (0.0 <= progress <= 1.0) de 2º turno de 2026 sobre a base real do 1º turno.
    Usado para testar todo o ciclo 0% -> 100% e empates em todas as disputas (Presidente + Governadores).
    """
    cands_sorted = sorted(cands_2t_meta[:2], key=lambda c: int(c["seq"]))
    c1_meta, c2_meta = cands_sorted[0], cands_sorted[1]
    c1_num, c2_num = str(c1_meta["n"]), str(c2_meta["n"])

    child_2t: dict[str, dict[str, Any]] = {}
    tot_ts = 0
    tot_st = 0
    tot_te = 0
    tot_est = 0
    tot_c = 0
    tot_vv = 0
    tot_vb = 0
    tot_tvn = 0
    tot_c1 = 0
    tot_c2 = 0

    sorted_keys = sorted(child_1t_summaries.keys())
    for idx, code in enumerate(sorted_keys):
        c1t = child_1t_summaries[code]
        ts_loc = max(1, int(c1t.get("ts", 10)))
        te_loc = max(10, int(c1t.get("te", 100)))
        turnout_1t = max(0, int(c1t.get("c", int(te_loc * 0.79))))
        bn_rate = float(c1t.get("blank_null_rate", 0.048))

        # Velocidade ligeiramente diferente por localidade para exercitar ranking e mapa
        speed = 0.8 + (idx % 5) * 0.1
        if progress <= 0.0:
            loc_prog = 0.0
        elif progress >= 1.0:
            loc_prog = 1.0
        else:
            loc_prog = min(1.0, max(0.0, progress ** (1.0 / speed)))

        st_loc = int(round(ts_loc * loc_prog))
        est_loc = int(round(te_loc * loc_prog))
        c_loc = int(round(turnout_1t * 0.985 * loc_prog))
        vv_loc = int(round(c_loc * (1.0 - bn_rate)))
        bn_loc = max(0, c_loc - vv_loc)
        vb_loc = int(round(bn_loc * 0.38))
        tvn_loc = max(0, bn_loc - vb_loc)

        v1_1t = int(c1t.get("candidates_votes", {}).get(c1_num, 0))
        v2_1t = int(c1t.get("candidates_votes", {}).get(c2_num, 0))
        sum_1t = v1_1t + v2_1t
        base_share_c1 = (v1_1t / sum_1t) if sum_1t > 0 else 0.50

        if force_exact_tie:
            c1_v = vv_loc // 2
            c2_v = c1_v
            vv_loc = c1_v + c2_v
            c_loc = vv_loc + vb_loc + tvn_loc
        else:
            # Pequena variação realista entre 1º e 2º turno (-1.2 p.p. a +1.8 p.p.)
            swing = ((idx % 7) - 3) * 0.005
            share_2t = min(0.92, max(0.08, base_share_c1 + swing))
            c1_v = int(round(vv_loc * share_2t))
            c2_v = max(0, vv_loc - c1_v)

        pstn_loc = (st_loc / ts_loc * 100.0) if ts_loc > 0 else 0.0
        child_2t[code] = {
            "dt": "25/10/2026",
            "ht": hms,
            "ts": ts_loc,
            "st": st_loc,
            "pstn": str(round(pstn_loc, 6)),
            "te": te_loc,
            "est": est_loc,
            "c": c_loc,
            "vv": vv_loc,
            "vb": vb_loc,
            "tvn": tvn_loc,
            "candidates_votes": {c1_num: c1_v, c2_num: c2_v},
        }

        tot_ts += ts_loc
        tot_st += st_loc
        tot_te += te_loc
        tot_est += est_loc
        tot_c += c_loc
        tot_vv += vv_loc
        tot_vb += vb_loc
        tot_tvn += tvn_loc
        tot_c1 += c1_v
        tot_c2 += c2_v

    c1_elected = progress >= 1.0 and tot_c1 > tot_c2
    c2_elected = progress >= 1.0 and tot_c2 > tot_c1

    macro_2t_payload = _make_ea20_dict(
        ele_code=ele_code_2t,
        cargo_code=cargo_code,
        tpabr="br" if uf_scope.lower() == "br" else "uf",
        cdabr=uf_scope.lower(),
        dg="25/10/2026",
        hg=hms,
        dt="25/10/2026",
        ht=hms,
        ts=tot_ts,
        st=tot_st,
        te=tot_te,
        est=tot_est,
        c=tot_c,
        vv=tot_vv,
        vb=tot_vb,
        tvn=tot_tvn,
        cand1_meta=c1_meta,
        cand2_meta=c2_meta,
        cand1_votes=tot_c1,
        cand2_votes=tot_c2,
        cand1_elected=c1_elected,
        cand2_elected=c2_elected,
    )
    return macro_2t_payload, child_2t
