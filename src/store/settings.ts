import type { Objective } from '../data/types'

export type ScoreMetric = 'cac' | 'roas' | 'roi' | 'cpl' | 'convRate' | 'ctr'

export interface ObjectiveTargets {
  cac: number
  roas: number
  roi: number
  cpl: number
  convRate: number
  ctr: number
}

export interface Settings {
  companyName: string
  grossMargin: number // 0..1
  attributionModel: 'last-click' | 'first-click' | 'linear'
  roasTarget: number
  cacLimit: number
  cplLimit: number
  convRateMin: number
  budgetAlertPct: number
  monthlyRevenueGoal: number
  scoreTargets: Record<Objective, ObjectiveTargets>
  scoreWeights: Record<Objective, Record<ScoreMetric, number>>
  integrations: {
    apiBaseUrl: string // backend FastAPI (opcional)
    n8nConnected: boolean
  }
}

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'Acme Store (demo)',
  grossMargin: 0.55,
  attributionModel: 'last-click',
  roasTarget: 2.5,
  cacLimit: 300,
  cplLimit: 30,
  convRateMin: 1,
  budgetAlertPct: 80,
  monthlyRevenueGoal: 1200000,
  scoreTargets: {
    Vendas: { cac: 250, roas: 3, roi: 40, cpl: 25, convRate: 2, ctr: 1.5 },
    'Geração de leads': { cac: 900, roas: 2, roi: 20, cpl: 40, convRate: 0.6, ctr: 0.8 },
    Awareness: { cac: 600, roas: 1, roi: 0, cpl: 50, convRate: 0.3, ctr: 0.7 },
  },
  scoreWeights: {
    Vendas: { roas: 25, roi: 25, cac: 20, convRate: 15, cpl: 5, ctr: 10 },
    'Geração de leads': { cpl: 30, cac: 15, convRate: 15, ctr: 15, roas: 10, roi: 15 },
    Awareness: { ctr: 35, cpl: 25, convRate: 15, roas: 10, roi: 10, cac: 5 },
  },
  integrations: { apiBaseUrl: '', n8nConnected: false },
}
