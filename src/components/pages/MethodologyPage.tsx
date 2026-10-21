import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Scale,
  ShieldCheck,
} from 'lucide-react'

interface MethodologyPageProps {
  onBack: () => void
}

export function MethodologyPage({ onBack }: MethodologyPageProps) {
  return (
    <article
      aria-labelledby="methodology-heading"
      className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="methodology-heading"
              className="text-xl font-bold text-slate-900 dark:text-white"
            >
              Metodologia, Premissas e Limites
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Transparência técnica sobre os cálculos e conformidade com a
              Resolução TSE nº 23.751/2026
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar para a apuração
        </button>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Independência e Fonte Oficial
          </p>
          <p className="mt-1">
            Este aplicativo web é independente e não possui afiliação com o
            Tribunal Superior Eleitoral (TSE), candidatos, coligações ou
            partidos políticos. Ele não substitui a divulgação oficial do TSE em{' '}
            <a
              href="https://resultados.tse.jus.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              resultados.tse.jus.br
            </a>
            .
          </p>
        </div>

        <h3 className="flex items-center gap-2 pt-2 text-base font-bold text-slate-900 dark:text-white">
          <Scale className="h-4 w-4 text-slate-500" aria-hidden="true" />
          1. Neutralidade Política e Ordem Oficial
        </h3>
        <p>
          Os dois candidatos de cada disputa (Presidente e Governadores nos
          estados com 2º turno) recebem tratamento visual, textual e matemático
          estritamente idêntico:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Ordem fixa oficial:</strong> os candidatos são exibidos
            sempre na ordem oficial do arquivo consolidado <code>EA20</code> do
            TSE (campo <code>seq</code>).
          </li>
          <li>
            <strong>Paleta não-partidária e acessível:</strong> utilizamos Roxo
            (<code>#6D28D9</code>) com padrão diagonal e Petróleo (
            <code>#0F766E</code>) com padrão pontilhado, evitando cores
            associadas a partidos e garantindo distinção para pessoas com
            daltonismo.
          </li>
          <li>
            <strong>Sem declaração própria de resultado:</strong> o sistema
            jamais declara resultado por conta própria. O selo{' '}
            <em>&ldquo;Eleito (segundo o TSE)&rdquo;</em> só aparece se o JSON
            oficial do TSE contiver <code>e == &quot;s&quot;</code> ou{' '}
            <code>st == &quot;Eleito&quot;</code>.
          </li>
        </ul>

        <h3 className="pt-2 text-base font-bold text-slate-900 dark:text-white">
          2. Fórmulas da Calculadora da Virada
        </h3>
        <p>
          A Calculadora da Virada responde quanto o candidato que está atrás no
          momento precisa conquistar dos votos válidos restantes estimados para
          ultrapassar 50% dos votos válidos totais:
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <p>
            V = votos válidos já apurados dos dois candidatos (V = V₁ + V₂)
          </p>
          <p className="mt-1">
            A = votos válidos já apurados do candidato que está atrás
          </p>
          <p className="mt-1">
            t_bn = (votos em branco + votos nulos) / total de votos apurados
          </p>
          <p className="mt-1">
            C_esp = comparecimento do 1º turno × fator do controle deslizante
            (m)
          </p>
          <p className="mt-1">
            R = máx(0, C_esp − comparecimento já apurado) × (1 − t_bn)
          </p>
          <p className="mt-2 font-bold text-slate-950 dark:text-white">
            s = ((V + R) / 2 − A) / R
          </p>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Nota: todas as quantidades que dependem de <code>R</code> ou{' '}
          <code>C_esp</code> trazem o rótulo{' '}
          <strong>&ldquo;Estimativa do site, não é resultado oficial&rdquo;</strong>.
        </p>

        <h3 className="pt-2 text-base font-bold text-slate-900 dark:text-white">
          3. Onde ainda falta contar e Cenário de Referência
        </h3>
        <p>
          Para cada UF (na disputa presidencial) e município, cruzamos o arquivo
          oficial do 2º turno (<code>EA20</code> / <code>EA15</code>) com a
          linha de base oficial do 1º turno de 2026 do mesmo cargo:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Estimamos os votos válidos restantes em cada local a partir do
            comparecimento do 1º turno naquela mesma localidade e da proporção
            atual de votos válidos.
          </li>
          <li>
            Agrupamos os votos válidos restantes estimados conforme qual dos
            dois candidatos do 2º turno obteve mais votos naquele local no 1º
            turno.
          </li>
          <li>
            O <strong>Cenário de referência (estimativa do site)</strong> é uma
            extrapolação meramente ilustrativa (desligada por padrão) que aplica
            a variação média observada nos locais com pelo menos 30% das seções
            apuradas aos locais pendentes, acompanhada de faixa de incerteza.
            Locais ainda pouco apurados podem ter perfil demográfico ou
            eleitoral distinto dos locais já totalizados.
          </li>
        </ul>

        <h3 className="flex items-center gap-2 pt-2 text-base font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
          4. Validação de Sanidade, Arquitetura e LGPD
        </h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Verificação antes da publicação:</strong> antes de publicar
            qualquer snapshot JSON, o backend confere se a soma dos candidatos
            bate com os votos válidos, se válidos + brancos + nulos + anulados
            batem com o total apurado, se os percentuais estão entre 0% e 100% e
            se os votos e seções apuradas nunca diminuem em relação ao ciclo
            anterior. Caso haja inconsistência, o snapshot anterior é mantido
            com o aviso <em>&ldquo;Atualização em verificação&rdquo;</em>.
          </li>
          <li>
            <strong>Proteção à infraestrutura do TSE:</strong> conforme a
            Resolução TSE nº 23.751/2026 (arts. 264 a 269), os navegadores dos
            usuários nunca fazem requisições diretas aos servidores do TSE.
            Apenas o coletor central consulta os arquivos oficiais em intervalos
            controlados (45–60 s) com cabeçalhos <code>If-None-Match</code> (
            <code>ETag</code>) e <code>If-Modified-Since</code>.
          </li>
          <li>
            <strong>Privacidade (LGPD):</strong> não utilizamos cadastro, login,
            cookies de rastreamento individual nem coleta de dados pessoais.
          </li>
        </ul>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>Documentação técnica de referência: arquivos EA11, EA12, EA14, EA15 e EA20 do TSE.</span>
        <a
          href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-slate-700 underline dark:text-slate-300"
        >
          Especificação técnica oficial do TSE
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </footer>
    </article>
  )
}
