import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { InfoTip } from './ui'
import { KPIS, trendTone, type KpiKey } from '../lib/kpis'
import { signedPct } from '../lib/format'
import { useStore } from '../store/AppStore'
import { plain } from '../lib/learn'
import type { Derived } from '../data/types'

export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const o = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => o.disconnect()
  }, [])
  return dark
}

/** Paleta categórica validada (ordem fixa) — claro / escuro */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export function useChartTheme() {
  const dark = useIsDark()
  return {
    dark,
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    grid: dark ? '#262b36' : '#e9e8e3',
    axis: dark ? '#3a4050' : '#c3c2b7',
    tick: { fill: dark ? '#8b93a4' : '#898781', fontSize: 11 },
    cursor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
    ai: dark ? '#9085e9' : '#6250d6',
    good: '#0ca30c',
    bad: '#d03b3b',
    muted: dark ? '#4b5263' : '#c9c8c1',
  }
}

export interface TipRow {
  name: string
  value: string
  color?: string
}

export function ChartTip({ active, label, rows, footer }: { active?: boolean; label?: ReactNode; rows: TipRow[]; footer?: ReactNode }) {
  if (!active || !rows.length) return null
  return (
    <div className="min-w-[160px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#141c3c]/95">
      {label && <div className="mb-1 font-medium text-slate-700 dark:text-slate-200">{label}</div>}
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.name}
          </span>
          <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{r.value}</span>
        </div>
      ))}
      {footer && <div className="mt-1 border-t border-slate-100 pt-1 text-[10px] muted dark:border-white/10">{footer}</div>}
    </div>
  )
}

/** Tooltip genérico para Recharts com formatação por série */
export function makeTip(fmt: (name: string, v: number | null) => string, labelFmt?: (l: string) => ReactNode) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function Tip(props: any) {
    const rows = ((props.payload ?? []) as { name?: string; value?: number | null; color?: string; dataKey?: string }[]).filter((p) => p.name).map((p) => ({ name: String(p.name), value: fmt(String(p.dataKey ?? p.name), p.value ?? null), color: p.color }))
    return <ChartTip active={props.active} label={labelFmt ? labelFmt(String(props.label)) : props.label} rows={rows} />
  }
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function KpiCard({ k, value, prev, spark, hasPrev = true, compact, sub, d }: { k: KpiKey; value: number | null; prev: number | null; spark?: (number | null)[]; hasPrev?: boolean; compact?: boolean; sub?: ReactNode; d?: Derived }) {
  const { didactic } = useStore()
  const explain = didactic && d ? plain(k, d) : null
  const def = KPIS[k]
  const delta = value !== null && prev !== null && prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : null
  const tone = trendTone(k, delta)
  const t = useChartTheme()
  const color = tone === 'good' ? '#0ca30c' : tone === 'bad' ? '#d03b3b' : t.dark ? '#3987e5' : '#2a78d6'
  const data = (spark ?? []).map((v, i) => ({ i, v }))
  const id = `sp-${k}`
  return (
    <div className="card group relative flex flex-col overflow-hidden p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {def.label}
        <InfoTip
          text={
            <>
              <span className="block font-medium text-slate-800 dark:text-slate-100">{def.label}</span>
              {def.help}
              {def.formula && <span className="mt-1 block rounded bg-slate-50 px-1.5 py-1 font-mono text-[10px] dark:bg-white/5">{def.formula}</span>}
              {def.better !== null && <span className="mt-1 block">Tendência positiva: {def.better ? 'alta' : 'queda'}.</span>}
            </>
          }
        />
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular">{compact && def.fmtCompact ? def.fmtCompact(value) : def.fmt(value)}</div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {hasPrev && delta !== null ? (
          <span className={clsx('inline-flex items-center gap-0.5 font-medium', tone === 'good' && 'text-good-ink dark:text-good', tone === 'bad' && 'text-bad', tone === 'neutral' && 'text-slate-500')}>
            {delta > 0.5 ? <ArrowUpRight size={13} /> : delta < -0.5 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
            {signedPct(delta)}
          </span>
        ) : (
          <span className="muted">sem comparação</span>
        )}
        {hasPrev && prev !== null && <span className="truncate muted">vs. {compact && def.fmtCompact ? def.fmtCompact(prev) : def.fmt(prev)}</span>}
      </div>
      {sub && !explain && <div className="mt-1 text-[11px] muted">{sub}</div>}
      {explain && <p className="relative z-10 mt-3 border-t border-slate-100 pt-2.5 text-[12px] leading-snug text-slate-600 dark:border-white/[0.06] dark:text-slate-300">{explain}</p>}
      {data.length > 2 && !sub && (
        <div className="pointer-events-none absolute right-3 top-3 h-8 w-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
