import type { Campaign, Channel, DailyMetric, ConversionType, Objective, CampaignStatus } from './types'

/**
 * Base de dados DEMONSTRATIVA (fictícia), gerada de forma determinística.
 * 12 meses de histórico diário, 19 campanhas, 11 canais.
 * Os padrões embutidos (alta de CPC, queda de conversão, crescimento etc.)
 * existem para que o motor de insights tenha o que detectar — todos os
 * indicadores da aplicação são calculados a partir destas linhas.
 */

export const CHANNELS: Channel[] = [
  { id: 'google', name: 'Google Ads', kind: 'Pago', color: '#2a78d6' },
  { id: 'meta', name: 'Meta Ads', kind: 'Pago', color: '#eb6834' },
  { id: 'instagram', name: 'Instagram Ads', kind: 'Pago', color: '#e87ba4' },
  { id: 'facebook', name: 'Facebook Ads', kind: 'Pago', color: '#6250d6' },
  { id: 'linkedin', name: 'LinkedIn Ads', kind: 'Pago', color: '#1baf7a' },
  { id: 'tiktok', name: 'TikTok Ads', kind: 'Pago', color: '#e34948' },
  { id: 'organic', name: 'Organic Search', kind: 'Orgânico', color: '#008300' },
  { id: 'email', name: 'Email Marketing', kind: 'Orgânico', color: '#eda100' },
  { id: 'referral', name: 'Referral', kind: 'Orgânico', color: '#7c7a73' },
  { id: 'direct', name: 'Direct', kind: 'Orgânico', color: '#a3a19a' },
  { id: 'other', name: 'Outros canais', kind: 'Pago', color: '#c3c2b7' },
]

interface Profile {
  id: string
  name: string
  channelId: string
  platform: string
  objective: Objective
  conversionType: ConversionType
  owner: string
  spend: number // mídia diária base (0 = orgânico)
  other: number // custo não-mídia diário
  cpc?: number
  clicks?: number // cliques diários (orgânico)
  ctr: number
  visit: number
  lead: number
  opp: number
  cust: number
  aov: number
  repeat: number
  startDaysAgo?: number
  endedDaysAgo?: number
  status?: CampaignStatus
  b2b?: boolean
  nov?: boolean
  trend?: number
  budgetFactor?: number
  pattern?: 'cpcSpike' | 'growth' | 'convDrop' | 'inconsistent'
}

const P: Profile[] = [
  { id: 'c01', name: 'Google Search — Marca', channelId: 'google', platform: 'Google Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Ana Souza', spend: 650, other: 35, cpc: 1.3, ctr: 0.08, visit: 0.9, lead: 0.1, opp: 0.5, cust: 0.45, aov: 520, repeat: 1.08, trend: 0.1 },
  { id: 'c02', name: 'Google Search — Genérico', channelId: 'google', platform: 'Google Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Ana Souza', spend: 1400, other: 70, cpc: 3.2, ctr: 0.042, visit: 0.85, lead: 0.09, opp: 0.4, cust: 0.3, aov: 560, repeat: 1.05, pattern: 'cpcSpike', budgetFactor: 0.45 },
  { id: 'c03', name: 'Google Shopping — Catálogo', channelId: 'google', platform: 'Google Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Bruno Lima', spend: 900, other: 60, cpc: 1.1, ctr: 0.016, visit: 0.9, lead: 0.05, opp: 0.55, cust: 0.5, aov: 310, repeat: 1.1, nov: true, trend: 0.2 },
  { id: 'c04', name: 'Google Display — Remarketing', channelId: 'google', platform: 'Google Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Bruno Lima', spend: 800, other: 55, cpc: 0.9, ctr: 0.0045, visit: 0.7, lead: 0.02, opp: 0.35, cust: 0.3, aov: 400, repeat: 1.05, budgetFactor: 0.4 },
  { id: 'c05', name: 'Meta — Prospecção Lookalike', channelId: 'meta', platform: 'Meta Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Carla Mendes', spend: 1100, other: 80, cpc: 1.6, ctr: 0.013, visit: 0.8, lead: 0.07, opp: 0.35, cust: 0.35, aov: 380, repeat: 1.06 },
  { id: 'c06', name: 'Meta — Remarketing Dinâmico', channelId: 'meta', platform: 'Meta Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Carla Mendes', spend: 600, other: 40, cpc: 1.2, ctr: 0.019, visit: 0.85, lead: 0.09, opp: 0.5, cust: 0.45, aov: 360, repeat: 1.12, nov: true },
  { id: 'c07', name: 'Instagram — Reels Lançamento', channelId: 'instagram', platform: 'Meta Ads', objective: 'Vendas', conversionType: 'Assinatura', owner: 'Carla Mendes', spend: 1000, other: 90, cpc: 1.4, ctr: 0.015, visit: 0.78, lead: 0.08, opp: 0.4, cust: 0.38, aov: 340, repeat: 1.0, startDaysAgo: 130, pattern: 'growth', nov: true },
  { id: 'c08', name: 'Instagram — Stories Promo', channelId: 'instagram', platform: 'Meta Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Diego Rocha', spend: 450, other: 35, cpc: 1.5, ctr: 0.009, visit: 0.75, lead: 0.06, opp: 0.4, cust: 0.35, aov: 300, repeat: 1.04, endedDaysAgo: 40, status: 'Encerrada' },
  { id: 'c09', name: 'Facebook — Leads Formulário', channelId: 'facebook', platform: 'Meta Ads', objective: 'Geração de leads', conversionType: 'Cadastro', owner: 'Diego Rocha', spend: 500, other: 30, cpc: 0.95, ctr: 0.017, visit: 1, lead: 0.12, opp: 0.2, cust: 0.3, aov: 290, repeat: 1.0 },
  { id: 'c10', name: 'LinkedIn — ABM Enterprise', channelId: 'linkedin', platform: 'LinkedIn Ads', objective: 'Geração de leads', conversionType: 'Demo agendada', owner: 'Eduarda Nunes', spend: 900, other: 110, cpc: 11, ctr: 0.0055, visit: 0.85, lead: 0.09, opp: 0.45, cust: 0.2, aov: 6800, repeat: 1.0, b2b: true },
  { id: 'c11', name: 'LinkedIn — Lead Gen Webinar', channelId: 'linkedin', platform: 'LinkedIn Ads', objective: 'Geração de leads', conversionType: 'Demo agendada', owner: 'Eduarda Nunes', spend: 650, other: 60, cpc: 9, ctr: 0.007, visit: 1, lead: 0.16, opp: 0.25, cust: 0.15, aov: 4200, repeat: 1.0, b2b: true },
  { id: 'c12', name: 'TikTok — Awareness Creators', channelId: 'tiktok', platform: 'TikTok Ads', objective: 'Awareness', conversionType: 'Cadastro', owner: 'Felipe Araújo', spend: 700, other: 120, cpc: 0.6, ctr: 0.008, visit: 0.6, lead: 0.02, opp: 0.3, cust: 0.3, aov: 260, repeat: 1.0, pattern: 'inconsistent' },
  { id: 'c13', name: 'TikTok — Spark Ads Conversão', channelId: 'tiktok', platform: 'TikTok Ads', objective: 'Vendas', conversionType: 'Compra', owner: 'Felipe Araújo', spend: 550, other: 45, cpc: 0.75, ctr: 0.012, visit: 0.7, lead: 0.05, opp: 0.4, cust: 0.35, aov: 270, repeat: 1.03, pattern: 'convDrop' },
  { id: 'c14', name: 'SEO — Blog & Conteúdo', channelId: 'organic', platform: 'Orgânico', objective: 'Geração de leads', conversionType: 'Cadastro', owner: 'Gabriela Pinto', spend: 0, other: 380, clicks: 900, ctr: 0.035, visit: 0.95, lead: 0.03, opp: 0.35, cust: 0.35, aov: 410, repeat: 1.02, trend: 0.4 },
  { id: 'c15', name: 'Email — Nutrição de Leads', channelId: 'email', platform: 'RD Station', objective: 'Vendas', conversionType: 'Assinatura', owner: 'Gabriela Pinto', spend: 0, other: 120, clicks: 420, ctr: 0.04, visit: 0.9, lead: 0.07, opp: 0.45, cust: 0.4, aov: 380, repeat: 1.0 },
  { id: 'c16', name: 'Email — Newsletter Promocional', channelId: 'email', platform: 'RD Station', objective: 'Vendas', conversionType: 'Compra', owner: 'Gabriela Pinto', spend: 0, other: 90, clicks: 300, ctr: 0.025, visit: 0.9, lead: 0.05, opp: 0.4, cust: 0.4, aov: 330, repeat: 1.05, nov: true },
  { id: 'c17', name: 'Indicação — Programa de Parceiros', channelId: 'referral', platform: 'Parceiros', objective: 'Vendas', conversionType: 'Compra', owner: 'Henrique Dias', spend: 0, other: 260, clicks: 160, ctr: 0.12, visit: 0.95, lead: 0.15, opp: 0.5, cust: 0.45, aov: 620, repeat: 1.04 },
  { id: 'c18', name: 'Tráfego Direto — Site', channelId: 'direct', platform: 'Orgânico', objective: 'Vendas', conversionType: 'Compra', owner: 'Henrique Dias', spend: 0, other: 60, clicks: 650, ctr: 0.3, visit: 0.97, lead: 0.05, opp: 0.4, cust: 0.45, aov: 450, repeat: 1.06 },
  { id: 'c19', name: 'Podcasts Patrocinados', channelId: 'other', platform: 'Spotify Ads', objective: 'Awareness', conversionType: 'Compra', owner: 'Felipe Araújo', spend: 380, other: 50, cpc: 2.1, ctr: 0.005, visit: 0.8, lead: 0.05, opp: 0.35, cust: 0.3, aov: 420, repeat: 1.0, status: 'Pausada', endedDaysAgo: 12 },
]

export const HISTORY_DAYS = 365

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dataEndDate(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1) // dados até ontem
  return d
}

export function generateDemo(): { campaigns: Campaign[]; metrics: DailyMetric[] } {
  const rand = mulberry32(20261112)
  const gauss = () => {
    let u = 0
    let v = 0
    while (u === 0) u = rand()
    while (v === 0) v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const noise = (sigma: number) => Math.exp(gauss() * sigma - (sigma * sigma) / 2)
  const sround = (x: number) => {
    const f = Math.floor(x)
    return f + (rand() < x - f ? 1 : 0)
  }
  const end = dataEndDate()
  const metrics: DailyMetric[] = []
  const campaigns: Campaign[] = []

  for (const p of P) {
    const startAgo = p.startDaysAgo ?? HISTORY_DAYS - 1
    const endAgo = p.endedDaysAgo ?? 0
    const sDate = new Date(end)
    sDate.setDate(sDate.getDate() - startAgo)
    let eDate: string | null = null
    if (p.endedDaysAgo) {
      const e = new Date(end)
      e.setDate(e.getDate() - p.endedDaysAgo)
      eDate = isoDate(e)
    }
    const budgetBase = (p.spend || 0) + p.other
    campaigns.push({
      id: p.id,
      name: p.name,
      channelId: p.channelId,
      platform: p.platform,
      objective: p.objective,
      conversionType: p.conversionType,
      status: p.status ?? 'Ativa',
      startDate: isoDate(sDate),
      endDate: eDate,
      monthlyBudget: Math.round((budgetBase * 30.4 * (p.budgetFactor ?? 1.15)) / 100) * 100,
      owner: p.owner,
    })

    const inconsistent = p.pattern === 'inconsistent'
    const weekShock = new Map<number, [number, number]>()
    for (let ago = HISTORY_DAYS - 1; ago >= 0; ago--) {
      const d = new Date(end)
      d.setDate(d.getDate() - ago)
      if (ago > startAgo || ago < endAgo) continue
      const yearProgress = 1 - ago / (HISTORY_DAYS - 1)
      const dow = d.getDay()
      const weekend = dow === 0 || dow === 6
      const wk = p.b2b ? (weekend ? 0.35 : 1.1) : weekend ? 1.06 : 0.98
      const isNov = d.getMonth() === 10 && d.getDate() <= 30
      const novBoost = p.nov && isNov ? 1 + 0.3 * Math.min(1, d.getDate() / 25) : 1
      const sigma = inconsistent ? 0.45 : 0.12
      const rateSigma = inconsistent ? 0.3 : 0.1

      let spendMult = (1 + (p.trend ?? 0) * yearProgress) * wk * novBoost
      let shockRate = 1
      if (inconsistent) {
        const wkIdx = Math.floor(ago / 7)
        if (!weekShock.has(wkIdx)) weekShock.set(wkIdx, [noise(0.4), noise(0.35)])
        const [a, b] = weekShock.get(wkIdx)!
        spendMult *= a
        shockRate = b
      }
      let leadMult = shockRate
      let custMult = p.nov && isNov ? 1.15 : 1
      let cpcMult = 1
      if (p.pattern === 'growth') {
        const prog = 1 - ago / startAgo
        spendMult *= 0.3 + 0.7 * prog
        leadMult *= 0.8 + 0.35 * prog
      }
      if (p.pattern === 'cpcSpike' && ago < 12) cpcMult = 1 + 0.5 * Math.min(1, (12 - ago) / 5)
      if (p.pattern === 'convDrop' && ago < 21) {
        leadMult *= 0.55
        custMult *= 0.85
      }

      let mediaSpend = 0
      let clicks: number
      if (p.spend > 0) {
        mediaSpend = p.spend * spendMult * noise(sigma)
        const cpc = (p.cpc ?? 1) * cpcMult * noise(0.08)
        clicks = sround(mediaSpend / cpc)
      } else {
        clicks = sround((p.clicks ?? 0) * spendMult * noise(sigma))
      }
      const otherCost = p.other * (p.spend > 0 ? Math.max(0.6, spendMult) : 1 + (p.trend ?? 0) * yearProgress * 0.5) * noise(0.05)
      const ctr = Math.min(0.9, p.ctr * noise(0.08))
      const impressions = Math.max(clicks, Math.round(clicks / ctr))
      const visitors = sround(clicks * Math.min(1, p.visit * noise(0.04)))
      const leads = sround(visitors * Math.min(0.95, p.lead * leadMult * noise(rateSigma)))
      const opportunities = sround(leads * Math.min(0.95, p.opp * noise(rateSigma)))
      const customers = sround(opportunities * Math.min(0.95, p.cust * custMult * noise(rateSigma)))
      const orders = customers + sround(customers * (p.repeat - 1) * 1.0)
      let revenue = 0
      for (let i = 0; i < orders; i++) revenue += p.aov * noise(0.25)
      metrics.push({
        date: isoDate(d),
        campaignId: p.id,
        mediaSpend: Math.round(mediaSpend * 100) / 100,
        otherCost: Math.round(otherCost * 100) / 100,
        impressions,
        clicks,
        visitors,
        leads,
        opportunities,
        customers,
        orders,
        revenue: Math.round(revenue * 100) / 100,
        source: 'demo',
      })
    }
  }
  return { campaigns, metrics }
}
