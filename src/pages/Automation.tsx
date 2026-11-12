import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Activity, CheckCircle2, Eye, History, Loader2, Pause, Pencil, Play, Plug, Plus, Sparkles, Trash2, Workflow as WfIcon, XCircle } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Badge, Card, DataTable, EmptyState, Modal, PageHeader, Segmented, Tabs, Toggle, toast, type Column } from '../components/ui'
import ExecutionDetail, { MODE_LABEL, StatusBadge } from '../components/ExecutionDetail'
import { describeTrigger, defOf, METRIC_LABELS } from '../automation/catalog'
import { TEMPLATES, workflowFromTemplate, type Template } from '../automation/templates'
import type { ConditionRule, Execution, Workflow } from '../automation/types'
import { dateTimeBR, percent, relTime } from '../lib/format'

export default function Automation() {
  const s = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState<'workflows' | 'templates' | 'history' | 'logs'>('workflows')
  const [execView, setExecView] = useState<Execution | null>(null)
  const [historyFor, setHistoryFor] = useState<Workflow | null>(null)
  const [details, setDetails] = useState<Workflow | null>(null)
  const [toDelete, setToDelete] = useState<Workflow | null>(null)
  const [statusF, setStatusF] = useState<'all' | Execution['status']>('all')

  const stats = useMemo(() => {
    const ex = s.executions.filter((e) => e.status !== 'skipped')
    const ok = ex.filter((e) => e.status === 'success').length
    const err = ex.filter((e) => e.status === 'error').length
    return { total: s.workflows.length, active: s.workflows.filter((w) => w.status === 'active').length, paused: s.workflows.filter((w) => w.status !== 'active').length, runs: ex.length, ok, err, rate: ex.length ? (ok / ex.length) * 100 : null, last: s.executions[0] }
  }, [s.workflows, s.executions])

  const lastOf = (id: string) => s.executions.find((e) => e.workflowId === id)
  const countOf = (id: string) => s.executions.filter((e) => e.workflowId === id && e.status !== 'skipped').length

  const run = async (wf: Workflow) => {
    if (!s.can('edit')) return toast.error('Seu perfil é somente leitura.')
    const ex = await s.executeWorkflow(wf.id, 'test')
    if (!ex) return
    if (ex.status === 'skipped') toast.info('Execução duplicada ignorada (idempotência).')
    else if (ex.status === 'success') toast.success(`${wf.name}: ${ex.result?.summary}`)
    else toast.error(`${wf.name}: ${ex.error}`)
    setExecView(ex)
  }
  const applyTemplate = (t: Template) => {
    if (!s.can('edit')) return toast.error('Seu perfil é somente leitura.')
    const wf = workflowFromTemplate(t, 'draft')
    s.saveWorkflow(wf)
    toast.success(`Workflow "${t.name}" criado a partir do modelo. Revise e ative.`)
    nav(`/automation/workflows/${wf.id}`)
  }

  const cols: Column<Workflow>[] = [
    { key: 'name', header: 'Workflow', sticky: true, value: (w) => w.name, render: (w) => <div className="max-w-[280px]"><div className="truncate font-medium">{w.name}</div><div className="truncate text-[11px] muted">{w.description}</div></div> },
    { key: 'status', header: 'Status', value: (w) => w.status, render: (w) => <div className="flex items-center gap-2"><Toggle checked={w.status === 'active'} disabled={!s.can('edit')} onChange={(v) => { s.setWorkflowStatus(w.id, v ? 'active' : 'paused'); toast.success(`${w.name} ${v ? 'ativado' : 'pausado'}.`) }} label="Ativar/pausar" /><Badge tone={w.status === 'active' ? 'green' : w.status === 'paused' ? 'amber' : 'gray'}>{w.status === 'active' ? 'Ativo' : w.status === 'paused' ? 'Pausado' : 'Rascunho'}</Badge></div> },
    { key: 'trigger', header: 'Gatilho', value: (w) => describeTrigger(w).trigger },
    { key: 'freq', header: 'Frequência', value: (w) => describeTrigger(w).frequency },
    { key: 'last', header: 'Última execução', value: (w) => lastOf(w.id)?.startedAt ?? '', render: (w) => <span title={dateTimeBR(lastOf(w.id)?.startedAt)}>{relTime(lastOf(w.id)?.startedAt)}</span> },
    { key: 'count', header: 'Execuções', align: 'right', value: (w) => countOf(w.id) },
    { key: 'result', header: 'Último resultado', value: (w) => lastOf(w.id)?.status ?? '', render: (w) => { const e = lastOf(w.id); return e ? <button onClick={(ev) => { ev.stopPropagation(); setExecView(e) }}><StatusBadge s={e.status} /></button> : <span className="muted">—</span> } },
    {
      key: 'actions', header: 'Ações', align: 'right', sortable: false,
      render: (w) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost p-1.5" title="Executar teste manual" aria-label="Executar teste" disabled={s.runningIds.includes(w.id)} onClick={() => run(w)}>{s.runningIds.includes(w.id) ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}</button>
          <button className="btn-ghost p-1.5" title="Editar" aria-label="Editar" onClick={() => nav(`/automation/workflows/${w.id}`)}><Pencil size={15} /></button>
          <button className="btn-ghost p-1.5" title="Histórico" aria-label="Histórico" onClick={() => setHistoryFor(w)}><History size={15} /></button>
          <button className="btn-ghost p-1.5" title="Detalhes" aria-label="Detalhes" onClick={() => setDetails(w)}><Eye size={15} /></button>
          <button className="btn-ghost p-1.5 text-bad" title={s.can('delete') ? 'Excluir' : 'Apenas administradores podem excluir'} aria-label="Excluir" disabled={!s.can('delete')} onClick={() => setToDelete(w)}><Trash2 size={15} /></button>
        </div>
      ),
    },
  ]

  const exCols: Column<Execution>[] = [
    { key: 'id', header: 'ID', value: (e) => e.id, render: (e) => <code className="text-[11px]">{e.id.slice(0, 16)}</code> },
    { key: 'wf', header: 'Workflow', value: (e) => e.workflowName },
    { key: 'at', header: 'Data e hora', value: (e) => e.startedAt, render: (e) => dateTimeBR(e.startedAt) },
    { key: 'mode', header: 'Modo', value: (e) => MODE_LABEL[e.mode] },
    { key: 'status', header: 'Status', value: (e) => e.status, render: (e) => <StatusBadge s={e.status} /> },
    { key: 'dur', header: 'Duração', align: 'right', value: (e) => e.durationMs, render: (e) => `${(e.durationMs / 1000).toFixed(2)} s` },
    { key: 'res', header: 'Resultado', value: (e) => e.error ?? e.result?.summary ?? '', render: (e) => <span className={clsx('block max-w-[380px] truncate text-xs', e.error ? 'text-bad' : 'muted')}>{e.error ?? e.result?.summary}</span> },
  ]

  return (
    <>
      <PageHeader title="Automações" description="Criação, execução e monitoramento de workflows. O app guarda configurações e histórico; o n8n executa agendamentos, condições e envios via webhooks autenticados." actions={s.can('edit') && <><button className="btn-secondary" onClick={() => setTab('templates')}><Sparkles size={14} /> Usar modelo</button><button className="btn-primary" onClick={() => nav('/automation/workflows/new')}><Plus size={14} /> Criar workflow</button></>} />

      <div className={clsx('mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-xs', s.settings.integrations.n8nConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200')}>
        <Plug size={16} />
        <div className="flex-1">
          {s.settings.integrations.n8nConnected ? <><b>n8n conectado.</b> Execuções disparadas pelo backend.</> : <><b>n8n não conectado.</b> As execuções rodam no motor interno do app, com as mesmas regras; e-mails, Slack e webhooks ficam registrados no histórico sem envio.</>}
        </div>
        <Link to="/settings?tab=integrations" className="font-semibold underline">Como configurar</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          { l: 'Total de workflows', v: stats.total, i: WfIcon },
          { l: 'Ativos', v: stats.active, i: Play, c: 'text-good-ink dark:text-good' },
          { l: 'Pausados / rascunho', v: stats.paused, i: Pause, c: 'text-amber-600' },
          { l: 'Execuções', v: stats.runs, i: Activity },
          { l: 'Bem-sucedidas', v: stats.ok, i: CheckCircle2, c: 'text-good-ink dark:text-good' },
          { l: 'Com erro', v: stats.err, i: XCircle, c: 'text-bad' },
          { l: 'Taxa de sucesso', v: percent(stats.rate, 1), i: CheckCircle2 },
          { l: 'Última execução', v: relTime(stats.last?.startedAt), i: History, sub: stats.last?.workflowName },
        ].map((k) => (
          <div key={k.l} className="card p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] muted"><k.i size={12} />{k.l}</div>
            <div className={clsx('mt-1 text-xl font-semibold', k.c)}>{k.v}</div>
            {k.sub && <div className="truncate text-[10px] muted">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'workflows', label: 'Workflows', count: s.workflows.length }, { value: 'templates', label: 'Modelos', count: TEMPLATES.length }, { value: 'history', label: 'Histórico de execuções', count: s.executions.length }, { value: 'logs', label: 'Logs', count: s.logs.length }]} />
        {tab === 'workflows' && (
          <Card>
            <DataTable rows={s.workflows} columns={cols} rowKey={(w) => w.id} search={(w) => `${w.name} ${w.description}`} searchPlaceholder="Pesquisar workflow…" onRowClick={(w) => nav(`/automation/workflows/${w.id}`)} empty={<EmptyState icon={<WfIcon size={20} />} title="Nenhum workflow" description="Crie do zero ou a partir de um modelo." action={<button className="btn-primary" onClick={() => setTab('templates')}>Ver modelos</button>} />} />
          </Card>
        )}
        {tab === 'templates' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="card flex flex-col p-4">
                <div className="flex items-center gap-2">
                  <div className={clsx('rounded-lg p-2', t.ai ? 'bg-ai-50 text-ai-500 dark:bg-ai-500/15' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300')}>{t.ai ? <Sparkles size={15} /> : <WfIcon size={15} />}</div>
                  <div className="text-sm font-semibold">{t.name}</div>
                </div>
                <p className="mt-2 text-xs muted">{t.description}</p>
                <ol className="mt-3 space-y-1 text-xs">
                  {t.steps.map((st, i) => <li key={i} className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold dark:bg-white/10">{i + 1}</span>{st}</li>)}
                </ol>
                <div className="mt-auto flex items-center justify-between pt-4">
                  {t.ai ? <Badge tone="purple">IA</Badge> : <span className="text-[11px] muted">{s.workflows.filter((w) => w.templateId === t.id).length} em uso</span>}
                  <button className="btn-secondary btn-sm" onClick={() => applyTemplate(t)} disabled={!s.can('edit')}>Usar modelo</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'history' && (
          <Card>
            <DataTable rows={s.executions.filter((e) => statusF === 'all' || e.status === statusF)} columns={exCols} rowKey={(e) => e.id} search={(e) => `${e.workflowName} ${e.id}`} searchPlaceholder="Pesquisar por workflow ou ID…" onRowClick={setExecView} pageSize={15} dense toolbar={<Segmented value={statusF} onChange={setStatusF} options={[{ value: 'all', label: 'Todas' }, { value: 'success', label: 'Sucesso' }, { value: 'error', label: 'Erro' }, { value: 'skipped', label: 'Ignoradas' }]} />} />
          </Card>
        )}
        {tab === 'logs' && (
          <Card title="Automation logs" subtitle="Registro de operações: execuções, alterações, importações e falhas de integração">
            <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto font-mono text-[11px] dark:divide-white/5">
              {s.logs.slice(0, 300).map((l) => (
                <div key={l.id} className="flex gap-3 py-1.5">
                  <span className="shrink-0 muted">{dateTimeBR(l.at)}</span>
                  <span className={clsx('w-12 shrink-0 font-semibold uppercase', l.level === 'error' ? 'text-bad' : l.level === 'warn' ? 'text-amber-600' : 'text-brand-600 dark:text-brand-300')}>{l.level}</span>
                  <span className="break-words">{l.message}</span>
                </div>
              ))}
              {s.logs.length === 0 && <EmptyState title="Sem logs" />}
            </div>
          </Card>
        )}
      </div>

      <ExecutionDetail ex={execView} onClose={() => setExecView(null)} />

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`Histórico · ${historyFor?.name}`} size="lg">
        {historyFor && (
          <DataTable rows={s.executions.filter((e) => e.workflowId === historyFor.id)} columns={exCols.filter((c) => c.key !== 'wf')} rowKey={(e) => e.id} onRowClick={(e) => { setHistoryFor(null); setExecView(e) }} pageSize={10} dense empty={<EmptyState title="Ainda não executado" />} />
        )}
      </Modal>

      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.name ?? ''} size="lg" footer={details && <><button className="btn-secondary" onClick={() => setDetails(null)}>Fechar</button><button className="btn-primary" onClick={() => nav(`/automation/workflows/${details.id}`)}><Pencil size={14} /> Abrir no editor</button></>}>
        {details && (
          <div className="space-y-3 text-sm">
            <p className="muted">{details.description}</p>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><div className="muted">Status</div><div className="font-medium">{details.status}</div></div>
              <div><div className="muted">Gatilho</div><div className="font-medium">{describeTrigger(details).trigger}</div></div>
              <div><div className="muted">Frequência</div><div className="font-medium">{describeTrigger(details).frequency}</div></div>
              <div><div className="muted">Atualizado</div><div className="font-medium">{dateTimeBR(details.updatedAt)}</div></div>
              <div><div className="muted">ID n8n</div><div className="font-medium">{details.n8nWorkflowId ?? 'não sincronizado (demo)'}</div></div>
              <div><div className="muted">Webhook de disparo</div><code className="text-[10px]">POST /api/workflows/{details.id.slice(0, 10)}…/trigger</code></div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold">Sequência de execução</div>
              <ol className="space-y-2">
                {details.nodes.map((n, i) => (
                  <li key={n.id} className="flex gap-3 rounded-lg border border-slate-100 p-2.5 dark:border-white/10">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold dark:bg-white/10">{i + 1}</span>
                    <div className="text-xs">
                      <div className="font-medium">{n.data.label} <Badge tone={n.data.kind === 'trigger' ? 'blue' : n.data.kind === 'condition' ? 'amber' : 'green'}>{n.data.kind}</Badge></div>
                      <div className="muted">{defOf(n.data.type as string)?.label}</div>
                      <div className="mt-0.5 font-mono text-[10px] muted">
                        {n.data.kind === 'condition'
                          ? ((n.data.config as { rules: ConditionRule[]; combinator: string }).rules.map((r) => `${METRIC_LABELS[r.metric]} ${r.op} ${r.value}`).join(` ${(n.data.config as { combinator: string }).combinator} `))
                          : JSON.stringify(n.data.config)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir workflow" size="sm" footer={<><button className="btn-secondary" onClick={() => setToDelete(null)}>Cancelar</button><button className="btn-danger" onClick={() => { s.deleteWorkflow(toDelete!.id); toast.success('Workflow excluído.'); setToDelete(null) }}>Excluir</button></>}>
        <p className="text-sm">Excluir <b>{toDelete?.name}</b>? O histórico de execuções é mantido para auditoria, mas o workflow deixa de rodar no n8n.</p>
      </Modal>
    </>
  )
}
