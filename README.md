# Apuração 2º Turno — Eleições 2026 (`25/10/2026`)

Aplicação web **mobile-first** e de **alta performance** desenvolvida para acompanhar a apuração do **2º turno das Eleições Gerais Brasileiras de 2026** (domingo, **25 de outubro de 2026**, votação das 8h às 17h e divulgação oficial dos resultados a partir das **17h00 BRT**) para os cargos de **Presidente da República** e **Governador** (nas UFs com 2º turno detectadas automaticamente via configuração do TSE).

> **Proposta de Valor**: Responder com rigor matemático, transparência analítica e estrita neutralidade textual à pergunta central: **"O que ainda pode mudar nesta apuração?"** através da Calculadora da Virada, Onde Ainda Falta Contar, Mapa Geográfico IBGE em Tempo Real, Linha do Tempo com Replay Histórico 2022 e o feed determinístico Lex News.
>
> **Aviso de Independência**: Este aplicativo **não substitui** o canal oficial do Tribunal Superior Eleitoral e **não possui afiliação** com o TSE, órgãos governamentais, candidatos, coligações ou partidos políticos. Dados oficiais: [Portal Resultados do TSE](https://resultados.tse.jus.br).

---

## 1. Visão Geral e Identidade Visual

O projeto adota uma arquitetura visual moderna, focada em legibilidade e rapidez de assimilação dos dados eleitorais em tempo real:

* **Dashboard Widescreen de 3 Colunas em Tema True Black / OLED (`#050505`)**:
  - Em telas largas (desktops e TVs), a interface se distribui harmonicamente em uma grade de 12 colunas (`lg:grid-cols-12`), mantendo todos os componentes vitais visíveis sem rolagem excessiva.
  - No mobile, os componentes adotam ordenação lógica vertical otimizada (`order-1` a `order-5`), priorizando o Placar, a Calculadora da Virada e o Mapa com touch fluido.
  - Paleta com contraste estrito WCAG AAA, suporte nativo a Dark/Light Mode e **Modo Foco** para apresentações limpas.

* **Identidade Visual Intuitiva por Candidato e Partido**:
  - **Presidente da República**: Vermelho (`#EF4444` / `#DC2626`) para Lula (PT) e Azul (`#3B82F6` / `#1D4ED8`) para Flávio Bolsonaro (PL).
  - **Governadores**: Paletas personalizadas e distintas baseadas nas legendas partidárias dos finalistas de cada estado (`AC`, `AM`, `DF`, `ES`, `RN`, `TO`).
  - **Fotos Oficiais em Alta Definição**: Avatares oficiais do cadastro do TSE (`/avatars/*.jpg`), exibidos em anéis com a cor de cada candidato e com fallback estático em SVG.
  - **Bandeiras Oficiais das 27 UFs em SVG Vetorial**: Armazenadas em [`public/flags/*.svg`](public/flags/) e exibidas nas abas de seleção de disputa, nos cartões de locais pendentes e nos detalhes de cada localidade.

* **Interface Limpa de Alta Escaneabilidade**:
  - **100% Ícones Vetoriais Lucide-React**: Interface sóbria, profissional e sem emojis em nenhum componente analítico ou feed de notícias.
  - **Tooltips Contextuais (ⓘ)**: Explicações metodológicas detalhadas acessíveis sob demanda por hover ou foco, evitando poluição visual.
  - **Aviso Legal Único e Sóbrio**: Rótulo centralizado no rodapé da página e avisos de estimativa integrados contextualmente, sem repetições residuais desnecessárias dentro de cada mini-card.

---

## 2. Funcionalidades Principais

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    BANNER OFICIAL FIXO (TIMESTAMP TSE + STATUS)                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                  SELETOR DE DISPUTAS COM BANDEIRAS OFICIAIS DAS UFs              │
├──────────────────────────────────────────────────────────────────────────────────┤
│     PLACAR CABO DE GUERRA (PINO CENTRAL 50%) + VELOCÍMETRO DE URNAS/MIN          │
├────────────────────────┬─────────────────────────────┬───────────────────────────┤
│    COLUNA ESQUERDA     │       COLUNA CENTRAL        │      COLUNA DIREITA       │
│      (4 Colunas)       │         (5 Colunas)         │        (3 Colunas)        │
│                        │                             │                           │
│ • Calculadora Virada   │ • Mapa IBGE (27 UFs e 5.570 │ • Lex News                │
│   (Medidor Graduado)   │   municípios):              │   (Fast Ticker com        │
│ • Onde Falta Contar    │   - Ao Vivo (2ºT)           │    destaques em negrito   │
│   (Cards com Bandeiras │   - Variação vs. 1ºT        │    e ícones vetoriais     │
│    e Drilldown Mun.)   │   - Busca com Auto-Zoom     │    sem emojis)            │
│                        │ • Linha do Tempo da Margem  │                           │
│                        │   & Replay Histórico 2022   │                           │
├────────────────────────┴─────────────────────────────┴───────────────────────────┤
│            RODAPÉ LEGAL UNIFICADO & METODOLOGIA MATEMÁTICA DETALHADA             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Placar "Cabo de Guerra" & Velocímetro de Ritmo de Apuração
- **Termômetro Frente a Frente**: Barra encorpada de disputa em tempo real com o pino visual dos `50%` demarcado ao centro.
- **Perfis Oficiais**: Fotos nítidas dos candidatos, número de urna, votos válidos acumulados e percentual oficial informado pelo TSE.
- **Velocímetro de Ritmo (`CountingSpeedometer.tsx`)**:
  - Calcula em tempo real o fluxo de processamento em **urnas/minuto** e **votos/minuto** comparando os ciclos recentes da apuração.
  - Exibe a **projeção estimada de minutos restantes** para conclusão da totalização.
  - Indicador dinâmico de ritmo: acelerando, em ritmo de cruzeiro, desacelerando ou totalização concluída.

### 2.2. Coluna Esquerda: Análise de Virada e Votos Restantes
- **Calculadora da Virada (`TurnaroundCalculator.tsx`)**:
  - Calcula a fração exata de votos válidos restantes ($s$) que o candidato momentaneamente atrás necessita obter para virar o resultado.
  - **Medidor Visual Graduado**: régua com 3 zonas de probabilidade matemática:
    - *Zona Verde Esmeralda*: `< 50%` (Cenário Favorável)
    - *Zona Âmbar*: `50% a 60%` (Cenário Disputado)
    - *Zona Rosa/Carmim*: `> 60%` (Alta Complexidade)
  - **Controle de Sensibilidade de Comparecimento**: controle deslizante interativo ($\delta \in [-10\%, +10\%]$) recalculando instantaneamente a projeção no navegador.
- **Onde Ainda Falta Contar (`WhereVotesRemain.tsx`)**:
  - Barra empilhada dividindo os votos restantes entre locais onde o Candidato 1 liderou no 1º turno vs. locais onde o Candidato 2 liderou.
  - Cartões das localidades com maior volume de votos pendentes, exibindo a **bandeira oficial do estado**, percentual apurado e margem do 1º turno.
  - **Drilldown por Cidades**: ao clicar no botão em qualquer estado na disputa presidencial, carrega instantaneamente o ranking dos municípios daquela UF.

### 2.3. Coluna Central: Cartografia Oficial IBGE & Linha do Tempo
- **Mapa Oficial IBGE (`SwingMapSection.tsx`, `GeoChoroplethMap.tsx` e `TileGridMap.tsx`)**:
  - **27 UFs e 5.570 Municípios**: Malhas cartográficas de alta precisão do IBGE com projeção Mercator otimizada.
  - **Dois Modos de Visualização**:
    - *Ao Vivo (2º Turno)*: Colore cada localidade com a cor oficial do candidato que lidera a apuração naquele momento.
    - *Variação vs. 1º Turno (Swing)*: Escala divergente que mede onde cada candidato cresceu ou recuou em pontos percentuais.
  - **Busca Municipal com Auto-Zoom**: Caixa de busca inteligente com autocomplete que centraliza e amplia o mapa diretamente no município digitado.
  - **Grade de Quadrados (Tile Grid)**: Visão alternativa onde todos os 27 estados ocupam áreas idênticas, facilitando a análise de UFs menores (DF, SE, AL, PB, RN, ES).
  - **Renderização Dinâmica**: Alternância inteligente entre SVG vetorial e HTML5 Canvas para performance de 60 FPS mesmo em estados com centenas de municípios (como MG e SP).
- **Linha do Tempo da Margem & Replay 2022 (`MarginTimelineChart.tsx`)**:
  - Gráfico da evolução da diferença entre candidatos ao longo do tempo ou por percentual de urnas apuradas.
  - **Replay Histórico 2022**: Reproduz com play/pause e seletor de velocidade os 21 quadros históricos da apuração presidencial de 2022, destacando o marco exato da virada às 18:44:12 (67,76% das urnas).

### 2.4. Coluna Direita: Lex News em Tempo Real
- **Fast Ticker Analítico (`AutoNarratorFeed.tsx`)**:
  - Feed determinístico de frases curtas geradas matematicamente a cada ciclo de dados do TSE.
  - Destaques em negrito para números formatados, percentuais e nomes de candidatos.
  - Pílulas categorizadas (*Virada*, *Onde Falta Contar*, *Margem*, *Ritmo*, *Status TSE*, *Variação 1ºT*) com ícones vetoriais Lucide-React.
  - Remoção de qualquer texto residual redundante, mantendo a leitura fluida em no máximo 2 linhas por card.

---

## 3. Fundamentação Matemática da Calculadora da Virada

Para cada disputa em apuração:
- $V = V_1 + V_2$: Total de votos válidos já totalizados para os dois candidatos.
- $A = \min(V_1, V_2)$: Total de votos do candidato que se encontra momentaneamente atrás.
- Para cada localidade $i$, dado o ajuste percentual de comparecimento $\delta \in [-0,10, +0,10]$ sobre o comparecimento oficial do 1º turno ($C_{1,i}$):

$$C_{\text{esp},i}(\delta) = \max\!\left(\text{tv}_i,\; \min\!\left(\text{te}_{2,i},\; C_{1,i} \times (1 + \delta)\right)\right)$$

onde $\text{tv}_i$ é o total de votantes já apurados e $\text{te}_{2,i}$ é o eleitorado apto cadastrado no 2º turno.

- Taxa de votos brancos e nulos observada:
$$b_i = \frac{\text{vb}_i + \text{tvn}_i}{\text{tv}_i}$$
*(com fallback para a taxa do 1º turno $b_{1,i}$ no início da contagem quando $\text{tv}_i = 0$)*.

- Volume estimado de votos válidos restantes na disputa:
$$R(\delta) = \sum_i \max\!\left(0,\; C_{\text{esp},i}(\delta) - \text{tv}_i\right) \times (1 - b_i)$$

- Percentual necessário dos votos válidos restantes para ultrapassar 50%:
$$s = \frac{\frac{V + R(\delta)}{2} - A}{R(\delta)}$$

- **Tratamento de Casos de Borda**:
  - $s > 100\%$ ou $R = 0$: A diferença atual supera o volume total de votos restantes estimados.
  - $s \le 0\%$: O candidato em análise já totalizou matematicamente mais da metade dos votos válidos estimados.
  - Empate exato ($V_1 = V_2$): $s = 50,00\%$.

---

## 4. Arquitetura Técnica e Conformidade TSE

O sistema foi rigorosamente arquitetado para respeitar os artigos 264 a 269 da **Resolução TSE nº 23.751/2026**:

```
[Servidores Oficiais do TSE / DivulgaCandContas]
                 │
                 │ Polling assíncrono controlado (1 req a cada 45–60s por arquivo)
                 │ Cabeçalhos HTTP If-Modified-Since e If-None-Match (ETag)
                 │ Inspeção prévia de EA14/EA15 (-ab.json) para baixar apenas UFs alteradas
                 ▼
[Backend Python 3.12 + FastAPI + SQLite]
    ├── Descoberta de pleitos via EA11 (ele-c.json)
    ├── Validador de integridade (bloqueia publicação se soma divergir ou % apurado regredir)
    ├── Calculadora da Virada + Narrador Neutro Determinístico
    └── Publicador Atômico de Snapshots JSON Estáticos (public/snapshots/*)
                 │
                 ▼
[Camada CDN / Armazenamento Estático (Cache-Control: max-age=30, s-maxage=60)]
                 │
                 ▼
[Frontend PWA React 19 + TypeScript + Vite + Tailwind CSS]
    └── Navegadores NUNCA fazem requisições ao TSE; consomem exclusivamente snapshots do CDN
```

### Arquivos Oficiais do TSE Processados pelo Backend

| Código TSE | Nome do Arquivo | Função no Sistema |
| :--- | :--- | :--- |
| **EA11** | `comum/config/ele-c.json` | Descoberta automática dos códigos de eleição e UFs que foram para o 2º turno de Governador. |
| **EA12** | `<ciclo>/<pleito>/config/mun-e<pleito>-cm.json` | Mapeamento dos 5.570 municípios (código TSE de 5 dígitos vs. código IBGE de 7 dígitos). |
| **EA14 / EA15** | `<ciclo>/<pleito>/dados/<uf>/<uf>-e<pleito>-ab.json` | Acompanhamento de seções e horários de atualização para polling inteligente. |
| **EA20** | `<ciclo>/<pleito>/dados/<uf>/<prefixo>-c<cargo>-e<pleito>-u.json` | Totalização de seções, eleitorado, comparecimento, votos válidos e votação por candidato. |

---

## 5. Como Executar Localmente

### Pré-requisitos
- **Node.js** 20+ e `npm`
- **Python** 3.12+ com ambiente virtual `.venv`

### Passo a Passo

```bash
# 1. Instalar dependências do Frontend
npm install

# 2. Configurar o ambiente virtual Python e dependências do Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 3. Iniciar o Backend FastAPI (porta 8000)
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 4. Em outro terminal, iniciar o Frontend Vite (porta 3000)
npm run dev
```

Abra seu navegador em [http://localhost:3000](http://localhost:3000). A aplicação consome a API local via proxy reverso transparente (`/api -> http://localhost:8000`).

---

## 6. Suíte de Testes e Qualidade

O projeto conta com suítes automatizadas cobrindo todos os requisitos analíticos e de interface:

```bash
# 1. Suíte de Testes do Frontend (9 testes - Node Test Runner)
npm run test:frontend

# 2. Suíte de Testes do Backend (12 testes - Pytest)
.venv/bin/pytest

# 3. Verificação de Código e Linter (Oxlint)
npm run lint

# 4. Build de Produção TypeScript + Vite
npm run build

# 5. Teste de Carga Concorrente (2.000 requisições / 100 clientes)
DISABLE_STARTUP_POLLER=1 .venv/bin/python3 scripts/load_test.py
```

---

## 7. Instruções de Deploy em Produção

### Backend & Poller (Render / Fly.io / Railway / VPS)
1. Utilize o [`Dockerfile`](Dockerfile) disponível na raiz do repositório.
2. Monte volume persistente no diretório `/app/backend/data` para reter o banco SQLite e a linha de base do 1º turno (`baseline_1t_2026.json`).
3. Configure o healthcheck da plataforma para `GET /health`.

### Frontend Estático & PWA (Cloudflare Pages / Vercel / Netlify)
1. **Build command**: `npm run build`
2. **Output directory**: `dist`
3. Configure redirecionamento SPA (`/* -> /index.html`) e regras de cache:
   - `public, max-age=30, stale-while-revalidate=60` para `/snapshots/*.json`
   - `public, max-age=86400, immutable` para `/geo/*.topo.json`, `/flags/*.svg` e `/avatars/*.jpg`

---

## 8. Checklist de Operação — Véspera e Dia da Eleição

### Véspera (`24/10/2026` — até 18h BRT)
- [ ] Confirmar integridade de `backend/data/baseline_1t_2026.json` com 100% dos votos do 1º turno para Presidente e Governadores.
- [ ] Testar conectividade do poller com o arquivo `ele-c.json` (`EA11`) nos servidores do TSE.
- [ ] Validar que o banco SQLite de produção está limpo para a contagem oficial do 2º turno (`is_replay = 0`).

### Durante a Votação (`25/10/2026` — 08h00 às 16h55 BRT)
- [ ] Confirmar que o frontend exibe a contagem regressiva para as 17h00 BRT com 0,00% apurado.
- [ ] Monitorar a rota `/health` e `/api/v1/status`: confirmar ciclos regulares de polling recebendo `HTTP 304 Not Modified` via ETag.

### Janela Crítica de Apuração (`25/10/2026` — 17h00 às 23h00 BRT)
- [ ] Verificar a transição automática das telas às 17h00 BRT com os primeiros boletins totalizados pelo TSE.
- [ ] Acompanhar o Velocímetro de Apuração e garantir que a idade dos snapshots em cache permanece $< 60$ segundos.
- [ ] Confirmar que a atribuição **"Eleito (segundo o TSE)"** surge única e exclusivamente quando o arquivo oficial do TSE trouxer `e == "s"`.
