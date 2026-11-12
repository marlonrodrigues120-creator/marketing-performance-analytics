import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CHANNELS, dataEndDate, generateDemo, isoDate } from '../data/seed'
import type { Campaign, Channel, DailyMetric } from '../data/types'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import type { AppNotification, AutomationLog, Execution, Workflow } from '../automation/types'
import { TEMPLATES, workflowFromTemplate } from '../automation/templates'
import { runWorkflow } from '../automation/engine'
import { addDays } from '../lib/query'
import { uid } from '../automation/catalog'
import { authenticate, createAccount, renameAccount } from './auth'

export type Role = 'admin' | 'analyst' | 'viewer' | 'visitor'
export interface User {
  name: string
  email: string
  role: Role
}

export interface ImportRecord {
  id: string
  at: string
  fileName: string
  rows: number
  inserted: number
  duplicates: number
  skipped: number
  newCampaigns: number
  user: string
  status: 'Concluída' | 'Revertida'
}

export interface Scenario {
  id: string
  name: string
  createdAt: string
  total: number
  allocation: Record<string, number>
}

export type PeriodPreset = '7d' | '30d' | '90d' | '180d' | '365d' | 'mtd' | 'custom'
export interface Filters {
  preset: PeriodPreset
  start: string
  end: string
  channels: string[]
  campaigns: string[]
  platforms: string[]
  conversionTypes: string[]
}

const LS = {
  settings: 'mpa.settings',
  workflows: 'mpa.workflows.v2',
  executions: 'mpa.executions.v2',
  logs: 'mpa.logs.v2',
  notifications: 'mpa.notifications.v1',
  imports: 'mpa.imports.v1',
  importedRows: 'mpa.importedRows.v1',
  importedCampaigns: 'mpa.importedCampaigns.v1',
  tags: 'mpa.tags.v1',
  user: 'mpa.user',
  scenarios: 'mpa.scenarios.v1',
  filters: 'mpa.filters',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* quota ou modo privado: a sessão segue funcionando em memória */
  }
}

export function presetRange(p: PeriodPreset, dataEnd: string, custom?: { start: string; end: string }) {
  if (p === 'custom' && custom) return custom
  if (p === 'mtd') return { start: dataEnd.slice(0, 8) + '01', end: dataEnd }
  const n = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[p as '7d'] ?? 30
  return { start: addDays(dataEnd, -(n - 1)), end: dataEnd }
}

interface Store {
  user: User | null
  login: (email: string, password: string) => Promise<string | null>
  signup: (name: string, email: string, password: string) => Promise<string | null>
  enterAsVisitor: () => void
  updateProfile: (name: string) => string | null
  logout: () => void
  can: (perm: 'edit' | 'delete' | 'admin') => boolean
  channels: Channel[]
  campaigns: Campaign[]
  metrics: DailyMetric[]
  dataStart: string
  dataEnd: string
  settings: Settings
  updateSettings: (p: Partial<Settings>) => void
  resetSettings: () => void
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  resetFilters: () => void
  workflows: Workflow[]
  saveWorkflow: (wf: Workflow) => void
  deleteWorkflow: (id: string) => void
  setWorkflowStatus: (id: string, status: Workflow['status']) => void
  executions: Execution[]
  runningIds: string[]
  executeWorkflow: (id: string, mode: 'manual' | 'test' | 'event', input?: Record<string, unknown>, wfOverride?: Workflow) => Promise<Execution | null>
  logs: AutomationLog[]
  addLog: (l: Omit<AutomationLog, 'id' | 'at'>) => void
  notifications: AppNotification[]
  markNotificationsRead: () => void
  clearNotifications: () => void
  imports: ImportRecord[]
  commitImport: (fileName: string, rows: DailyMetric[], newCampaigns: Campaign[], stats: { duplicates: number; skipped: number; total: number }) => void
  revertImport: (id: string) => void
  importedRowCount: number
  tags: Record<string, string[]>
  scenarios: Scenario[]
  saveScenario: (s: Omit<Scenario, 'id' | 'createdAt'>) => void
  deleteScenario: (id: string) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

type ImportedRow = DailyMetric & { importId: string }

function seedAutomation(ctxBase: { campaigns: Campaign[]; metrics: DailyMetric[]; settings: Settings; dataEnd: string }) {
  const workflows = TEMPLATES.filter((t) => !t.ai).map((t, i) => workflowFromTemplate(t, i === 4 ? 'paused' : 'active'))
  const executions: Execution[] = []
  const logs: AutomationLog[] = []
  let k = 0
  for (let ago = 13; ago >= 0; ago--) {
    const asOf = addDays(ctxBase.dataEnd, -ago)
    const runDay = new Date(addDays(asOf, 1) + 'T00:00:00')
    for (const wf of workflows) {
      if (wf.status === 'paused' && ago < 6) continue
      const t = wf.nodes.find((n) => n.data.kind === 'trigger')!
      const cfg = t.data.config as Record<string, string>
      if (cfg.frequency === 'weekly' && runDay.getDay() !== 1) continue
      const [h, m] = String(cfg.time ?? '08:00').split(':').map(Number)
      const now = new Date(runDay)
      now.setHours(h || 7, (m || 0) + (k % 3), 0, 0)
      k++
      const res = runWorkflow(wf, { ...ctxBase, channels: CHANNELS, asOf, now }, 'schedule')
      res.execution.idempotencyKey = `${wf.id}:schedule:${asOf}`
      logs.push(...res.logs)
      executions.push(res.execution)
    }
  }
  // falhas de integração simuladas de forma determinística, para demonstrar o tratamento de erros
  const failures: [string, number, string][] = [
    ['high-cac', 4, 'SMTP 421: serviço de e-mail temporariamente indisponível (simulado)'],
    ['weekly-summary', 0, 'Timeout de 30s ao chamar o webhook do Slack (simulado)'],
    ['daily-report', 9, 'n8n respondeu 502 Bad Gateway ao receber o disparo (simulado)'],
  ]
  for (const [tpl, nth, msg] of failures) {
    const wf = workflows.find((w) => w.templateId === tpl)
    const ex = executions.filter((e) => e.workflowId === wf?.id && e.steps.some((s) => s.kind === 'action' && s.status === 'success'))[nth]
    if (!ex) continue
    const failAt = ex.steps.findIndex((s) => s.kind === 'action' && s.status === 'success')
    ex.steps[failAt].status = 'error'
    ex.steps[failAt].output = msg
    for (let j = failAt + 1; j < ex.steps.length; j++) if (ex.steps[j].status === 'success') Object.assign(ex.steps[j], { status: 'skipped', output: 'Não executado devido a erro anterior' })
    ex.status = 'error'
    ex.error = `${msg} — nova tentativa agendada (retry com backoff exponencial no n8n).`
    logs.push({ id: uid('log'), at: ex.startedAt, level: 'error', workflowId: ex.workflowId, message: `${ex.workflowName}: ${msg}` })
  }
  executions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return { workflows, executions, logs: logs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300) }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const demo = useMemo(() => generateDemo(), [])
  const dataEndD = useMemo(() => isoDate(dataEndDate()), [])
  const [user, setUser] = useState<User | null>(() => load(LS.user, null))
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(LS.settings, {}) }))
  const [importedRows, setImportedRows] = useState<ImportedRow[]>(() => load(LS.importedRows, []))
  const [importedCampaigns, setImportedCampaigns] = useState<Campaign[]>(() => load(LS.importedCampaigns, []))
  const [imports, setImports] = useState<ImportRecord[]>(() => load(LS.imports, []))
  const [tags, setTags] = useState<Record<string, string[]>>(() => load(LS.tags, {}))
  const [scenarios, setScenarios] = useState<Scenario[]>(() => load(LS.scenarios, []))
  const [notifications, setNotifications] = useState<AppNotification[]>(() => load(LS.notifications, []))

  const campaigns = useMemo(() => [...demo.campaigns, ...importedCampaigns], [demo, importedCampaigns])
  const metrics = useMemo(() => (importedRows.length ? [...demo.metrics, ...importedRows] : demo.metrics), [demo, importedRows])
  const dataEnd = useMemo(() => metrics.reduce((a, r) => (r.date > a ? r.date : a), dataEndD), [metrics, dataEndD])
  const dataStart = useMemo(() => metrics.reduce((a, r) => (r.date < a ? r.date : a), dataEnd), [metrics, dataEnd])

  const seeded = useRef<ReturnType<typeof seedAutomation> | null>(null)
  const getSeed = () => (seeded.current ??= seedAutomation({ campaigns: demo.campaigns, metrics: demo.metrics, settings: DEFAULT_SETTINGS, dataEnd: dataEndD }))
  const [workflows, setWorkflows] = useState<Workflow[]>(() => load(LS.workflows, null) ?? getSeed().workflows)
  const [executions, setExecutions] = useState<Execution[]>(() => load(LS.executions, null) ?? getSeed().executions)
  const [logs, setLogs] = useState<AutomationLog[]>(() => load(LS.logs, null) ?? getSeed().logs)
  const [runningIds, setRunningIds] = useState<string[]>([])

  const defaultFilters = useCallback((): Filters => ({ preset: '30d', ...presetRange('30d', dataEnd), channels: [], campaigns: [], platforms: [], conversionTypes: [] }), [dataEnd])
  const [filters, setFiltersState] = useState<Filters>(() => {
    const f = load<Filters | null>(LS.filters, null)
    if (!f) return { preset: '30d', ...presetRange('30d', dataEndD), channels: [], campaigns: [], platforms: [], conversionTypes: [] }
    return f.preset === 'custom' ? f : { ...f, ...presetRange(f.preset, dataEndD) }
  })

  useEffect(() => {
    setFiltersState((f) => (f.preset === 'custom' || f.end === dataEnd ? f : { ...f, ...presetRange(f.preset, dataEnd) }))
  }, [dataEnd])
  useEffect(() => { save(LS.settings, settings) }, [settings])
  useEffect(() => { save(LS.workflows, workflows) }, [workflows])
  useEffect(() => { save(LS.executions, executions.slice(0, 500)) }, [executions])
  useEffect(() => { save(LS.logs, logs.slice(0, 500)) }, [logs])
  useEffect(() => { save(LS.notifications, notifications.slice(0, 100)) }, [notifications])
  useEffect(() => { save(LS.imports, imports) }, [imports])
  useEffect(() => { save(LS.importedRows, importedRows) }, [importedRows])
  useEffect(() => { save(LS.importedCampaigns, importedCampaigns) }, [importedCampaigns])
  useEffect(() => { save(LS.tags, tags) }, [tags])
  useEffect(() => { save(LS.scenarios, scenarios) }, [scenarios])
  useEffect(() => { save(LS.filters, filters) }, [filters])
  useEffect(() => { save(LS.user, user) }, [user])

  const setFilters = useCallback(
    (p: Partial<Filters>) =>
      setFiltersState((f) => {
        const n = { ...f, ...p }
        if (p.preset && p.preset !== 'custom') Object.assign(n, presetRange(p.preset, dataEnd))
        return n
      }),
    [dataEnd],
  )

  const addLog = useCallback((l: Omit<AutomationLog, 'id' | 'at'>) => setLogs((ls) => [{ ...l, id: uid('log'), at: new Date().toISOString() }, ...ls]), [])

  const recentKeys = useRef(new Map<string, number>())
  const executeWorkflow = useCallback<Store['executeWorkflow']>(
    async (id, mode, input, wfOverride) => {
      const wf = wfOverride ?? workflows.find((w) => w.id === id)
      if (!wf) return null
      // prevenção de execuções duplicadas: bloqueia execução concorrente e repetição em < 10s
      const key = `${wf.id}:${mode}:${dataEnd}`
      const last = recentKeys.current.get(key)
      if (runningIds.includes(wf.id) || (last && Date.now() - last < 10000)) {
        const skipped: Execution = { id: uid('exec'), workflowId: wf.id, workflowName: wf.name, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 0, status: 'skipped', mode, engine: 'demo', idempotencyKey: key, input: input ?? {}, result: { summary: 'Execução duplicada ignorada: já existe uma execução com a mesma chave de idempotência nos últimos 10 segundos.' }, steps: [] }
        setExecutions((e) => [skipped, ...e])
        addLog({ level: 'warn', workflowId: wf.id, message: `${wf.name}: execução duplicada ignorada (${key})` })
        return skipped
      }
      recentKeys.current.set(key, Date.now())
      setRunningIds((r) => [...r, wf.id])
      const res = runWorkflow(wf, { campaigns, channels: CHANNELS, metrics, settings, asOf: dataEnd, input }, mode)
      res.execution.idempotencyKey = key
      await new Promise((r) => setTimeout(r, Math.min(1800, 300 + res.execution.durationMs / 2)))
      setRunningIds((r) => r.filter((x) => x !== wf.id))
      setExecutions((e) => [res.execution, ...e])
      if (mode !== 'test') {
        setNotifications((n) => [...res.notifications, ...n])
        if (res.tags.length) setTags((t) => {
          const nt = { ...t }
          for (const { campaignId, tag } of res.tags) nt[campaignId] = Array.from(new Set([...(nt[campaignId] ?? []), tag]))
          return nt
        })
      }
      setLogs((l) => [...res.logs, { id: uid('log'), at: new Date().toISOString(), level: 'info' as const, workflowId: wf.id, message: `${wf.name}: execução ${mode === 'test' ? 'de teste ' : ''}concluída — ${res.execution.result?.summary}` }, ...l])
      return res.execution
    },
    [workflows, runningIds, campaigns, metrics, settings, dataEnd, addLog],
  )

  const store: Store = {
    user,
    login: async (email, password) => {
      try {
        const acc = await authenticate(email, password)
        setUser({ name: acc.name, email: acc.email, role: 'admin' })
        return null
      } catch (e) {
        return (e as Error).message
      }
    },
    signup: async (name, email, password) => {
      try {
        const acc = await createAccount(name, email, password)
        setUser({ name: acc.name, email: acc.email, role: 'admin' })
        return null
      } catch (e) {
        return (e as Error).message
      }
    },
    updateProfile: (name) => {
      if (!user || name.trim().length < 2) return 'Digite um nome com pelo menos 2 letras.'
      try {
        if (user.role !== 'visitor') renameAccount(user.email, name)
      } catch (e) {
        return (e as Error).message
      }
      setUser({ ...user, name: name.trim() })
      return null
    },
    enterAsVisitor: () => setUser({ name: 'Visitante', email: 'visitante', role: 'visitor' }),
    logout: () => setUser(null),
    can: (perm) => {
      if (!user) return false
      // visitante explora tudo num ambiente isolado no próprio navegador
      if (user.role === 'admin' || user.role === 'visitor') return true
      if (perm === 'admin' || perm === 'delete') return false
      return user.role !== 'viewer'
    },
    channels: CHANNELS,
    campaigns,
    metrics,
    dataStart,
    dataEnd,
    settings,
    updateSettings: (p) => setSettings((s) => ({ ...s, ...p })),
    resetSettings: () => setSettings(DEFAULT_SETTINGS),
    filters,
    setFilters,
    resetFilters: () => setFiltersState(defaultFilters()),
    workflows,
    saveWorkflow: (wf) => {
      setWorkflows((ws) => (ws.some((w) => w.id === wf.id) ? ws.map((w) => (w.id === wf.id ? { ...wf, updatedAt: new Date().toISOString() } : w)) : [...ws, wf]))
      addLog({ level: 'info', workflowId: wf.id, message: `Workflow "${wf.name}" salvo por ${user?.name ?? 'usuário'}` })
    },
    deleteWorkflow: (id) => {
      const wf = workflows.find((w) => w.id === id)
      setWorkflows((ws) => ws.filter((w) => w.id !== id))
      addLog({ level: 'warn', workflowId: id, message: `Workflow "${wf?.name}" excluído por ${user?.name ?? 'usuário'}` })
    },
    setWorkflowStatus: (id, status) => {
      setWorkflows((ws) => ws.map((w) => (w.id === id ? { ...w, status, updatedAt: new Date().toISOString() } : w)))
      const wf = workflows.find((w) => w.id === id)
      addLog({ level: 'info', workflowId: id, message: `Workflow "${wf?.name}" ${status === 'active' ? 'ativado' : 'pausado'}` })
    },
    executions,
    runningIds,
    executeWorkflow,
    logs,
    addLog,
    notifications,
    markNotificationsRead: () => setNotifications((n) => n.map((x) => ({ ...x, read: true }))),
    clearNotifications: () => setNotifications([]),
    imports,
    commitImport: (fileName, rows, newCamps, stats) => {
      const id = uid('imp')
      setImportedRows((r) => [...r, ...rows.map((x) => ({ ...x, source: 'import' as const, importId: id }))])
      if (newCamps.length) setImportedCampaigns((c) => [...c, ...newCamps])
      setImports((i) => [{ id, at: new Date().toISOString(), fileName, rows: stats.total, inserted: rows.length, duplicates: stats.duplicates, skipped: stats.skipped, newCampaigns: newCamps.length, user: user?.name ?? '—', status: 'Concluída' }, ...i])
      addLog({ level: 'info', message: `Importação "${fileName}": ${rows.length} linhas inseridas, ${stats.duplicates} duplicadas, ${stats.skipped} ignoradas` })
      // dispara workflows ativos com gatilho de importação
      for (const wf of workflows) {
        if (wf.status === 'active' && wf.nodes.some((n) => n.data.type === 'data_import')) setTimeout(() => executeWorkflow(wf.id, 'event', { rows: rows.length, fileName }), 50)
      }
    },
    revertImport: (id) => {
      setImportedRows((r) => r.filter((x) => x.importId !== id))
      setImports((i) => i.map((x) => (x.id === id ? { ...x, status: 'Revertida' } : x)))
      addLog({ level: 'warn', message: `Importação ${id} revertida` })
    },
    importedRowCount: importedRows.length,
    tags,
    scenarios,
    saveScenario: (s) => setScenarios((x) => [{ ...s, id: uid('scn'), createdAt: new Date().toISOString() }, ...x]),
    deleteScenario: (id) => setScenarios((x) => x.filter((s) => s.id !== id)),
    resetDemo: () => {
      Object.values(LS).forEach((k) => k !== LS.user && localStorage.removeItem(k))
      location.reload()
    },
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do AppProvider')
  return s
}
