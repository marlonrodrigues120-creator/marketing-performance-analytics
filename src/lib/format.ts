const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 2 })
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export const NA = '—'

export function money(v: number | null | undefined, opts?: { compact?: boolean; cents?: boolean }) {
  if (v === null || v === undefined || !isFinite(v)) return NA
  if (opts?.compact && Math.abs(v) >= 10000) {
    const abs = Math.abs(v)
    const s = abs >= 1e6 ? `${dec.format(abs / 1e6)} mi` : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(abs / 1e3)} mil`
    return `${v < 0 ? '-' : ''}R$ ${s}`
  }
  return opts?.cents === false || Math.abs(v) >= 1000 ? brl0.format(v) : brl.format(v)
}

export function num(v: number | null | undefined, opts?: { compact?: boolean }) {
  if (v === null || v === undefined || !isFinite(v)) return NA
  if (opts?.compact && Math.abs(v) >= 100000) {
    return v >= 1e6 ? `${dec.format(v / 1e6)} mi` : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v / 1e3)} mil`
  }
  return int.format(v)
}

export function percent(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || !isFinite(v)) return NA
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)}%`
}

export function ratio(v: number | null | undefined) {
  if (v === null || v === undefined || !isFinite(v)) return NA
  return `${dec.format(v)}x`
}

export function signedPct(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined || !isFinite(v)) return NA
  return `${v > 0 ? '+' : ''}${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)}%`
}

export function dateBR(iso: string | null | undefined) {
  if (!iso) return NA
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function dateTimeBR(iso: string | null | undefined) {
  if (!iso) return NA
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function relTime(iso: string | null | undefined) {
  if (!iso) return 'nunca'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  return `há ${Math.floor(diff / 86400)} d`
}
