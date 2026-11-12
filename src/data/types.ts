export type ConversionType = 'Compra' | 'Assinatura' | 'Demo agendada' | 'Cadastro'
export type Objective = 'Vendas' | 'Geração de leads' | 'Awareness'
export type CampaignStatus = 'Ativa' | 'Pausada' | 'Encerrada'

export interface Channel {
  id: string
  name: string
  kind: 'Pago' | 'Orgânico'
  color: string
}

export interface Campaign {
  id: string
  name: string
  channelId: string
  platform: string
  objective: Objective
  conversionType: ConversionType
  status: CampaignStatus
  startDate: string
  endDate: string | null
  monthlyBudget: number
  owner: string
}

/** Uma linha diária por campanha — tabela fato marketing_metrics */
export interface DailyMetric {
  date: string // YYYY-MM-DD
  campaignId: string
  mediaSpend: number // investimento em anúncios (mídia)
  otherCost: number // custos não-mídia: produção, ferramentas, agência
  impressions: number
  clicks: number
  visitors: number
  leads: number
  opportunities: number
  customers: number // conversões = novos clientes
  orders: number
  revenue: number // receita atribuída (last-click)
  source?: 'demo' | 'import'
}

export interface Totals {
  mediaSpend: number
  otherCost: number
  investment: number
  impressions: number
  clicks: number
  paidClicks: number // cliques em linhas com investimento em mídia (base do CPC)
  visitors: number
  leads: number
  opportunities: number
  customers: number
  orders: number
  revenue: number
}

export interface Derived extends Totals {
  ctr: number | null
  cpc: number | null
  cpl: number | null
  cac: number | null
  roas: number | null
  roi: number | null
  convRate: number | null
  aov: number | null
  grossProfit: number
  profit: number
  revPerCustomer: number | null
  leadRate: number | null
}
