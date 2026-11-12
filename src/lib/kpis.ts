import type { Derived } from '../data/types'
import { money, num, percent, ratio } from './format'

export type KpiKey = 'investment' | 'revenue' | 'cac' | 'roas' | 'roi' | 'leads' | 'customers' | 'cpl' | 'ctr' | 'cpc' | 'convRate' | 'aov' | 'profit' | 'mediaSpend' | 'clicks' | 'impressions' | 'grossProfit' | 'revPerCustomer' | 'otherCost' | 'opportunities' | 'visitors'

export interface KpiDef {
  key: KpiKey
  label: string
  short: string
  help: string
  formula?: string
  /** true = maior é melhor; false = menor é melhor; null = neutro (contexto) */
  better: boolean | null
  fmt: (v: number | null) => string
  fmtCompact?: (v: number | null) => string
}

export const KPIS: Record<KpiKey, KpiDef> = {
  investment: { key: 'investment', label: 'Total Invested', short: 'Investimento', help: 'Soma do investimento em mídia e dos custos não-mídia (produção, ferramentas, agência) no período.', formula: 'Mídia + custos não-mídia', better: null, fmt: (v) => money(v), fmtCompact: (v) => money(v, { compact: true }) },
  mediaSpend: { key: 'mediaSpend', label: 'Ad Spend', short: 'Mídia', help: 'Investimento exclusivamente em anúncios pagos.', better: null, fmt: (v) => money(v), fmtCompact: (v) => money(v, { compact: true }) },
  otherCost: { key: 'otherCost', label: 'Custos não-mídia', short: 'Outros custos', help: 'Produção de conteúdo, ferramentas, comissões e agência.', better: null, fmt: (v) => money(v), fmtCompact: (v) => money(v, { compact: true }) },
  revenue: { key: 'revenue', label: 'Revenue Generated', short: 'Receita', help: 'Receita atribuída às campanhas pelo modelo last-click. Receita não é lucro.', better: true, fmt: (v) => money(v), fmtCompact: (v) => money(v, { compact: true }) },
  cac: { key: 'cac', label: 'CAC', short: 'CAC', help: 'Customer Acquisition Cost: quanto custa, em média, adquirir um novo cliente.', formula: 'Investimento total ÷ novos clientes', better: false, fmt: (v) => money(v) },
  roas: { key: 'roas', label: 'ROAS', short: 'ROAS', help: 'Return on Ad Spend: receita gerada para cada R$ 1 investido em anúncios. Não considera margem nem custos não-mídia.', formula: 'Receita atribuída ÷ investimento em anúncios', better: true, fmt: (v) => ratio(v) },
  roi: { key: 'roi', label: 'ROI', short: 'ROI', help: 'Return on Investment: retorno financeiro real, usando lucro bruto (receita × margem) contra o investimento total.', formula: '((Lucro bruto − Investimento total) ÷ Investimento total) × 100', better: true, fmt: (v) => percent(v, 1) },
  leads: { key: 'leads', label: 'Total Leads', short: 'Leads', help: 'Contatos qualificados gerados (formulários, cadastros, demos).', better: true, fmt: (v) => num(v), fmtCompact: (v) => num(v, { compact: true }) },
  customers: { key: 'customers', label: 'Total Conversions', short: 'Conversões', help: 'Novos clientes adquiridos (conversão final do funil).', better: true, fmt: (v) => num(v), fmtCompact: (v) => num(v, { compact: true }) },
  cpl: { key: 'cpl', label: 'CPL', short: 'CPL', help: 'Cost per Lead: custo médio para gerar um lead.', formula: 'Investimento total ÷ leads', better: false, fmt: (v) => money(v) },
  ctr: { key: 'ctr', label: 'CTR', short: 'CTR', help: 'Click Through Rate: percentual de impressões que viraram cliques.', formula: '(Cliques ÷ Impressões) × 100', better: true, fmt: (v) => percent(v) },
  cpc: { key: 'cpc', label: 'CPC', short: 'CPC', help: 'Cost per Click: custo médio de cada clique em anúncios pagos.', formula: 'Investimento em anúncios ÷ cliques', better: false, fmt: (v) => money(v) },
  convRate: { key: 'convRate', label: 'Conversion Rate', short: 'Conv. %', help: 'Percentual de cliques que se tornaram clientes.', formula: '(Conversões ÷ Cliques) × 100', better: true, fmt: (v) => percent(v) },
  aov: { key: 'aov', label: 'Average Order Value', short: 'Ticket médio', help: 'Valor médio por pedido.', formula: 'Receita ÷ número de pedidos', better: true, fmt: (v) => money(v) },
  profit: { key: 'profit', label: 'Estimated Profit', short: 'Lucro estimado', help: 'Lucro bruto (receita × margem bruta configurada) menos o investimento total em marketing.', formula: 'Receita × margem − Investimento total', better: true, fmt: (v) => money(v), fmtCompact: (v) => money(v, { compact: true }) },
  grossProfit: { key: 'grossProfit', label: 'Lucro bruto', short: 'Lucro bruto', help: 'Receita × margem bruta configurada.', better: true, fmt: (v) => money(v), fmtCompact: (v) => money(v, { compact: true }) },
  revPerCustomer: { key: 'revPerCustomer', label: 'Revenue per Customer', short: 'Receita/cliente', help: 'Receita média gerada por cliente adquirido.', formula: 'Receita ÷ clientes', better: true, fmt: (v) => money(v) },
  clicks: { key: 'clicks', label: 'Cliques', short: 'Cliques', help: 'Total de cliques.', better: true, fmt: (v) => num(v), fmtCompact: (v) => num(v, { compact: true }) },
  impressions: { key: 'impressions', label: 'Impressões', short: 'Impressões', help: 'Total de impressões.', better: true, fmt: (v) => num(v), fmtCompact: (v) => num(v, { compact: true }) },
  opportunities: { key: 'opportunities', label: 'Oportunidades', short: 'Oportunidades', help: 'Leads que viraram oportunidade comercial.', better: true, fmt: (v) => num(v) },
  visitors: { key: 'visitors', label: 'Visitantes', short: 'Visitantes', help: 'Sessões no site originadas pela campanha.', better: true, fmt: (v) => num(v), fmtCompact: (v) => num(v, { compact: true }) },
}

export const getKpi = (d: Derived, k: KpiKey): number | null => (d as unknown as Record<string, number | null>)[k] ?? null

/** Classifica a variação considerando a direção desejada do KPI. */
export function trendTone(k: KpiKey, delta: number | null): 'good' | 'bad' | 'neutral' {
  if (delta === null || Math.abs(delta) < 0.5) return 'neutral'
  const better = KPIS[k].better
  if (better === null) return 'neutral'
  return (delta > 0) === better ? 'good' : 'bad'
}
