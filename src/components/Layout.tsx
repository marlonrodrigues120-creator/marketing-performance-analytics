import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, BookOpen, Calculator, CalendarDays, ChartLine, ChevronsLeft, ChevronsRight, CircleDollarSign, CircleHelp, Filter, GraduationCap, LayoutDashboard, LogOut, Megaphone, Menu, Moon, RotateCcw, Search, Settings, Share2, Sparkles, Sun, Upload, Workflow, X } from 'lucide-react'
import { useStore, type PeriodPreset } from '../store/AppStore'
import { MultiSelect, Toaster, Toggle } from './ui'
import { CommandPalette, WelcomeTour } from './didactic'
import { Logo } from './Logo'
import { dateBR, relTime } from '../lib/format'
import { addDays } from '../lib/query'

const NAV = [
  { group: 'Análise', items: [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/campaigns', label: 'Campanhas', icon: Megaphone },
    { to: '/channels', label: 'Canais', icon: Share2 },
    { to: '/funnel', label: 'Funil de conversão', icon: Filter },
    { to: '/financial', label: 'Análise financeira', icon: CircleDollarSign },
    { to: '/performance', label: 'Evolução no tempo', icon: ChartLine },
  ] },
  { group: 'Inteligência', items: [
    { to: '/insights', label: 'Insights e IA', icon: Sparkles },
    { to: '/simulator', label: 'Simulador de orçamento', icon: Calculator },
  ] },
  { group: 'Automação', items: [{ to: '/automation', label: 'Automações', icon: Workflow }] },
  { group: 'Dados', items: [
    { to: '/import', label: 'Importar dados', icon: Upload },
    { to: '/learn', label: 'Aprenda', icon: GraduationCap },
    { to: '/settings', label: 'Configurações', icon: Settings },
  ] },
]
const FILTER_ROUTES = ['/', '/campaigns', '/channels', '/funnel', '/financial', '/performance', '/insights']

export default function Layout() {
  const { tourSeen, setTourSeen, user } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mpa.sidebar') === 'collapsed')
  const [palette, setPalette] = useState(false)
  const [tour, setTour] = useState(false)
  const loc = useLocation()
  useEffect(() => { setMobileOpen(false) }, [loc.pathname])
  useEffect(() => { if (!tourSeen && user) setTour(true) }, [tourSeen, user])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const toggleCollapse = () => {
    localStorage.setItem('mpa.sidebar', collapsed ? 'open' : 'collapsed')
    setCollapsed(!collapsed)
  }
  const showFilters = FILTER_ROUTES.some((r) => (r === '/' ? loc.pathname === '/' : loc.pathname.startsWith(r)))
  const isBuilder = loc.pathname.includes('/workflows/')
  return (
    <div className="min-h-screen">
      <aside className={clsx('fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 text-slate-300 transition-[width,transform] duration-200 dark:bg-navy-950 dark:ring-1 dark:ring-white/5', collapsed ? 'lg:w-[72px]' : 'lg:w-64', 'w-64', mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <div className={clsx('flex h-16 items-center gap-2.5', collapsed ? 'lg:justify-center lg:px-0' : '', 'px-5')}>
          <Logo />
          <div className={clsx('leading-tight', collapsed && 'lg:hidden')}>
            <div className="text-sm font-semibold text-white">Marketing Performance</div>
            <div className="text-[11px] text-slate-400">Analytics e automação</div>
          </div>
          <button className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={16} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mt-5 first:mt-2">
              <div className={clsx('mb-1.5 px-2.5 text-[11px] font-medium text-slate-500', collapsed && 'lg:invisible lg:h-0 lg:mb-0')}>{g.group}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} title={collapsed ? it.label : undefined} className={({ isActive }) => clsx('relative mb-0.5 flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors', collapsed && 'lg:justify-center', isActive ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white')}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r-full bg-brand-400" />}
                      <it.icon size={18} className={clsx(isActive ? 'text-brand-300' : 'text-slate-400')} />
                      <span className={clsx(collapsed && 'lg:hidden')}>{it.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <DataStatus collapsed={collapsed} />
        <button onClick={toggleCollapse} className="hidden h-11 items-center justify-center gap-2 border-t border-white/5 text-xs text-slate-400 hover:text-white lg:flex" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Recolher menu</>}
        </button>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className={clsx('transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <VisitorBar />
        <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => setPalette(true)} onTour={() => setTour(true)} />
        {showFilters && <FilterBar />}
        <main key={isBuilder ? 'builder' : loc.pathname} className="mx-auto max-w-[1600px] px-4 py-6 motion-safe:animate-fade-up sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <WelcomeTour open={tour} onClose={() => { setTour(false); setTourSeen(true) }} />
      <Toaster />
    </div>
  )
}

function VisitorBar() {
  const { user, logout } = useStore()
  const nav = useNavigate()
  if (user?.role !== 'visitor') return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-500 px-4 py-2 text-center text-[13px] text-white">
      Você está como visitante: o que criar fica salvo só neste navegador.
      <button className="rounded-lg bg-white/15 px-2.5 py-0.5 font-medium hover:bg-white/25" onClick={() => { logout(); nav('/login?mode=signup') }}>Criar conta</button>
    </div>
  )
}

function DataStatus({ collapsed }: { collapsed: boolean }) {
  const { dataStart, dataEnd, importedRowCount } = useStore()
  if (collapsed) return <div className="mx-auto mb-3 hidden h-2 w-2 rounded-full bg-amber-400 lg:block" title="Dados fictícios" />
  return (
    <div className="mx-3 mb-3 rounded-xl bg-white/5 p-3 text-[11px] leading-relaxed text-slate-400">
      <div className="mb-0.5 flex items-center gap-1.5 font-medium text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Dados fictícios</div>
      De {dateBR(dataStart)} a {dateBR(dataEnd)}{importedRowCount > 0 && `, mais ${importedRowCount} linhas importadas`}. Receita atribuída pelo último clique.
    </div>
  )
}

function Topbar({ onMenu, onSearch, onTour }: { onMenu: () => void; onSearch: () => void; onTour: () => void }) {
  const { user, logout, notifications, markNotificationsRead, clearNotifications, didactic, setDidactic } = useStore()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [menu, setMenu] = useState<null | 'n' | 'u' | 'h'>(null)
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggleTheme = () => {
    const d = !dark
    document.documentElement.classList.toggle('dark', d)
    try { localStorage.setItem('mpa.theme', d ? 'dark' : 'light') } catch { /* ignora */ }
    setDark(d)
  }
  const unread = notifications.filter((n) => !n.read).length
  const initials = (user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const pop = 'absolute right-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-navy-800'
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md dark:border-white/[0.06] dark:bg-navy-950/85 sm:px-6 lg:px-8">
      <button className="btn-ghost p-2 lg:hidden" onClick={onMenu} aria-label="Abrir menu"><Menu size={18} /></button>
      <button onClick={onSearch} className="flex h-9 w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        <Search size={15} />
        <span className="flex-1 truncate text-left">Buscar ou perguntar…</span>
        <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 text-[11px] dark:border-white/10 dark:bg-white/5 sm:inline">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1" ref={ref}>
        <label className="mr-1 hidden cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 sm:flex" title="Mostra guias e explicações em linguagem simples">
          <BookOpen size={15} className="text-brand-500" /> Modo didático <Toggle checked={didactic} onChange={setDidactic} label="Modo didático" />
        </label>
        <div className="relative">
          <button className="btn-ghost p-2" aria-label="Ajuda" onClick={() => setMenu(menu === 'h' ? null : 'h')}><CircleHelp size={18} /></button>
          {menu === 'h' && (
            <div className={clsx(pop, 'w-60 p-1.5')}>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { setMenu(null); onTour() }}><GraduationCap size={15} /> Rever o tour</button>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { setMenu(null); nav('/learn') }}><BookOpen size={15} /> Glossário das métricas</button>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { setMenu(null); nav('/insights?tab=analyst') }}><Sparkles size={15} /> Perguntar à IA</button>
              <label className="flex items-center justify-between rounded-xl px-3 py-2 text-sm sm:hidden">Modo didático <Toggle checked={didactic} onChange={setDidactic} label="Modo didático" /></label>
            </div>
          )}
        </div>
        <button className="btn-ghost p-2" onClick={toggleTheme} aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <div className="relative">
          <button className="btn-ghost relative p-2" aria-label="Notificações" onClick={() => setMenu(menu === 'n' ? null : 'n')}>
            <Bell size={18} />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {menu === 'n' && (
            <div className={clsx(pop, 'w-80')}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
                <span className="text-sm font-semibold">Notificações</span>
                <div className="flex gap-3 text-xs">
                  <button className="text-brand-600 hover:underline dark:text-brand-300" onClick={markNotificationsRead}>Marcar como lidas</button>
                  <button className="text-slate-500 hover:underline" onClick={clearNotifications}>Limpar</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">Os alertas das automações aparecem aqui.</p>}
                {notifications.slice(0, 30).map((n) => (
                  <button key={n.id} onClick={() => { setMenu(null); nav(n.link ?? '/automation') }} className={clsx('block w-full border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5', !n.read && 'bg-brand-50/60 dark:bg-brand-500/5')}>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span className={clsx('h-1.5 w-1.5 rounded-full', n.severity === 'critical' ? 'bg-bad' : n.severity === 'warning' ? 'bg-warn' : n.severity === 'success' ? 'bg-good' : 'bg-brand-500')} />
                      {n.title}
                      <span className="ml-auto font-normal text-slate-500">{relTime(n.at)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button className="ml-1 flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => setMenu(menu === 'u' ? null : 'u')} aria-label="Conta">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">{initials}</span>
            <span className="hidden text-left leading-tight xl:block">
              <span className="block text-xs font-medium">{user?.name}</span>
              <span className="block text-[11px] text-slate-500">{user?.role === 'visitor' ? 'Visitante' : 'Administrador'}</span>
            </span>
          </button>
          {menu === 'u' && (
            <div className={clsx(pop, 'w-60 p-1.5')}>
              <div className="px-3 py-2 text-xs text-slate-500">{user?.role === 'visitor' ? 'Sessão de visitante' : user?.email}</div>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { setMenu(null); nav('/settings') }}><Settings size={15} /> Configurações</button>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-bad hover:bg-red-50 dark:hover:bg-red-500/10" onClick={logout}><LogOut size={15} /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '180d', label: 'Últimos 6 meses' },
  { value: '365d', label: 'Últimos 12 meses' },
  { value: 'mtd', label: 'Mês atual' },
  { value: 'custom', label: 'Personalizado' },
]

function FilterBar() {
  const { filters, setFilters, resetFilters, channels, campaigns, dataStart, dataEnd } = useStore()
  const platforms = Array.from(new Set(campaigns.map((c) => c.platform))).sort()
  const convTypes = Array.from(new Set(campaigns.map((c) => c.conversionType))).sort()
  const campOptions = campaigns.filter((c) => !filters.channels.length || filters.channels.includes(c.channelId)).map((c) => ({ value: c.id, label: c.name }))
  const active = filters.channels.length + filters.campaigns.length + filters.platforms.length + filters.conversionTypes.length + (filters.preset !== '30d' ? 1 : 0)
  const len = Math.round((new Date(filters.end).getTime() - new Date(filters.start).getTime()) / 86400000) + 1
  return (
    <div className="border-b border-slate-200/80 bg-white/60 dark:border-white/[0.06] dark:bg-navy-950/60">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
          <CalendarDays size={14} className="text-brand-500" />
          <select aria-label="Período" value={filters.preset} onChange={(e) => setFilters({ preset: e.target.value as PeriodPreset })} className="bg-transparent text-xs font-medium focus:outline-none dark:[color-scheme:dark]">
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {filters.preset === 'custom' && (
          <div className="flex items-center gap-1 text-xs">
            <input type="date" aria-label="Data inicial" className="input w-auto py-1 text-xs dark:[color-scheme:dark]" min={dataStart} max={filters.end} value={filters.start} onChange={(e) => e.target.value && setFilters({ start: e.target.value })} />
            <span className="text-slate-500">até</span>
            <input type="date" aria-label="Data final" className="input w-auto py-1 text-xs dark:[color-scheme:dark]" min={filters.start} max={dataEnd} value={filters.end} onChange={(e) => e.target.value && setFilters({ end: e.target.value })} />
          </div>
        )}
        <MultiSelect label="Canal" options={channels.map((c) => ({ value: c.id, label: c.name, hint: c.kind }))} value={filters.channels} onChange={(v) => setFilters({ channels: v, campaigns: filters.campaigns.filter((id) => !v.length || v.includes(campaigns.find((c) => c.id === id)?.channelId ?? '')) })} />
        <MultiSelect label="Campanha" options={campOptions} value={filters.campaigns} onChange={(v) => setFilters({ campaigns: v })} width="w-72" />
        <MultiSelect label="Plataforma" options={platforms.map((p) => ({ value: p, label: p }))} value={filters.platforms} onChange={(v) => setFilters({ platforms: v })} />
        <MultiSelect label="Conversão" options={convTypes.map((p) => ({ value: p, label: p }))} value={filters.conversionTypes} onChange={(v) => setFilters({ conversionTypes: v })} />
        {active > 0 && <button className="btn-ghost btn-sm" onClick={resetFilters}><RotateCcw size={12} /> Limpar filtros</button>}
        <div className="ml-auto hidden text-xs text-slate-500 xl:block">
          {dateBR(filters.start)} a {dateBR(filters.end)}, comparado com {dateBR(addDays(filters.start, -len))} a {dateBR(addDays(filters.start, -1))}
        </div>
      </div>
    </div>
  )
}
