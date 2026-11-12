import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Card, EmptyState, InfoTip, Segmented } from '../components/ui'
import { Legend, makeTip, useChartTheme } from '../components/charts'
import { autoGranularity, TrendLine } from '../components/widgets'
import { sum, timeSeries, type Granularity, type SeriesPoint } from '../lib/metrics'
import { campaignStats, channelStats } from '../lib/query'
import { KPIS, getKpi, trendTone, type KpiKey } from '../lib/kpis'
import { money, num, percent, ratio, signedPct } from '../lib/format'
import type { Derived } from '../data/types'

const HERO: KpiKey[] = ['revenue', 'investment', 'roas', 'roi']
const STRIP: KpiKey[] = ['cac', 'leads', 'customers', 'cpl', 'ctr', 'cpc']

function Delta({ k, cur, prev }: { k: KpiKey; cur: number | null; prev: number | null }) {
  const d = cur !== null && prev ? ((cur - prev) / Math.abs(prev)) * 100 : null
  if (d === null) return <span className="text-xs text-slate-400">sem comparação</span>
  const tone = trendTone(k, d)
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-medium tabular', tone === 'good' && 'text-good-ink dark:text-good', tone === 'bad' && 'text-bad', tone === 'neutral' && 'text-slate-500')}>
      {d > 0.5 ? <ArrowUpRight size={13} /> : d < -0.5 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {signedPct(d)}
    </span>
  )
}

function HeroKpi({ k, d, prev, series, color }: { k: KpiKey; d: Derived; prev: Derived | null; series: SeriesPoint[]; color: string }) {
  const def = KPIS[k]
  const v = getKpi(d, k)
  const id = `hero-${k}`
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">{def.label}<InfoTip text={<><b className="block text-slate-800 dark:text-slate-100">{def.label}</b>{def.help}{def.formula && <span className="mt-1 block font-mono text-[10px]">{def.formula}</span>}</>} /></div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-[30px] font-semibold leading-none tracking-[-0.025em] tabular">{(def.fmtCompact ?? def.fmt)(v)}</span>
          <Delta k={k} cur={v} prev={prev ? getKpi(prev, k) : null} />
        </div>
        <div className="mt-1 text-xs text-slate-500">{prev ? `antes ${(def.fmtCompact ?? def.fmt)(getKpi(prev, k))}` : ' '}</div>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series.map((p) => ({ v: getKpi(p, k) }))} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Overview() {
  const a = useAnalytics()
  const { channels: allChannels, campaigns: allCampaigns, settings } = useStore()
  const t = useChartTheme()
  const nav = useNavigate()
  const [gran, setGran] = useState<Granularity>(autoGranularity(a.range.days))
  const g = gran === 'day' && a.range.days > 200 ? 'week' : gran
  const series = useMemo(() => timeSeries(a.rows, g, a.margin), [a.rows, g, a.margin])
  const spark = useMemo(() => timeSeries(a.rows, autoGranularity(a.range.days), a.margin), [a.rows, a.range.days, a.margin])
  const chStats = useMemo(() => channelStats(allCampaigns, allChannels, a.rows, a.margin).sort((x, y) => y.d.investment - x.d.investment), [a.rows, a.margin, allCampaigns, allChannels])
  const cStats = useMemo(() => campaignStats(allCampaigns, allChannels, a.rows, a.margin), [a.rows, a.margin, allCampaigns, allChannels])

  if (a.rows.length === 0)
    return (
      <>
        <h1 className="mb-5 text-[28px] font-semibold tracking-[-0.02em]">Overview</h1>
        <div className="card"><EmptyState title="Nenhum dado para os filtros selecionados" description="Amplie o período ou remova filtros de canal, campanha, plataforma ou tipo de conversão." /></div>
      </>
    )

  const d = a.total
  const p = a.prevTotal
  const rev = p ? ((d.revenue - p.revenue) / p.revenue) * 100 : null
  const top = [...cStats].sort((x, y) => y.d.revenue - x.d.revenue).slice(0, 6)
  const funnel = [
    { l: 'Impressões', v: d.impressions },
    { l: 'Cliques', v: d.clicks },
    { l: 'Visitantes', v: d.visitors },
    { l: 'Leads', v: d.leads },
    { l: 'Oportunidades', v: d.opportunities },
    { l: 'Clientes', v: d.customers },
  ]
  const fmax = Math.log10(Math.max(10, d.impressions))
  const totalInv = d.investment
  const colors = [t.series[1], t.series[0], t.series[2], t.series[6]]

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Overview</h1>
      </div>

      <section className="mb-4 grid items-center gap-6 overflow-hidden rounded-2xl bg-navy-900 p-6 text-white sm:p-7 lg:grid-cols-[1fr_auto] dark:bg-navy-800">
        <p className="max-w-3xl text-[21px] font-medium leading-[1.5] tracking-[-0.01em] sm:text-[24px]">
          Você investiu {money(d.investment, { compact: true })} e gerou {money(d.revenue, { compact: true })} em receita
          {rev !== null && <span className={rev >= 0 ? 'text-emerald-300' : 'text-red-300'}> ({signedPct(rev)})</span>}. Cada R$ 1 em anúncios voltou como <span className="text-brand-300">R$ {d.roas?.toFixed(2).replace('.', ',') ?? '—'}</span>.
        </p>
        <dl className="grid grid-cols-3 gap-6 border-white/10 lg:grid-cols-1 lg:gap-4 lg:border-l lg:pl-7">
          {[
            ['Lucro estimado', money(d.profit, { compact: true }), d.profit >= 0],
            ['Clientes novos', num(d.customers), true],
            ['Custo por cliente', money(d.cac), d.cac !== null && d.cac <= settings.cacLimit],
          ].map(([l, v, ok]) => (
            <div key={String(l)}>
              <dt className="text-xs text-slate-400">{l}</dt>
              <dd className={clsx('text-lg font-semibold tabular', !ok && 'text-red-300')}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {HERO.map((k, i) => <HeroKpi key={k} k={k} d={d} prev={p} series={spark} color={colors[i]} />)}
      </div>

      <div className="card mt-4 grid grid-cols-2 divide-slate-100 sm:grid-cols-3 sm:divide-x lg:grid-cols-6 dark:divide-white/[0.06]">
        {STRIP.map((k) => {
          const def = KPIS[k]
          const v = getKpi(d, k)
          return (
            <div key={k} className="px-5 py-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">{def.label}<InfoTip text={<><b className="block text-slate-800 dark:text-slate-100">{def.label}</b>{def.help}{def.formula && <span className="mt-1 block font-mono text-[10px]">{def.formula}</span>}</>} /></div>
              <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular">{(def.fmtCompact ?? def.fmt)(v)}</div>
              <div className="mt-1"><Delta k={k} cur={v} prev={p ? getKpi(p, k) : null} /></div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Investimento e receita" subtitle="Receita atribuída pelo último clique" actions={<Segmented size="sm" value={g} onChange={setGran} options={[{ value: 'day', label: 'Dia' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }]} />}>
          <Legend items={[{ label: 'Receita', color: t.series[1] }, { label: 'Investimento', color: t.series[0] }]} />
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ov-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.series[1]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={t.series[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={20} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} width={82} tickFormatter={(v) => money(v, { compact: true })} />
              <Tooltip cursor={{ fill: t.cursor }} content={makeTip((_k, v) => money(v))} />
              <Bar dataKey="investment" name="Investimento" fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Area type="monotone" dataKey="revenue" name="Receita" stroke={t.series[1]} strokeWidth={2} fill="url(#ov-rev)" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Investimento por canal" subtitle={`${money(totalInv)} no período`} actions={<Link to="/channels" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Ver canais</Link>}>
          <ul className="space-y-3">
            {chStats.slice(0, 8).map((c) => {
              const share = (c.d.investment / totalInv) * 100
              return (
                <li key={c.channel.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.channel.color }} />{c.channel.name}</span>
                    <span className="tabular text-slate-500"><b className="font-medium text-slate-900 dark:text-white">{money(c.d.investment, { compact: true })}</b> · ROAS {ratio(c.d.roas)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: c.channel.color }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {chStats.length > 8 && <p className="mt-3 text-xs text-slate-500">e mais {chStats.length - 8} canais com {percent((chStats.slice(8).reduce((x, c) => x + c.d.investment, 0) / totalInv) * 100, 1)} do investimento</p>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Evolução do CAC" subtitle={`Limite de ${money(settings.cacLimit)}`}>
          <TrendLine data={series} dataKey="cac" name="CAC" fmt={(v) => money(v)} reference={settings.cacLimit} refLabel="Limite" height={200} />
        </Card>
        <Card title="Evolução do ROAS" subtitle={`Meta de ${settings.roasTarget.toLocaleString('pt-BR')}x`}>
          <TrendLine data={series} dataKey="roas" name="ROAS" fmt={(v) => (v === null ? '—' : `${v.toFixed(2).replace('.', ',')}x`)} reference={settings.roasTarget} refLabel="Meta" color={t.series[2]} height={200} />
        </Card>
        <Card title="Leads e conversões" subtitle={`${num(d.leads)} leads, ${num(d.customers)} conversões`}>
          <div className="space-y-1">
            {(['leads', 'customers'] as const).map((k, i) => (
              <div key={k}>
                <div className="text-[11px] text-slate-500">{k === 'leads' ? 'Leads' : 'Conversões'}</div>
                <ResponsiveContainer width="100%" height={84}>
                  <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="label" hide={i === 0} tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={24} />
                    <YAxis tick={t.tick} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => num(v, { compact: true })} />
                    <Tooltip content={makeTip((_k, v) => num(v))} />
                    <Line type="monotone" dataKey={k} name={k === 'leads' ? 'Leads' : 'Conversões'} stroke={i === 0 ? t.series[0] : t.series[2]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Funil do período" actions={<Link to="/funnel" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Ver funil</Link>}>
          <ol className="space-y-2.5">
            {funnel.map((f, i) => (
              <li key={f.l}>
                <div className="flex items-center justify-between text-sm">
                  <span>{f.l}</span>
                  <span className="tabular"><b className="font-medium">{num(f.v, { compact: true })}</b>{i > 0 && <span className="ml-2 text-xs text-slate-500">{funnel[i - 1].v ? percent((f.v / funnel[i - 1].v) * 100, 1) : '—'}</span>}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(3, (Math.log10(Math.max(1, f.v)) / fmax) * 100)}%`, opacity: 1 - i * 0.1 }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">Percentual ao lado: quanto avançou da etapa anterior. Barras em escala logarítmica.</p>
        </Card>
        <Card className="xl:col-span-2" title="Campanhas com mais receita" actions={<Link to="/campaigns" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Ver todas</Link>}>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.06]">
                  {['Campanha', 'Investimento', 'Receita', 'ROAS', 'ROI', 'CAC'].map((h, i) => <th key={h} className={clsx('th', i === 0 ? 'pl-5' : 'text-right', i === 5 && 'pr-5')}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {top.map((s) => (
                  <tr key={s.campaign.id} onClick={() => nav(`/campaigns/${s.campaign.id}`)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03]">
                    <td className="td pl-5"><span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.channel.color }} /><span className="max-w-[260px] truncate font-medium">{s.campaign.name}</span></span></td>
                    <td className="td text-right">{money(s.d.investment, { compact: true })}</td>
                    <td className="td text-right font-medium">{money(s.d.revenue, { compact: true })}</td>
                    <td className={clsx('td text-right', s.d.roas !== null && s.d.roas < settings.roasTarget && 'text-bad')}>{ratio(s.d.roas)}</td>
                    <td className={clsx('td text-right', s.d.roi !== null && (s.d.roi >= 0 ? 'text-good-ink dark:text-good' : 'text-bad'))}>{percent(s.d.roi, 0)}</td>
                    <td className="td pr-5 text-right">{money(s.d.cac)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Juntas, respondem por {percent((sum(a.rows.filter((r) => top.some((x) => x.campaign.id === r.campaignId))).revenue / d.revenue) * 100, 0)} da receita.</p>
        </Card>
      </div>
    </>
  )
}
