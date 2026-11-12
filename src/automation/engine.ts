import type { Campaign, Channel, DailyMetric } from '../data/types'
import type { Settings } from '../store/settings'
import { money, num, percent, ratio, signedPct } from '../lib/format'
import { generateInsights } from '../lib/insights'
import { derive, groupBy, sum, variation } from '../lib/metrics'
import { addDays, between, channelStats } from '../lib/query'
import { defOf, METRIC_LABELS, triggerOf, uid } from './catalog'
import type { AppNotification, AutomationLog, ConditionRule, ExecMode, ExecStep, Execution, WfNode, Workflow } from './types'

export interface EngineCtx {
  campaigns: Campaign[]
  channels: Channel[]
  metrics: DailyMetric[]
  settings: Settings
  asOf: string // data de referência (último dia com dados)
  now?: Date
  input?: Record<string, unknown>
}

export interface EngineResult {
  execution: Execution
  notifications: AppNotification[]
  logs: AutomationLog[]
  tags: { campaignId: string; tag: string }[]
}

type Item = Record<string, unknown> & { campaignId?: string; name: string }

function itemFor(c: Campaign | null, rows: DailyMetric[], s: Settings, extra?: Record<string, unknown>): Item {
  const d = derive(sum(rows), s.grossMargin)
  return {
    campaignId: c?.id,
    name: c?.name ?? 'Conta (total)',
    cac: d.cac,
    roas: d.roas,
    cpl: d.cpl,
    convRate: d.convRate,
    investment: d.investment,
    cpc: d.cpc,
    ctr: d.ctr,
    revenue: d.revenue,
    leads: d.leads,
    customers: d.customers,
    ...extra,
  }
}

function evalRule(item: Item, r: ConditionRule): boolean {
  const v = item[r.metric] as number | null | undefined
  if (v === null || v === undefined || !isFinite(v)) return false
  switch (r.op) {
    case '>': return v > r.value
    case '>=': return v >= r.value
    case '<': return v < r.value
    case '<=': return v <= r.value
    case '=': return Math.abs(v - r.value) < 1e-9
  }
}

function fmtItem(i: Item, keys: string[]) {
  const f: Record<string, (v: number | null) => string> = { cac: money, cpl: money, cpc: money, investment: (v) => money(v), revenue: (v) => money(v), roas: ratio, convRate: (v) => percent(v), ctr: (v) => percent(v), budgetUsed: (v) => percent(v, 0), leadRate: (v) => percent(v), drop: (v) => signedPct(v), rise: (v) => signedPct(v) }
  return `${i.name}: ${keys.map((k) => `${k.toUpperCase()} ${(f[k] ?? ((v: number | null) => String(v)))(i[k] as number | null)}`).join(' · ')}`
}

export function periodReport(ctx: EngineCtx, days: number) {
  const { metrics, settings, campaigns, channels, asOf } = ctx
  const start = addDays(asOf, -(days - 1))
  const pStart = addDays(start, -days)
  const pEnd = addDays(start, -1)
  const cur = derive(sum(between(metrics, start, asOf)), settings.grossMargin)
  const prev = derive(sum(between(metrics, pStart, pEnd)), settings.grossMargin)
  const chs = channelStats(campaigns, channels, between(metrics, start, asOf), settings.grossMargin).filter((c) => c.d.investment > 0)
  const byRoi = [...chs].filter((c) => c.d.roi !== null).sort((a, b) => b.d.roi! - a.d.roi!)
  const line = (label: string, a: string, delta: number | null) => `• ${label}: ${a} (${signedPct(delta)} vs. período anterior)`
  const lines = [
    `Período: ${start.split('-').reverse().join('/')} a ${asOf.split('-').reverse().join('/')} (${days} dia${days > 1 ? 's' : ''})`,
    line('Investimento', money(cur.investment), variation(cur.investment, prev.investment)),
    line('Receita atribuída', money(cur.revenue), variation(cur.revenue, prev.revenue)),
    line('Leads', num(cur.leads), variation(cur.leads, prev.leads)),
    line('Conversões', num(cur.customers), variation(cur.customers, prev.customers)),
    line('CAC', money(cur.cac), variation(cur.cac, prev.cac)),
    line('ROAS', ratio(cur.roas), variation(cur.roas, prev.roas)),
    line('ROI', percent(cur.roi, 1), cur.roi !== null && prev.roi !== null ? cur.roi - prev.roi : null).replace('%)', ' p.p.)').replace('% vs', ' p.p. vs'),
  ]
  if (byRoi.length >= 2) {
    lines.push(`• Melhor canal (ROI): ${byRoi[0].channel.name} — ${percent(byRoi[0].d.roi, 1)}`)
    lines.push(`• Pior canal (ROI): ${byRoi[byRoi.length - 1].channel.name} — ${percent(byRoi[byRoi.length - 1].d.roi, 1)}`)
  }
  return { text: lines.join('\n'), cur, prev, start }
}

export function runWorkflow(wf: Workflow, ctx: EngineCtx, mode: ExecMode): EngineResult {
  const now = ctx.now ?? new Date()
  const s = ctx.settings
  const steps: ExecStep[] = []
  const notifications: AppNotification[] = []
  const logs: AutomationLog[] = []
  const tags: { campaignId: string; tag: string }[] = []
  const outputs: { action: string; content: string }[] = []
  let elapsed = 0
  const rnd = (a: number, b: number) => Math.round(a + Math.random() * (b - a))
  const exec: Execution = {
    id: uid('exec'),
    workflowId: wf.id,
    workflowName: wf.name,
    startedAt: now.toISOString(),
    finishedAt: null,
    durationMs: 0,
    status: 'running',
    mode,
    engine: 'demo',
    idempotencyKey: '',
    input: { asOf: ctx.asOf, ...(ctx.input ?? {}) },
    result: null,
    steps,
  }
  const trigger = triggerOf(wf)
  if (!trigger) {
    exec.status = 'error'
    exec.error = 'Workflow sem gatilho configurado.'
    exec.finishedAt = now.toISOString()
    return { execution: exec, notifications, logs, tags }
  }

  // ---- Gatilho
  const tc = trigger.data.config as Record<string, number | string>
  const lookback = Number(tc.lookbackDays ?? 7) || 7
  const wStart = addDays(ctx.asOf, -(lookback - 1))
  const windowRows = between(ctx.metrics, wStart, ctx.asOf)
  const byCamp = groupBy(windowRows, (r) => r.campaignId)
  let items: Item[] = []
  let triggerMsg = ''
  let triggerFired = true
  const camps = ctx.campaigns
  switch (trigger.data.type) {
    case 'schedule': {
      items = [itemFor(null, windowRows, s)]
      triggerMsg = `Execução programada — janela de ${lookback} dia(s) até ${ctx.asOf}`
      break
    }
    case 'new_lead': {
      const day = between(ctx.metrics, ctx.asOf, ctx.asOf)
      const n = day.reduce((a, r) => a + r.leads, 0)
      items = camps.map((c) => itemFor(c, day.filter((r) => r.campaignId === c.id), s)).filter((i) => (i.leads as number) > 0)
      triggerMsg = `${n} novos leads em ${ctx.asOf}`
      triggerFired = n > 0
      break
    }
    case 'cac_above': {
      const th = Number(tc.threshold)
      items = camps.filter((c) => byCamp.has(c.id)).map((c) => itemFor(c, byCamp.get(c.id)!, s)).filter((i) => (i.cac !== null && (i.cac as number) > th) || (i.cac === null && (i.investment as number) > th))
      triggerMsg = `${items.length} campanha(s) com CAC > ${money(th)} nos últimos ${lookback} dias`
      triggerFired = items.length > 0
      break
    }
    case 'roas_below': {
      const t = Number(tc.target)
      items = camps.filter((c) => byCamp.has(c.id)).map((c) => itemFor(c, byCamp.get(c.id)!, s)).filter((i) => i.roas !== null && (i.roas as number) < t)
      triggerMsg = `${items.length} campanha(s) com ROAS < ${ratio(t)} nos últimos ${lookback} dias`
      triggerFired = items.length > 0
      break
    }
    case 'budget_near': {
      const pct = Number(tc.pct)
      const mStart = ctx.asOf.slice(0, 8) + '01'
      const mtd = groupBy(between(ctx.metrics, mStart, ctx.asOf), (r) => r.campaignId)
      items = camps
        .filter((c) => mtd.has(c.id) && c.monthlyBudget > 0)
        .map((c) => {
          const rs = mtd.get(c.id)!
          const used = (rs.reduce((a, r) => a + r.mediaSpend + r.otherCost, 0) / c.monthlyBudget) * 100
          return itemFor(c, rs, s, { budgetUsed: used, budget: c.monthlyBudget })
        })
        .filter((i) => (i.budgetUsed as number) >= pct)
      triggerMsg = `${items.length} campanha(s) com ≥ ${pct}% do orçamento mensal consumido`
      triggerFired = items.length > 0
      break
    }
    case 'conv_drop':
    case 'cpc_spike': {
      const bStart = addDays(wStart, -28)
      const bEnd = addDays(wStart, -1)
      const base = groupBy(between(ctx.metrics, bStart, bEnd), (r) => r.campaignId)
      const thr = Number(trigger.data.type === 'conv_drop' ? tc.dropPct : tc.risePct)
      items = []
      for (const c of camps) {
        const r = byCamp.get(c.id)
        const b = base.get(c.id)
        if (!r || !b) continue
        const dr = derive(sum(r), s.grossMargin)
        const db = derive(sum(b), s.grossMargin)
        if (trigger.data.type === 'conv_drop') {
          const v = variation(dr.leadRate, db.leadRate)
          if (v !== null && v <= -thr && dr.visitors > 100) items.push(itemFor(c, r, s, { leadRate: dr.leadRate, drop: v }))
        } else {
          const v = variation(dr.cpc, db.cpc)
          if (v !== null && v >= thr && dr.clicks > 100) items.push(itemFor(c, r, s, { rise: v }))
        }
      }
      triggerMsg = `${items.length} campanha(s) com ${trigger.data.type === 'conv_drop' ? `queda de conversão ≥ ${thr}%` : `alta de CPC ≥ ${thr}%`} vs. 4 semanas anteriores`
      triggerFired = items.length > 0
      break
    }
    case 'data_import': {
      const rows = Number(ctx.input?.rows ?? 0)
      items = [itemFor(null, windowRows, s, { importedRows: rows })]
      triggerMsg = rows ? `Importação concluída com ${rows} linhas` : 'Evento de importação (teste manual)'
      break
    }
    case 'new_campaign': {
      const latest = [...camps].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
      items = latest ? [itemFor(latest, byCamp.get(latest.id) ?? [], s)] : []
      triggerMsg = latest ? `Campanha mais recente: ${latest.name} (início ${latest.startDate})` : 'Nenhuma campanha'
      break
    }
  }
  const tms = rnd(80, 260)
  elapsed += tms
  steps.push({ nodeId: trigger.id, label: trigger.data.label, kind: 'trigger', status: 'success', ms: tms, output: triggerMsg })

  // ---- Percurso do grafo
  const visited = new Set<string>([trigger.id])
  const queue: { node: WfNode; items: Item[] }[] = []
  const enqueue = (from: WfNode, its: Item[], handle?: 'true' | 'false') => {
    for (const e of wf.edges.filter((e) => e.source === from.id && (handle ? (e.sourceHandle ?? 'true') === handle : true))) {
      const n = wf.nodes.find((x) => x.id === e.target)
      if (n && !visited.has(n.id)) {
        visited.add(n.id)
        queue.push({ node: n, items: its })
      }
    }
  }
  if (triggerFired) enqueue(trigger, items)
  const errorMsg: string | undefined = undefined

  while (queue.length) {
    const { node, items: its } = queue.shift()!
    const ms = rnd(60, 900)
    elapsed += ms
    if (node.data.kind === 'condition') {
      const cfg = node.data.config as { combinator: 'AND' | 'OR'; rules: ConditionRule[] }
      const pass = its.filter((i) => (cfg.combinator === 'AND' ? cfg.rules.every((r) => evalRule(i, r)) : cfg.rules.some((r) => evalRule(i, r))))
      const fail = its.filter((i) => !pass.includes(i))
      const desc = cfg.rules.map((r) => `${METRIC_LABELS[r.metric]} ${r.op} ${r.value}`).join(` ${cfg.combinator} `)
      steps.push({ nodeId: node.id, label: node.data.label, kind: 'condition', status: 'success', ms, output: `${desc} → ${pass.length} verdadeiro(s), ${fail.length} falso(s)` })
      if (pass.length) enqueue(node, pass, 'true')
      if (fail.length) enqueue(node, fail, 'false')
      continue
    }
    const cfg = node.data.config as Record<string, string>
    const keys = ['cac', 'roas', 'cpl', 'convRate', 'budgetUsed', 'drop', 'rise'].filter((k) => its.some((i) => i[k] !== undefined && i[k] !== null)).slice(0, 3)
    const list = its.filter((i) => i.campaignId).map((i) => fmtItem(i, keys))
    let out = ''
    switch (node.data.type) {
      case 'generate_report': {
        const days = Math.max(1, lookback)
        const rep = periodReport(ctx, days)
        out = rep.text + (list.length ? `\n\nItens do gatilho:\n${list.join('\n')}` : '')
        outputs.push({ action: 'Relatório', content: out })
        out = `Relatório gerado (${days} dia(s))`
        break
      }
      case 'send_email': {
        const body = outputs.find((o) => o.action === 'Relatório')?.content ?? list.join('\n')
        outputs.push({ action: 'E-mail', content: `Para: ${cfg.to}\nAssunto: ${cfg.subject}\n\n${body}` })
        out = `E-mail enfileirado para ${cfg.to} (modo demo: não enviado)`
        break
      }
      case 'slack': {
        const body = outputs.find((o) => o.action.startsWith('Insights'))?.content ?? outputs.find((o) => o.action === 'Relatório')?.content ?? list.join('\n')
        outputs.push({ action: `Slack ${cfg.channel}`, content: body })
        out = `Mensagem preparada para ${cfg.channel} (modo demo: não publicada)`
        break
      }
      case 'notify': {
        const sev = (cfg.severity as AppNotification['severity']) ?? 'warning'
        notifications.push({ id: uid('ntf'), at: now.toISOString(), title: wf.name, body: list.length ? `${list.length} item(ns): ${its.map((i) => i.name).slice(0, 3).join(', ')}${its.length > 3 ? '…' : ''}` : triggerMsg, read: false, severity: sev, link: '/automation' })
        out = `Notificação in-app enviada (${sev})`
        break
      }
      case 'log_event':
      case 'log_incident': {
        logs.push({ id: uid('log'), at: now.toISOString(), level: node.data.type === 'log_incident' ? 'warn' : 'info', workflowId: wf.id, message: `${cfg.message ?? `Ocorrência (${cfg.severity})`}: ${its.map((i) => i.name).join(', ') || triggerMsg}` })
        out = node.data.type === 'log_incident' ? `Ocorrência registrada (severidade ${cfg.severity})` : 'Evento registrado no histórico'
        break
      }
      case 'update_record': {
        for (const i of its) if (i.campaignId) tags.push({ campaignId: i.campaignId, tag: cfg.tag })
        out = `Tag "${cfg.tag}" aplicada a ${its.filter((i) => i.campaignId).length} campanha(s)`
        break
      }
      case 'webhook': {
        const payload = { event: wf.templateId ?? 'custom', workflow: wf.name, asOf: ctx.asOf, items: its.slice(0, 10) }
        outputs.push({ action: 'Webhook', content: `POST ${cfg.url}\nX-MPA-Signature: sha256=<assinado no backend>\n\n${JSON.stringify(payload, null, 2)}` })
        out = 'Payload preparado (modo demo: assinatura e envio ocorrem no backend)'
        break
      }
      case 'ai_insights': {
        const ids = new Set(its.map((i) => i.campaignId).filter(Boolean))
        const start = addDays(ctx.asOf, -29)
        const all = generateInsights({ campaigns: ctx.campaigns, channels: ctx.channels, rows: ctx.metrics, start, end: ctx.asOf, settings: s })
        const rel = ids.size ? all.filter((x) => x.entityId && ids.has(x.entityId)) : all.slice(0, 4)
        const text = rel.length ? rel.slice(0, 5).map((x) => `• [${x.priority}] ${x.entity} — ${x.title}. ${x.recommendation}`).join('\n') : 'Nenhuma recomendação adicional: os indicadores dos itens recebidos não acionaram regras de insight.'
        outputs.push({ action: 'Insights IA', content: text })
        out = `${rel.length} recomendação(ões) gerada(s) a partir dos dados (sem métricas inventadas)`
        break
      }
    }
    steps.push({ nodeId: node.id, label: node.data.label, kind: node.data.kind, status: 'success', ms, output: out })
    enqueue(node, its)
  }

  for (const n of wf.nodes) {
    if (!visited.has(n.id) || (!triggerFired && n.id !== trigger.id)) {
      if (!steps.find((st) => st.nodeId === n.id)) steps.push({ nodeId: n.id, label: n.data.label, kind: n.data.kind, status: 'skipped', ms: 0, output: triggerFired ? 'Não alcançado (ramo não executado ou nó desconectado)' : 'Gatilho não disparou' })
    }
  }

  exec.durationMs = elapsed
  exec.finishedAt = new Date(now.getTime() + elapsed).toISOString()
  exec.status = errorMsg ? 'error' : 'success'
  exec.error = errorMsg
  exec.result = {
    summary: triggerFired ? `${triggerMsg}. ${steps.filter((x) => x.kind === 'action' && x.status === 'success').length} ação(ões) executada(s).` : `${triggerMsg}. Nenhuma ação necessária.`,
    items: items.slice(0, 20).map((i) => ({ ...i })),
    outputs,
  }
  return { execution: exec, notifications, logs, tags }
}

export function validateWorkflow(wf: Workflow): string[] {
  const errs: string[] = []
  const triggers = wf.nodes.filter((n) => n.data.kind === 'trigger')
  if (triggers.length === 0) errs.push('Adicione um gatilho (trigger).')
  if (triggers.length > 1) errs.push('Use apenas um gatilho por workflow.')
  if (!wf.nodes.some((n) => n.data.kind === 'action')) errs.push('Adicione ao menos uma ação.')
  for (const n of wf.nodes) {
    if (n.data.kind !== 'trigger' && !wf.edges.some((e) => e.target === n.id)) errs.push(`"${n.data.label}" não está conectado a nenhuma etapa anterior.`)
    if (n.data.kind === 'condition') {
      const rules = (n.data.config as { rules: ConditionRule[] }).rules
      if (!rules?.length) errs.push(`"${n.data.label}" não tem regras.`)
      if (rules?.some((r) => !isFinite(r.value))) errs.push(`"${n.data.label}" tem valor inválido.`)
    }
    const def = defOf(n.data.type as string)
    for (const f of def?.fields ?? []) {
      const v = (n.data.config as Record<string, unknown>)[f.key]
      if (f.type === 'number' && (v === '' || v === undefined || !isFinite(Number(v)))) errs.push(`"${n.data.label}": campo "${f.label}" inválido.`)
      if (f.type === 'text' && f.key === 'to' && !String(v ?? '').includes('@')) errs.push(`"${n.data.label}": informe e-mail(s) válido(s).`)
    }
  }
  // ciclos
  const adj = new Map<string, string[]>()
  for (const e of wf.edges) adj.set(e.source, [...(adj.get(e.source) ?? []), e.target])
  const state = new Map<string, number>()
  const dfs = (id: string): boolean => {
    state.set(id, 1)
    for (const t of adj.get(id) ?? []) {
      if (state.get(t) === 1) return true
      if (!state.get(t) && dfs(t)) return true
    }
    state.set(id, 2)
    return false
  }
  if (wf.nodes.some((n) => !state.get(n.id) && dfs(n.id))) errs.push('O fluxo contém um ciclo; remova a conexão que volta para uma etapa anterior.')
  return errs
}

