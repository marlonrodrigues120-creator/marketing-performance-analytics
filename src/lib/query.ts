import type { Campaign, Channel, DailyMetric, Derived } from '../data/types'
import { derive, groupBy, sum } from './metrics'

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

export function between(rows: DailyMetric[], start: string, end: string) {
  return rows.filter((r) => r.date >= start && r.date <= end)
}

export interface CampaignStat {
  campaign: Campaign
  channel: Channel
  d: Derived
}

export function campaignStats(campaigns: Campaign[], channels: Channel[], rows: DailyMetric[], margin: number): CampaignStat[] {
  const g = groupBy(rows, (r) => r.campaignId)
  const out: CampaignStat[] = []
  for (const c of campaigns) {
    const rs = g.get(c.id)
    if (!rs || rs.length === 0) continue
    out.push({ campaign: c, channel: channels.find((ch) => ch.id === c.channelId)!, d: derive(sum(rs), margin) })
  }
  return out
}

export interface ChannelStat {
  channel: Channel
  d: Derived
  campaigns: number
}

export function channelStats(campaigns: Campaign[], channels: Channel[], rows: DailyMetric[], margin: number): ChannelStat[] {
  const byCamp = new Map(campaigns.map((c) => [c.id, c.channelId]))
  const g = groupBy(rows, (r) => byCamp.get(r.campaignId) ?? 'other')
  const out: ChannelStat[] = []
  for (const ch of channels) {
    const rs = g.get(ch.id)
    if (!rs || rs.length === 0) continue
    const nCamp = new Set(rs.map((r) => r.campaignId)).size
    out.push({ channel: ch, d: derive(sum(rs), margin), campaigns: nCamp })
  }
  return out
}

export function dailyValues(rows: DailyMetric[], fn: (d: Derived) => number | null, margin: number) {
  const g = groupBy(rows, (r) => r.date)
  return Array.from(g.keys())
    .sort()
    .map((k) => fn(derive(sum(g.get(k)!), margin)))
}
