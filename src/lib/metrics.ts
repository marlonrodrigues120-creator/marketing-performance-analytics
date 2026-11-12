import type { DailyMetric, Derived, Totals } from '../data/types'

/** Divisão segura: retorna null quando o denominador é zero ou inválido. */
export const safeDiv = (a: number, b: number): number | null => (b > 0 && isFinite(a) ? a / b : null)

export function emptyTotals(): Totals {
  return { mediaSpend: 0, otherCost: 0, investment: 0, impressions: 0, clicks: 0, paidClicks: 0, visitors: 0, leads: 0, opportunities: 0, customers: 0, orders: 0, revenue: 0 }
}

export function sum(rows: DailyMetric[]): Totals {
  const t = emptyTotals()
  for (const r of rows) {
    t.mediaSpend += r.mediaSpend
    t.otherCost += r.otherCost
    t.impressions += r.impressions
    t.clicks += r.clicks
    if (r.mediaSpend > 0) t.paidClicks += r.clicks
    t.visitors += r.visitors
    t.leads += r.leads
    t.opportunities += r.opportunities
    t.customers += r.customers
    t.orders += r.orders
    t.revenue += r.revenue
  }
  t.investment = t.mediaSpend + t.otherCost
  return t
}

/**
 * Fórmulas oficiais da plataforma (documentadas em Financial Analysis):
 * - Investimento total = mídia + custos não-mídia (produção, ferramentas, agência)
 * - CAC  = Investimento total / novos clientes
 * - CPL  = Investimento total / leads
 * - ROAS = Receita atribuída / Investimento em anúncios (mídia)
 * - ROI  = ((Lucro bruto − Investimento total) / Investimento total) × 100
 *          onde Lucro bruto = Receita × margem bruta (receita ≠ lucro)
 * - CTR  = Cliques / Impressões × 100
 * - CPC  = Investimento em anúncios / Cliques pagos
 * - Conversion Rate = Conversões / Cliques × 100
 * - AOV  = Receita / Pedidos
 */
export function derive(t: Totals, margin: number): Derived {
  const grossProfit = t.revenue * margin
  const roi = safeDiv(grossProfit - t.investment, t.investment)
  return {
    ...t,
    ctr: pct(safeDiv(t.clicks, t.impressions)),
    cpc: t.mediaSpend > 0 ? safeDiv(t.mediaSpend, t.paidClicks) : null,
    cpl: safeDiv(t.investment, t.leads),
    cac: safeDiv(t.investment, t.customers),
    roas: safeDiv(t.revenue, t.mediaSpend),
    roi: roi === null ? null : roi * 100,
    convRate: pct(safeDiv(t.customers, t.clicks)),
    aov: safeDiv(t.revenue, t.orders),
    grossProfit,
    profit: grossProfit - t.investment,
    revPerCustomer: safeDiv(t.revenue, t.customers),
    leadRate: pct(safeDiv(t.leads, t.visitors)),
  }
}

const pct = (v: number | null) => (v === null ? null : v * 100)

export function groupBy<K extends string>(rows: DailyMetric[], key: (r: DailyMetric) => K): Map<K, DailyMetric[]> {
  const m = new Map<K, DailyMetric[]>()
  for (const r of rows) {
    const k = key(r)
    let arr = m.get(k)
    if (!arr) m.set(k, (arr = []))
    arr.push(r)
  }
  return m
}

export type Granularity = 'day' | 'week' | 'month'

export function bucketKey(date: string, g: Granularity): string {
  if (g === 'day') return date
  if (g === 'month') return date.slice(0, 7)
  const d = new Date(date + 'T00:00:00')
  const day = (d.getDay() + 6) % 7 // segunda = 0
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

export interface SeriesPoint extends Derived {
  key: string
  label: string
}

export function timeSeries(rows: DailyMetric[], g: Granularity, margin: number, allDates?: string[]): SeriesPoint[] {
  const groups = groupBy(rows, (r) => bucketKey(r.date, g))
  const keys = allDates ? Array.from(new Set(allDates.map((d) => bucketKey(d, g)))) : Array.from(groups.keys())
  keys.sort()
  return keys.map((k) => ({ key: k, label: bucketLabel(k, g), ...derive(sum(groups.get(k) ?? []), margin) }))
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function bucketLabel(k: string, g: Granularity) {
  if (g === 'month') {
    const [y, m] = k.split('-')
    return `${MONTHS[+m - 1]}/${y.slice(2)}`
  }
  const [, m, d] = k.split('-')
  return `${d}/${m}`
}

/** Inclinação de regressão linear normalizada pela média (variação % por período). */
export function trendSlope(values: (number | null)[]): number | null {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null && isFinite(p[1]))
  if (pts.length < 3) return null
  const n = pts.length
  const mx = pts.reduce((a, p) => a + p[0], 0) / n
  const my = pts.reduce((a, p) => a + p[1], 0) / n
  let num = 0
  let den = 0
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my)
    den += (x - mx) ** 2
  }
  if (den === 0 || my === 0) return null
  return ((num / den) / Math.abs(my)) * 100
}

export function variation(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

export function stdev(values: number[]) {
  if (values.length < 2) return 0
  const m = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1))
}
