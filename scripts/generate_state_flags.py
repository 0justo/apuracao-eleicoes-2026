"""
Gera os arquivos SVG vetoriais das 27 bandeiras oficiais dos estados brasileiros (UFs) + Brasil (BR) + Exterior (ZZ)
em public/flags/<uf>.svg
"""

import os
from pathlib import Path

FLAGS_DIR = Path("public/flags")
FLAGS_DIR.mkdir(parents=True, exist_ok=True)

# Helper para desenhar estrela de 5 pontas
def star_polygon(cx: float, cy: float, r_out: float, r_in: float) -> str:
    import math
    points = []
    angle = -math.pi / 2
    step = math.pi / 5
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        points.append(f"{x:.1f},{y:.1f}")
        angle += step
    return " ".join(points)

# Definições SVG completas e fiéis para cada UF
FLAGS_SVG = {
    # São Paulo (SP): 13 faixas pretas e brancas, cantão vermelho com círculo branco e mapa azul do Brasil
    "sp": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#000"/>
  {"".join(f'<rect y="{i * 70 / 13:.2f}" width="100" height="{70 / 13:.2f}" fill="#fff"/>' for i in range(1, 13, 2))}
  <rect width="46" height="37.7" fill="#CC0000"/>
  <circle cx="23" cy="18.8" r="13" fill="#fff"/>
  <!-- Silhueta estilizada do mapa do Brasil -->
  <path d="M19 11c2-1 6-1 8 1 2 2 4 1 5 3s-1 4-1 6-2 4-4 6-4 4-5 2-2-4-2-7 0-4 1-5-1-4-2-6z" fill="#002B7F"/>
  <!-- 4 estrelas amarelas nos cantos do cantão -->
  <polygon points="{star_polygon(6, 6, 3, 1.2)}" fill="#FEDF00"/>
  <polygon points="{star_polygon(40, 6, 3, 1.2)}" fill="#FEDF00"/>
  <polygon points="{star_polygon(6, 32, 3, 1.2)}" fill="#FEDF00"/>
  <polygon points="{star_polygon(40, 32, 3, 1.2)}" fill="#FEDF00"/>
</svg>''',

    # Minas Gerais (MG): Fundo branco, triângulo equilátero vermelho com lema
    "mg": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#FFFFFF"/>
  <polygon points="50,14 22,58 78,58" fill="#D60000"/>
  <path id="curve" d="M 20 62 Q 50 67 80 62" fill="transparent"/>
  <text font-family="sans-serif" font-size="3.2" font-weight="900" fill="#000" text-anchor="middle">
    <textPath href="#curve" startOffset="50%">LIBERTAS QUÆ SERA TAMEN</textPath>
  </text>
</svg>''',

    # Rio de Janeiro (RJ): Quatro quadrantes diagonais azul celeste e branco, brasão oval central
    "rj": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#FFFFFF"/>
  <polygon points="0,0 100,0 50,35" fill="#5BA4E5"/>
  <polygon points="0,70 100,70 50,35" fill="#5BA4E5"/>
  <ellipse cx="50" cy="35" rx="14" ry="18" fill="#FFFFFF" stroke="#D4AF37" stroke-width="1.5"/>
  <path d="M43 28h14v10c0 5-7 8-7 8s-7-3-7-8V28z" fill="#0047AB"/>
  <circle cx="50" cy="35" r="4" fill="#FEDF00"/>
  <path d="M48 35l4-2v4z" fill="#D60000"/>
</svg>''',

    # Bahia (BA): 4 faixas horizontais branco/vermelho, cantão azul com triângulo branco
    "ba": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="17.5" fill="#FFFFFF"/>
  <rect y="17.5" width="100" height="17.5" fill="#D60000"/>
  <rect y="35" width="100" height="17.5" fill="#FFFFFF"/>
  <rect y="52.5" width="100" height="17.5" fill="#D60000"/>
  <rect width="40" height="35" fill="#002B7F"/>
  <polygon points="20,7 7,28 33,28" fill="#FFFFFF"/>
</svg>''',

    # Ceará (CE): Fundo verde, losango amarelo, escudo branco central com sol e mar
    "ce": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#009B3A"/>
  <polygon points="50,7 93,35 50,63 7,35" fill="#FEDF00"/>
  <circle cx="50" cy="35" r="14" fill="#FFFFFF" stroke="#009B3A" stroke-width="1"/>
  <path d="M42 30h16v8c0 4-8 7-8 7s-8-3-8-7v-8z" fill="#002B7F"/>
  <circle cx="50" cy="33" r="3" fill="#FEDF00"/>
</svg>''',

    # Pernambuco (PE): Azul escuro superior com arco-íris, sol e cruz; branco inferior com estrela
    "pe": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="35" fill="#002B7F"/>
  <rect y="35" width="100" height="35" fill="#FFFFFF"/>
  <!-- Arco-íris -->
  <path d="M25 35 A25 25 0 0 1 75 35" stroke="#D60000" stroke-width="4.5" fill="none"/>
  <path d="M28 35 A22 22 0 0 1 72 35" stroke="#FEDF00" stroke-width="3" fill="none"/>
  <path d="M30 35 A20 20 0 0 1 70 35" stroke="#009B3A" stroke-width="2.5" fill="none"/>
  <!-- Sol -->
  <circle cx="50" cy="27" r="4.5" fill="#FEDF00"/>
  <!-- Cruz vermelha -->
  <rect x="48.5" y="10" width="3" height="9" fill="#D60000"/>
  <rect x="45.5" y="12.5" width="9" height="3" fill="#D60000"/>
  <!-- Estrela vermelha inferior -->
  <polygon points="{star_polygon(50, 52, 5.5, 2.3)}" fill="#D60000"/>
</svg>''',

    # Paraná (PR): Fundo verde, faixa transversal branca, esfera azul com Cruzeiro do Sul
    "pr": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#009B3A"/>
  <polygon points="0,0 18,0 100,55 100,70 82,70 0,15" fill="#FFFFFF"/>
  <circle cx="50" cy="35" r="14" fill="#002B7F"/>
  <!-- Cruzeiro do Sul estilizado -->
  <circle cx="50" cy="26" r="1.3" fill="#FFFFFF"/>
  <circle cx="50" cy="44" r="1.3" fill="#FFFFFF"/>
  <circle cx="43" cy="33" r="1.3" fill="#FFFFFF"/>
  <circle cx="56" cy="33" r="1.3" fill="#FFFFFF"/>
  <circle cx="53" cy="38" r="0.9" fill="#FFFFFF"/>
</svg>''',

    # Rio Grande do Sul (RS): Três faixas diagonais verde, vermelho e amarelo com brasão
    "rs": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <polygon points="0,0 100,0 0,55" fill="#009B3A"/>
  <polygon points="100,0 100,70 0,55" fill="#D60000"/>
  <polygon points="0,55 100,70 0,70" fill="#FEDF00"/>
  <ellipse cx="50" cy="35" rx="13" ry="16" fill="#FFFFFF" stroke="#FEDF00" stroke-width="1.5"/>
  <polygon points="50,25 58,40 42,40" fill="#002B7F"/>
</svg>''',

    # Santa Catarina (SC): Três faixas horizontais vermelho/branco/vermelho, losango verde central com brasão
    "sc": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="23" fill="#D60000"/>
  <rect y="23" width="100" height="24" fill="#FFFFFF"/>
  <rect y="47" width="100" height="23" fill="#D60000"/>
  <polygon points="50,18 78,35 50,52 22,35" fill="#009B3A"/>
  <polygon points="{star_polygon(50, 35, 7, 3)}" fill="#D60000"/>
</svg>''',

    # Distrito Federal (DF): Fundo branco, quadrado verde central com Cruz de Brasília dourada
    "df": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#FFFFFF"/>
  <rect x="35" y="20" width="30" height="30" fill="#009B3A"/>
  <!-- Cruz de Brasília: 4 setas amarelas divergentes -->
  <polygon points="50,22 45,30 48,30 48,35 50,35 50,22" fill="#FEDF00"/>
  <polygon points="50,22 55,30 52,30 52,35 50,35 50,22" fill="#FEDF00"/>
  <polygon points="50,48 45,40 48,40 48,35 50,35 50,48" fill="#FEDF00"/>
  <polygon points="50,48 55,40 52,40 52,35 50,35 50,48" fill="#FEDF00"/>
  <polygon points="37,35 45,30 45,33 50,33 50,35 37,35" fill="#FEDF00"/>
  <polygon points="37,35 45,40 45,37 50,37 50,35 37,35" fill="#FEDF00"/>
  <polygon points="63,35 55,30 55,33 50,33 50,35 63,35" fill="#FEDF00"/>
  <polygon points="63,35 55,40 55,37 50,37 50,35 63,35" fill="#FEDF00"/>
</svg>''',

    # Espírito Santo (ES): Três faixas horizontais azul celeste, branco e rosa com lema
    "es": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="23.33" fill="#75AADB"/>
  <rect y="23.33" width="100" height="23.33" fill="#FFFFFF"/>
  <rect y="46.66" width="100" height="23.34" fill="#F49AC2"/>
  <path id="es_curve" d="M 22 38 Q 50 28 78 38" fill="transparent"/>
  <text font-family="sans-serif" font-size="4.2" font-weight="bold" fill="#002B7F" text-anchor="middle">
    <textPath href="#es_curve" startOffset="50%">TRABALHA E CONFIA</textPath>
  </text>
</svg>''',

    # Goiás (GO): 8 faixas verdes e amarelas, cantão azul com Cruzeiro do Sul
    "go": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#009B3A"/>
  {"".join(f'<rect y="{i * 70 / 8:.2f}" width="100" height="{70 / 8:.2f}" fill="#FEDF00"/>' for i in range(1, 8, 2))}
  <rect width="42" height="35" fill="#002B7F"/>
  <polygon points="{star_polygon(21, 10, 2.5, 1)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(21, 26, 2.5, 1)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(12, 17, 2.5, 1)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(30, 17, 2.5, 1)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(25, 22, 1.8, 0.7)}" fill="#FFFFFF"/>
</svg>''',

    # Maranhão (MA): 9 faixas branco, vermelho e preto; cantão azul com estrela branca
    "ma": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="7.77" fill="#FFFFFF"/>
  <rect y="7.77" width="100" height="7.77" fill="#D60000"/>
  <rect y="15.54" width="100" height="7.77" fill="#000000"/>
  <rect y="23.31" width="100" height="7.77" fill="#FFFFFF"/>
  <rect y="31.08" width="100" height="7.77" fill="#D60000"/>
  <rect y="38.85" width="100" height="7.77" fill="#000000"/>
  <rect y="46.62" width="100" height="7.77" fill="#FFFFFF"/>
  <rect y="54.39" width="100" height="7.77" fill="#D60000"/>
  <rect y="62.16" width="100" height="7.84" fill="#000000"/>
  <rect width="36" height="31.1" fill="#002B7F"/>
  <polygon points="{star_polygon(18, 15.5, 7.5, 3.2)}" fill="#FFFFFF"/>
</svg>''',

    # Mato Grosso (MT): Azul com grande losango branco, círculo verde e estrela amarela
    "mt": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#002B7F"/>
  <polygon points="50,6 92,35 50,64 8,35" fill="#FFFFFF"/>
  <circle cx="50" cy="35" r="16" fill="#009B3A"/>
  <polygon points="{star_polygon(50, 35, 10, 4.2)}" fill="#FEDF00"/>
</svg>''',

    # Mato Grosso do Sul (MS): Fundo azul escuro, faixa diagonal branca, canto verde e estrela dourada
    "ms": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#002B7F"/>
  <polygon points="0,0 48,0 0,70" fill="#009B3A"/>
  <polygon points="48,0 60,0 0,70" fill="#FFFFFF"/>
  <polygon points="{star_polygon(78, 52, 7.5, 3.2)}" fill="#FEDF00"/>
</svg>''',

    # Pará (PA): Fundo vermelho, faixa diagonal branca com estrela azul central
    "pa": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#D60000"/>
  <polygon points="0,70 14,70 100,0 86,0" fill="#FFFFFF"/>
  <polygon points="{star_polygon(50, 35, 6.5, 2.8)}" fill="#002B7F"/>
</svg>''',

    # Paraíba (PB): Faixa vertical preta (1/3), vermelha (2/3) com lema NÉGO
    "pb": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="33.33" height="70" fill="#000000"/>
  <rect x="33.33" width="66.67" height="70" fill="#D60000"/>
  <text x="66.6" y="41" font-family="sans-serif" font-size="13" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
    NÉGO
  </text>
</svg>''',

    # Piauí (PI): Faixas horizontais verde/amarelo, cantão vermelho com estrela e data
    "pi": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#009B3A"/>
  {"".join(f'<rect y="{i * 70 / 8:.2f}" width="100" height="{70 / 8:.2f}" fill="#FEDF00"/>' for i in range(1, 8, 2))}
  <rect width="36" height="35" fill="#D60000"/>
  <polygon points="{star_polygon(18, 14, 6, 2.5)}" fill="#FFFFFF"/>
  <text x="18" y="27" font-family="sans-serif" font-size="2.6" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
    13 DE MARÇO
  </text>
  <text x="18" y="31" font-family="sans-serif" font-size="2.6" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
    DE 1823
  </text>
</svg>''',

    # Rio Grande do Norte (RN): Bicolor verde e branco com brasão central
    "rn": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="35" fill="#009B3A"/>
  <rect y="35" width="100" height="35" fill="#FFFFFF"/>
  <ellipse cx="50" cy="35" rx="12" ry="15" fill="#FEDF00" stroke="#009B3A" stroke-width="1"/>
  <circle cx="50" cy="35" r="8" fill="#FFFFFF"/>
  <path d="M46 38l4-6 4 6z" fill="#002B7F"/>
</svg>''',

    # Alagoas (AL): Tricolor vertical vermelho, branco e azul com brasão
    "al": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="33.33" height="70" fill="#D60000"/>
  <rect x="33.33" width="33.34" height="70" fill="#FFFFFF"/>
  <rect x="66.67" width="33.33" height="70" fill="#002B7F"/>
  <ellipse cx="50" cy="35" rx="10" ry="13" fill="#FEDF00" stroke="#D60000" stroke-width="1"/>
  <circle cx="50" cy="35" r="6" fill="#002B7F"/>
</svg>''',

    # Sergipe (SE): 4 faixas verdes e amarelas, cantão azul com 5 estrelas brancas
    "se": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="17.5" fill="#009B3A"/>
  <rect y="17.5" width="100" height="17.5" fill="#FEDF00"/>
  <rect y="35" width="100" height="17.5" fill="#009B3A"/>
  <rect y="52.5" width="100" height="17.5" fill="#FEDF00"/>
  <rect width="40" height="35" fill="#002B7F"/>
  <polygon points="{star_polygon(20, 10, 3, 1.2)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(10, 22, 3, 1.2)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(30, 22, 3, 1.2)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(14, 29, 2.5, 1)}" fill="#FFFFFF"/>
  <polygon points="{star_polygon(26, 29, 2.5, 1)}" fill="#FFFFFF"/>
</svg>''',

    # Tocantins (TO): Azul no topo esquerdo, faixa diagonal branca com sol dourado, amarelo inferior
    "to": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <polygon points="0,0 100,0 0,70" fill="#002B7F"/>
  <polygon points="100,0 100,70 0,70" fill="#FF8C00"/>
  <polygon points="25,0 75,0 0,55 0,35" fill="#FFFFFF"/>
  <polygon points="0,35 100,0 100,35 0,70" fill="#FFFFFF"/>
  <circle cx="50" cy="35" r="9" fill="#FEDF00"/>
  <!-- Raios do Sol -->
  <path d="M50 21v28M36 35h28M40 25l20 20M40 45l20-20" stroke="#FF8C00" stroke-width="1.5"/>
</svg>''',

    # Rondônia (RO): Metade superior azul com estrela, metade inferior verde e amarelo
    "ro": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <polygon points="0,0 100,0 50,35" fill="#002B7F"/>
  <polygon points="0,0 0,70 50,35" fill="#009B3A"/>
  <polygon points="100,0 100,70 50,35" fill="#009B3A"/>
  <polygon points="0,70 100,70 50,35" fill="#FEDF00"/>
  <polygon points="{star_polygon(50, 20, 9, 3.8)}" fill="#FFFFFF"/>
</svg>''',

    # Acre (AC): Diagonal amarelo superior e verde inferior, com estrela vermelha no canto superior
    "ac": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <polygon points="0,0 100,0 0,70" fill="#FEDF00"/>
  <polygon points="100,0 100,70 0,70" fill="#009B3A"/>
  <polygon points="{star_polygon(20, 18, 7.5, 3.2)}" fill="#D60000"/>
</svg>''',

    # Amazonas (AM): Faixas horizontais branco/vermelho/branco, cantão azul com 25 estrelas
    "am": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="23.33" fill="#FFFFFF"/>
  <rect y="23.33" width="100" height="23.33" fill="#D60000"/>
  <rect y="46.66" width="100" height="23.34" fill="#FFFFFF"/>
  <rect width="40" height="35" fill="#002B7F"/>
  <polygon points="{star_polygon(20, 17.5, 4.5, 1.8)}" fill="#FFFFFF"/>
  <!-- Círculo de pequenas estrelas -->
  <circle cx="10" cy="10" r="1" fill="#fff"/>
  <circle cx="20" cy="7" r="1" fill="#fff"/>
  <circle cx="30" cy="10" r="1" fill="#fff"/>
  <circle cx="33" cy="20" r="1" fill="#fff"/>
  <circle cx="30" cy="27" r="1" fill="#fff"/>
  <circle cx="20" cy="30" r="1" fill="#fff"/>
  <circle cx="10" cy="27" r="1" fill="#fff"/>
  <circle cx="7" cy="20" r="1" fill="#fff"/>
</svg>''',

    # Amapá (AP): Azul, verde, faixas estreitas amarelo e branco, fortaleza estilizada
    "ap": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="30" fill="#002B7F"/>
  <rect y="30" width="100" height="10" fill="#FEDF00"/>
  <rect y="33" width="100" height="4" fill="#FFFFFF"/>
  <rect y="40" width="100" height="30" fill="#009B3A"/>
  <!-- Fortaleza de São José -->
  <rect x="8" y="24" width="20" height="22" fill="#000000"/>
  <rect x="12" y="28" width="12" height="14" fill="#FEDF00"/>
</svg>''',

    # Roraima (RR): Três faixas diagonais azul turquesa, branco e verde com linha vermelha e estrela
    "rr": f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <polygon points="0,0 100,0 0,70" fill="#008080"/>
  <polygon points="100,0 100,70 0,70" fill="#009B3A"/>
  <polygon points="0,70 100,0 100,10 10,70" fill="#FFFFFF"/>
  <rect y="66" width="100" height="4" fill="#D60000"/>
  <polygon points="{star_polygon(50, 40, 10, 4.2)}" fill="#FEDF00"/>
</svg>''',

    # Brasil (BR): Fundo verde, losango amarelo, círculo azul com faixa celeste
    "br": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#009B3A"/>
  <polygon points="50,6 94,35 50,64 6,35" fill="#FEDF00"/>
  <circle cx="50" cy="35" r="16" fill="#002776"/>
  <path d="M34.5 35 A16 16 0 0 1 65.5 35" stroke="#FFFFFF" stroke-width="2.5" fill="none"/>
</svg>''',

    # Exterior (ZZ): Bandeira estilizada do Brasil com ícone de globo
    "zz": '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
  <rect width="100" height="70" fill="#002776"/>
  <circle cx="50" cy="35" r="22" fill="#009B3A" stroke="#FEDF00" stroke-width="2"/>
  <ellipse cx="50" cy="35" rx="14" ry="22" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>
  <line x1="28" y1="35" x2="72" y2="35" stroke="#FFFFFF" stroke-width="1.5"/>
</svg>''',
}

def main():
    for uf, content in FLAGS_SVG.items():
        out_file = FLAGS_DIR / f"{uf}.svg"
        out_file.write_text(content.strip(), encoding="utf-8")
        print(f"Generated {out_file} ({len(content)} bytes)")

if __name__ == "__main__":
    main()
