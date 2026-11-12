import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, CornerDownLeft, GraduationCap, Lightbulb, Megaphone, Search, Sparkles, X } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { PAGE_GUIDES } from '../lib/learn'
import type { Derived } from '../data/types'
import { money, num, percent, ratio, signedPct } from '../lib/format'

/* ------------------------------------------------------------------ Guia por página */
export function PageGuide({ id }: { id: keyof typeof PAGE_GUIDES }) {
  const { didactic } = useStore()
  const key = `mpa.guide.${id}`
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== 'closed')
  if (!didactic) return null
  const g = PAGE_GUIDES[id]
  const toggle = () => {
    localStorage.setItem(key, open ? 'closed' : 'open')
    setOpen(!open)
  }
  return (
    <section className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/60 dark:border-brand-500/20 dark:bg-brand-500/[0.07]">
      <button onClick={toggle} className="flex w-full items-center gap-2.5 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white"><Lightbulb size={15} /></span>
        <span className="flex-1 text-sm font-semibold text-brand-900 dark:text-brand-100">{g.title}</span>
        <span className="hidden text-xs text-brand-700/70 dark:text-brand-200/60 sm:inline">{open ? 'Ocultar' : 'Mostrar'}</span>
        <ChevronDown size={16} className={clsx('text-brand-700 transition-transform dark:text-brand-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-4 px-4 pb-4 text-sm md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="mb-1.5 text-xs font-medium text-brand-800/80 dark:text-brand-200/80">Esta tela responde</p>
            <ul className="space-y-1">
              {g.answers.map((a) => <li key={a} className="text-slate-800 dark:text-slate-200">{a}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-brand-800/80 dark:text-brand-200/80">Como ler</p>
            <ol className="list-decimal space-y-1 pl-4 text-slate-700 marker:text-brand-500 dark:text-slate-300">
              {g.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            {g.inspired && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{g.inspired}</p>}
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ Resumo narrativo */
export function PeriodStory({ d, prev, days, topChannel, worstCampaign, insights }: { d: Derived; prev: Derived | null; days: number; topChannel?: { name: string; roi: number | null }; worstCampaign?: { name: string; profit: number }; insights: number }) {
  const dv = (a: number | null, b: number | null | undefined) => (a !== null && b ? ((a - b) / Math.abs(b)) * 100 : null)
  const rev = dv(d.revenue, prev?.revenue)
  const cac = dv(d.cac, prev?.cac)
  return (
    <section className="mb-5 rounded-2xl bg-navy-900 px-5 py-6 text-white sm:px-7 sm:py-7 dark:bg-navy-800">
      <p className="text-sm text-slate-400">Resumo dos últimos {days} dias</p>
      <p className="mt-3 max-w-5xl text-[22px] font-medium leading-[1.55] tracking-[-0.01em] sm:text-[26px]">
        Você investiu <span className="font-semibold">{money(d.investment, { compact: true })}</span> e gerou <span className="font-semibold">{money(d.revenue, { compact: true })}</span> em receita
        {rev !== null && <> ({rev >= 0 ? 'alta' : 'queda'} de <span className={rev >= 0 ? 'text-emerald-300' : 'text-red-300'}>{signedPct(rev).replace('-', '')}</span>)</>}. Cada R$ 1 em anúncios trouxe <span className="font-semibold text-brand-300">{ratio(d.roas).replace('x', '').replace(/^/, 'R$ ')}</span> e,{' '}
        depois de pagar produtos e marketing, {d.profit >= 0 ? <>sobraram <span className="font-semibold text-emerald-300">{money(d.profit, { compact: true })}</span></> : <>faltaram <span className="font-semibold text-red-300">{money(-d.profit, { compact: true })}</span></>}.
      </p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
        <span>Cliente novo custou <b className="text-white">{money(d.cac)}</b>{cac !== null && <span className={cac <= 0 ? 'text-emerald-300' : 'text-red-300'}> ({signedPct(cac)})</span>}</span>
        {topChannel && <span>Canal mais rentável: <b className="text-white">{topChannel.name}</b> (ROI {percent(topChannel.roi, 0)})</span>}
        {worstCampaign && worstCampaign.profit < 0 && <span>Maior prejuízo: <b className="text-white">{worstCampaign.name}</b> ({money(worstCampaign.profit, { compact: true })})</span>}
        <span><b className="text-white">{num(insights)}</b> pontos de atenção e oportunidades</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ Busca rápida (Ctrl+K) */
const PAGES = [
  ['Overview', '/', 'Resumo e KPIs'],
  ['Campanhas', '/campaigns', 'Tabela e score'],
  ['Canais', '/channels', 'Comparação e ranking'],
  ['Funil de conversão', '/funnel', 'Gargalos por etapa'],
  ['Análise financeira', '/financial', 'Lucro, ROI e fórmulas'],
  ['Evolução no tempo', '/performance', 'Tendências'],
  ['Insights', '/insights', 'Alertas e oportunidades'],
  ['AI Marketing Analyst', '/insights?tab=analyst', 'Pergunte em português'],
  ['Simulador de orçamento', '/simulator', 'Cenários de investimento'],
  ['Automações', '/automation', 'Workflows e histórico'],
  ['Importar dados', '/import', 'CSV'],
  ['Aprenda', '/learn', 'Glossário das métricas'],
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
    const out: { label: string; hint: string; to: string; icon: 'page' | 'camp' | 'ai' }[] = []
    for (const [l, to, h] of PAGES) if (!t || m(l) || m(h)) out.push({ label: l, hint: h, to, icon: 'page' })
    if (t) for (const c of campaigns) if (m(c.name)) out.push({ label: c.name, hint: 'Campanha', to: `/campaigns/${c.id}`, icon: 'camp' })
    if (t.length > 3) out.push({ label: `Perguntar à IA: "${q.trim()}"`, hint: 'AI Marketing Analyst', to: `/insights?tab=analyst&ask=${encodeURIComponent(q.trim())}`, icon: 'ai' })
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
            placeholder="Busque uma tela, campanha ou faça uma pergunta…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
          />
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar"><X size={16} /></button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {items.map((it, i) => (
            <li key={it.to + it.label}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(it.to)} className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === idx ? 'bg-slate-100 dark:bg-white/10' : '')} role="option" aria-selected={i === idx}>
                <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', it.icon === 'ai' ? 'bg-ai-100 text-ai-600 dark:bg-ai-500/20 dark:text-ai-300' : it.icon === 'camp' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300')}>
                  {it.icon === 'ai' ? <Sparkles size={15} /> : it.icon === 'camp' ? <Megaphone size={15} /> : <CornerDownLeft size={15} />}
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

/* ------------------------------------------------------------------ Tour de boas-vindas */
const STEPS = [
  { title: 'Bem-vindo ao seu painel de marketing', body: 'Aqui você acompanha quanto investe, quanto volta e onde ajustar. Todos os números deste ambiente são de uma empresa fictícia, para você explorar à vontade.' },
  { title: 'Filtros valem para tudo', body: 'Período, canal, campanha, plataforma e tipo de conversão ficam no topo. Ao mudar um filtro, cartões, gráficos, tabelas e insights se atualizam juntos.' },
  { title: 'Números explicados em frases', body: 'Com o modo didático ligado, cada indicador vem com uma frase simples ("cada R$ 1 em anúncios trouxe R$ 3,86") e cada tela tem um guia de leitura. Desligue no topo quando não precisar mais.' },
  { title: 'Pergunte, simule e automatize', body: 'Pressione Ctrl+K para buscar qualquer tela ou perguntar à IA. O simulador projeta mudanças de orçamento e as automações enviam alertas sozinhas. A página Aprenda reúne o glossário das métricas.' },
]

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0)
  const nav = useNavigate()
  useEffect(() => { if (open) setI(0) }, [open])
  if (!open) return null
  const s = STEPS[i]
  const last = i === STEPS.length - 1
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-navy-800">
        <div className="bg-navy-900 px-6 pb-5 pt-6 text-white">
          <div className="flex items-center gap-2 text-xs text-slate-400"><GraduationCap size={14} /> Passo {i + 1} de {STEPS.length}</div>
          <h2 id="tour-title" className="mt-2 text-xl font-semibold tracking-tight">{s.title}</h2>
        </div>
        <p className="px-6 py-5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex gap-1.5">{STEPS.map((_, j) => <span key={j} className={clsx('h-1.5 rounded-full transition-all', j === i ? 'w-5 bg-brand-500' : 'w-1.5 bg-slate-300 dark:bg-white/20')} />)}</div>
          <div className="flex gap-2">
            {!last && <button className="btn-ghost" onClick={onClose}>Pular</button>}
            {last && <button className="btn-secondary" onClick={() => { onClose(); nav('/learn') }}>Abrir Aprenda</button>}
            <button className="btn-primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Começar' : 'Próximo'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
