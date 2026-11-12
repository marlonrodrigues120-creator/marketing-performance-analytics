import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Card, DemoBadge, EmptyState, PageHeader, Segmented, Toggle } from '../components/ui'
import { Legend, useChartTheme } from '../components/charts'
import { autoGranularity, TrendLine } from '../components/widgets'
import { timeSeries, trendSlope, type Granularity } from '../lib/metrics'
import { KPIS, getKpi, type KpiKey } from '../lib/kpis'
import { signedPct } from '../lib/format'
import { PageGuide } from '../components/didactic'

const METRICS: { k: KpiKey; title: string }[] = [
  { k: 'investment', title: 'Investimento' },
  { k: 'revenue', title: 'Receita' },
  { k: 'leads', title: 'Leads' },
  { k: 'customers', title: 'Conversões' },
  { k: 'cac', title: 'Evolução do CAC' },
  { k: 'roas', title: 'Evolução do ROAS' },
  { k: 'roi', title: 'Evolução do ROI' },
  { k: 'cpl', title: 'Evolução do CPL' },
]
const GLABEL: Record<Granularity, string> = { day: 'diário', week: 'semanal', month: 'mensal' }

export default function Performance() {
  const a = useAnalytics()
  const { settings } = useStore()
  const t = useChartTheme()
  const [g, setG] = useState<Granularity>(autoGranularity(a.range.days))
  const [compare, setCompare] = useState(true)
  const [selected, setSelected] = useState<KpiKey[]>(METRICS.map((m) => m.k))

  const data = useMemo(() => {
    const cur = timeSeries(a.rows, g, a.margin)
    const prev = timeSeries(a.prevRows, g, a.margin)
    // alinha o período anterior por posição (1º dia/semana/mês com 1º dia/semana/mês)
    const offset = Math.max(0, prev.length - cur.length)
    return cur.map((p, i) => {
      const q = prev[i + offset]
      const extra: Record<string, number | null> = {}
      for (const m of METRICS) extra[`prev_${m.k}`] = q ? getKpi(q, m.k) : null
      return { ...p, ...extra }
    })
  }, [a, g])

  if (!a.rows.length) return <><PageHeader title="Evolução no tempo" /><div className="card"><EmptyState title="Sem dados para os filtros selecionados" /></div></>

  return (
    <>
      <PageHeader
        title="Evolução no tempo"
        description="Séries temporais dos principais indicadores. A tendência é a inclinação da regressão linear, em % da média por período."
        badge={<DemoBadge />}
        actions={
          <>
            <label className="flex items-center gap-2 text-xs"><Toggle checked={compare && a.hasPrev} disabled={!a.hasPrev} onChange={setCompare} label="Comparar com período anterior" /> Comparar com período anterior</label>
            <Segmented value={g} onChange={setG} options={[{ value: 'day', label: 'Diário' }, { value: 'week', label: 'Semanal' }, { value: 'month', label: 'Mensal' }]} />
          </>
        }
      />
      <PageGuide id="performance" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRICS.map((m) => {
          const on = selected.includes(m.k)
          return (
            <button key={m.k} onClick={() => setSelected(on ? selected.filter((x) => x !== m.k) : [...selected, m.k])} className={clsx('rounded-full border px-3 py-1 text-xs transition', on ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5')}>
              {m.title}
            </button>
          )
        })}
      </div>
      {g === 'month' && data.length < 3 && <p className="mb-3 text-xs muted">Poucos meses no período selecionado — amplie o filtro de período para ver tendências mensais.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {METRICS.filter((m) => selected.includes(m.k)).map((m, idx) => {
          const slope = trendSlope(data.map((p) => getKpi(p, m.k)))
          const better = KPIS[m.k].better
          const tone = slope === null || Math.abs(slope) < 0.5 ? 'neutral' : better === null ? 'neutral' : (slope > 0) === better ? 'good' : 'bad'
          return (
            <Card
              key={m.k}
              title={`${m.title} (${GLABEL[g]})`}
              subtitle={KPIS[m.k].formula ?? KPIS[m.k].help}
              actions={
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tone === 'good' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', tone === 'bad' && 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300', tone === 'neutral' && 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300')}>
                  {slope === null ? <Minus size={12} /> : slope > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {slope === null ? 'sem tendência' : `${slope > 0 ? 'Alta' : 'Queda'} ${signedPct(slope)}/período`}
                </span>
              }
            >
              {compare && a.hasPrev && <Legend items={[{ label: 'Período atual', color: t.series[idx % 4 === 0 ? 0 : idx % 4] }, { label: 'Período anterior', color: t.muted, dashed: true }]} />}
              <TrendLine data={data} dataKey={m.k} name={m.title} fmt={KPIS[m.k].fmtCompact ?? KPIS[m.k].fmt} color={t.series[idx % 4 === 0 ? 0 : idx % 4]} compare={compare && a.hasPrev ? `prev_${m.k}` : undefined} compareName="Período anterior" reference={m.k === 'cac' ? settings.cacLimit : m.k === 'roas' ? settings.roasTarget : m.k === 'cpl' ? settings.cplLimit : undefined} refLabel={m.k === 'roas' ? 'Meta' : m.k === 'cac' || m.k === 'cpl' ? 'Limite' : undefined} />
            </Card>
          )
        })}
      </div>
    </>
  )
}
