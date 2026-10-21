# Regras do Projeto — Apuração 2º Turno (Eleições 2026)

Estas diretrizes regem o desenvolvimento, textos de interface, testes, fixtures e documentação:

1. **Identidade Visual por Candidato/Partido e Neutralidade Textual**:
   - **Cores Temáticas e Fotos Oficiais Permitidas**: É expressamente permitido e recomendado o uso de cores temáticas personalizadas por candidato e partido (ex.: Vermelho `#EF4444` / `#DC2626` para Lula/PT, Azul `#3B82F6` / `#1D4ED8` para Flávio Bolsonaro/PL, e paleta coerente e distinta baseada nos partidos para os candidatos a Governador no 2º turno), bem como a exibição das fotos oficiais dos candidatos a partir dos metadados/URLs da API do TSE (com fallback seguro).
   - **Neutralidade nos Textos e Simetria de Layout**: Sem linguagem de torcida, sem adjetivos valorativos, tratamento estruturalmente simétrico aos dois candidatos.
   - **Ordem Fixa e Consistente**: Seguir estritamente a ordem oficial do TSE (`seq` / ordem de apresentação oficial do arquivo `EA20` do TSE).

2. **Proibição de Declaração Própria de Resultado**:
   - **NUNCA** escrever "eleito", "vencedor", "ganhou", "vitória" ou "derrota" por conta própria em nenhum componente, cálculo ou frase do assistente analítico ("Lex").
   - Só exibir o status "Eleito" (ou "Matematicamente definido") se o próprio JSON oficial do TSE trouxer `e == "s"` ou `st == "Eleito"`, sempre acompanhado da atribuição explícita: **"Eleito (segundo o TSE)"**.

3. **Rotulagem Estrita de Estimativas e Interface Limpa de Alta Escaneabilidade**:
   - Nenhuma projeção ou extrapolação pode ser apresentada como fato.
   - Todo componente que envolva votos restantes estimados, comparecimento esperado ou o "Cenário de referência" deve exibir de forma clara e contextual o rótulo **"Estimativa do site, não é resultado oficial"** em cabeçalhos, tooltips informativos (ⓘ) e modais metodológicos, evitando repetições residuais desnecessárias dentro de cada mini-card para garantir leitura rápida e limpa.

4. **Aviso Fixo de Fonte, Independência e Rodapé Legal Único**:
   - Manter aviso fixo no topo e rodapé legal único e sóbrio:
     > *"Resultado parcial até 100% das urnas apuradas. Fonte: TSE. Atualizado às HH:MM:SS"*
   - Incluir link clicável direto para o Portal Resultados do TSE (`https://resultados.tse.jus.br`) e link "ver na fonte" em cada métrica relevante.
   - Explicitar que o aplicativo é independente e não possui afiliação com o TSE, candidatos, coligações ou partidos políticos.

5. **Privacidade e LGPD**:
   - Sem cadastro, sem login, sem cookies de rastreamento individual e sem coleta de dados pessoais (conformidade integral com a LGPD).

6. **Coleta Controlada de Dados do TSE (Resolução TSE nº 23.751/2026, arts. 264 a 269)**:
   - O backend realiza polling controlado (intervalo mínimo de 45–60 s por arquivo, enviando cabeçalhos `If-Modified-Since` e `If-None-Match` / `ETag` e utilizando os arquivos de acompanhamento `EA14`/`EA15` `-ab.json`).
   - O frontend consome os snapshots JSON estáticos validados e publicados pelo nosso backend/CDN, podendo exibir as fotos oficiais referenciadas nos metadados do TSE com fallback estático local.
