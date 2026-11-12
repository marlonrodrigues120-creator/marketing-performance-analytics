import type { Campaign, Channel, DailyMetric } from '../data/types'
import type { Settings } from '../store/settings'
import { money, percent, ratio, signedPct } from './format'
import { bucketKey, derive, groupBy, stdev, sum } from './metrics'
import { addDays, between, campaignStats, channelStats } from './query'

export type Priority = 'Alta' | 'Média' | 'Baixa'

export interface Insight {
  id: string
  rule: string
  type: 'problem' | 'opportunity'
  title: string
  description: string
  metric: string
  entity: string
  entityType: 'Campanha' | 'Canal' | 'Conta'
  entityId?: string
  impact: string
  impactValue: number // usado para ordenar
  recommendation: string
  priority: Priority
  evidence: { label: string; value: string }[]
}

interface Ctx {
  campaigns: Campaign[]
  channels: Channel[]
  rows: DailyMetric[] // todas as datas, já filtradas por dimensão
  start: string
  end: string
  settings: Settings
}

const PRIO_ORDER: Record<Priority, number> = { Alta: 0, Média: 1, Baixa: 2 }

/**
 * Motor de insights baseado em regras. Toda afirmação é derivada dos dados
 * (sem inferência causal): os textos descrevem associações observadas e
 * recomendam investigação/ação, nunca afirmam a causa.
 */
export function generateInsights(ctx: Ctx): Insight[] {
  const { campaigns, channels, rows, start, end, settings } = ctx
  const m = settings.grossMargin
  const cur = between(rows, start, end)
  if (cur.length === 0) return []
  const total = derive(sum(cur), m)
  const cs = campaignStats(campaigns, channels, cur, m)
  const chs = channelStats(campaigns, channels, cur, m)
  const out: Insight[] = []

  // 1. CAC acima da média do mesmo objetivo (B2B e B2C não são comparados entre si)
  const objAvg = new Map<string, number | null>()
  for (const obj of new Set(cs.map((s) => s.campaign.objective))) {
    const group = cs.filter((s) => s.campaign.objective === obj)
    const inv = group.reduce((a, s) => a + s.d.investment, 0)
    const cust = group.reduce((a, s) => a + s.d.customers, 0)
    objAvg.set(obj, cust > 0 ? inv / cust : null)
  }
  for (const s of cs) {
    const avg = objAvg.get(s.campaign.objective)
    if (avg && s.d.cac && s.d.customers >= 3 && s.d.cac > avg * 1.4 && (s.d.roi === null || s.d.roi < 50)) {
      const excess = s.d.investment - s.d.customers * avg
      out.push({
        id: `cac-${s.campaign.id}`,
        rule: 'CAC acima da média',
        type: 'problem',
        title: `CAC ${((s.d.cac / avg - 1) * 100).toFixed(0)}% acima da média`,
        description: `${s.campaign.name} adquiriu ${s.d.customers} clientes a ${money(s.d.cac)} cada, contra média de ${money(avg)} das campanhas de "${s.campaign.objective}".`,
        metric: 'CAC',
        entity: s.campaign.name,
        entityType: 'Campanha',
        entityId: s.campaign.id,
        impact: `${money(excess, { compact: true })} acima do custo médio de aquisição`,
        impactValue: excess,
        recommendation: 'Revise segmentação, palavras-chave/públicos e lances. Considere realocar parte da verba para campanhas do mesmo objetivo com CAC abaixo da média.',
        priority: s.d.roi !== null && s.d.roi < 0 ? 'Alta' : 'Média',
        evidence: [
          { label: 'CAC da campanha', value: money(s.d.cac) },
          { label: `CAC médio (${s.campaign.objective})`, value: money(avg) },
          { label: 'ROI', value: percent(s.d.roi, 1) },
        ],
      })
    }
  }

  // 2. ROAS abaixo da meta (somente campanhas com mídia)
  for (const s of cs) {
    if (s.d.mediaSpend > 500 && s.d.roas !== null && s.d.roas < settings.roasTarget) {
      const gap = settings.roasTarget * s.d.mediaSpend - s.d.revenue
      out.push({
        id: `roas-${s.campaign.id}`,
        rule: 'ROAS abaixo da meta',
        type: 'problem',
        title: `ROAS de ${ratio(s.d.roas)} abaixo da meta de ${ratio(settings.roasTarget)}`,
        description: `${s.campaign.name} gerou ${money(s.d.revenue, { compact: true })} de receita para ${money(s.d.mediaSpend, { compact: true })} em mídia.`,
        metric: 'ROAS',
        entity: s.campaign.name,
        entityType: 'Campanha',
        entityId: s.campaign.id,
        impact: `${money(gap, { compact: true })} de receita para atingir a meta`,
        impactValue: gap,
        recommendation: s.campaign.objective === 'Awareness' ? 'Campanha de awareness: ROAS direto tende a ser baixo. Avalie metas de alcance/CTR e reduza a verba se não houver efeito em busca de marca.' : 'Reduza lances nos segmentos de menor retorno, teste novos criativos e revise a página de destino.',
        priority: s.d.roas < settings.roasTarget * 0.5 ? 'Alta' : 'Média',
        evidence: [
          { label: 'ROAS', value: ratio(s.d.roas) },
          { label: 'Meta', value: ratio(settings.roasTarget) },
          { label: 'Investimento em mídia', value: money(s.d.mediaSpend) },
        ],
      })
    }
  }

  // 3. Canal com maior retorno financeiro
  const byProfit = [...chs].sort((a, b) => b.d.profit - a.d.profit)
  if (byProfit[0] && byProfit[0].d.profit > 0) {
    const c = byProfit[0]
    out.push({
      id: `profit-${c.channel.id}`,
      rule: 'Canal com maior retorno financeiro',
      type: 'opportunity',
      title: `${c.channel.name} lidera o lucro estimado`,
      description: `Lucro estimado de ${money(c.d.profit, { compact: true })} no período, com ROI de ${percent(c.d.roi, 1)}.`,
      metric: 'Lucro estimado / ROI',
      entity: c.channel.name,
      entityType: 'Canal',
      entityId: c.channel.id,
      impact: `${((c.d.profit / Math.max(1, total.profit)) * 100).toFixed(0)}% do lucro estimado total`,
      impactValue: c.d.profit * 0.1,
      recommendation: 'Proteja o orçamento deste canal e teste incrementos graduais (10–20%), monitorando se CAC e ROAS se mantêm.',
      priority: 'Média',
      evidence: [
        { label: 'Lucro estimado', value: money(c.d.profit) },
        { label: 'ROI', value: percent(c.d.roi, 1) },
        { label: 'Receita', value: money(c.d.revenue) },
      ],
    })
  }

  // 4. Alto investimento e baixa conversão
  const avgInv = total.investment / Math.max(1, cs.length)
  for (const s of cs) {
    if (s.d.investment > avgInv && s.d.convRate !== null && total.convRate !== null && s.d.convRate < total.convRate * 0.4) {
      out.push({
        id: `hilo-${s.campaign.id}`,
        rule: 'Alto investimento e baixa conversão',
        type: 'problem',
        title: 'Alto investimento com baixa conversão',
        description: `${s.campaign.name} recebeu ${money(s.d.investment, { compact: true })} (acima da média por campanha) e converte ${percent(s.d.convRate)} dos cliques, contra ${percent(total.convRate)} da conta.`,
        metric: 'Taxa de conversão',
        entity: s.campaign.name,
        entityType: 'Campanha',
        entityId: s.campaign.id,
        impact: `${money(s.d.investment, { compact: true })} investidos com retorno abaixo do esperado`,
        impactValue: s.d.investment * 0.5,
        recommendation: 'Revise a qualidade do tráfego (posicionamentos, públicos), a oferta e a página de destino. Teste reduzir a verba em 30% enquanto otimiza.',
        priority: 'Alta',
        evidence: [
          { label: 'Investimento', value: money(s.d.investment) },
          { label: 'Conversão', value: percent(s.d.convRate) },
          { label: 'Conversão média', value: percent(total.convRate) },
        ],
      })
    }
  }

  // 5. Canal com menor CPL
  const cplRank = chs.filter((c) => c.d.cpl !== null && c.d.leads >= 30 && c.d.investment >= total.investment * 0.02).sort((a, b) => a.d.cpl! - b.d.cpl!)
  if (cplRank[0] && total.cpl) {
    const c = cplRank[0]
    out.push({
      id: `cpl-${c.channel.id}`,
      rule: 'Canal com menor custo por lead',
      type: 'opportunity',
      title: `${c.channel.name} tem o menor CPL`,
      description: `CPL de ${money(c.d.cpl)} contra ${money(total.cpl)} da média da conta, com ${c.d.leads.toLocaleString('pt-BR')} leads.`,
      metric: 'CPL',
      entity: c.channel.name,
      entityType: 'Canal',
      entityId: c.channel.id,
      impact: `${((1 - c.d.cpl! / total.cpl) * 100).toFixed(0)}% mais barato por lead que a média`,
      impactValue: (total.cpl - c.d.cpl!) * c.d.leads * 0.2,
      recommendation: 'Avalie se o canal tem capacidade de escalar (lista, audiência, conteúdo) e se a qualidade dos leads se sustenta no funil.',
      priority: 'Baixa',
      evidence: [
        { label: 'CPL do canal', value: money(c.d.cpl) },
        { label: 'CPL médio', value: money(total.cpl) },
      ],
    })
  }

  // Janelas recentes: últimos 7 dias do período vs. 28 dias anteriores
  const recentStart = addDays(end, -6)
  const baseStart = addDays(end, -34)
  const baseEnd = addDays(end, -7)
  const recent = groupBy(between(rows, recentStart, end), (r) => r.campaignId)
  const base = groupBy(between(rows, baseStart, baseEnd), (r) => r.campaignId)

  for (const c of campaigns) {
    const r = recent.get(c.id)
    const b = base.get(c.id)
    if (!r || !b) continue
    const dr = derive(sum(r), m)
    const db = derive(sum(b), m)
    // 6. Aumento inesperado de CPC
    if (dr.cpc && db.cpc && dr.cpc > db.cpc * 1.2 && dr.clicks > 100) {
      const delta = (dr.cpc / db.cpc - 1) * 100
      const extra = (dr.cpc - db.cpc) * dr.clicks
      out.push({
        id: `cpc-${c.id}`,
        rule: 'Aumento inesperado de CPC',
        type: 'problem',
        title: `CPC subiu ${delta.toFixed(0)}% nos últimos 7 dias`,
        description: `${c.name}: CPC médio de ${money(dr.cpc)} contra ${money(db.cpc)} nas 4 semanas anteriores. Conversões: ${signedPct(((dr.customers / 7) / (db.customers / 28) - 1) * 100)} na média diária.`,
        metric: 'CPC',
        entity: c.name,
        entityType: 'Campanha',
        entityId: c.id,
        impact: `${money(extra)} pagos a mais em cliques na última semana`,
        impactValue: extra * 4,
        recommendation: 'Verifique leilão (concorrência, termos de pesquisa) e índice de qualidade. Considere lances máximos ou estratégia de CPA alvo.',
        priority: delta > 35 ? 'Alta' : 'Média',
        evidence: [
          { label: 'CPC 7 dias', value: money(dr.cpc) },
          { label: 'CPC 28 dias anteriores', value: money(db.cpc) },
        ],
      })
    }
    // 7. Queda na taxa de conversão (leads/visitantes ou clientes/cliques)
    if (dr.leadRate !== null && db.leadRate !== null && dr.visitors > 200 && dr.leadRate < db.leadRate * 0.75) {
      const delta = (dr.leadRate / db.leadRate - 1) * 100
      const lost = (db.leadRate - dr.leadRate) / 100 * dr.visitors
      out.push({
        id: `conv-${c.id}`,
        rule: 'Queda na taxa de conversão',
        type: 'problem',
        title: `Conversão em lead caiu ${Math.abs(delta).toFixed(0)}%`,
        description: `${c.name}: ${percent(dr.leadRate)} dos visitantes viraram leads nos últimos 7 dias, contra ${percent(db.leadRate)} nas 4 semanas anteriores.`,
        metric: 'Taxa de conversão',
        entity: c.name,
        entityType: 'Campanha',
        entityId: c.id,
        impact: `≈ ${Math.round(lost)} leads a menos na semana`,
        impactValue: lost * (total.cpl ?? 20),
        recommendation: 'Investigue mudanças recentes na página de destino, formulário, oferta ou tracking. Compare criativos ativos antes e depois da queda.',
        priority: 'Alta',
        evidence: [
          { label: 'Lead rate 7 dias', value: percent(dr.leadRate) },
          { label: 'Lead rate 28 dias anteriores', value: percent(db.leadRate) },
        ],
      })
    }
  }

  // 8. Crescimento significativo de receita (período vs. anterior equivalente)
  const len = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  const pStart = addDays(start, -len)
  const pEnd = addDays(start, -1)
  const prevRows = between(rows, pStart, pEnd)
  if (prevRows.length) {
    const prevCh = new Map(channelStats(campaigns, channels, prevRows, m).map((c) => [c.channel.id, c]))
    for (const c of chs) {
      const p = prevCh.get(c.channel.id)
      if (p && p.d.revenue > 5000 && c.d.revenue > p.d.revenue * 1.25) {
        const growth = (c.d.revenue / p.d.revenue - 1) * 100
        out.push({
          id: `growth-${c.channel.id}`,
          rule: 'Crescimento significativo de receita',
          type: 'opportunity',
          title: `Receita de ${c.channel.name} cresceu ${growth.toFixed(0)}%`,
          description: `${money(c.d.revenue, { compact: true })} no período contra ${money(p.d.revenue, { compact: true })} no período anterior equivalente. Investimento variou ${signedPct((c.d.investment / Math.max(1, p.d.investment) - 1) * 100)}.`,
          metric: 'Receita',
          entity: c.channel.name,
          entityType: 'Canal',
          entityId: c.channel.id,
          impact: `+${money(c.d.revenue - p.d.revenue, { compact: true })} de receita`,
          impactValue: (c.d.revenue - p.d.revenue) * 0.2,
          recommendation: 'Identifique quais campanhas e criativos explicam o crescimento e avalie escalar mantendo o ROAS acima da meta.',
          priority: 'Média',
          evidence: [
            { label: 'Receita atual', value: money(c.d.revenue) },
            { label: 'Receita anterior', value: money(p.d.revenue) },
            { label: 'ROAS', value: ratio(c.d.roas) },
          ],
        })
      }
    }
  }

  // 9. Oportunidade de redistribuição de orçamento
  const paid = chs.filter((c) => c.d.mediaSpend > 5000 && c.d.roas !== null).sort((a, b) => b.d.roas! - a.d.roas!)
  if (paid.length >= 2) {
    const best = paid[0]
    const worst = paid[paid.length - 1]
    if (best.d.roas! > worst.d.roas! * 1.5) {
      const move = worst.d.mediaSpend * 0.2
      // projeção conservadora: retornos decrescentes (70% da eficiência marginal)
      const delta = move * best.d.roas! * 0.7 - move * worst.d.roas!
      out.push({
        id: `realloc-${worst.channel.id}-${best.channel.id}`,
        rule: 'Oportunidade de redistribuição de orçamento',
        type: 'opportunity',
        title: `Realocar verba de ${worst.channel.name} para ${best.channel.name}`,
        description: `${best.channel.name} tem ROAS de ${ratio(best.d.roas)} e ${worst.channel.name}, ${ratio(worst.d.roas)}. Mover 20% da mídia (${money(move, { compact: true })}) tende a elevar a receita.`,
        metric: 'ROAS',
        entity: `${worst.channel.name} → ${best.channel.name}`,
        entityType: 'Canal',
        impact: `Projeção: ${delta > 0 ? '+' : ''}${money(delta, { compact: true })} de receita (estimativa, não resultado real)`,
        impactValue: delta,
        recommendation: 'Simule no Budget Simulator e aplique gradualmente (testes de 2 semanas). Nenhuma alteração é feita nas plataformas sem confirmação.',
        priority: 'Média',
        evidence: [
          { label: `ROAS ${best.channel.name}`, value: ratio(best.d.roas) },
          { label: `ROAS ${worst.channel.name}`, value: ratio(worst.d.roas) },
        ],
      })
    }
  }

  // 10. Desempenho inconsistente (variabilidade semanal de investimento e ROAS)
  const g = groupBy(cur, (r) => r.campaignId)
  for (const c of campaigns) {
    const rs = g.get(c.id)
    if (!rs || rs.length < 21) continue
    const weeks = Array.from(groupBy(rs, (r) => bucketKey(r.date, 'week')).values()).filter((w) => w.length >= 5)
    const ws = weeks.map((w) => w.reduce((a, r) => a + r.mediaSpend, 0))
    const wr = weeks.map((w) => { const sp = w.reduce((a, r) => a + r.mediaSpend, 0); return sp > 0 ? w.reduce((a, r) => a + r.revenue, 0) / sp : 0 })
    if (weeks.length < 3 || ws.some((v) => v === 0)) continue
    const cv = stdev(ws) / (ws.reduce((a, b) => a + b, 0) / ws.length)
    const mr = wr.reduce((a, b) => a + b, 0) / wr.length
    const cvr = mr > 0 ? stdev(wr) / mr : 0
    if (cvr > 0.35 || (cv > 0.25 && cvr > 0.25)) {
      out.push({
        id: `incons-${c.id}`,
        rule: 'Campanha com desempenho inconsistente',
        type: 'problem',
        title: 'Desempenho semanal inconsistente',
        description: `${c.name}: o investimento semanal varia ${(cv * 100).toFixed(0)}% em torno da média e o ROAS semanal, ${(cvr * 100).toFixed(0)}%. Resultados assim dificultam a previsão.`,
        metric: 'Variabilidade (CV)',
        entity: c.name,
        entityType: 'Campanha',
        entityId: c.id,
        impact: 'Baixa previsibilidade de resultados',
        impactValue: 1000,
        recommendation: 'Estabilize o orçamento diário (evite picos manuais), consolide conjuntos de anúncios e aguarde o fim da fase de aprendizado antes de novas mudanças.',
        priority: 'Baixa',
        evidence: [
          { label: 'CV investimento semanal', value: `${(cv * 100).toFixed(0)}%` },
          { label: 'CV ROAS semanal', value: `${(cvr * 100).toFixed(0)}%` },
        ],
      })
    }
  }

  return out.sort((a, b) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || b.impactValue - a.impactValue)
}
