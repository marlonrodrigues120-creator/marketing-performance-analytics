import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { Calculator, Scale } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Card, DataTable, DemoBadge, EmptyState, PageHeader, Segmented, type Column } from '../components/ui'
import { ChartTip, KpiCard, useChartTheme } from '../components/charts'
import { campaignStats, channelStats } from '../lib/query'
import { getKpi, type KpiKey } from '../lib/kpis'
import { money, num, percent, ratio } from '../lib/format'
import type { Derived } from '../data/types'
import { PageGuide } from '../components/didactic'

const CARDS: KpiKey[] = ['investment', 'revenue', 'profit', 'roi', 'roas', 'cac', 'cpl', 'aov', 'otherCost', 'revPerCustomer']

interface PRow {
  id: string
  name: string
  color: string
  d: Derived
  sub: string
}

export default function Financial() {
  const a = useAnalytics()
  const { channels, settings } = useStore()
  const t = useChartTheme()
  const [by, setBy] = useState<'channel' | 'campaign'>('channel')
  const d = a.total
  const rows: PRow[] = useMemo(
    () =>
      by === 'channel'
        ? channelStats(a.campaigns, channels, a.rows, a.margin).map((s) => ({ id: s.channel.id, name: s.channel.name, color: s.channel.color, d: s.d, sub: `${s.campaigns} campanha(s)` }))
        : campaignStats(a.campaigns, channels, a.rows, a.margin).map((s) => ({ id: s.campaign.id, name: s.campaign.name, color: s.channel.color, d: s.d, sub: s.channel.name })),
    [by, a, channels],
  )
  if (!a.rows.length) return <><PageHeader title="Análise financeira" /><div className="card"><EmptyState title="Sem dados para os filtros selecionados" /></div></>

  const cogs = d.revenue * (1 - a.margin)
  const steps = [
    { label: 'Receita atribuída', v: d.revenue, kind: 'total' },
    { label: `(−) Custo dos produtos/serviços (${percent((1 - a.margin) * 100, 0)})`, v: -cogs, kind: 'neg' },
    { label: `Lucro bruto (margem ${percent(a.margin * 100, 0)})`, v: d.grossProfit, kind: 'total' },
    { label: '(−) Investimento em mídia', v: -d.mediaSpend, kind: 'neg' },
    { label: '(−) Custos não-mídia', v: -d.otherCost, kind: 'neg' },
    { label: 'Lucro estimado após marketing', v: d.profit, kind: d.profit >= 0 ? 'pos' : 'neg' },
  ]
  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.v)))
  const chartRows = [...rows].sort((x, y) => y.d.profit - x.d.profit).slice(0, by === 'campaign' ? 19 : 11)

  const cols: Column<PRow>[] = [
    { key: 'name', header: by === 'channel' ? 'Canal' : 'Campanha', sticky: true, value: (r) => r.name, render: (r) => <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: r.color }} /><span className="max-w-[240px] truncate font-medium">{r.name}</span><span className="text-[10px] muted">{r.sub}</span></span> },
    { key: 'inv', header: 'Investimento', align: 'right', value: (r) => r.d.investment, render: (r) => money(r.d.investment) },
    { key: 'media', header: 'Mídia', align: 'right', value: (r) => r.d.mediaSpend, render: (r) => money(r.d.mediaSpend) },
    { key: 'rev', header: 'Receita', align: 'right', value: (r) => r.d.revenue, render: (r) => money(r.d.revenue) },
    { key: 'gp', header: 'Lucro bruto', align: 'right', value: (r) => r.d.grossProfit, render: (r) => money(r.d.grossProfit) },
    { key: 'profit', header: 'Lucro estimado', align: 'right', value: (r) => r.d.profit, render: (r) => <span className={clsx('font-medium', r.d.profit >= 0 ? 'text-good-ink dark:text-good' : 'text-bad')}>{money(r.d.profit)}</span> },
    { key: 'roas', header: 'ROAS', align: 'right', value: (r) => r.d.roas, render: (r) => ratio(r.d.roas) },
    { key: 'roi', header: 'ROI', align: 'right', value: (r) => r.d.roi, render: (r) => <span className={clsx('font-medium', r.d.roi !== null && (r.d.roi >= 0 ? 'text-good-ink dark:text-good' : 'text-bad'))}>{percent(r.d.roi, 1)}</span> },
    { key: 'cac', header: 'CAC', align: 'right', value: (r) => r.d.cac, render: (r) => money(r.d.cac) },
    { key: 'aov', header: 'Ticket médio', align: 'right', value: (r) => r.d.aov, render: (r) => money(r.d.aov) },
  ]

  const formulas = [
    { name: 'CAC', f: 'Investimento em marketing ÷ novos clientes', calc: `${money(d.investment)} ÷ ${num(d.customers)}`, r: money(d.cac) },
    { name: 'CPL', f: 'Investimento em marketing ÷ leads', calc: `${money(d.investment)} ÷ ${num(d.leads)}`, r: money(d.cpl) },
    { name: 'ROAS', f: 'Receita atribuída ÷ investimento em anúncios', calc: `${money(d.revenue)} ÷ ${money(d.mediaSpend)}`, r: ratio(d.roas) },
    { name: 'ROI', f: '((Retorno financeiro − Investimento total) ÷ Investimento total) × 100', calc: `((${money(d.grossProfit)} − ${money(d.investment)}) ÷ ${money(d.investment)}) × 100`, r: percent(d.roi, 1) },
    { name: 'CTR', f: '(Cliques ÷ Impressões) × 100', calc: `(${num(d.clicks)} ÷ ${num(d.impressions)}) × 100`, r: percent(d.ctr) },
    { name: 'CPC', f: 'Investimento em anúncios ÷ cliques pagos', calc: `${money(d.mediaSpend)} ÷ ${num(d.paidClicks)}`, r: money(d.cpc) },
    { name: 'Conversion Rate', f: '(Conversões ÷ Cliques) × 100', calc: `(${num(d.customers)} ÷ ${num(d.clicks)}) × 100`, r: percent(d.convRate) },
    { name: 'Average Order Value', f: 'Receita ÷ número de pedidos', calc: `${money(d.revenue)} ÷ ${num(d.orders)}`, r: money(d.aov) },
  ]

  return (
    <>
      <PageHeader title="Análise financeira" description="Rentabilidade dos investimentos em marketing. Receita não é tratada como lucro: o ROI usa o lucro bruto (receita × margem bruta configurada) contra o investimento total." badge={<DemoBadge />} />
      <PageGuide id="financial" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {CARDS.map((k) => <KpiCard key={k} k={k} value={getKpi(d, k)} prev={a.prevTotal ? getKpi(a.prevTotal, k) : null} hasPrev={a.hasPrev} compact={['investment', 'revenue', 'profit', 'otherCost'].includes(k)} d={d} />)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Da receita ao lucro estimado" subtitle={`Margem bruta de ${percent(a.margin * 100, 0)} definida em Settings`}>
          <div className="space-y-2.5">
            {steps.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs">
                  <span className={clsx(s.kind === 'total' || s.kind === 'pos' ? 'font-semibold' : 'muted')}>{s.label}</span>
                  <span className={clsx('tabular-nums font-medium', s.v < 0 && 'text-bad', s.kind === 'pos' && 'text-good-ink dark:text-good')}>{money(s.v)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.abs(s.v) / maxAbs) * 100}%`, background: s.kind === 'total' ? t.series[0] : s.kind === 'pos' ? t.good : t.bad, opacity: s.kind === 'neg' ? 0.75 : 1 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/5"><div className="muted">Pedidos</div><div className="font-semibold">{num(d.orders)}</div></div>
            <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/5"><div className="muted">Clientes novos</div><div className="font-semibold">{num(d.customers)}</div></div>
          </div>
        </Card>
        <Card className="xl:col-span-3" title="Lucro estimado por canal/campanha" subtitle="Barras vermelhas: investimento maior que o lucro bruto gerado" actions={<Segmented size="sm" value={by} onChange={setBy} options={[{ value: 'channel', label: 'Canais' }, { value: 'campaign', label: 'Campanhas' }]} />}>
          <ResponsiveContainer width="100%" height={Math.max(260, chartRows.length * 26)}>
            <BarChart data={chartRows.map((r) => ({ name: r.name, v: r.d.profit, roi: r.d.roi }))} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} />
              <YAxis type="category" dataKey="name" width={190} tick={{ ...t.tick, fill: t.dark ? '#c3c8d4' : '#52514e' }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 27) + '…' : v)} />
              <ReferenceLine x={0} stroke={t.axis} />
              <Tooltip cursor={{ fill: t.cursor }} content={({ active, payload }) => (active && payload?.[0] ? <ChartTip active label={String(payload[0].payload.name)} rows={[{ name: 'Lucro estimado', value: money(payload[0].value as number) }, { name: 'ROI', value: percent(payload[0].payload.roi, 1) }]} /> : null)} />
              <Bar dataKey="v" radius={4} maxBarSize={16}>
                {chartRows.map((r) => <Cell key={r.id} fill={r.d.profit >= 0 ? t.series[0] : t.bad} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-4" title="Rentabilidade comparada" subtitle={`${by === 'channel' ? 'Canais' : 'Campanhas'} no período · ordene por qualquer coluna`} actions={<Segmented size="sm" value={by} onChange={setBy} options={[{ value: 'channel', label: 'Canais' }, { value: 'campaign', label: 'Campanhas' }]} />}>
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} initialSort={{ key: 'profit', dir: 'desc' }} search={(r) => r.name} searchPlaceholder="Pesquisar…" />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={<span className="flex items-center gap-1.5"><Calculator size={15} /> Fórmulas aplicadas com os valores do período</span>} subtitle="Todos os indicadores são recalculados a partir das linhas filtradas; divisões por zero retornam “—”">
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[640px]">
              <tbody>
                {formulas.map((f) => (
                  <tr key={f.name} className="border-b border-slate-50 align-top dark:border-white/5">
                    <td className="td pl-5 font-semibold">{f.name}</td>
                    <td className="td whitespace-normal text-xs"><div>{f.f}</div><div className="mt-0.5 font-mono text-[11px] muted">{f.calc}</div></td>
                    <td className="td pr-5 text-right font-semibold">{f.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-1.5"><Scale size={15} /> ROAS ≠ ROI</span>}>
          <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p><span className="font-semibold text-slate-900 dark:text-slate-100">ROAS ({ratio(d.roas)})</span> mede quanto de receita cada R$ 1 em anúncios trouxe. Ignora margem e custos não-mídia, por isso um ROAS acima de 1 pode ainda dar prejuízo.</p>
            <p><span className="font-semibold text-slate-900 dark:text-slate-100">ROI ({percent(d.roi, 1)})</span> usa o retorno financeiro (lucro bruto = receita × {percent(a.margin * 100, 0)}) contra todo o investimento de marketing, incluindo produção, ferramentas e agência.</p>
            <p>Break-even de ROAS com a margem atual: <span className="font-semibold">{ratio(d.mediaSpend ? (d.investment / a.margin) / d.mediaSpend : null)}</span> — abaixo disso, a mídia não se paga.</p>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-white/10">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Modelo de atribuição: {settings.attributionModel}</div>
              <p className="mt-0.5">Toda a receita de um pedido é atribuída ao último canal clicado antes da compra. Canais de topo de funil (TikTok, Display, Podcasts) tendem a ser sub-representados nesse modelo.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
