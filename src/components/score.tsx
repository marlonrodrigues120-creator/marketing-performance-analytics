import clsx from 'clsx'
import type { CampaignScore, ScoreClass } from '../lib/score'

export const CLASS_TONE: Record<ScoreClass, string> = {
  Excelente: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  Bom: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30',
  Regular: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  'Necessita atenção': 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
}

export function ScorePill({ s }: { s: CampaignScore }) {
  if (s.score === null) return <span className="text-xs muted">—</span>
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', CLASS_TONE[s.cls!])} title={s.explanation}>
      {s.score}
      <span className="font-medium">{s.cls}</span>
    </span>
  )
}

export function ScoreGauge({ s, size = 120 }: { s: CampaignScore; size?: number }) {
  const v = s.score ?? 0
  const r = size / 2 - 10
  const c = Math.PI * r
  const color = s.cls === 'Excelente' ? '#0ca30c' : s.cls === 'Bom' ? '#2a78d6' : s.cls === 'Regular' ? '#eda100' : '#d03b3b'
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 18 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path d={`M10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`} fill="none" stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth={10} strokeLinecap="round" />
        <path d={`M10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-2xl font-semibold leading-none">{s.score ?? '—'}</div>
        <div className="mt-0.5 text-[11px] muted">{s.cls ?? 'sem dados'}</div>
      </div>
    </div>
  )
}
