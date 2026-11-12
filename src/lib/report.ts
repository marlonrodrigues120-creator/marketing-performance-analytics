import type { AnalystCtx } from './analyst'
import { derive, sum } from './metrics'
import { campaignStats, channelStats } from './query'
import { generateInsights } from './insights'
import { dateBR, money, num, percent, ratio, signedPct } from './format'

export interface ReportSection {
  title: string
  lines: string[]
}

const v = (a: number | null, b: number | null) => (a !== null && b ? ((a - b) / Math.abs(b)) * 100 : null)

/** Relatório executivo gerado exclusivamente a partir dos dados filtrados. */
export function buildReport(ctx: AnalystCtx): { title: string; sections: ReportSection[]; markdown: string } {
  const m = ctx.settings.grossMargin
  const d = derive(sum(ctx.rows), m)
  const p = ctx.prevRows.length ? derive(sum(ctx.prevRows), m) : null
  const cs = campaignStats(ctx.campaigns, ctx.channels, ctx.rows, m)
  const chs = channelStats(ctx.campaigns, ctx.channels, ctx.rows, m)
  const ins = generateInsights({ campaigns: ctx.campaigns, channels: ctx.channels, rows: ctx.dimRows, start: ctx.start, end: ctx.end, settings: ctx.settings })
  const cmp = (cur: number | null, prev: number | null) => (p ? ` (${signedPct(v(cur, prev))} vs. período anterior)` : '')
  const title = `Relatório executivo de marketing — ${dateBR(ctx.start)} a ${dateBR(ctx.end)}`
  const byProfit = [...cs].sort((a, b) => b.d.profit - a.d.profit)
  const byRoi = [...chs].filter((c) => c.d.roi !== null && c.d.investment > 1000).sort((a, b) => b.d.roi! - a.d.roi!)

  const sections: ReportSection[] = [
    {
      title: 'Resumo de performance',
      lines: [
        `Investimento total de ${money(d.investment)}${cmp(d.investment, p?.investment ?? null)}, sendo ${money(d.mediaSpend)} em mídia.`,
        `Receita atribuída de ${money(d.revenue)}${cmp(d.revenue, p?.revenue ?? null)} e lucro estimado após marketing de ${money(d.profit)} (margem bruta de ${percent(m * 100, 0)}).`,
        `${num(d.leads)} leads e ${num(d.customers)} novos clientes${cmp(d.customers, p?.customers ?? null)}.`,
        `CAC ${money(d.cac)}${cmp(d.cac, p?.cac ?? null)} · ROAS ${ratio(d.roas)}${cmp(d.roas, p?.roas ?? null)} · ROI ${percent(d.roi, 1)} · CPL ${money(d.cpl)}.`,
      ],
    },
    {
      title: 'Principais resultados',
      lines: [
        byRoi[0] ? `Canal mais eficiente: ${byRoi[0].channel.name}, ROI de ${percent(byRoi[0].d.roi, 1)}.` : '',
        byRoi.length > 1 ? `Canal menos eficiente: ${byRoi[byRoi.length - 1].channel.name}, ROI de ${percent(byRoi[byRoi.length - 1].d.roi, 1)}.` : '',
        `Maior receita por canal: ${[...chs].sort((a, b) => b.d.revenue - a.d.revenue)[0]?.channel.name} (${money([...chs].sort((a, b) => b.d.revenue - a.d.revenue)[0]?.d.revenue)}).`,
      ].filter(Boolean),
    },
    {
      title: 'Campanhas de destaque',
      lines: byProfit.slice(0, 3).map((s) => `${s.campaign.name}: lucro estimado ${money(s.d.profit)}, ROI ${percent(s.d.roi, 1)}, CAC ${money(s.d.cac)}.`),
    },
    {
      title: 'Problemas identificados',
      lines: ins.filter((i) => i.type === 'problem').slice(0, 5).map((i) => `[${i.priority}] ${i.entity} — ${i.title}. ${i.description}`),
    },
    {
      title: 'Recomendações estratégicas',
      lines: ins.slice(0, 5).map((i) => `${i.entity}: ${i.recommendation}`),
    },
  ]
  const markdown = [`# ${title}`, '', '_Dados demonstrativos (fictícios). Atribuição: ' + ctx.settings.attributionModel + '. Gerado a partir dos indicadores da plataforma, sem métricas externas._', '', ...sections.flatMap((s) => [`## ${s.title}`, ...(s.lines.length ? s.lines.map((l) => `- ${l}`) : ['- Nada a destacar no período.']), ''])].join('\n')
  return { title, sections, markdown }
}
