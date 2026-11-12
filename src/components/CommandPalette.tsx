import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { CornerDownLeft, Megaphone, Search, X } from 'lucide-react'
import { useStore } from '../store/AppStore'

/* ------------------------------------------------------------------ Busca rápida */
const PAGES = [
  ['Overview', '/', 'Resumo e KPIs'],
  ['Campanhas', '/campaigns', 'Tabela e score'],
  ['Canais', '/channels', 'Comparação e ranking'],
  ['Funil de conversão', '/funnel', 'Gargalos por etapa'],
  ['Análise financeira', '/financial', 'Lucro, ROI e fórmulas'],
  ['Evolução no tempo', '/performance', 'Tendências'],
  ['Simulador de orçamento', '/simulator', 'Cenários de investimento'],
  ['Automações', '/automation', 'Workflows e histórico'],
  ['Importar dados', '/import', 'CSV'],
  ['Configurações', '/settings', 'Metas, score e integrações'],
] as const

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { campaigns } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      setTimeout(() => input.current?.focus(), 10)
    }
  }, [open])
  const items = useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const m = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t)
    const out: { label: string; hint: string; to: string; icon: 'page' | 'camp' }[] = []
    for (const [l, to, h] of PAGES) if (!t || m(l) || m(h)) out.push({ label: l, hint: h, to, icon: 'page' })
    if (t) for (const c of campaigns) if (m(c.name)) out.push({ label: c.name, hint: 'Campanha', to: `/campaigns/${c.id}`, icon: 'camp' })
    return out.slice(0, 12)
  }, [q, campaigns])
  if (!open) return null
  const go = (to: string) => {
    onClose()
    nav(to)
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-label="Busca rápida" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-navy-800" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/10">
          <Search size={18} className="text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
              if (e.key === 'Enter' && items[idx]) go(items[idx].to)
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Busque uma tela ou campanha"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
          />
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar"><X size={16} /></button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {items.map((it, i) => (
            <li key={it.to + it.label}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(it.to)} className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === idx ? 'bg-slate-100 dark:bg-white/10' : '')} role="option" aria-selected={i === idx}>
                <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', it.icon === 'camp' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300')}>
                  {it.icon === 'camp' ? <Megaphone size={15} /> : <CornerDownLeft size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.label}</span>
                  <span className="block text-xs text-slate-500">{it.hint}</span>
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nada encontrado. Tente o nome de uma campanha ou canal.</li>}
        </ul>
        <div className="flex gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-white/10"><span>↑↓ navegar</span><span>Enter abrir</span><span>Esc fechar</span></div>
      </div>
    </div>
  )
}

