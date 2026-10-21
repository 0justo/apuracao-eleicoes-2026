/**
 * Especificação E2E Mobile (390x844) — Apuração 2º Turno 2026
 * Cobre o fluxo completo de apuração (0% -> 25% -> 50% empate -> 65% -> 88% -> 100%),
 * troca de disputa (Presidente e Governadores), Calculadora da Virada, Mapa 1ºT->2ºT,
 * Linha do Tempo com Replay 2022, Metodologia e Status Operacional.
 */

export const MOBILE_VIEWPORT = { width: 390, height: 844 }

export const E2E_MOBILE_SCENARIOS = [
  {
    name: 'Estágio 0% (Pré-17h): Contagem regressiva e placar zerado sem declaração de resultado',
    url: '/presidente?stage=0pct',
    expectedPct: '0,00%',
    mustContain: [
      'Resultado parcial até 100% das urnas apuradas. Fonte: TSE.',
      'Estimativa do site, não é resultado oficial',
    ],
  },
  {
    name: 'Estágio 25%: Início da totalização com hachura <30% no mapa',
    url: '/presidente?stage=25pct',
    expectedPct: '24,18%',
    mustContain: ['Calculadora da Virada', 'Onde Ainda Falta Contar'],
  },
  {
    name: 'Estágio 50% Empate Exato: s = 50,00% dos votos restantes',
    url: '/presidente?stage=50tie',
    expectedPct: '50,00%',
    mustContain: ['50,00%'],
  },
  {
    name: 'Estágio 65% (Ao Vivo): Placar Neutro com avatares do CDN, Mapa e Linha do Tempo',
    url: '/presidente?stage=65pct',
    expectedPct: '63,25%',
    mustContain: ['LULA', 'FLAVIO BOLSONARO', 'seq 1', 'seq 2'],
  },
  {
    name: 'Estágio 88%: Reta final quando s > 100% dos votos restantes estimados',
    url: '/presidente?stage=88pct',
    expectedPct: '87,42%',
    mustContain: [
      'Pelos dados atuais, a diferença supera o total estimado de votos restantes',
    ],
  },
  {
    name: 'Estágio 100%: Apuração concluída com atribuição oficial "Eleito (segundo o TSE)"',
    url: '/presidente?stage=100pct',
    expectedPct: '100,00%',
    mustContain: ['Eleito (segundo o TSE)'],
  },
  {
    name: 'Disputa de Governador (DF): Abre direto no mapa municipal do Distrito Federal',
    url: '/governador/df?stage=65pct',
    expectedPct: '58,36%',
    mustContain: ['Governador — Distrito Federal (DF)', 'CELINA LEÃO', 'LEANDRO GRASS'],
  },
  {
    name: 'Página Metodologia e Limites (/metodologia)',
    url: '/metodologia',
    expectedPct: null,
    mustContain: ['Metodologia', 'Estimativa do site, não é resultado oficial'],
  },
  {
    name: 'Página Status Operacional (/status)',
    url: '/status',
    expectedPct: null,
    mustContain: ['Status Operacional do Sistema'],
  },
]
