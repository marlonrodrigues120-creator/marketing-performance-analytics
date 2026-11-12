import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { Card, PageHeader } from '../components/ui'
import { GLOSSARY, plain } from '../lib/learn'
import { KPIS, getKpi } from '../lib/kpis'
import { money, num, percent, ratio } from '../lib/format'

export default function Learn() {
  const a = useAnalytics()
  const d = a.total
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return GLOSSARY.filter((g) => !t || `${g.name} ${g.full} ${g.what}`.toLowerCase().includes(t))
  }, [q])

  const pct = (x: number, y: number) => (y ? percent((x / y) * 100) : '—')
  const chain = [
    { label: 'Investimento', value: money(d.investment, { compact: true }) },
    { label: 'Impressões', value: num(d.impressions, { compact: true }), via: `CPM ${money(d.impressions ? (d.mediaSpend / d.impressions) * 1000 : null)}` },
    { label: 'Cliques', value: num(d.clicks, { compact: true }), via: `CTR ${percent(d.ctr)}` },
    { label: 'Leads', value: num(d.leads), via: `${pct(d.leads, d.clicks)} dos cliques` },
    { label: 'Clientes', value: num(d.customers), via: `${pct(d.customers, d.leads)} dos leads` },
    { label: 'Receita', value: money(d.revenue, { compact: true }), via: `ticket ${money(d.aov)}` },
    { label: 'Lucro estimado', value: money(d.profit, { compact: true }), via: `margem de ${percent(a.margin * 100, 0)}` },
  ]
  const margin = a.margin
  return (
    <>
      <PageHeader title="Aprenda" description="Guia rápido das métricas de marketing usadas no painel, com os números reais do período filtrado como exemplo." />

      <Card title="Do investimento ao lucro" subtitle="Cada seta mostra a métrica que mede a passagem de uma etapa para a próxima">
        <ol className="flex flex-wrap items-stretch gap-y-3">
          {chain.map((c, i) => (
            <li key={c.label} className="flex items-center">
              {i > 0 && (
                <span className="flex flex-col items-center px-2 text-center text-[11px] leading-tight text-slate-500">
                  <ArrowRight size={16} className="text-brand-400" />
                  <span className="mt-0.5 max-w-[92px]">{c.via}</span>
                </span>
              )}
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/5">
                <span className="block text-[11px] text-slate-500">{c.label}</span>
                <span className="block text-base font-semibold tabular">{c.value}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Leitura: cada etapa perde pessoas. Melhorar qualquer seta aumenta o resultado final: um anúncio mais atrativo melhora o CTR, uma página melhor aumenta os leads e um time comercial mais rápido converte mais leads em clientes. No período, o CAC ficou em {money(d.cac)}, o ROAS em {ratio(d.roas)} e o ROI em {percent(d.roi, 1)}.
        </p>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="ROAS e ROI não são a mesma coisa">
          <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>Exemplo com números redondos: R$ 1.000 em anúncios, R$ 200 de produção e R$ 3.000 de receita, com margem de {percent(margin * 100, 0)}.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div className="text-xs text-slate-500">ROAS</div>
                <div className="text-lg font-semibold">3,00x</div>
                <div className="text-xs">3.000 ÷ 1.000. Olha só receita e anúncio.</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div className="text-xs text-slate-500">ROI</div>
                <div className="text-lg font-semibold">{percent(((3000 * margin - 1200) / 1200) * 100, 1)}</div>
                <div className="text-xs">(3.000 × {margin.toLocaleString('pt-BR')} − 1.200) ÷ 1.200. Desconta produto e todos os custos.</div>
              </div>
            </div>
            <p>Por isso uma campanha pode ter ROAS acima de 1 e ainda dar prejuízo. Use o ROAS para otimizar anúncios no dia a dia e o ROI para decidir se vale continuar investindo.</p>
          </div>
        </Card>
        <Card title="De onde vem a receita de cada canal">
          <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>Uma pessoa pode ver um vídeo no TikTok, pesquisar no Google dias depois e comprar por um e-mail. Qual canal ganha o crédito? Essa regra se chama <b className="text-slate-900 dark:text-white">modelo de atribuição</b>.</p>
            <p>Este painel usa <b className="text-slate-900 dark:text-white">último clique</b>: toda a venda vai para o último canal clicado antes da compra. É simples e auditável, mas tende a subestimar canais de descoberta como TikTok, Display e Podcasts.</p>
            <p>Ferramentas como Northbeam e Triple Whale oferecem modelos multitoque, que dividem o crédito entre os canais da jornada. Eles exigem dados de navegação de cada pessoa (GA4 ou CRM).</p>
          </div>
        </Card>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Glossário das métricas</h2>
          <p className="text-sm text-slate-500">Os exemplos usam os filtros atuais.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar métrica, ex.: CAC" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar métrica" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((g) => {
          const v = getKpi(d, g.key)
          return (
            <article key={g.key} id={g.key} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{g.name}</h3>
                  <p className="text-xs text-slate-500">{g.full}</p>
                </div>
                <span className="rounded-lg bg-brand-50 px-2 py-1 text-sm font-semibold tabular text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{(KPIS[g.key].fmtCompact ?? KPIS[g.key].fmt)(v)}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{g.what}</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-white/5 dark:text-slate-300">{g.formula}</p>
              <p className="mt-3 text-sm italic text-slate-600 dark:text-slate-300">“{plain(g.key, d)}”</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="text-xs font-medium text-slate-500">Como ler</dt><dd>{g.read}</dd></div>
                <div><dt className="text-xs font-medium text-good-ink dark:text-good">Bom sinal</dt><dd>{g.good}</dd></div>
                <div><dt className="text-xs font-medium text-bad">Cuidado</dt><dd>{g.pitfall}</dd></div>
              </dl>
              <Link to={g.where} className="mt-auto pt-4 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">Ver na prática</Link>
            </article>
          )
        })}
      </div>
    </>
  )
}
