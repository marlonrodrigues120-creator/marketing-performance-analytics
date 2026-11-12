import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from 'recharts'
import { Sparkles } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Card, DemoBadge, EmptyState, PageHeader, Segmented } from '../components/ui'
import { KpiCard, Legend, makeTip, useChartTheme } from '../components/charts'
import { autoGranularity, InsightCard, MetricSelect, RankBars, SeeAll, TrendLine } from '../components/widgets'
import { timeSeries, type Granularity } from '../lib/metrics'
import { campaignStats, channelStats } from '../lib/query'
import { generateInsights } from '../lib/insights'
import { KPIS, getKpi, type KpiKey } from '../lib/kpis'
import { money, num, percent } from '../lib/format'

const CARDS: KpiKey[] = ['investment', 'revenue', 'cac', 'roas', 'roi', 'leads', 'customers', 'cpl', 'ctr', 'cpc']

export default function Overview() {
  const a = useAnalytics()
  const { settings, channels: allChannels, campaigns: allCampaigns } = useStore()
  const t = useChartTheme()
  const nav = useNavigate()
  const [gran, setGran] = useState<Granularity>(autoGranularity(a.range.days))
  const [campMetric, setCampMetric] = useState<'roas' | 'roi' | 'cac' | 'revenue'>('roas')
  const g = useMemo(() => (gran === 'day' && a.range.days > 200 ? 'week' : gran), [gran, a.range.days])

  const series = useMemo(() => timeSeries(a.rows, g, a.margin), [a.rows, g, a.margin])
  const sparkSeries = useMemo(() => timeSeries(a.rows, autoGranularity(a.range.days), a.margin), [a.rows, a.range.days, a.margin])
  const chStats = useMemo(() => channelStats(allCampaigns, allChannels, a.rows, a.margin).sort((x, y) => y.d.investment - x.d.investment), [a.rows, a.margin, allCampaigns, allChannels])
  const cStats = useMemo(() => campaignStats(allCampaigns, allChannels, a.rows, a.margin), [a.rows, a.margin, allCampaigns, allChannels])
  const insights = useMemo(() => generateInsights({ campaigns: a.campaigns, channels: allChannels, rows: a.dimRows, start: a.range.start, end: a.range.end, settings }), [a, allChannels, settings])

  if (a.rows.length === 0)
    return (
      <>
        <PageHeader title="Overview" />
        <div className="card"><EmptyState title="Sem dados para os filtros selecionados" description="Amplie o período ou remova filtros de canal, campanha, plataforma ou tipo de conversão." /></div>
      </>
    )

  const campItems = cStats
    .map((s) => ({ id: s.campaign.id, name: s.campaign.name, value: getKpi(s.d, campMetric), color: s.channel.color, extra: s.channel.name }))
    .filter((x) => x.value !== null)
    .sort((x, y) => (campMetric === 'cac' ? x.value! - y.value! : y.value! - x.value!))
    .slice(0, 10)
  const totalInv = a.total.investment

  return (
    <>
      <PageHeader title="Overview" description="Visão consolidada da performance de marketing no período e nos filtros selecionados." badge={<DemoBadge />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {CARDS.map((k) => (
          <KpiCard key={k} k={k} value={getKpi(a.total, k)} prev={a.prevTotal ? getKpi(a.prevTotal, k) : null} hasPrev={a.hasPrev} spark={sparkSeries.map((p) => getKpi(p, k))} compact={k === 'investment' || k === 'revenue'} sub={k === 'investment' ? `Mídia ${money(a.total.mediaSpend, { compact: true })} · outros ${money(a.total.otherCost, { compact: true })}` : undefined} />
        ))}
      </div>
      {!a.hasPrev && <p className="mt-2 text-xs muted">Comparação indisponível: o período anterior equivalente está fora do histórico de dados.</p>}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Investimento versus receita" subtitle="Investimento total (mídia + outros custos) e receita atribuída (last-click). Receita não é lucro." actions={<Segmented size="sm" value={g} onChange={setGran} options={[{ value: 'day', label: 'Dia' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }]} />}>
          <Legend items={[{ label: 'Investimento', color: t.series[0] }, { label: 'Receita', color: t.series[1] }]} />
          <ResponsiveContainer width="100%" height={330}>
            <ComposedChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={20} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} width={80} tickFormatter={(v) => money(v, { compact: true })} />
              <Tooltip cursor={{ fill: t.cursor }} content={makeTip((_k, v) => money(v))} />
              <Bar dataKey="investment" name="Investimento" fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="revenue" name="Receita" stroke={t.series[1]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Distribuição de investimento por canal" subtitle={`Total ${money(totalInv)} no período`}>
          <RankBars items={chStats.map((c) => ({ id: c.channel.id, name: c.channel.name, value: c.d.investment, color: c.channel.color, extra: `${percent((c.d.investment / totalInv) * 100, 1)} do total` }))} fmt={(v) => money(v, { compact: true })} colorByEntity />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Evolução do CAC" subtitle={`Linha tracejada: limite configurado de ${money(settings.cacLimit)}`}>
          <TrendLine data={series} dataKey="cac" name="CAC" fmt={(v) => money(v)} reference={settings.cacLimit} refLabel="Limite" />
        </Card>
        <Card title="Evolução do ROAS" subtitle={`Linha tracejada: meta de ${settings.roasTarget.toLocaleString('pt-BR')}x`}>
          <TrendLine data={series} dataKey="roas" name="ROAS" fmt={(v) => (v === null ? '—' : `${v.toFixed(2).replace('.', ',')}x`)} reference={settings.roasTarget} refLabel="Meta" color={t.series[2]} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Leads e conversões ao longo do tempo" subtitle="Escalas separadas para preservar a leitura de cada série" className="xl:col-span-1">
          <div className="text-xs font-medium muted">Leads · {num(a.total.leads)}</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" hide />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => num(v, { compact: true })} />
              <Tooltip cursor={{ fill: t.cursor }} content={makeTip((_k, v) => num(v))} />
              <Bar dataKey="leads" name="Leads" fill={t.series[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs font-medium muted">Conversões · {num(a.total.customers)}</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={20} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} width={44} />
              <Tooltip cursor={{ fill: t.cursor }} content={makeTip((_k, v) => num(v))} />
              <Bar dataKey="customers" name="Conversões" fill={t.series[2]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="xl:col-span-2" title="Comparação de performance entre campanhas" subtitle="Top 10 no indicador selecionado · clique na barra para detalhes" actions={<MetricSelect value={campMetric} onChange={setCampMetric} options={[{ value: 'roas', label: 'ROAS' }, { value: 'roi', label: 'ROI' }, { value: 'cac', label: 'CAC (menor é melhor)' }, { value: 'revenue', label: 'Receita' }]} />}>
          <RankBars items={campItems} fmt={KPIS[campMetric].fmt} onClick={(id) => nav(`/campaigns/${id}`)} reference={campMetric === 'roas' ? settings.roasTarget : undefined} good={campMetric === 'roas' ? (v) => v >= settings.roasTarget : campMetric === 'roi' ? (v) => v >= 0 : campMetric === 'cac' ? (v) => v <= settings.cacLimit : undefined} />
          <p className="mt-1 text-[11px] muted">{campMetric === 'roas' ? 'Barras vermelhas: abaixo da meta de ROAS. Campanhas orgânicas não têm ROAS (sem mídia).' : campMetric === 'roi' ? 'Barras vermelhas: ROI negativo.' : campMetric === 'cac' ? 'Barras vermelhas: CAC acima do limite configurado.' : 'Receita atribuída pelo modelo last-click.'}</p>
        </Card>
      </div>

      <Card className="mt-4" title={<span className="flex items-center gap-1.5"><Sparkles size={15} className="text-ai-500" /> Principais insights</span>} subtitle={`${insights.length} insights gerados a partir dos indicadores do período`} actions={<SeeAll to="/insights">Ver todos</SeeAll>}>
        {insights.length === 0 ? (
          <EmptyState title="Nenhum insight para os filtros atuais" />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {insights.slice(0, 3).map((i) => <InsightCard key={i.id} i={i} compact />)}
          </div>
        )}
      </Card>
    </>
  )
}
