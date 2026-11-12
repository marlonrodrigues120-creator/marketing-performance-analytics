export type NodeKind = 'trigger' | 'condition' | 'action'

export type TriggerType = 'schedule' | 'new_lead' | 'cac_above' | 'roas_below' | 'budget_near' | 'conv_drop' | 'cpc_spike' | 'data_import' | 'new_campaign'
export type ActionType = 'send_email' | 'notify' | 'generate_report' | 'log_event' | 'update_record' | 'webhook' | 'ai_insights' | 'log_incident' | 'slack'
export type ConditionMetric = 'cac' | 'roas' | 'cpl' | 'convRate' | 'investment' | 'budgetUsed' | 'revenueVsGoal' | 'cpc' | 'ctr'
export type Operator = '>' | '>=' | '<' | '<=' | '='

export interface ConditionRule {
  id: string
  metric: ConditionMetric
  op: Operator
  value: number
}

export interface WfNodeData {
  kind: NodeKind
  type: TriggerType | ActionType | 'condition'
  label: string
  config: Record<string, unknown>
  [key: string]: unknown
}

export interface WfNode {
  id: string
  position: { x: number; y: number }
  data: WfNodeData
}

export interface WfEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}

export type WorkflowStatus = 'active' | 'paused' | 'draft'

export interface Workflow {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  templateId?: string
  nodes: WfNode[]
  edges: WfEdge[]
  createdAt: string
  updatedAt: string
  n8nWorkflowId?: string
}

export type ExecStatus = 'success' | 'error' | 'running' | 'skipped'
export type ExecMode = 'schedule' | 'event' | 'manual' | 'test'

export interface ExecStep {
  nodeId: string
  label: string
  kind: NodeKind
  status: 'success' | 'error' | 'skipped'
  ms: number
  output: string
}

export interface Execution {
  id: string
  workflowId: string
  workflowName: string
  startedAt: string
  finishedAt: string | null
  durationMs: number
  status: ExecStatus
  mode: ExecMode
  engine: 'demo' | 'n8n'
  idempotencyKey: string
  input: Record<string, unknown>
  result: { summary: string; items?: Record<string, unknown>[]; outputs?: { action: string; content: string }[] } | null
  error?: string
  steps: ExecStep[]
}

export interface AutomationLog {
  id: string
  at: string
  level: 'info' | 'warn' | 'error'
  workflowId?: string
  message: string
}

export interface AppNotification {
  id: string
  at: string
  title: string
  body: string
  read: boolean
  severity: 'info' | 'warning' | 'critical' | 'success'
  link?: string
}
