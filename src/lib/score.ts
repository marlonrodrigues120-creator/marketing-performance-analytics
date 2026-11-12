import type { Campaign, Derived } from '../data/types'
import type { ScoreMetric, Settings } from '../store/settings'

export type ScoreClass = 'Excelente' | 'Bom' | 'Regular' | 'Necessita atenção'

export interface ScoreFactor {
  metric: ScoreMetric
  label: string
  value: number | null
  target: number
  weight: number
  points: number | null // 0..100
  contribution: number // pontos ponderados
}

export interface CampaignScore {
  score: number | null
  cls: ScoreClass | null
  factors: ScoreFactor[]
  explanation: string
}

const LOWER_BETTER: ScoreMetric[] = ['cac', 'cpl']
export const SCORE_LABELS: Record<ScoreMetric, string> = { cac: 'CAC', roas: 'ROAS', roi: 'ROI', cpl: 'CPL', convRate: 'Taxa de conversão', ctr: 'CTR' }

export function classify(s: number): ScoreClass {
  if (s >= 80) return 'Excelente'
  if (s >= 60) return 'Bom'
  if (s >= 40) return 'Regular'
  return 'Necessita atenção'
}

/**
 * Pontuação 0–100 por indicador: atingir exatamente a meta = 60 pontos;
 * 50% melhor que a meta = 100; 75% pior = 0. Indicadores sem dado (ex.: ROAS
 * de canal orgânico, sem mídia) são excluídos e os pesos redistribuídos.
 * Metas e pesos variam por objetivo da campanha (Settings → Campaign Score).
 */
export function scoreCampaign(c: Campaign, d: Derived, s: Settings): CampaignScore {
  const targets = s.scoreTargets[c.objective]
  const weights = s.scoreWeights[c.objective]
  const metrics = Object.keys(weights) as ScoreMetric[]
  const factors: ScoreFactor[] = metrics.map((m) => {
    const value = d[m] as number | null
    const target = targets[m]
    const weight = weights[m]
    let points: number | null = null
    if (value !== null && isFinite(value) && weight > 0) {
      let r: number
      if (m === 'roi') {
        // ROI pode ser negativo: compara em pontos percentuais (100 p.p. abaixo da meta = 0)
        points = clamp(60 + (value - target) * 0.6, 0, 100)
      } else {
        r = LOWER_BETTER.includes(m) ? (value > 0 ? target / value : 1.5) : target > 0 ? value / target : 1
        points = clamp(60 + 80 * (r - 1), 0, 100)
      }
    }
    return { metric: m, label: SCORE_LABELS[m], value, target, weight, points, contribution: 0 }
  })
  const valid = factors.filter((f) => f.points !== null)
  const wsum = valid.reduce((a, f) => a + f.weight, 0)
  if (wsum === 0 || d.clicks < 50) {
    return { score: null, cls: null, factors, explanation: 'Dados insuficientes para pontuar esta campanha no período.' }
  }
  for (const f of valid) f.contribution = (f.points! * f.weight) / wsum
  const score = Math.round(valid.reduce((a, f) => a + f.contribution, 0))
  const sorted = [...valid].sort((a, b) => b.points! - a.points!)
  const best = sorted.slice(0, 2).filter((f) => f.points! >= 60)
  const worst = sorted.reverse().slice(0, 2).filter((f) => f.points! < 60)
  const parts: string[] = [`Objetivo "${c.objective}" — metas e pesos específicos.`]
  if (best.length) parts.push(`Puxaram a nota para cima: ${best.map((f) => f.label).join(' e ')}.`)
  if (worst.length) parts.push(`Puxaram para baixo: ${worst.map((f) => f.label).join(' e ')}.`)
  const excluded = factors.filter((f) => f.points === null && f.weight > 0)
  if (excluded.length) parts.push(`Sem dado: ${excluded.map((f) => f.label).join(', ')} (peso redistribuído).`)
  return { score, cls: classify(score), factors, explanation: parts.join(' ') }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
