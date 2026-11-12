import type { ActionType, ConditionMetric, NodeKind, Operator, TriggerType, WfNode, WfEdge, Workflow } from './types'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'time'
  options?: { value: string; label: string }[]
  help?: string
  suffix?: string
}

export interface NodeDef {
  type: TriggerType | ActionType | 'condition'
  kind: NodeKind
  label: string
  description: string
  icon: string
  defaults: Record<string, unknown>
  fields: FieldDef[]
}

const freq: FieldDef = {
  key: 'frequency',
  label: 'Frequência',
  type: 'select',
  options: [
    { value: 'hourly', label: 'A cada hora' },
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekly', label: 'Semanalmente (segunda)' },
  ],
}
const lookback: FieldDef = { key: 'lookbackDays', label: 'Janela de análise', type: 'number', suffix: 'dias' }

export const TRIGGERS: NodeDef[] = [
  { type: 'schedule', kind: 'trigger', label: 'Execução programada', description: 'Executa em horário definido (cron no n8n).', icon: 'Clock', defaults: { frequency: 'daily', time: '08:00', lookbackDays: 1 }, fields: [freq, { key: 'time', label: 'Horário', type: 'time' }, lookback] },
  { type: 'new_lead', kind: 'trigger', label: 'Novo lead cadastrado', description: 'Disparado por webhook quando um lead entra no CRM.', icon: 'UserPlus', defaults: { lookbackDays: 1 }, fields: [lookback] },
  { type: 'cac_above', kind: 'trigger', label: 'CAC acima do limite', description: 'Monitora o CAC das campanhas.', icon: 'TrendingUp', defaults: { threshold: 300, lookbackDays: 7, frequency: 'daily' }, fields: [{ key: 'threshold', label: 'Limite de CAC', type: 'number', suffix: 'R$' }, lookback, freq] },
  { type: 'roas_below', kind: 'trigger', label: 'ROAS abaixo da meta', description: 'Monitora o ROAS das campanhas pagas.', icon: 'TrendingDown', defaults: { target: 2.5, lookbackDays: 7, frequency: 'daily' }, fields: [{ key: 'target', label: 'Meta de ROAS', type: 'number', suffix: 'x' }, lookback, freq] },
  { type: 'budget_near', kind: 'trigger', label: 'Orçamento próximo do limite', description: 'Compara o investimento do mês com o orçamento planejado.', icon: 'Wallet', defaults: { pct: 80, frequency: 'daily' }, fields: [{ key: 'pct', label: 'Consumo mínimo', type: 'number', suffix: '%' }, freq] },
  { type: 'conv_drop', kind: 'trigger', label: 'Queda na taxa de conversão', description: 'Compara a conversão recente com o período anterior.', icon: 'ArrowDownRight', defaults: { dropPct: 20, lookbackDays: 7, frequency: 'daily' }, fields: [{ key: 'dropPct', label: 'Queda mínima', type: 'number', suffix: '%' }, lookback, freq] },
  { type: 'cpc_spike', kind: 'trigger', label: 'Aumento inesperado de CPC', description: 'Detecta alta de CPC versus média das 4 semanas anteriores.', icon: 'Zap', defaults: { risePct: 20, lookbackDays: 7, frequency: 'daily' }, fields: [{ key: 'risePct', label: 'Alta mínima', type: 'number', suffix: '%' }, lookback, freq] },
  { type: 'data_import', kind: 'trigger', label: 'Importação de novos dados', description: 'Disparado ao concluir uma importação em Data Import.', icon: 'Upload', defaults: {}, fields: [] },
  { type: 'new_campaign', kind: 'trigger', label: 'Nova campanha cadastrada', description: 'Disparado quando uma campanha nova aparece nos dados.', icon: 'Megaphone', defaults: {}, fields: [] },
]

export const CONDITION: NodeDef = {
  type: 'condition',
  kind: 'condition',
  label: 'Condição',
  description: 'Filtra campanhas por regras combinadas com AND/OR.',
  icon: 'GitBranch',
  defaults: { combinator: 'AND', rules: [{ id: 'r1', metric: 'cac', op: '>', value: 100 }] },
  fields: [],
}

export const ACTIONS: NodeDef[] = [
  { type: 'send_email', kind: 'action', label: 'Enviar e-mail', description: 'Envia via SMTP/SendGrid configurado no n8n.', icon: 'Mail', defaults: { to: 'marketing@empresa.com', subject: 'Alerta de performance' }, fields: [{ key: 'to', label: 'Destinatários', type: 'text' }, { key: 'subject', label: 'Assunto', type: 'text' }] },
  { type: 'notify', kind: 'action', label: 'Enviar notificação', description: 'Notificação in-app para a equipe.', icon: 'Bell', defaults: { severity: 'warning' }, fields: [{ key: 'severity', label: 'Severidade', type: 'select', options: [{ value: 'info', label: 'Informativa' }, { value: 'warning', label: 'Atenção' }, { value: 'critical', label: 'Crítica' }] }] },
  { type: 'generate_report', kind: 'action', label: 'Gerar relatório', description: 'Consolida KPIs do período em um relatório.', icon: 'FileText', defaults: { format: 'executive' }, fields: [{ key: 'format', label: 'Formato', type: 'select', options: [{ value: 'executive', label: 'Resumo executivo' }, { value: 'detailed', label: 'Detalhado por campanha' }] }] },
  { type: 'log_event', kind: 'action', label: 'Registrar evento', description: 'Grava no histórico de automações.', icon: 'ScrollText', defaults: { message: 'Evento registrado pelo workflow' }, fields: [{ key: 'message', label: 'Mensagem', type: 'text' }] },
  { type: 'update_record', kind: 'action', label: 'Atualizar informações', description: 'Marca campanhas afetadas com uma tag.', icon: 'PencilLine', defaults: { tag: 'revisar' }, fields: [{ key: 'tag', label: 'Tag aplicada', type: 'text' }] },
  { type: 'webhook', kind: 'action', label: 'Enviar para webhook', description: 'POST autenticado (HMAC) para URL externa.', icon: 'Webhook', defaults: { url: 'https://hooks.exemplo.com/marketing' }, fields: [{ key: 'url', label: 'URL', type: 'text', help: 'O segredo de assinatura fica no backend, nunca no navegador.' }] },
  { type: 'ai_insights', kind: 'action', label: 'Gerar insights com IA', description: 'Gera recomendações com base nos itens recebidos.', icon: 'Sparkles', defaults: { tone: 'objetivo' }, fields: [{ key: 'tone', label: 'Tom', type: 'select', options: [{ value: 'objetivo', label: 'Objetivo' }, { value: 'executivo', label: 'Executivo' }] }] },
  { type: 'log_incident', kind: 'action', label: 'Registrar ocorrência', description: 'Abre uma ocorrência no histórico.', icon: 'AlertTriangle', defaults: { severity: 'média' }, fields: [{ key: 'severity', label: 'Severidade', type: 'select', options: [{ value: 'baixa', label: 'Baixa' }, { value: 'média', label: 'Média' }, { value: 'alta', label: 'Alta' }] }] },
  { type: 'slack', kind: 'action', label: 'Enviar resumo para Slack', description: 'Publica em um canal via Incoming Webhook.', icon: 'MessageSquare', defaults: { channel: '#marketing-performance' }, fields: [{ key: 'channel', label: 'Canal', type: 'text' }] },
]

export const ALL_DEFS: NodeDef[] = [...TRIGGERS, CONDITION, ...ACTIONS]
export const defOf = (type: string) => ALL_DEFS.find((d) => d.type === type)

export const METRIC_LABELS: Record<ConditionMetric, string> = {
  cac: 'CAC (R$)',
  roas: 'ROAS (x)',
  cpl: 'CPL (R$)',
  convRate: 'Conversão (%)',
  investment: 'Investimento (R$)',
  budgetUsed: 'Orçamento consumido (%)',
  revenueVsGoal: 'Receita vs. meta (%)',
  cpc: 'CPC (R$)',
  ctr: 'CTR (%)',
}
export const OPERATORS: Operator[] = ['>', '>=', '<', '<=', '=']

let counter = 0
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function makeNode(type: string, position: { x: number; y: number }, overrides?: Record<string, unknown>, label?: string): WfNode {
  const def = defOf(type)!
  return {
    id: uid('n'),
    position,
    data: { kind: def.kind, type: def.type, label: label ?? def.label, config: { ...structuredClone(def.defaults), ...(overrides ?? {}) } },
  }
}

export function chain(nodes: WfNode[]): WfEdge[] {
  const edges: WfEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const s = nodes[i]
    edges.push({ id: uid('e'), source: s.id, target: nodes[i + 1].id, sourceHandle: s.data.kind === 'condition' ? 'true' : null })
  }
  return edges
}

export function triggerOf(wf: Workflow) {
  return wf.nodes.find((n) => n.data.kind === 'trigger')
}

export function describeTrigger(wf: Workflow): { trigger: string; frequency: string } {
  const t = triggerOf(wf)
  if (!t) return { trigger: 'Sem gatilho', frequency: '—' }
  const def = defOf(t.data.type as string)
  const c = t.data.config as Record<string, string>
  const f = c.frequency
  const time = c.time ?? '08:00'
  const frequency = f === 'hourly' ? 'A cada hora' : f === 'weekly' ? `Segundas, ${time}` : f === 'daily' ? `Diário, ${time}` : 'Por evento'
  return { trigger: def?.label ?? String(t.data.type), frequency }
}

/** Organiza o fluxo de cima para baixo: cada nível do grafo (a partir do gatilho) vira uma linha. */
export function layoutVertical<N extends { id: string; position: { x: number; y: number }; data: { kind: NodeKind } }>(nodes: N[], edges: { source: string; target: string }[]): N[] {
  const level = new Map<string, number>()
  const roots = nodes.filter((n) => n.data.kind === 'trigger' || !edges.some((e) => e.target === n.id))
  const queue = roots.map((r) => r.id)
  roots.forEach((r) => level.set(r.id, 0))
  while (queue.length) {
    const id = queue.shift()!
    for (const e of edges.filter((x) => x.source === id)) {
      const l = level.get(id)! + 1
      if ((level.get(e.target) ?? -1) < l && l < nodes.length) {
        level.set(e.target, l)
        queue.push(e.target)
      }
    }
  }
  const max = Math.max(0, ...level.values())
  for (const n of nodes) if (!level.has(n.id)) level.set(n.id, max + 1)
  const rows = new Map<number, N[]>()
  for (const n of nodes) rows.set(level.get(n.id)!, [...(rows.get(level.get(n.id)!) ?? []), n])
  const out = new Map<string, { x: number; y: number }>()
  for (const [l, row] of rows) {
    row.sort((a, b) => a.position.x - b.position.x)
    row.forEach((n, i) => out.set(n.id, { x: (i - (row.length - 1) / 2) * 260 - 110, y: l * 170 }))
  }
  return nodes.map((n) => ({ ...n, position: out.get(n.id)! }))
}
