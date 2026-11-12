import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { Trophy } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Card, DataTable, DemoBadge, EmptyState, InfoTip, MultiSelect, PageHeader, type Column } from '../components/ui'
import { ChartTip, useChartTheme } from '../components/charts'
import { MetricSelect, RankBars } from '../components/widgets'
import { channelStats, type ChannelStat } from '../lib/query'
import { KPIS, getKpi, type KpiKey } from '../lib/kpis'
import { money, num, percent } from '../lib/format'
import { PageGuide } from '../components/didactic'

const METRICS: KpiKey[] = ['investment', 'revenue', 'impressions', 'clicks', 'leads', 'customers', 'cac', 'cpl', 'cpc', 'ctr', 'convRate', 'roas', 'roi', 'profit']

const LEADERS: { k: KpiKey; title: string; dir: 'max' | 'min' }[] = [
  { k: 'investment', title: 'Maior investimento', dir: 'max' },
  { k: 'revenue', title: 'Maior receita', dir: 'max' },
  { k: 'leads', title: 'Mais leads', dir: 'max' },
  { k: 'convRate', title: 'Melhor taxa de conversão', dir: 'max' },
  { k: 'cac', title: 'Menor CAC', dir: 'min' },
  { k: 'cpl', title: 'Menor CPL', dir: 'min' },
  { k: 'roas', title: 'Maior ROAS', dir: 'max' },
  { k: 'roi', title: 'Melhor ROI', dir: 'max' },
]

/** Índice de eficiência: média dos percentis em ROI, CAC, CPL e conversão (ROAS quando houver mídia). */
function efficiency(stats: ChannelStat[]) {
  const keys: { k: KpiKey; better: boolean }[] = [
    { k: 'roi', better: true },
    { k: 'cac', better: false },
    { k: 'cpl', better: false },
    { k: 'convRate', better: true },
    { k: 'roas', better: true },
  ]
  return stats
    .map((s) => {
      const parts = keys
        .map(({ k, better }) => {
          const v = getKpi(s.d, k)
          const vals = stats.map((x) => getKpi(x.d, k)).filter((x): x is number => x !== null)
          if (v === null || vals.length < 2) return null
          const below = vals.filter((x) => (better ? x < v : x > v)).length
          return (below / (vals.length - 1)) * 100
        })
        .filter((x): x is number => x !== null)
      return { s, index: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0 }
    })
    .sort((a, b) => b.index - a.index)
}

export default function Channels() {
  const a = useAnalytics()
  const { campaigns, channels } = useStore()
  const t = useChartTheme()
  const [metric, setMetric] = useState<KpiKey>('roas')
  const [compare, setCompare] = useState<string[]>([])
  const stats = useMemo(() => channelStats(campaigns.filter((c) => a.campaigns.includes(c)), channels, a.rows, a.margin), [a, campaigns, channels])
  const ranking = useMemo(() => efficiency(stats), [stats])
  const cmp = stats.filter((s) => compare.includes(s.channel.id))

  if (!stats.length) return <><PageHeader title="Canais" /><div className="card"><EmptyState title="Sem dados de canais para os filtros selecionados" /></div></>

  const cols: Column<ChannelStat>[] = [
    { key: 'name', header: 'Canal', sticky: true, value: (r) => r.channel.name, render: (r) => <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.channel.color }} />{r.channel.name}<span className="text-[10px] font-normal muted">{r.channel.kind}</span></span> },
    ...METRICS.filter((k) => k !== 'profit').map((k) => ({ key: k, header: KPIS[k].short, align: 'right' as const, value: (r: ChannelStat) => getKpi(r.d, k), render: (r: ChannelStat) => (KPIS[k].fmtCompact ?? KPIS[k].fmt)(getKpi(r.d, k)) })),
  ]

  return (
    <>
      <PageHeader title="Canais" description="Comparação entre canais de aquisição. Canais sem investimento em mídia não têm CPC nem ROAS (exibidos como —)." badge={<DemoBadge />} />
      <PageGuide id="channels" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {LEADERS.map((l) => {
          const valid = stats.filter((s) => getKpi(s.d, l.k) !== null && (l.k !== 'convRate' || s.d.clicks > 500))
          const best = valid.sort((x, y) => (l.dir === 'max' ? getKpi(y.d, l.k)! - getKpi(x.d, l.k)! : getKpi(x.d, l.k)! - getKpi(y.d, l.k)!))[0]
          return (
            <div key={l.k} className="card p-4">
              <div className="text-[11px] font-medium muted">{l.title}</div>
              {best ? (
                <>
                  <div className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: best.channel.color }} />{best.channel.name}</div>
                  <div className="text-lg font-semibold tabular-nums">{(KPIS[l.k].fmtCompact ?? KPIS[l.k].fmt)(getKpi(best.d, l.k))}</div>
                </>
              ) : <div className="mt-2 text-sm muted">—</div>}
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Comparativo por indicador" subtitle={KPIS[metric].help} actions={<MetricSelect value={metric} onChange={setMetric} options={METRICS.map((k) => ({ value: k, label: KPIS[k].label }))} />}>
          <RankBars items={stats.map((s) => ({ id: s.channel.id, name: s.channel.name, value: getKpi(s.d, metric), color: s.channel.color })).filter((x) => x.value !== null).sort((x, y) => (KPIS[metric].better === false ? x.value! - y.value! : y.value! - x.value!))} fmt={KPIS[metric].fmtCompact ?? KPIS[metric].fmt} colorByEntity />
          {stats.some((s) => getKpi(s.d, metric) === null) && <p className="mt-1 text-[11px] muted">Sem valor para: {stats.filter((s) => getKpi(s.d, metric) === null).map((s) => s.channel.name).join(', ')}.</p>}
        </Card>
        <Card className="xl:col-span-2" title={<span className="flex items-center gap-1.5"><Trophy size={15} className="text-amber-500" /> Ranking de eficiência e rentabilidade <InfoTip text="Índice 0–100: média dos percentis do canal em ROI, CAC, CPL, taxa de conversão e ROAS (quando há mídia). 100 = melhor em todos." /></span>}>
          <ol className="space-y-2">
            {ranking.map(({ s, index }, i) => (
              <li key={s.channel.id} className="flex items-center gap-3">
                <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', i < 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10')}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm"><span className="truncate font-medium">{s.channel.name}</span><span className="tabular-nums font-semibold">{index.toFixed(0)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${index}%` }} /></div>
                  <div className="mt-0.5 text-[10px] muted">ROI {percent(s.d.roi, 0)} · CAC {money(s.d.cac)} · lucro {money(s.d.profit, { compact: true })}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="mt-4" title="Indicadores por canal" subtitle="Ordene por qualquer coluna">
        <DataTable rows={stats} columns={cols} rowKey={(r) => r.channel.id} initialSort={{ key: 'investment', dir: 'desc' }} search={(r) => r.channel.name} searchPlaceholder="Pesquisar canal…" />
      </Card>

      <Card className="mt-4" title="Comparar canais" subtitle="Selecione dois ou mais canais para comparação lado a lado" actions={<MultiSelect label="Canais" placeholder="Selecionar" options={stats.map((s) => ({ value: s.channel.id, label: s.channel.name }))} value={compare} onChange={setCompare} />}>
        {cmp.length < 2 ? (
          <EmptyState title="Selecione ao menos dois canais" description="Ex.: Google Ads vs. Meta Ads vs. LinkedIn Ads." action={<button className="btn-secondary" onClick={() => setCompare(stats.slice().sort((x, y) => y.d.investment - x.d.investment).slice(0, 3).map((s) => s.channel.id))}>Comparar os 3 maiores</button>} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(['cac', 'roas', 'roi', 'cpl'] as KpiKey[]).map((k) => (
                <div key={k}>
                  <div className="text-xs font-medium">{KPIS[k].label}</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={cmp.map((s) => ({ name: s.channel.name, v: getKpi(s.d, k), color: s.channel.color }))} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={t.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={{ stroke: t.axis }} tickLine={false} interval={0} tickFormatter={(v: string) => v.replace(' Ads', '')} />
                      <YAxis tick={t.tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => KPIS[k].fmt(v)} />
                      <Tooltip cursor={{ fill: t.cursor }} content={({ active, payload }) => (active && payload?.[0] ? <ChartTip active label={String(payload[0].payload.name)} rows={[{ name: KPIS[k].label, value: KPIS[k].fmt(payload[0].value as number) }]} /> : null)} />
                      <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {cmp.map((s) => <Cell key={s.channel.id} fill={s.channel.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
            <div className="-mx-4 mt-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="th pl-5">Indicador</th>
                    {cmp.map((s) => <th key={s.channel.id} className="th text-right"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.channel.color }} />{s.channel.name}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((k) => {
                    const vals = cmp.map((s) => getKpi(s.d, k))
                    const valid = vals.filter((v): v is number => v !== null)
                    const bestV = KPIS[k].better === null || !valid.length ? null : KPIS[k].better ? Math.max(...valid) : Math.min(...valid)
                    return (
                      <tr key={k} className="border-b border-slate-50 dark:border-white/5">
                        <td className="td pl-5 font-medium">{KPIS[k].label}</td>
                        {vals.map((v, i) => <td key={i} className={clsx('td text-right', v !== null && v === bestV && 'font-semibold text-good-ink dark:text-good')}>{(KPIS[k].fmtCompact ?? KPIS[k].fmt)(v)}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] muted">Em verde, o melhor valor entre os canais selecionados (considerando se o indicador deve subir ou cair). {num(cmp.reduce((x, s) => x + s.campaigns, 0))} campanhas envolvidas.</p>
          </>
        )}
      </Card>
    </>
  )
}
