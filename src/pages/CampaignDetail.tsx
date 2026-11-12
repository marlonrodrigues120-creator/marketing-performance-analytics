import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { useStore } from '../store/AppStore'
import { Badge, Card, DemoBadge, EmptyState, PageHeader, Segmented } from '../components/ui'
import { KpiCard, makeTip, useChartTheme } from '../components/charts'
import { autoGranularity, InsightCard, TrendLine } from '../components/widgets'
import { ScoreGauge } from '../components/score'
import { derive, sum, timeSeries, type Granularity } from '../lib/metrics'
import { addDays, between, daysBetween } from '../lib/query'
import { scoreCampaign } from '../lib/score'
import { generateInsights } from '../lib/insights'
import { KPIS, getKpi, trendTone, type KpiKey } from '../lib/kpis'
import { dateBR, money, num, signedPct } from '../lib/format'

const COMPARE: KpiKey[] = ['cac', 'cpl', 'roas', 'roi', 'ctr', 'cpc', 'convRate', 'aov']

export default function CampaignDetail() {
  const { id } = useParams()
  const { campaigns, channels, metrics, filters, settings, dataStart, tags } = useStore()
  const t = useChartTheme()
  const c = campaigns.find((x) => x.id === id)
  const [gOverride, setG] = useState<Granularity | null>(null)

  const data = useMemo(() => {
    if (!c) return null
    const m = settings.grossMargin
    const own = metrics.filter((r) => r.campaignId === c.id)
    const rows = between(own, filters.start, filters.end)
    const len = daysBetween(filters.start, filters.end) + 1
    const ps = addDays(filters.start, -len)
    const prevRows = ps >= dataStart ? between(own, ps, addDays(filters.start, -1)) : []
    const all = between(metrics, filters.start, filters.end)
    const sameObj = new Set(campaigns.filter((x) => x.objective === c.objective).map((x) => x.id))
    return {
      rows,
      d: derive(sum(rows), m),
      prev: prevRows.length ? derive(sum(prevRows), m) : null,
      avgAll: derive(sum(all), m),
      avgObj: derive(sum(all.filter((r) => sameObj.has(r.campaignId))), m),
      len,
    }
  }, [c, metrics, filters, settings.grossMargin, dataStart, campaigns])

  const insights = useMemo(() => (c ? generateInsights({ campaigns, channels, rows: metrics, start: filters.start, end: filters.end, settings }).filter((i) => i.entityId === c.id) : []), [c, campaigns, channels, metrics, filters, settings])

  if (!c || !data)
    return <div className="card"><EmptyState title="Campanha não encontrada" action={<Link className="btn-primary" to="/campaigns">Voltar para campanhas</Link>} /></div>

  const ch = channels.find((x) => x.id === c.channelId)!
  const g = gOverride ?? autoGranularity(data.len)
  const series = timeSeries(data.rows, g, settings.grossMargin)
  const score = scoreCampaign(c, data.d, settings)
  const budgetUsedMtd = (() => {
    const mStart = filters.end.slice(0, 8) + '01'
    const s = metrics.filter((r) => r.campaignId === c.id && r.date >= mStart && r.date <= filters.end).reduce((a, r) => a + r.mediaSpend + r.otherCost, 0)
    return c.monthlyBudget ? (s / c.monthlyBudget) * 100 : null
  })()

  return (
    <>
      <Link to="/campaigns" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={13} /> Campanhas
      </Link>
      <PageHeader
        title={c.name}
        badge={<DemoBadge />}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={c.status === 'Ativa' ? 'green' : c.status === 'Pausada' ? 'amber' : 'gray'}>{c.status}</Badge>
            <Badge>{ch.name}</Badge>
            <Badge>{c.platform}</Badge>
            <Badge tone="blue">{c.objective}</Badge>
            <Badge>Conversão: {c.conversionType}</Badge>
            {tags[c.id]?.map((x) => <Badge key={x} tone="purple">#{x}</Badge>)}
          </span>
        }
        actions={<Segmented size="sm" value={g} onChange={setG} options={[{ value: 'day', label: 'Dia' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }]} />}
      />
      {data.rows.length === 0 ? (
        <div className="card"><EmptyState title="Sem dados desta campanha no período selecionado" description={`A campanha esteve ativa de ${dateBR(c.startDate)} a ${c.endDate ? dateBR(c.endDate) : 'hoje'}. Ajuste o período no filtro global.`} /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card title="Informações gerais">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                {[
                  ['Responsável', c.owner],
                  ['Início', dateBR(c.startDate)],
                  ['Término', c.endDate ? dateBR(c.endDate) : 'Em andamento'],
                  ['Orçamento mensal', money(c.monthlyBudget)],
                  ['Consumido no mês', budgetUsedMtd === null ? '—' : `${budgetUsedMtd.toFixed(0)}%`],
                  ['Investimento (período)', money(data.d.investment)],
                  ['Mídia', money(data.d.mediaSpend)],
                  ['Outros custos', money(data.d.otherCost)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="muted">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-3">
              {(['revenue', 'customers', 'leads', 'cac', 'roas', 'roi'] as KpiKey[]).map((k) => (
                <KpiCard key={k} k={k} value={getKpi(data.d, k)} prev={data.prev ? getKpi(data.prev, k) : null} hasPrev={!!data.prev} spark={series.map((p) => getKpi(p, k))} compact={k === 'revenue'} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Histórico de investimento" subtitle="Mídia + custos não-mídia">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={t.grid} vertical={false} />
                  <XAxis dataKey="label" tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={20} />
                  <YAxis tick={t.tick} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                  <Tooltip cursor={{ fill: t.cursor }} content={makeTip((_k, v) => money(v))} />
                  <Bar dataKey="investment" name="Investimento" fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Receita gerada" subtitle="Receita atribuída (last-click)">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.series[1]} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={t.series[1]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={t.grid} vertical={false} />
                  <XAxis dataKey="label" tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={20} />
                  <YAxis tick={t.tick} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                  <Tooltip content={makeTip((_k, v) => money(v))} />
                  <Area type="monotone" dataKey="revenue" name="Receita" stroke={t.series[1]} strokeWidth={2} fill="url(#revg)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Evolução de leads">
              <TrendLine data={series} dataKey="leads" name="Leads" fmt={(v) => num(v)} height={200} />
            </Card>
            <Card title="Evolução de conversões">
              <TrendLine data={series} dataKey="customers" name="Conversões" fmt={(v) => num(v)} height={200} color={t.series[2]} />
            </Card>
            <Card title="CAC" subtitle={`Limite: ${money(settings.cacLimit)}`}>
              <TrendLine data={series} dataKey="cac" name="CAC" fmt={(v) => money(v)} reference={settings.cacLimit} refLabel="Limite" height={200} />
            </Card>
            <Card title="ROAS" subtitle={data.d.mediaSpend > 0 ? `Meta: ${settings.roasTarget.toLocaleString('pt-BR')}x` : 'Campanha sem investimento em mídia: ROAS não se aplica.'}>
              {data.d.mediaSpend > 0 ? <TrendLine data={series} dataKey="roas" name="ROAS" fmt={(v) => (v === null ? '—' : `${v.toFixed(2).replace('.', ',')}x`)} reference={settings.roasTarget} refLabel="Meta" height={200} color={t.series[2]} /> : <EmptyState title="ROAS indisponível" description="Use ROI e CAC para avaliar campanhas orgânicas." />}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3" title="Comparação com a média" subtitle="Mesmo período e filtros de data · média ponderada (total ÷ total)">
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/5">
                      <th className="th pl-5">Indicador</th>
                      <th className="th text-right">Campanha</th>
                      <th className="th text-right">Média ({c.objective})</th>
                      <th className="th text-right">Média geral</th>
                      <th className="th pr-5 text-right">vs. objetivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((k) => {
                      const v = getKpi(data.d, k)
                      const o = getKpi(data.avgObj, k)
                      const delta = v !== null && o ? ((v - o) / Math.abs(o)) * 100 : null
                      const tone = trendTone(k, delta)
                      return (
                        <tr key={k} className="border-b border-slate-50 dark:border-white/5">
                          <td className="td pl-5 font-medium">{KPIS[k].label}</td>
                          <td className="td text-right font-semibold">{KPIS[k].fmt(v)}</td>
                          <td className="td text-right">{KPIS[k].fmt(o)}</td>
                          <td className="td text-right muted">{KPIS[k].fmt(getKpi(data.avgAll, k))}</td>
                          <td className={clsx('td pr-5 text-right font-medium', tone === 'good' && 'text-good-ink dark:text-good', tone === 'bad' && 'text-bad')}>{signedPct(delta)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="lg:col-span-2" title="Campaign Score" subtitle="Pontuação 0–100 considerando o objetivo da campanha">
              <div className="flex justify-center"><ScoreGauge s={score} size={160} /></div>
              <p className="mt-3 text-xs leading-relaxed muted">{score.explanation}</p>
              <div className="mt-3 space-y-2">
                {score.factors.map((f) => (
                  <div key={f.metric} className="text-xs">
                    <div className="flex justify-between">
                      <span>{f.label} <span className="muted">· peso {f.weight}</span></span>
                      <span className="tabular-nums muted">{f.points === null ? 'sem dado' : `${Math.round(f.points)} pts · meta ${f.metric === 'cac' || f.metric === 'cpl' ? money(f.target) : f.metric === 'roas' ? `${f.target}x` : `${f.target}%`}`}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div className={clsx('h-full rounded-full', f.points === null ? '' : f.points >= 60 ? 'bg-brand-500' : f.points >= 40 ? 'bg-amber-400' : 'bg-bad')} style={{ width: `${f.points ?? 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <h2 className="mb-3 mt-6 section-title">Insights específicos da campanha</h2>
          {insights.length ? (
            <div className="grid gap-3 lg:grid-cols-2">{insights.map((i) => <InsightCard key={i.id} i={i} />)}</div>
          ) : (
            <div className="card"><EmptyState title="Nenhum alerta para esta campanha no período" description="Os indicadores estão dentro das regras configuradas (CAC, ROAS, CPC, conversão e consistência)." /></div>
          )}
        </>
      )}
    </>
  )
}
