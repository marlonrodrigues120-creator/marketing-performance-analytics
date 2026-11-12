import { useMemo } from 'react'
import { useStore } from './AppStore'
import { derive, sum } from '../lib/metrics'
import { addDays, between, daysBetween } from '../lib/query'

/**
 * Aplica os filtros globais (período, canal, campanha, plataforma, tipo de
 * conversão) uma única vez e entrega as linhas já filtradas para todas as
 * páginas — garante que cards, gráficos, tabelas e insights usem a mesma base.
 */
export function useAnalytics() {
  const { campaigns, channels, metrics, filters, settings, dataStart } = useStore()
  return useMemo(() => {
    const campIds = new Set(
      campaigns
        .filter(
          (c) =>
            (!filters.channels.length || filters.channels.includes(c.channelId)) &&
            (!filters.campaigns.length || filters.campaigns.includes(c.id)) &&
            (!filters.platforms.length || filters.platforms.includes(c.platform)) &&
            (!filters.conversionTypes.length || filters.conversionTypes.includes(c.conversionType)),
        )
        .map((c) => c.id),
    )
    const dimRows = metrics.filter((r) => campIds.has(r.campaignId))
    const len = daysBetween(filters.start, filters.end) + 1
    const prevStart = addDays(filters.start, -len)
    const prevEnd = addDays(filters.start, -1)
    const rows = between(dimRows, filters.start, filters.end)
    const prevRows = between(dimRows, prevStart, prevEnd)
    const hasPrev = prevStart >= dataStart && prevRows.length > 0
    const m = settings.grossMargin
    const filteredCampaigns = campaigns.filter((c) => campIds.has(c.id))
    const filteredChannels = channels.filter((ch) => filteredCampaigns.some((c) => c.channelId === ch.id))
    return {
      rows,
      prevRows: hasPrev ? prevRows : [],
      dimRows,
      hasPrev,
      partialPrev: prevStart < dataStart && prevRows.length > 0,
      range: { start: filters.start, end: filters.end, days: len },
      prevRange: { start: prevStart, end: prevEnd },
      total: derive(sum(rows), m),
      prevTotal: hasPrev ? derive(sum(prevRows), m) : null,
      campaigns: filteredCampaigns,
      channels: filteredChannels,
      margin: m,
    }
  }, [campaigns, channels, metrics, filters, settings.grossMargin, dataStart])
}
