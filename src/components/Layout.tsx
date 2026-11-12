import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, Calculator, CalendarDays, ChartLine, CircleDollarSign, Database, Filter, LayoutDashboard, LogOut, Megaphone, Menu, Moon, RotateCcw, Settings, Share2, Sparkles, Sun, Upload, Workflow, X } from 'lucide-react'
import { useStore, type PeriodPreset } from '../store/AppStore'
import { MultiSelect, Toaster } from './ui'
import { dateBR, relTime } from '../lib/format'
import { addDays } from '../lib/query'

const NAV = [
  { group: 'Analytics', items: [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/channels', label: 'Channels', icon: Share2 },
    { to: '/funnel', label: 'Conversion Funnel', icon: Filter },
    { to: '/financial', label: 'Financial Analysis', icon: CircleDollarSign },
    { to: '/performance', label: 'Performance over Time', icon: ChartLine },
  ] },
  { group: 'Intelligence', items: [
    { to: '/insights', label: 'Marketing Insights', icon: Sparkles },
    { to: '/simulator', label: 'Budget Simulator', icon: Calculator },
  ] },
  { group: 'Automation', items: [{ to: '/automation', label: 'Automation Center', icon: Workflow }] },
  { group: 'Dados', items: [
    { to: '/import', label: 'Data Import', icon: Upload },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
]

const FILTER_ROUTES = ['/', '/campaigns', '/channels', '/funnel', '/financial', '/performance', '/insights']

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setMobileOpen(false) }, [loc.pathname])
  const showFilters = FILTER_ROUTES.some((r) => (r === '/' ? loc.pathname === '/' : loc.pathname.startsWith(r)))
  return (
    <div className="min-h-screen">
      <aside className={clsx('fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-white/[0.07] dark:bg-[#0e121a] lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-ai-500 text-white shadow-sm">
            <ChartLine size={17} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Marketing Performance</div>
            <div className="text-[11px] muted">Analytics & Automation</div>
          </div>
          <button className="btn-ghost ml-auto p-1 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mt-4 first:mt-1">
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.group}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => clsx('group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition', isActive ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100')}>
                  <it.icon size={16} className={clsx(it.to === '/insights' && 'text-ai-500')} />
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <DataStatus />
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="lg:pl-64">
        <Topbar onMenu={() => setMobileOpen(true)} />
        {showFilters && <FilterBar />}
        <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}

function DataStatus() {
  const { dataStart, dataEnd, importedRowCount, settings } = useStore()
  return (
    <div className="m-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
        <Database size={12} /> Modo demonstração
      </div>
      Dados fictícios de {dateBR(dataStart)} a {dateBR(dataEnd)}
      {importedRowCount > 0 && ` + ${importedRowCount} linhas importadas`}. Atribuição: {settings.attributionModel}.
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout, notifications, markNotificationsRead, clearNotifications } = useStore()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [openN, setOpenN] = useState(false)
  const [openU, setOpenU] = useState(false)
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenN(false)
        setOpenU(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggleTheme = () => {
    const d = !dark
    document.documentElement.classList.toggle('dark', d)
    try {
      localStorage.setItem('mpa.theme', d ? 'dark' : 'light')
    } catch {
      /* ignora */
    }
    setDark(d)
  }
  const unread = notifications.filter((n) => !n.read).length
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#0b0e14]/80 sm:px-6 lg:px-8">
      <button className="btn-ghost p-2 lg:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu size={18} />
      </button>
      <div className="hidden text-sm muted sm:block">Workspace · <span className="font-medium text-slate-700 dark:text-slate-200">Acme Store (demo)</span></div>
      <div className="ml-auto flex items-center gap-1" ref={ref}>
        <button className="btn-ghost p-2" onClick={toggleTheme} aria-label="Alternar tema" title={dark ? 'Light mode' : 'Dark mode'}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="relative">
          <button className="btn-ghost relative p-2" aria-label="Notificações" onClick={() => { setOpenN((o) => !o); setOpenU(false) }}>
            <Bell size={17} />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {openN && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#1a2030]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-white/10">
                <span className="text-sm font-semibold">Notificações</span>
                <div className="flex gap-2 text-xs">
                  <button className="text-brand-600 hover:underline dark:text-brand-300" onClick={markNotificationsRead}>Marcar lidas</button>
                  <button className="muted hover:underline" onClick={clearNotifications}>Limpar</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && <p className="px-4 py-8 text-center text-xs muted">Sem notificações. Alertas dos workflows aparecem aqui.</p>}
                {notifications.slice(0, 30).map((n) => (
                  <button key={n.id} onClick={() => { setOpenN(false); nav(n.link ?? '/automation') }} className={clsx('block w-full border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5', !n.read && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span className={clsx('h-1.5 w-1.5 rounded-full', n.severity === 'critical' ? 'bg-bad' : n.severity === 'warning' ? 'bg-warn' : n.severity === 'success' ? 'bg-good' : 'bg-brand-500')} />
                      {n.title}
                      <span className="ml-auto font-normal muted">{relTime(n.at)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs muted">{n.body}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button className="ml-1 flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { setOpenU((o) => !o); setOpenN(false) }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-ai-500 text-xs font-semibold text-white">{user?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-xs font-medium">{user?.name}</span>
              <span className="block text-[10px] capitalize muted">{user?.role === 'admin' ? 'Administrador' : user?.role === 'analyst' ? 'Analista' : 'Leitura'}</span>
            </span>
          </button>
          {openU && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#1a2030]">
              <div className="px-3 py-2 text-xs muted">{user?.email}</div>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => nav('/settings')}>
                <Settings size={14} /> Configurações
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-bad hover:bg-red-50 dark:hover:bg-red-500/10" onClick={logout}>
                <LogOut size={14} /> Sair
              </button>
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
    <div className="sticky top-16 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#0b0e14]/90">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
          <CalendarDays size={13} className="text-slate-400" />
          <select aria-label="Período" value={filters.preset} onChange={(e) => setFilters({ preset: e.target.value as PeriodPreset })} className="bg-transparent text-xs font-medium focus:outline-none dark:[color-scheme:dark]">
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {filters.preset === 'custom' && (
          <div className="flex items-center gap-1 text-xs">
            <input type="date" aria-label="Data inicial" className="input w-auto py-1 text-xs dark:[color-scheme:dark]" min={dataStart} max={filters.end} value={filters.start} onChange={(e) => e.target.value && setFilters({ start: e.target.value })} />
            <span className="muted">até</span>
            <input type="date" aria-label="Data final" className="input w-auto py-1 text-xs dark:[color-scheme:dark]" min={filters.start} max={dataEnd} value={filters.end} onChange={(e) => e.target.value && setFilters({ end: e.target.value })} />
          </div>
        )}
        <MultiSelect label="Canal" options={channels.map((c) => ({ value: c.id, label: c.name, hint: c.kind }))} value={filters.channels} onChange={(v) => setFilters({ channels: v, campaigns: filters.campaigns.filter((id) => !v.length || v.includes(campaigns.find((c) => c.id === id)?.channelId ?? '')) })} />
        <MultiSelect label="Campanha" options={campOptions} value={filters.campaigns} onChange={(v) => setFilters({ campaigns: v })} width="w-72" />
        <MultiSelect label="Plataforma" options={platforms.map((p) => ({ value: p, label: p }))} value={filters.platforms} onChange={(v) => setFilters({ platforms: v })} />
        <MultiSelect label="Conversão" options={convTypes.map((p) => ({ value: p, label: p }))} value={filters.conversionTypes} onChange={(v) => setFilters({ conversionTypes: v })} />
        {active > 0 && (
          <button className="btn-ghost btn-sm" onClick={resetFilters}>
            <RotateCcw size={12} /> Limpar
          </button>
        )}
        <div className="ml-auto hidden text-[11px] muted xl:block">
          {dateBR(filters.start)} – {dateBR(filters.end)} ({len} dias) · comparado a {dateBR(addDays(filters.start, -len))} – {dateBR(addDays(filters.start, -1))}
        </div>
      </div>
    </div>
  )
}
