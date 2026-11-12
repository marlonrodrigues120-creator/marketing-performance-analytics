import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, ArrowRight, Lightbulb } from 'lucide-react'
import { ChartTip, makeTip, useChartTheme } from './charts'
import { Badge } from './ui'
import type { Insight } from '../lib/insights'
import type { Granularity } from '../lib/metrics'

export function autoGranularity(days: number): Granularity {
  return days <= 45 ? 'day' : days <= 200 ? 'week' : 'month'
}

export function TrendLine({ data, dataKey, name, fmt, reference, refLabel, color, height = 220, compare, compareName }: { data: object[]; dataKey: string; name: string; fmt: (v: number | null) => string; reference?: number; refLabel?: string; color?: string; height?: number; compare?: string; compareName?: string }) {
  const t = useChartTheme()
  const c = color ?? t.series[0]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={t.tick} axisLine={{ stroke: t.axis }} tickLine={false} minTickGap={24} />
        <YAxis tick={t.tick} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => fmt(v)} />
        <Tooltip cursor={{ stroke: t.axis }} content={makeTip((_k, v) => fmt(v))} />
        {reference !== undefined && <ReferenceLine y={reference} stroke={t.ai} strokeDasharray="4 4" label={{ value: refLabel, position: 'insideTopRight', fill: t.ai, fontSize: 11 }} />}
        {compare && <Line type="monotone" dataKey={compare} name={compareName} stroke={t.muted} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />}
        <Line type="monotone" dataKey={dataKey} name={name} stroke={c} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: t.dark ? '#121722' : '#fff' }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface RankItem {
  id: string
  name: string
  value: number | null
  color?: string
  extra?: string
}

export function RankBars({ items, fmt, height, reference, good, onClick, colorByEntity }: { items: RankItem[]; fmt: (v: number | null) => string; height?: number; reference?: number; good?: (v: number) => boolean; onClick?: (id: string) => void; colorByEntity?: boolean }) {
  const t = useChartTheme()
  const data = items.filter((i) => i.value !== null)
  const h = height ?? Math.max(120, data.length * 30 + 20)
  const allNeg = data.length > 0 && data.every((d) => d.value! <= 0)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: allNeg ? 8 : 84, bottom: 0, left: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide domain={[(min: number) => Math.min(0, min), 'auto']} />
        <YAxis type="category" dataKey="name" width={190} tick={{ ...t.tick, fill: t.dark ? '#c3c8d4' : '#52514e' }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 30 ? v.slice(0, 29) + '…' : v)} />
        <Tooltip cursor={{ fill: t.cursor }} content={({ active, payload }) => (active && payload?.[0] ? <ChartTip active label={String(payload[0].payload.name)} rows={[{ name: 'Valor', value: fmt(payload[0].value as number) }, ...(payload[0].payload.extra ? [{ name: 'Detalhe', value: String(payload[0].payload.extra) }] : [])]} /> : null)} />
        {reference !== undefined && <ReferenceLine x={reference} stroke={t.ai} strokeDasharray="4 4" />}
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={allNeg ? 22 : 18} onClick={onClick ? (d: { payload?: RankItem }) => d.payload && onClick(d.payload.id) : undefined} cursor={onClick ? 'pointer' : undefined}>
          {data.map((d) => (
            <Cell key={d.id} fill={colorByEntity && d.color ? d.color : good ? (good(d.value!) ? t.series[0] : t.bad) : t.series[0]} />
          ))}
          <LabelList dataKey="value" position={allNeg ? 'insideLeft' : 'right'} formatter={(v: unknown) => fmt(v as number)} style={{ fontSize: 11, fill: allNeg ? '#fff' : t.dark ? '#c3c8d4' : '#52514e' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const PRIO_TONE = { Alta: 'red', Média: 'amber', Baixa: 'gray' } as const

export function InsightCard({ i, compact }: { i: Insight; compact?: boolean }) {
  return (
    <div className="card flex flex-col p-4 transition hover:shadow-md animate-fade-up">
      <div className="flex items-start gap-3">
        <div className={clsx('mt-0.5 rounded-lg p-2', i.type === 'problem' ? 'bg-red-50 text-bad dark:bg-red-500/10' : 'bg-ai-50 text-ai-500 dark:bg-ai-500/15 dark:text-ai-300')}>{i.type === 'problem' ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={PRIO_TONE[i.priority]}>Prioridade {i.priority.toLowerCase()}</Badge>
            <Badge tone={i.type === 'problem' ? 'red' : 'purple'}>{i.type === 'problem' ? 'Problema' : 'Oportunidade'}</Badge>
            <Badge tone="blue">{i.metric}</Badge>
          </div>
          <h4 className="mt-2 text-sm font-semibold leading-snug">{i.title}</h4>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {i.entityType}:{' '}
            {i.entityType === 'Campanha' && i.entityId ? (
              <Link className="text-brand-600 hover:underline dark:text-brand-300" to={`/campaigns/${i.entityId}`}>{i.entity}</Link>
            ) : (
              i.entity
            )}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{i.description}</p>
        </div>
      </div>
      {!compact && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {i.evidence.map((e) => (
              <div key={e.label} className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/5">
                <div className="text-[10px] muted">{e.label}</div>
                <div className="text-xs font-semibold tabular-nums">{e.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-ai-100 bg-ai-50/60 p-2.5 text-xs leading-relaxed dark:border-ai-500/20 dark:bg-ai-500/10">
            <span className="font-semibold text-ai-700 dark:text-ai-300">Recomendação: </span>
            {i.recommendation}
          </div>
        </>
      )}
      <div className="mt-auto flex items-center justify-between pt-3 text-xs">
        <span className="muted">Impacto potencial: <span className="font-medium text-slate-700 dark:text-slate-200">{i.impact}</span></span>
      </div>
    </div>
  )
}

export function SeeAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
      {children} <ArrowRight size={12} />
    </Link>
  )
}

export function MetricSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="input w-auto py-1 text-xs dark:[color-scheme:dark]" aria-label="Métrica">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
