import { chain, makeNode, uid } from './catalog'
import type { Workflow } from './types'

export interface Template {
  ai?: boolean
  id: string
  name: string
  description: string
  steps: string[]
  build: () => Pick<Workflow, 'nodes' | 'edges'>
}

const X = (i: number) => 40 + i * 270
const Y = 140

export const TEMPLATES: Template[] = [
  {
    id: 'daily-report',
    name: 'Daily Marketing Report',
    description: 'Relatório diário de performance enviado por e-mail às 08:00.',
    steps: ['Executa todos os dias às 08:00', 'Consulta os dados do dia anterior', 'Calcula investimento, leads, conversões, CAC, ROAS e ROI', 'Consolida e gera o relatório', 'Envia por e-mail'],
    build: () => {
      const n = [
        makeNode('schedule', { x: X(0), y: Y }, { frequency: 'daily', time: '08:00', lookbackDays: 1 }, 'Todos os dias às 08:00'),
        makeNode('generate_report', { x: X(1), y: Y }, { format: 'executive' }, 'Consolidar KPIs do dia anterior'),
        makeNode('send_email', { x: X(2), y: Y }, { to: 'diretoria@empresa.com, marketing@empresa.com', subject: 'Daily Marketing Report' }, 'Enviar relatório por e-mail'),
      ]
      return { nodes: n, edges: chain(n) }
    },
  },
  {
    id: 'high-cac',
    name: 'High CAC Alert',
    description: 'Alerta quando campanhas ultrapassam o limite de CAC.',
    steps: ['Monitora as campanhas', 'Verifica o CAC dos últimos 7 dias', 'Compara com o limite configurado', 'Identifica campanhas acima do limite', 'Envia alerta por e-mail e Slack', 'Registra o evento no histórico'],
    build: () => {
      const n = [
        makeNode('cac_above', { x: X(0), y: Y }, { threshold: 300, lookbackDays: 7, frequency: 'daily' }, 'CAC acima de R$ 300'),
        makeNode('condition', { x: X(1), y: Y }, { combinator: 'AND', rules: [{ id: uid('r'), metric: 'investment', op: '>', value: 1000 }] }, 'Investimento relevante'),
        makeNode('send_email', { x: X(2), y: Y - 70 }, { to: 'performance@empresa.com', subject: 'Alerta: CAC acima do limite' }, 'Alerta por e-mail'),
        makeNode('slack', { x: X(2), y: Y + 70 }, { channel: '#alertas-marketing' }, 'Alerta no Slack'),
        makeNode('log_event', { x: X(3), y: Y }, { message: 'Campanhas com CAC acima do limite' }, 'Registrar no histórico'),
      ]
      const e = [
        { id: uid('e'), source: n[0].id, target: n[1].id },
        { id: uid('e'), source: n[1].id, target: n[2].id, sourceHandle: 'true' },
        { id: uid('e'), source: n[1].id, target: n[3].id, sourceHandle: 'true' },
        { id: uid('e'), source: n[2].id, target: n[4].id },
      ]
      return { nodes: n, edges: e }
    },
  },
  {
    id: 'low-roas',
    name: 'Low ROAS Alert',
    description: 'Identifica campanhas pagas com ROAS abaixo da meta e gera recomendação com IA.',
    steps: ['Consulta o ROAS das campanhas', 'Compara com a meta definida', 'Identifica campanhas abaixo da meta', 'Gera alerta', 'Registra a ocorrência', 'Gera recomendação com IA'],
    build: () => {
      const n = [
        makeNode('roas_below', { x: X(0), y: Y }, { target: 2.5, lookbackDays: 7, frequency: 'daily' }, 'ROAS abaixo de 2,5x'),
        makeNode('notify', { x: X(1), y: Y }, { severity: 'warning' }, 'Alerta para a equipe'),
        makeNode('log_incident', { x: X(2), y: Y }, { severity: 'média' }, 'Registrar ocorrência'),
        makeNode('ai_insights', { x: X(3), y: Y }, { tone: 'objetivo' }, 'Recomendação com IA'),
      ]
      return { nodes: n, edges: chain(n) }
    },
  },
  {
    id: 'budget-monitoring',
    name: 'Budget Monitoring',
    description: 'Avisa quando campanhas consomem 80% ou mais do orçamento mensal.',
    steps: ['Consulta o investimento acumulado do mês', 'Compara com o orçamento planejado', 'Identifica campanhas com 80%+ consumido', 'Envia notificação', 'Registra o evento'],
    build: () => {
      const n = [
        makeNode('budget_near', { x: X(0), y: Y }, { pct: 80, frequency: 'daily' }, 'Orçamento ≥ 80%'),
        makeNode('notify', { x: X(1), y: Y }, { severity: 'warning' }, 'Notificar responsáveis'),
        makeNode('log_event', { x: X(2), y: Y }, { message: 'Campanhas próximas do limite de orçamento' }, 'Registrar evento'),
      ]
      return { nodes: n, edges: chain(n) }
    },
  },
  {
    id: 'conversion-drop',
    name: 'Conversion Drop Alert',
    description: 'Detecta quedas relevantes na taxa de conversão e cria recomendação.',
    steps: ['Monitora a taxa de conversão', 'Compara com o período anterior', 'Identifica quedas relevantes', 'Gera alerta', 'Identifica campanhas afetadas', 'Cria recomendação'],
    build: () => {
      const n = [
        makeNode('conv_drop', { x: X(0), y: Y }, { dropPct: 20, lookbackDays: 7, frequency: 'daily' }, 'Queda de conversão ≥ 20%'),
        makeNode('notify', { x: X(1), y: Y }, { severity: 'critical' }, 'Gerar alerta'),
        makeNode('update_record', { x: X(2), y: Y }, { tag: 'queda-conversao' }, 'Marcar campanhas afetadas'),
        makeNode('ai_insights', { x: X(3), y: Y }, { tone: 'objetivo' }, 'Criar recomendação'),
      ]
      return { nodes: n, edges: chain(n) }
    },
  },
  {
    id: 'weekly-summary',
    name: 'Weekly Performance Summary',
    description: 'Resumo executivo semanal com comparação à semana anterior, toda segunda-feira.',
    steps: ['Executa toda segunda-feira', 'Consulta os dados da semana anterior', 'Compara com a semana precedente', 'Consolida KPIs', 'Identifica melhores e piores canais', 'Gera resumo executivo', 'Envia relatório'],
    build: () => {
      const n = [
        makeNode('schedule', { x: X(0), y: Y }, { frequency: 'weekly', time: '09:00', lookbackDays: 7 }, 'Segundas às 09:00'),
        makeNode('generate_report', { x: X(1), y: Y }, { format: 'executive' }, 'Consolidar semana vs. anterior'),
        makeNode('ai_insights', { x: X(2), y: Y }, { tone: 'executivo' }, 'Resumo executivo com IA'),
        makeNode('send_email', { x: X(3), y: Y - 70 }, { to: 'diretoria@empresa.com', subject: 'Weekly Performance Summary' }, 'Enviar por e-mail'),
        makeNode('slack', { x: X(3), y: Y + 70 }, { channel: '#marketing' }, 'Publicar no Slack'),
      ]
      const e = [
        { id: uid('e'), source: n[0].id, target: n[1].id },
        { id: uid('e'), source: n[1].id, target: n[2].id },
        { id: uid('e'), source: n[2].id, target: n[3].id },
        { id: uid('e'), source: n[2].id, target: n[4].id },
      ]
      return { nodes: n, edges: e }
    },
  },
  {
    id: 'ai-campaign-monitor',
    ai: true,
    name: 'AI Campaign Monitor',
    description: 'Consulta os dados, analisa KPIs, identifica anomalias, gera recomendações, armazena os insights e notifica os responsáveis.',
    steps: ['Consulta os dados dos últimos 7 dias', 'Analisa os principais KPIs', 'Identifica anomalias (CAC, ROAS, CPC, conversão)', 'Gera recomendações', 'Armazena os insights no histórico', 'Notifica os responsáveis'],
    build: () => {
      const n = [
        makeNode('schedule', { x: X(0), y: Y }, { frequency: 'daily', time: '07:00', lookbackDays: 7 }, 'Diário às 07:00'),
        makeNode('ai_insights', { x: X(1), y: Y }, { tone: 'objetivo' }, 'Analisar KPIs e anomalias'),
        makeNode('log_event', { x: X(2), y: Y }, { message: 'Insights de IA armazenados' }, 'Armazenar insights'),
        makeNode('notify', { x: X(3), y: Y }, { severity: 'info' }, 'Notificar responsáveis'),
      ]
      return { nodes: n, edges: chain(n) }
    },
  },
  {
    id: 'ai-weekly-analyst',
    ai: true,
    name: 'AI Marketing Analyst — semanal',
    description: 'Analisa periodicamente os indicadores e envia um resumo com recomendações baseadas nos dados.',
    steps: ['Executa às segundas', 'Consolida a semana vs. anterior', 'Gera análise com IA a partir dos agregados', 'Envia por e-mail'],
    build: () => {
      const n = [
        makeNode('schedule', { x: X(0), y: Y }, { frequency: 'weekly', time: '08:30', lookbackDays: 7 }, 'Segundas às 08:30'),
        makeNode('generate_report', { x: X(1), y: Y }, { format: 'executive' }, 'Consolidar semana'),
        makeNode('ai_insights', { x: X(2), y: Y }, { tone: 'executivo' }, 'Análise com IA'),
        makeNode('send_email', { x: X(3), y: Y }, { to: 'marketing@empresa.com', subject: 'Análise semanal da IA' }, 'Enviar análise'),
      ]
      return { nodes: n, edges: chain(n) }
    },
  },
]

export function workflowFromTemplate(t: Template, status: Workflow['status'] = 'active'): Workflow {
  const now = new Date().toISOString()
  return { id: uid('wf'), name: t.name, description: t.description, status, templateId: t.id, ...t.build(), createdAt: now, updatedAt: now }
}
