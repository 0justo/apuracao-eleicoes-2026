# Apuração 2º Turno — Eleições 2026 (`25/10/2026`)

Aplicação web **mobile-first**, neutra e independente para acompanhar a apuração do **2º turno das Eleições Gerais Brasileiras de 2026** (domingo, **25/10/2026**, votação das 8h às 17h e divulgação oficial a partir das **17h00 BRT**) para os cargos de **Presidente da República** e **Governador** (nos estados com 2º turno descobertos dinamicamente a partir da configuração oficial do TSE).

> **Diferencial**: Responder de forma matemática, transparente e estritamente neutra à pergunta **"O que ainda pode mudar nesta apuração?"** (Calculadora da Virada, Onde Ainda Falta Contar, Mapa de Variação 1ºT → 2ºT, Linha do Tempo da Margem com Replay Histórico 2022 e Narrador Automático determinístico).
>
> **Aviso importante**: Este aplicativo **não substitui** a fonte oficial e **não possui afiliação** com o Tribunal Superior Eleitoral (TSE), candidatos, coligações ou partidos políticos. Fonte oficial: [Portal Resultados do TSE](https://resultados.tse.jus.br).

---

## 1. Regras Inegociáveis do Projeto

1. **Neutralidade Política Absoluta**:
   - Proibido usar cores associadas a partidos ou campanhas (como vermelho, azul, amarelo ou verde-amarelo).
   - Paleta divergente neutra e acessível para daltônicos com dupla codificação visual (cor + padrão geométrico):
     - **Posição Oficial 1 (`seq=1` no TSE)**: Violeta (`#6D28D9` / `#5B21B6`) + padrão de listras diagonais (`///`).
     - **Posição Oficial 2 (`seq=2` no TSE)**: Turquesa/Petróleo (`#0F766E` / `#115E59`) + padrão pontilhado (`...`).
   - Ordem fixa e consistente dos candidatos seguindo estritamente o campo `seq` do arquivo oficial `EA20` do TSE.
   - Tratamento simétrico e idêntico aos dois candidatos, sem adjetivos valorativos ou linguagem de torcida.

2. **Proibição de Declaração Própria de Resultado**:
   - O sistema **nunca** escreve `"eleito"`, `"vencedor"`, `"ganhou"`, `"vitória"` ou `"derrota"` por conta própria.
   - O selo **"Eleito (segundo o TSE)"** só é exibido quando o próprio JSON oficial do TSE contém `e == "s"`.

3. **Rotulagem Estrita de Estimativas**:
   - Nenhuma projeção é apresentada como fato. Todo cálculo que envolva votos restantes estimados ($R$), comparecimento esperado ou o Cenário de Referência exibe de forma visível e imediata o rótulo:
     > **"Estimativa do site, não é resultado oficial"**

4. **Aviso Fixo de Fonte e Links `"ver na fonte"`**:
   - Topo fixo em todas as telas:
     > *"Resultado parcial até 100% das urnas apuradas. Fonte: TSE. Atualizado às HH:MM:SS"*
   - Cada métrica relevante inclui link clicável **"ver na fonte"** apontando para o arquivo JSON oficial (`EA20`) e para o [Portal Resultados do TSE](https://resultados.tse.jus.br).

5. **Privacidade e LGPD**:
   - Sem cadastro, sem login, sem cookies de rastreamento individual e sem coleta de dados pessoais.

6. **Respeito à Infraestrutura do TSE (Resolução TSE nº 23.751/2026, arts. 264 a 269)**:
   - Os navegadores dos usuários **NUNCA** fazem requisições diretas aos servidores do TSE (`resultados.tse.jus.br`) — nem para dados JSON, nem para imagens/fotos de candidatos.
   - Apenas o backend realiza polling controlado (intervalo mínimo de 45–60 s por arquivo, enviando `If-None-Match` / `ETag` e `If-Modified-Since`, e inspecionando os arquivos de acompanhamento `EA14`/`EA15` `-ab.json` para buscar apenas localidades cujo timestamp `dt`/`ht` mudou).
   - O frontend lê exclusivamente os snapshots JSON estáticos (`/snapshots/*`) e avatares estáticos (`/avatars/*`) validados e publicados no nosso CDN/armazenamento estático.

---

## 2. Arquitetura e Fluxo de Dados

```
[Servidores TSE / Ambiente Simulação]
          │
          │  1 req a cada 45–60s por arquivo (ETag / If-Modified-Since)
          │  Inspeção prévia de EA14/EA15 (-ab.json)
          ▼
[Backend Python 3.12 + FastAPI + httpx (Poller Assíncrono)]
   ├── Descoberta dinâmica de pleitos e UFs com 2º turno via EA11 (ele-c.json)
   ├── Linha de base do 1º turno 2026 em cache local (backend/data/baseline_1t_2026.json)
   ├── Normalizador + Calculadora da Virada + Narrador Determinístico
   ├── Validador de Sanidade (bloqueia publicação se soma divergir ou % apurado regredir)
   ├── Histórico em SQLite (backend/data/apuracao_2026.sqlite3)
   └── Publicador Atômico de Snapshots JSON Estáticos (public/snapshots/*)
          │
          ▼
[CDN / Armazenamento Estático (Cache-Control: public, max-age=30, stale-while-revalidate=60)]
          │
          ▼
[Frontend PWA React 19 + TypeScript + Vite + Tailwind CSS + d3-geo]
   └── Service Worker (public/sw.js) retém último snapshot válido para resiliência offline
```

### Convenção Oficial de Arquivos do TSE Consumidos pelo Backend

| Código TSE | Convenção de Nome | Finalidade no Sistema |
| :--- | :--- | :--- |
| **EA11** | `comum/config/ele-c.json` | Descoberta automática dos códigos do 1º turno (`6257`/`6259`) e 2º turno (`6258`/`6260`) e de quais UFs possuem 2º turno para Governador (`AC`, `AM`, `DF`, `ES`, `RN`, `TO`). |
| **EA12** | `<ciclo>/<pleito>/config/mun-e<pleito6>-cm.json` | Catálogo oficial dos 5.570 municípios + Exterior com código TSE de 5 dígitos (`cd`) e código IBGE de 7 dígitos (`cdi`). |
| **EA14 / EA15** | `<ciclo>/<pleito>/dados/<uf>/<uf>-e<pleito6>-ab.json` | Acompanhamento de seções e timestamp `dt`/`ht` por UF/município para baixar apenas locais atualizados no ciclo. |
| **EA20** | `<ciclo>/<pleito>/dados/<uf>/<prefixo>-c<cargo4>-e<pleito6>-u.json` | Resultado unificado por cargo (`0001` Presidente, `0003` Governador), contendo seções (`s`), eleitorado/comparecimento (`e`), votos (`v`) e candidatos (`cand` com `seq`, `sqcand`, `n`, `nm`, `nmu`, `vap`, `pvapn`, `e`, `st`). |

---

## 3. Fórmulas Matemáticas e Funcionalidades

### 3.1. Calculadora da Virada
Para cada disputa:
- $V = V_1 + V_2$: votos válidos já apurados dos dois candidatos.
- $A = \min(V_1, V_2)$: votos válidos já apurados do candidato que está momentaneamente atrás.
- Para cada localidade $i$ da disputa, dado o ajuste percentual de comparecimento $\delta \in [-0,20, +0,10]$ escolhido no controle deslizante sobre o comparecimento do 1º turno ($C_{1,i}$):
  $$C_{\text{esp},i}(\delta) = \max\!\left(\text{tv}_i,\; \min\!\left(\text{te}_{2,i},\; C_{1,i} \times (1 + \delta)\right)\right)$$
- Taxa de brancos e nulos $b_i = \frac{\text{vb}_i + \text{tvn}_i}{\text{tv}_i}$ (com fallback documentado para a taxa $b_{1,i}$ do 1º turno quando $\text{tv}_i = 0$ no início da apuração às 17h).
- Votos válidos restantes estimados:
  $$R(\delta) = \sum_i \max\!\left(0,\; C_{\text{esp},i}(\delta) - \text{tv}_i\right) \times (1 - b_i)$$
- Fração necessária dos votos válidos restantes para ultrapassar $50\%$:
  $$s = \frac{\frac{V + R(\delta)}{2} - A}{R(\delta)}$$
- Casos de borda tratados e testados:
  - $s > 100\%$ ou $R = 0$: *"Pelos dados atuais, a diferença supera o total estimado de votos restantes."*
  - $s \le 0\%$: *"Pelos dados atuais, o candidato de referência já soma mais da metade do total estimado de votos válidos."*
  - Empate exato ($V_1 = V_2$): $s = 50,00\%$.

### 3.2. Onde Ainda Falta Contar & Cenário de Referência
- Ranking de UFs e municípios ordenável por **votos válidos restantes estimados** ($R_i$) ou por **% de urnas pendentes**, com sobreposição de quem liderou no 1º turno naquele local e por qual margem.
- Gráfico de barras empilhadas dividindo $R$ entre locais onde o Candidato 1 liderou no 1º turno vs. locais onde o Candidato 2 liderou.
- Aba opcional **"Cenário de referência (estimativa do site)"** (desligada por padrão via `FEATURE_REFERENCE_SCENARIO=false`): aplica a variação média ponderada observada nos locais com $\ge 30\%$ apurado aos votos restantes pendentes, exibindo faixa de incerteza ($\pm 2\sigma$, mínimo $\pm 1,5\text{ p.p.}$).

### 3.3. Mapa de Variação 1ºT → 2ºT
- Duas visões alternáveis: **Mapa Geográfico** (malhas TopoJSON simplificadas do IBGE: `br-ufs.topo.json` com `6,5 KB` e 27 arquivos `<uf>-mun.topo.json` com até `197 KB`) e **Grade de Quadrados (Tile Grid)** para legibilidade idêntica de `DF`, `SE`, `AL`, `RN` e `ES`.
- Zoom por município com carregamento sob demanda e alternância automática/manual entre **SVG** e **HTML5 Canvas** (para estados com centenas de municípios como MG e SP).
- Locais com `< 30%` das seções apuradas recebem **hachura diagonal** sinalizando baixa confiabilidade estatística.

### 3.4. Linha do Tempo da Apuração e Replay Histórico 2022
- Série histórica da margem ($\text{Cand}_1 - \text{Cand}_2$ em pontos percentuais) e do percentual de cada candidato por **% de urnas apuradas** ou por **horário (BRT)**.
- Modo **Replay Histórico 2022**: reproduz em velocidade controlada (`1x`, `2x`, `4x`) ou via barra deslizante os 21 quadros históricos da apuração presidencial do 2º turno de 2022 (`30/10/2022`), incluindo o momento exato da virada aos `67,76%` das seções apuradas (`18:44:12`).

---

## 4. Como Executar Localmente e Rodar os Testes

### Pré-requisitos
- **Node.js** 20+ e `npm`
- **Python** 3.12+ (ambiente virtual em `.venv`)

### Instalação e Execução em Desenvolvimento
```bash
# 1. Instalar dependências frontend
npm install

# 2. Criar/ativar virtualenv Python e instalar dependências do backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 3. Iniciar backend FastAPI (porta 8000)
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 4. Iniciar frontend Vite (porta 5173)
npm run dev
```

### Execução das Suítes de Teste e Benchmark
```bash
# 1. Suíte de testes unitários e de integração do Backend (12 testes pytest)
.venv/bin/pytest -v backend_tests

# 2. Suíte de testes unitários e de contratos do Frontend (8 testes Node test runner)
npm run test:frontend

# 3. Build de produção TypeScript + Vite
npm run build

# 4. Suíte E2E Mobile (390x844) no navegador real (Headless Firefox, 0% -> 100%)
.venv/bin/python3 e2e/mobile_flows.py

# 5. Benchmark de Carga Concorrente (2.000 requisições / 100 clientes simultâneos)
DISABLE_STARTUP_POLLER=1 .venv/bin/python3 scripts/load_test.py
```

---

## 5. Relatório do Teste de Carga (Fase 5)

Executado via `scripts/load_test.py` (relatório salvo em `public/snapshots/load_test_report.json`):
- **Total de requisições**: `2.000` requisições simultâneas (`100` clientes concorrentes) distribuídas entre `/snapshots/catalog.json`, `/snapshots/presidente/latest.json`, `/snapshots/governador-*/latest.json`, `/api/v1/disputes/presidente` e `/health`.
- **Taxa de sucesso**: **100,0% HTTP 200** (`0,0%` de erros).
- **Throughput local (processo único ASGI)**: `~317 req/s` com compressão Brotli/GZip ativa (`1.800` payloads comprimidos) e cabeçalhos `Cache-Control: public, max-age=30, stale-while-revalidate=60` verificados.
- **Requisições disparadas ao TSE pelos clientes**: **`0`** (desacoplamento total garantido).

---

## 6. Instruções de Deploy em Produção

### Backend + Poller (Render / Fly.io / Railway)
1. Utilize o [`Dockerfile`](file:///home/luanpc/Documentos/project1/Dockerfile) na raiz do repositório.
2. Configure as variáveis de ambiente listadas em [`.env.example`](file:///home/luanpc/Documentos/project1/.env.example).
3. Monte um volume persistente em `/app/backend/data` (para o banco SQLite `apuracao_2026.sqlite3` e o cache do 1º turno `baseline_1t_2026.json`) e configure a publicação de `/app/public/snapshots` para o bucket R2/S3 ou CDN.
4. Configure o healthcheck da plataforma para `GET /health`.

### Frontend Estático / PWA (Cloudflare Pages / Vercel)
1. Comando de build: `npm run build`
2. Diretório de saída: `dist`
3. Regra de rewrite SPA: redirecionar rotas de navegação (`/presidente`, `/governador/*`, `/metodologia`, `/status`) para `/index.html`, mantendo cache curto (`max-age=30, stale-while-revalidate=60`) em `/snapshots/*.json` e cache longo (`max-age=86400`) em `/geo/*.topo.json` e `/avatars/*.svg`.

---

## 7. Checklist de Véspera e Dia da Apuração (`24/10/2026` e `25/10/2026`)

- [ ] **Sábado, 24/10/2026 (Véspera — até 18h BRT)**:
  - [ ] Confirmar que `backend/data/baseline_1t_2026.json` está íntegro e contém os resultados finais de 100% do 1º turno (`04/10/2026`) para Presidente (`6257`) e Governadores (`6259`).
  - [ ] Verificar conectividade do backend com `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` (`EA11`) e confirmar os códigos oficiais do 2º turno (`6258` e `6260`) e a lista de UFs com 2º turno.
  - [ ] Validar que o `validator.py` e o banco SQLite de produção estão zerados para a série temporal oficial do 2º turno (`is_replay = 0`).
  - [ ] Testar o disparo do webhook de alerta (`ALERT_WEBHOOK_URL`) simulando atraso $> 5$ minutos.
  - [ ] Confirmar que `FEATURE_REFERENCE_SCENARIO=false` está desligada por padrão.
- [ ] **Domingo, 25/10/2026 — 08h00 às 16h55 BRT (Durante a Votação)**:
  - [ ] Verificar que a tela pré-17h exibe a contagem regressiva até as 17h00 BRT, o resumo da linha de base do 1º turno e todos os contadores do 2º turno em `0,00%` (`waiting_0pct`).
  - [ ] Monitorar `/status` (`GET /api/v1/status`): confirmar ciclos de 60s, respostas `HTTP 304 Not Modified` via `ETag`/`If-Modified-Since` e zero erros 404/429 no TSE.
- [ ] **Domingo, 25/10/2026 — 17h00 às 23h00 BRT (Janela Crítica de Apuração)**:
  - [ ] Confirmar às `17h00` a transição automática para divulgação dos resultados parciais conforme o TSE publicar os primeiros arquivos `EA14`/`EA15`/`EA20`.
  - [ ] Acompanhar a página `/status`: verificar se a idade dos snapshots permanece $< 90\text{s}$ e se todas as verificações de sanidade estão com status `Aprovado (OK)`.
  - [ ] Caso o TSE apresente instabilidade temporária, confirmar que o banner de dados desatualizados (`> 3 min`) e o Service Worker (`sw.js`) mantêm o último snapshot válido visível sem tela em branco.
  - [ ] Verificar ao final da totalização que o selo **"Eleito (segundo o TSE)"** aparece exclusivamente quando o próprio JSON oficial do TSE trouxer `e == "s"`.
