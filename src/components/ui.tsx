import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, Info, Search, X } from 'lucide-react'

export function Card({ title, subtitle, actions, children, className, bodyClass, id }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={clsx('card animate-fade-up', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && <h3 className="section-title">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('px-4 pb-4 pt-3 sm:px-5', bodyClass)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, description, actions, badge }: { title: string; description?: ReactNode; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function InfoTip({ text, className }: { text: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={clsx('relative inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="Explicação" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}>
        <Info size={13} />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-5 z-50 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-normal leading-relaxed text-slate-600 shadow-lg dark:border-white/10 dark:bg-[#1a2030] dark:text-slate-300">
          {text}
        </span>
      )}
    </span>
  )
}

const TONES = {
  blue: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  purple: 'bg-ai-50 text-ai-700 dark:bg-ai-500/15 dark:text-ai-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  gray: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
}
export type Tone = keyof typeof TONES

export function Badge({ tone = 'gray', children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={clsx('chip', TONES[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function DemoBadge() {
  return (
    <Badge tone="amber" className="whitespace-nowrap">
      Dados fictícios
    </Badge>
  )
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-md font-medium transition', size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs', value === o.value ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-white/10">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition', value === t.value ? 'border-brand-500 text-brand-600 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function MultiSelect({ label, options, value, onChange, placeholder = 'Todos', icon, width = 'w-56' }: { label: string; options: { value: string; label: string; hint?: string }[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; icon?: ReactNode; width?: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
  const text = value.length === 0 ? placeholder : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? '1 selecionado' : `${value.length} selecionados`
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={clsx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition', value.length ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300')} aria-haspopup="listbox" aria-expanded={open}>
        {icon}
        <span className="text-slate-400 dark:text-slate-500">{label}:</span>
        <span className="max-w-[120px] truncate font-medium">{text}</span>
        {value.length > 0 ? (
          <X size={12} className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange([]) }} />
        ) : (
          <ChevronDown size={12} className="opacity-60" />
        )}
      </button>
      {open && (
        <div className={clsx('absolute left-0 top-full z-40 mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#1a2030]', width)}>
          {options.length > 6 && (
            <div className="relative mb-1">
              <Search size={13} className="absolute left-2 top-2 text-slate-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="input py-1.5 pl-7 text-xs" />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto" role="listbox">
            {filtered.map((o) => {
              const sel = value.includes(o.value)
              return (
                <button key={o.value} role="option" aria-selected={sel} onClick={() => onChange(sel ? value.filter((v) => v !== o.value) : [...value, o.value])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/10">
                  <span className={clsx('flex h-4 w-4 shrink-0 items-center justify-center rounded border', sel ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 dark:border-white/20')}>{sel && <Check size={11} />}</span>
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-[10px] muted">{o.hint}</span>}
                </button>
              )
            })}
            {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs muted">Nada encontrado</p>}
          </div>
          {value.length > 0 && (
            <button onClick={() => onChange([])} className="mt-1 w-full rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-brand-600 hover:bg-slate-50 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/5">
              Limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={clsx('card flex max-h-[92vh] w-full flex-col animate-fade-up rounded-b-none sm:rounded-xl', { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[size])} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/10">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-white/5">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200/70 dark:bg-white/5', className)} />
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50', checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-white/20')}>
      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}

/* ------------------------------ Tabela ------------------------------ */
export interface Column<T> {
  key: string
  header: ReactNode
  value?: (row: T) => number | string | null
  render?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  className?: string
  sticky?: boolean
}

export function DataTable<T>({ rows, columns, rowKey, search, searchPlaceholder = 'Pesquisar…', initialSort, onRowClick, empty, toolbar, pageSize = 0, dense }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; search?: (r: T) => string; searchPlaceholder?: string; initialSort?: { key: string; dir: 'asc' | 'desc' }; onRowClick?: (r: T) => void; empty?: ReactNode; toolbar?: ReactNode; pageSize?: number; dense?: boolean }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)
  const data = useMemo(() => {
    let d = rows
    if (search && q.trim()) {
      const t = q.trim().toLowerCase()
      d = d.filter((r) => search(r).toLowerCase().includes(t))
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.value) {
        d = [...d].sort((a, b) => {
          const va = col.value!(a)
          const vb = col.value!(b)
          if (va === null || va === undefined) return 1
          if (vb === null || vb === undefined) return -1
          const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
          return sort.dir === 'asc' ? r : -r
        })
      }
    }
    return d
  }, [rows, q, sort, columns, search])
  useEffect(() => { setPage(0) }, [q, rows.length])
  const pages = pageSize ? Math.max(1, Math.ceil(data.length / pageSize)) : 1
  const view = pageSize ? data.slice(page * pageSize, (page + 1) * pageSize) : data
  return (
    <div>
      {(search || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="input pl-8" aria-label={searchPlaceholder} />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-max border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th key={c.key} className={clsx('th border-b border-slate-100 bg-slate-50/80 first:pl-4 last:pr-4 dark:border-white/5 dark:bg-white/[0.02] sm:first:pl-5 sm:last:pr-5', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.sticky && 'sticky left-0 z-10 bg-slate-50 dark:bg-[#151b27]')}>
                    {c.sortable !== false && c.value ? (
                      <button className={clsx('inline-flex items-center gap-1 uppercase hover:text-slate-800 dark:hover:text-slate-200', active && 'text-brand-600 dark:text-brand-300')} onClick={() => setSort(active ? { key: c.key, dir: sort!.dir === 'desc' ? 'asc' : 'desc' } : { key: c.key, dir: 'desc' })}>
                        {c.header}
                        {active ? sort!.dir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : <ArrowUpDown size={11} className="opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx('group transition-colors', onRowClick && 'cursor-pointer', 'hover:bg-slate-50 dark:hover:bg-white/[0.03]')}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx('td border-b border-slate-100 first:pl-4 last:pr-4 dark:border-white/5 sm:first:pl-5 sm:last:pr-5', dense && 'py-2', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.sticky && 'sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-[#121722] dark:group-hover:bg-[#161c28]', c.className)}>
                    {c.render ? c.render(r) : String(c.value?.(r) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && (empty ?? <EmptyState title="Nenhum registro encontrado" description="Ajuste a pesquisa ou os filtros." />)}
      </div>
      {pageSize > 0 && pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs muted">
          <span>
            {page * pageSize + 1}–{Math.min(data.length, (page + 1) * pageSize)} de {data.length}
          </span>
          <div className="flex gap-1">
            <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <button className="btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Toast ------------------------------ */
type ToastItem = { id: number; text: string; tone: 'success' | 'error' | 'info' }
let pushToast: (t: Omit<ToastItem, 'id'>) => void = () => {}
export const toast = {
  success: (text: string) => pushToast({ text, tone: 'success' }),
  error: (text: string) => pushToast({ text, tone: 'error' }),
  info: (text: string) => pushToast({ text, tone: 'info' }),
}
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random()
      setItems((i) => [...i, { ...t, id }])
      setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), 4200)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={clsx('pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg animate-fade-up', t.tone === 'success' && 'border-emerald-200 bg-white text-slate-800 dark:border-emerald-500/30 dark:bg-[#132019] dark:text-emerald-100', t.tone === 'error' && 'border-red-200 bg-white text-slate-800 dark:border-red-500/30 dark:bg-[#251416] dark:text-red-100', t.tone === 'info' && 'border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-[#1a2030] dark:text-slate-100')}>
          <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', t.tone === 'success' ? 'bg-good' : t.tone === 'error' ? 'bg-bad' : 'bg-brand-500')} />
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[11px] text-bad">{error}</span> : hint ? <span className="mt-1 block text-[11px] muted">{hint}</span> : null}
    </label>
  )
}
