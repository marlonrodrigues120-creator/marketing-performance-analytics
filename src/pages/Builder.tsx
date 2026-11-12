import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams, useBlocker } from 'react-router-dom'
import { addEdge, Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, MarkerType, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import clsx from 'clsx'
import { AlertTriangle, ArrowDownRight, ArrowLeft, Bell, CheckCircle2, Circle, CircleSlash, Clock, FileText, GitBranch, Loader2, Mail, Megaphone, MessageSquare, Pause, PencilLine, Play, Plus, Save, ScrollText, Sparkles, Trash2, TrendingDown, TrendingUp, Upload, UserPlus, Wallet, Webhook, XCircle, Zap, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = { AlertTriangle, ArrowDownRight, Bell, Clock, FileText, GitBranch, Mail, Megaphone, MessageSquare, PencilLine, ScrollText, Sparkles, TrendingDown, TrendingUp, Upload, UserPlus, Wallet, Webhook, Zap }
import { useStore } from '../store/AppStore'
import { Badge, EmptyState, Field, toast } from '../components/ui'
import ExecutionDetail from '../components/ExecutionDetail'
import { useIsDark } from '../components/charts'
import { ACTIONS, CONDITION, defOf, makeNode, METRIC_LABELS, OPERATORS, TRIGGERS, uid, type NodeDef } from '../automation/catalog'
import { validateWorkflow } from '../automation/engine'
import type { ConditionMetric, ConditionRule, Execution, Operator, WfNodeData, Workflow } from '../automation/types'

type FNode = Node<WfNodeData>
const KIND_STYLE = {
  trigger: { bar: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', label: 'Gatilho' },
  condition: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', label: 'Condição' },
  action: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', label: 'Ação' },
}

function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const C = ICONS[name] ?? Circle
  return <C size={size} />
}

function summary(d: WfNodeData) {
  const c = d.config as Record<string, unknown>
  if (d.kind === 'condition') {
    const rules = (c.rules as ConditionRule[]) ?? []
    return rules.map((r) => `${METRIC_LABELS[r.metric].split(' (')[0]} ${r.op} ${r.value}`).join(` ${c.combinator} `) || 'Sem regras'
  }
  const def = defOf(d.type as string)
  return (def?.fields ?? []).slice(0, 2).map((f) => `${f.label}: ${String(c[f.key] ?? '—')}${f.suffix && f.suffix !== 'R$' ? f.suffix === 'dias' ? ' dias' : f.suffix : ''}`).join(' · ') || def?.description || ''
}

function WfNodeView({ data, selected }: NodeProps<FNode>) {
  const st = KIND_STYLE[data.kind]
  const def = defOf(data.type as string)
  const run = data.runStatus as 'success' | 'error' | 'skipped' | undefined
  return (
    <div className={clsx('w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm transition dark:bg-[#121a38]', selected ? 'border-brand-400 ring-2 ring-brand-400/30' : 'border-slate-200 dark:border-white/10', run === 'success' && 'ring-2 ring-emerald-400/60', run === 'error' && 'ring-2 ring-red-400/70', run === 'skipped' && 'opacity-60')}>
      <div className={clsx('h-1', st.bar)} />
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className={clsx('rounded-md p-1.5', st.chip)}><Icon name={def?.icon ?? 'Circle'} size={14} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide muted">{st.label}</div>
            <div className="truncate text-xs font-semibold">{data.label}</div>
          </div>
          {run === 'success' && <CheckCircle2 size={14} className="text-good" />}
          {run === 'error' && <XCircle size={14} className="text-bad" />}
          {run === 'skipped' && <CircleSlash size={14} className="text-slate-400" />}
        </div>
        <div className="mt-2 line-clamp-2 text-[10px] leading-snug muted">{summary(data)}</div>
      </div>
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-400 dark:!border-[#121a38]" />}
      {data.kind === 'condition' ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: '35%' }} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500 dark:!border-[#121a38]" />
          <Handle id="false" type="source" position={Position.Right} style={{ top: '75%' }} className="!h-3 !w-3 !border-2 !border-white !bg-red-500 dark:!border-[#121a38]" />
          <span className="absolute right-3 top-[28%] text-[8px] font-bold text-emerald-600">SIM</span>
          <span className="absolute right-3 top-[68%] text-[8px] font-bold text-red-500">NÃO</span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-brand-500 dark:!border-[#121a38]" />
      )}
    </div>
  )
}

const nodeTypes = { wf: WfNodeView }

const toFlowNodes = (wf: Workflow): FNode[] => wf.nodes.map((n) => ({ id: n.id, type: 'wf', position: n.position, data: n.data }))
const edgeStyle = (h?: string | null) => ({ stroke: h === 'false' ? '#d03b3b' : h === 'true' ? '#0ca30c' : '#2a78d6', strokeWidth: 2 })
const toFlowEdges = (wf: Workflow): Edge[] => wf.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, animated: true, style: edgeStyle(e.sourceHandle), markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle(e.sourceHandle).stroke } }))

export default function Builder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  )
}

function BuilderInner() {
  const { id } = useParams()
  const nav = useNavigate()
  const s = useStore()
  const dark = useIsDark()
  const existing = s.workflows.find((w) => w.id === id)
  const initial = useMemo<Workflow>(() => existing ?? { id: uid('wf'), name: 'Novo workflow', description: 'Descreva o objetivo desta automação.', status: 'draft', nodes: [], edges: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, [existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [meta, setMeta] = useState({ name: initial.name, description: initial.description, status: initial.status })
  const [nodes, setNodes, onNodesChange] = useNodesState<FNode>(toFlowNodes(initial))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(initial))
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [running, setRunning] = useState(false)
  const [lastExec, setLastExec] = useState<Execution | null>(null)
  const [showExec, setShowExec] = useState(false)
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)
  const readOnly = !s.can('edit')

  const current = useCallback((): Workflow => ({ ...initial, ...meta, nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: { kind: n.data.kind, type: n.data.type, label: n.data.label, config: n.data.config } })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })) }), [initial, meta, nodes, edges])
  const errors = useMemo(() => validateWorkflow(current()), [current])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (confirm('Há alterações não salvas. Sair mesmo assim?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  const mark = () => setDirty(true)
  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) return
      const src = nodes.find((n) => n.id === c.source)
      const tgt = nodes.find((n) => n.id === c.target)
      if (tgt?.data.kind === 'trigger') return toast.error('Gatilhos não recebem conexões de entrada.')
      if (!src) return
      setEdges((eds) => addEdge({ ...c, id: uid('e'), animated: true, style: edgeStyle(c.sourceHandle), markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle(c.sourceHandle).stroke } }, eds))
      mark()
    },
    [nodes, setEdges],
  )

  const add = (def: NodeDef, pos?: { x: number; y: number }) => {
    if (readOnly) return
    if (def.kind === 'trigger' && nodes.some((n) => n.data.kind === 'trigger')) return toast.error('Cada workflow tem apenas um gatilho. Remova o atual para trocar.')
    const last = [...nodes].sort((a, b) => b.position.x - a.position.x)[0]
    const position = pos ?? (last ? { x: last.position.x + 270, y: last.position.y } : { x: 60, y: 140 })
    const n = makeNode(def.type, position)
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), { id: n.id, type: 'wf', position: n.position, data: n.data, selected: true }])
    // conecta automaticamente ao último nó, quando faz sentido
    if (!pos && last && def.kind !== 'trigger') setEdges((eds) => [...eds, ...toFlowEdges({ ...initial, edges: [{ id: uid('e'), source: last.id, target: n.id, sourceHandle: last.data.kind === 'condition' ? 'true' : null }] })])
    setSelected(n.id)
    mark()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/mpa-node')
    const def = defOf(type)
    if (!def) return
    add(def, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }

  const sel = nodes.find((n) => n.id === selected)
  const updateData = (patch: Partial<WfNodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === selected ? { ...n, data: { ...n.data, ...patch, runStatus: undefined } } : n)))
    mark()
  }
  const updateConfig = (k: string, v: unknown) => sel && updateData({ config: { ...sel.data.config, [k]: v } })
  const removeSel = () => {
    if (!sel) return
    setNodes((ns) => ns.filter((n) => n.id !== sel.id))
    setEdges((es) => es.filter((e) => e.source !== sel.id && e.target !== sel.id))
    setSelected(null)
    mark()
  }

  const save = (status?: Workflow['status']) => {
    if (readOnly) return toast.error('Seu perfil é somente leitura.')
    if (!meta.name.trim()) return toast.error('Dê um nome ao workflow.')
    const wf = { ...current(), status: status ?? meta.status }
    if (wf.status === 'active' && errors.length) return toast.error('Corrija os problemas de validação antes de ativar.')
    s.saveWorkflow(wf)
    setMeta((m) => ({ ...m, status: wf.status }))
    setDirty(false)
    toast.success(status === 'active' ? 'Workflow salvo e ativado.' : status === 'paused' ? 'Workflow pausado.' : 'Alterações salvas.')
    if (id === 'new') setTimeout(() => nav(`/automation/workflows/${wf.id}`, { replace: true }), 0)
  }

  const test = async () => {
    if (errors.length) return toast.error(`Não é possível testar: ${errors[0]}`)
    setRunning(true)
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, runStatus: undefined } })))
    const ex = await s.executeWorkflow(initial.id, 'test', undefined, current())
    setRunning(false)
    if (!ex) return
    const st = new Map(ex.steps.map((x) => [x.nodeId, x.status]))
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, runStatus: st.get(n.id) } })))
    setLastExec(ex)
    if (ex.status === 'skipped') toast.info('Execução duplicada ignorada — aguarde alguns segundos.')
    else toast[ex.status === 'success' ? 'success' : 'error'](ex.result?.summary ?? ex.error ?? 'Teste concluído')
  }

  if (id !== 'new' && !existing) return <div className="card"><EmptyState title="Workflow não encontrado" action={<Link to="/automation" className="btn-primary">Voltar</Link>} /></div>

  const sequence = (() => {
    const order: string[] = []
    const trig = nodes.find((n) => n.data.kind === 'trigger')
    if (!trig) return []
    const q = [trig.id]
    while (q.length) {
      const cur = q.shift()!
      if (order.includes(cur)) continue
      order.push(cur)
      edges.filter((e) => e.source === cur).forEach((e) => q.push(e.target))
    }
    return order.map((x) => nodes.find((n) => n.id === x)!).filter(Boolean)
  })()

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col sm:-mx-6 lg:-mx-8">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-[#0b1128]">
        <Link to="/automation" className="btn-ghost p-1.5" aria-label="Voltar"><ArrowLeft size={16} /></Link>
        <div className="min-w-0 flex-1">
          <input className="w-full bg-transparent text-sm font-semibold focus:outline-none" value={meta.name} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); mark() }} aria-label="Nome do workflow" maxLength={80} disabled={readOnly} />
          <input className="w-full bg-transparent text-xs muted focus:outline-none" value={meta.description} onChange={(e) => { setMeta({ ...meta, description: e.target.value }); mark() }} aria-label="Descrição" maxLength={200} disabled={readOnly} />
        </div>
        <Badge tone={meta.status === 'active' ? 'green' : meta.status === 'paused' ? 'amber' : 'gray'}>{meta.status === 'active' ? 'Ativo' : meta.status === 'paused' ? 'Pausado' : 'Rascunho'}</Badge>
        {dirty && <Badge tone="blue">Alterações não salvas</Badge>}
        <button className="btn-secondary btn-sm" onClick={test} disabled={running || !nodes.length}>{running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Testar</button>
        {lastExec && <button className="btn-ghost btn-sm" onClick={() => setShowExec(true)}>Ver resultado do teste</button>}
        {meta.status === 'active' ? <button className="btn-secondary btn-sm" onClick={() => save('paused')} disabled={readOnly}><Pause size={13} /> Pausar</button> : <button className="btn-secondary btn-sm" onClick={() => save('active')} disabled={readOnly}><Play size={13} /> Ativar</button>}
        <button className="btn-primary btn-sm" onClick={() => save()} disabled={readOnly}><Save size={13} /> Salvar</button>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b1128] md:block">
          {[{ t: 'Triggers', items: TRIGGERS }, { t: 'Conditions', items: [CONDITION] }, { t: 'Actions', items: ACTIONS }].map((g) => (
            <div key={g.t} className="mb-4">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider muted">{g.t}</div>
              <div className="space-y-1">
                {g.items.map((d) => (
                  <button key={d.type} draggable={!readOnly} onDragStart={(e) => e.dataTransfer.setData('application/mpa-node', d.type)} onClick={() => add(d)} disabled={readOnly} className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition hover:border-slate-200 hover:bg-slate-50 disabled:opacity-50 dark:hover:border-white/10 dark:hover:bg-white/5" title={d.description}>
                    <span className={clsx('rounded-md p-1', KIND_STYLE[d.kind].chip)}><Icon name={d.icon} size={12} /></span>
                    <span className="flex-1 truncate">{d.label}</span>
                    <Plus size={12} className="opacity-40" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed muted">Clique para adicionar (conecta ao último nó) ou arraste para o canvas. Ligue a saída (direita) de um nó à entrada (esquerda) de outro. Selecione um nó ou conexão e pressione Backspace para remover.</p>
        </aside>
        <div className="relative min-w-0 flex-1" ref={wrapper} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === 'position' || x.type === 'remove')) mark() }}
            onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === 'remove')) mark() }}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelected(n.id)}
            onPaneClick={() => setSelected(null)}
            onNodesDelete={() => setSelected(null)}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
            colorMode={dark ? 'dark' : 'light'}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1.2} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden lg:!block" nodeColor={(n) => ((n.data as WfNodeData).kind === 'trigger' ? '#2a78d6' : (n.data as WfNodeData).kind === 'condition' ? '#eda100' : '#1baf7a')} />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto card max-w-sm p-5 text-center">
                <p className="text-sm font-medium">Comece por um gatilho</p>
                <p className="mt-1 text-xs muted">Escolha o evento que inicia a automação; depois adicione condições e ações.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">{TRIGGERS.slice(0, 4).map((t) => <button key={t.type} className="btn-secondary btn-sm" onClick={() => add(t)}>{t.label}</button>)}</div>
              </div>
            </div>
          )}
          {errors.length > 0 && nodes.length > 0 && (
            <div className="absolute left-3 top-3 max-w-sm rounded-lg border border-amber-200 bg-amber-50/95 p-2.5 text-[11px] text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-[#2a2314]/95 dark:text-amber-200">
              <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle size={12} /> {errors.length} ajuste(s) necessário(s)</div>
              <ul className="list-disc space-y-0.5 pl-4">{errors.slice(0, 4).map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </div>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1128] lg:block">
          {sel ? (
            <NodeConfig key={sel.id} n={sel} readOnly={readOnly} onLabel={(l) => updateData({ label: l })} onConfig={updateConfig} onRemove={removeSel} />
          ) : (
            <div className="p-4">
              <div className="text-sm font-semibold">Sequência de execução</div>
              <p className="mt-0.5 text-xs muted">Ordem em que o n8n executará as etapas a partir do gatilho.</p>
              {sequence.length === 0 ? <p className="mt-4 text-xs muted">Adicione um gatilho para começar.</p> : (
                <ol className="mt-3 space-y-2">
                  {sequence.map((n, i) => (
                    <li key={n.id}>
                      <button onClick={() => setSelected(n.id)} className="flex w-full items-start gap-2.5 rounded-lg border border-slate-100 p-2 text-left hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold dark:bg-white/10">{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{n.data.label}</span>
                          <span className="block text-[10px] muted">{KIND_STYLE[n.data.kind].label} · {defOf(n.data.type as string)?.label}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {nodes.length > sequence.length && <p className="mt-3 text-[11px] text-amber-600">{nodes.length - sequence.length} nó(s) desconectado(s) não serão executados.</p>}
            </div>
          )}
        </aside>
      </div>
      <ExecutionDetail ex={showExec ? lastExec : null} onClose={() => setShowExec(false)} />
    </div>
  )
}

function NodeConfig({ n, readOnly, onLabel, onConfig, onRemove }: { n: FNode; readOnly: boolean; onLabel: (l: string) => void; onConfig: (k: string, v: unknown) => void; onRemove: () => void }) {
  const def = defOf(n.data.type as string)!
  const c = n.data.config as Record<string, unknown>
  const rules = (c.rules as ConditionRule[]) ?? []
  const setRule = (i: number, patch: Partial<ConditionRule>) => onConfig('rules', rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <span className={clsx('rounded-md p-1.5', KIND_STYLE[n.data.kind].chip)}><Icon name={def.icon} size={14} /></span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide muted">{KIND_STYLE[n.data.kind].label}</div>
          <div className="text-sm font-semibold">{def.label}</div>
        </div>
      </div>
      <p className="mt-2 text-xs muted">{def.description}</p>
      <fieldset disabled={readOnly} className="mt-4 space-y-3">
        <Field label="Nome da etapa"><input className="input" value={n.data.label} onChange={(e) => onLabel(e.target.value)} maxLength={60} /></Field>
        {def.fields.map((f) => {
          const v = c[f.key]
          const invalid = f.type === 'number' && (v === '' || !isFinite(Number(v)))
          return (
            <Field key={f.key} label={f.label + (f.suffix ? ` (${f.suffix})` : '')} hint={f.help} error={invalid ? 'Informe um número válido.' : null}>
              {f.type === 'select' ? (
                <select className="input dark:[color-scheme:dark]" value={String(v ?? '')} onChange={(e) => onConfig(f.key, e.target.value)}>
                  {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'number' ? (
                <input className="input" type="number" step="any" value={v === undefined ? '' : String(v)} onChange={(e) => onConfig(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
              ) : (
                <input className="input dark:[color-scheme:dark]" type={f.type === 'time' ? 'time' : 'text'} value={String(v ?? '')} onChange={(e) => onConfig(f.key, e.target.value)} />
              )}
            </Field>
          )
        })}
        {n.data.kind === 'condition' && (
          <div>
            <div className="label">Combinar regras com</div>
            <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {(['AND', 'OR'] as const).map((op) => <button type="button" key={op} onClick={() => onConfig('combinator', op)} className={clsx('rounded-md px-3 py-1 text-xs font-semibold', c.combinator === op ? 'bg-amber-400 text-slate-900' : 'muted')}>{op}</button>)}
            </div>
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={r.id} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
                  {i > 0 && <div className="mb-1 text-[10px] font-bold text-amber-600">{String(c.combinator)}</div>}
                  <select className="input mb-1.5 py-1.5 text-xs dark:[color-scheme:dark]" value={r.metric} onChange={(e) => setRule(i, { metric: e.target.value as ConditionMetric })}>
                    {Object.entries(METRIC_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <div className="flex gap-1.5">
                    <select className="input w-20 py-1.5 text-xs dark:[color-scheme:dark]" value={r.op} onChange={(e) => setRule(i, { op: e.target.value as Operator })}>{OPERATORS.map((o) => <option key={o}>{o}</option>)}</select>
                    <input className="input py-1.5 text-xs" type="number" step="any" value={isFinite(r.value) ? r.value : ''} onChange={(e) => setRule(i, { value: e.target.value === '' ? NaN : Number(e.target.value) })} aria-label="Valor" />
                    <button type="button" className="btn-ghost p-1.5 text-bad" onClick={() => onConfig('rules', rules.filter((_, j) => j !== i))} aria-label="Remover regra"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => onConfig('rules', [...rules, { id: uid('r'), metric: 'roas', op: '<', value: 2 }])}><Plus size={12} /> Adicionar regra</button>
            <p className="mt-2 text-[10px] leading-relaxed muted">Saída verde (SIM) recebe os itens que atendem às regras; saída vermelha (NÃO), os demais. Exemplos: CAC &gt; 100, ROAS &lt; 2, CPL &gt; 30, Conversão &lt; 2, Orçamento consumido ≥ 80.</p>
          </div>
        )}
      </fieldset>
      {!readOnly && <button className="btn-ghost btn-sm mt-5 text-bad" onClick={onRemove}><Trash2 size={13} /> Remover etapa</button>}
    </div>
  )
}
