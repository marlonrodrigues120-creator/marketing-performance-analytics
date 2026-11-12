import { describe, expect, it } from 'vitest'
import { derive, safeDiv, sum } from './metrics'
import { generateDemo } from '../data/seed'
import { campaignStats, channelStats } from './query'
import { CHANNELS } from '../data/seed'
import { generateInsights } from './insights'
import { DEFAULT_SETTINGS } from '../store/settings'
import { runWorkflow } from '../automation/engine'
import { TEMPLATES, workflowFromTemplate } from '../automation/templates'
import { validateWorkflow } from '../automation/engine'
import type { DailyMetric } from '../data/types'

const row = (p: Partial<DailyMetric>): DailyMetric => ({ date: '2026-01-01', campaignId: 'x', mediaSpend: 0, otherCost: 0, impressions: 0, clicks: 0, visitors: 0, leads: 0, opportunities: 0, customers: 0, orders: 0, revenue: 0, ...p })

describe('fórmulas', () => {
  it('divisão por zero retorna null', () => {
    expect(safeDiv(1, 0)).toBeNull()
    const d = derive(sum([]), 0.5)
    expect([d.cac, d.cpl, d.roas, d.roi, d.ctr, d.cpc, d.convRate, d.aov]).toEqual([null, null, null, null, null, null, null, null])
  })

  it('CAC, CPL, ROAS, ROI, CTR, CPC, conversão e ticket médio', () => {
    const d = derive(sum([row({ mediaSpend: 1000, otherCost: 200, impressions: 100000, clicks: 2000, visitors: 1800, leads: 100, customers: 20, orders: 22, revenue: 6000 })]), 0.5)
    expect(d.cac).toBeCloseTo(60)
    expect(d.cpl).toBeCloseTo(12)
    expect(d.roas).toBeCloseTo(6)
    expect(d.roi).toBeCloseTo(((3000 - 1200) / 1200) * 100)
    expect(d.ctr).toBeCloseTo(2)
    expect(d.cpc).toBeCloseTo(0.5)
    expect(d.convRate).toBeCloseTo(1)
    expect(d.aov).toBeCloseTo(6000 / 22)
  })

  it('CPC ignora cliques orgânicos e ROAS não existe sem mídia', () => {
    const d = derive(sum([row({ mediaSpend: 100, clicks: 50 }), row({ otherCost: 30, clicks: 950 })]), 0.5)
    expect(d.cpc).toBeCloseTo(2)
    expect(derive(sum([row({ otherCost: 30, clicks: 10, revenue: 100 })]), 0.5).roas).toBeNull()
  })

  it('receita não é lucro: ROAS > 1 pode ter ROI negativo', () => {
    const d = derive(sum([row({ mediaSpend: 1000, otherCost: 100, revenue: 1500 })]), 0.4)
    expect(d.roas).toBeGreaterThan(1)
    expect(d.roi!).toBeLessThan(0)
  })
})

describe('consistência da base demonstrativa', () => {
  const { campaigns, metrics } = generateDemo()
  it('tem ≥ 6 meses, ≥ 15 campanhas e ≥ 5 canais', () => {
    expect(new Set(metrics.map((m) => m.date)).size).toBeGreaterThanOrEqual(180)
    expect(campaigns.length).toBeGreaterThanOrEqual(15)
    expect(new Set(campaigns.map((c) => c.channelId)).size).toBeGreaterThanOrEqual(5)
  })
  it('funil é monotônico em todas as linhas', () => {
    for (const m of metrics) {
      expect(m.clicks).toBeLessThanOrEqual(m.impressions)
      expect(m.visitors).toBeLessThanOrEqual(m.clicks)
      expect(m.leads).toBeLessThanOrEqual(m.visitors)
      expect(m.opportunities).toBeLessThanOrEqual(m.leads)
      expect(m.customers).toBeLessThanOrEqual(m.opportunities)
      expect(m.orders).toBeGreaterThanOrEqual(m.customers)
    }
  })
  it('soma por canal = soma por campanha = total', () => {
    const t = sum(metrics)
    const byCh = channelStats(campaigns, CHANNELS, metrics, 0.55).reduce((a, c) => a + c.d.revenue, 0)
    const byCp = campaignStats(campaigns, CHANNELS, metrics, 0.55).reduce((a, c) => a + c.d.revenue, 0)
    expect(byCh).toBeCloseTo(t.revenue, 2)
    expect(byCp).toBeCloseTo(t.revenue, 2)
  })
  it('insights são gerados a partir dos dados', () => {
    const end = metrics.reduce((a, r) => (r.date > a ? r.date : a), '')
    const ins = generateInsights({ campaigns, channels: CHANNELS, rows: metrics, start: metrics.find((m) => m.date >= end.slice(0, 8) + '01')!.date, end, settings: DEFAULT_SETTINGS })
    expect(ins.length).toBeGreaterThan(0)
    expect(ins.every((i) => i.evidence.length > 0 && i.recommendation.length > 0)).toBe(true)
  })
})

describe('automação', () => {
  const { campaigns, metrics } = generateDemo()
  const asOf = metrics.reduce((a, r) => (r.date > a ? r.date : a), '')
  it('todos os modelos são válidos e executam', () => {
    for (const t of TEMPLATES) {
      const wf = workflowFromTemplate(t)
      expect(validateWorkflow(wf)).toEqual([])
      const r = runWorkflow(wf, { campaigns, channels: CHANNELS, metrics, settings: DEFAULT_SETTINGS, asOf }, 'test')
      expect(r.execution.status).toBe('success')
      expect(r.execution.steps[0].kind).toBe('trigger')
    }
  })
  it('valida workflow sem gatilho', () => {
    const wf = workflowFromTemplate(TEMPLATES[0])
    wf.nodes = wf.nodes.filter((n) => n.data.kind !== 'trigger')
    expect(validateWorkflow(wf).join(' ')).toContain('gatilho')
  })
})
