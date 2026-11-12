import type { Campaign, Channel, DailyMetric } from '../data/types'
import type { Settings } from '../store/settings'
import { derive, sum } from './metrics'
import { campaignStats, channelStats } from './query'
import { generateInsights, type Insight } from './insights'
import { KPIS, getKpi, type KpiKey } from './kpis'
import { money, num, percent, ratio, signedPct } from './format'

export interface AnalystAnswer {
  text: string[]
  metrics?: { label: string; value: string; tone?: 'good' | 'bad' }[]
  chart?: { title: string; items: { id: string; name: string; value: number | null; color?: string }[]; kpi: KpiKey }
  bullets?: string[]
  caveat?: string
  basis: string
}

export interface AnalystCtx {
  campaigns: Campaign[]
  channels: Channel[]
  rows: DailyMetric[]
  prevRows: DailyMetric[]
  dimRows: DailyMetric[]
  start: string
  end: string
  settings: Settings
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

export const SUGGESTIONS = [
  'Qual campanha teve o melhor resultado?',
  'Qual canal possui o menor CAC?',
  'Por que o ROAS caiu?',
  'Onde estou desperdiçando orçamento?',
  'Quais campanhas precisam de atenção?',
  'Qual canal apresenta maior potencial de crescimento?',
  'Como posso melhorar minha taxa de conversão?',
  'Qual o ROI do Google Ads?',
]

/**
 * Analista determinístico: interpreta a pergunta, consulta os dados filtrados
 * e responde somente com indicadores calculados. Não infere causalidade: aponta
 * associações e sugere o que investigar. No backend, a mesma camada de dados
 * alimenta o modelo da OpenAI como contexto (ver /backend/app/services/ai.py).
 */
export function answer(question: string, ctx: AnalystCtx): AnalystAnswer {
  const q = norm(question)
  const m = ctx.settings.grossMargin
  const total = derive(sum(ctx.rows), m)
  const prev = ctx.prevRows.length ? derive(sum(ctx.prevRows), m) : null
  const cs = campaignStats(ctx.campaigns, ctx.channels, ctx.rows, m)
  const chs = channelStats(ctx.campaigns, ctx.channels, ctx.rows, m)
  const basis = `Base: ${ctx.rows.length.toLocaleString('pt-BR')} registros diários de ${ctx.start.split('-').reverse().join('/')} a ${ctx.end.split('-').reverse().join('/')}, filtros globais aplicados.`
  if (!ctx.rows.length) return { text: ['Não há dados para os filtros atuais, então não consigo responder sem inventar números. Amplie o período ou remova filtros.'], basis }

  // entidade citada (canal ou campanha)
  const ch = ctx.channels.find((c) => q.includes(norm(c.name)) || q.includes(norm(c.name.replace(' Ads', ''))))
  const camp = ctx.campaigns.find((c) => q.includes(norm(c.name)) || norm(c.name).split(' — ').slice(1).some((p) => p.length > 4 && q.includes(p)))
  const metricWord = (['cac', 'roas', 'roi', 'cpl', 'ctr', 'cpc'] as KpiKey[]).find((k) => new RegExp(`\\b${k}\\b`).test(q)) ?? (has(q, 'receita') ? 'revenue' : has(q, 'lead') ? 'leads' : has(q, 'conversao', 'conversoes') && !has(q, 'taxa') ? 'customers' : undefined)

  // 1. Melhor campanha
  if (has(q, 'melhor resultado', 'melhor campanha', 'melhor desempenho', 'campanha mais rentavel', 'melhor performance')) {
    const ranked = cs.filter((s) => s.d.investment > 0).sort((a, b) => b.d.profit - a.d.profit)
    const top = ranked[0]
    return {
      text: [
        `Pelo lucro estimado (receita × margem − investimento), a campanha com melhor resultado foi **${top.campaign.name}** (${top.channel.name}): ${money(top.d.profit)} de lucro estimado, ROI de ${percent(top.d.roi, 1)} e CAC de ${money(top.d.cac)}.`,
        `Em ROI, a líder é **${[...ranked].filter((s) => s.d.investment > 3000).sort((a, b) => (b.d.roi ?? -1e9) - (a.d.roi ?? -1e9))[0].campaign.name}**. Lucro absoluto e ROI respondem perguntas diferentes: um mostra quanto a campanha gerou, o outro, quão eficiente ela foi.`,
      ],
      metrics: [
        { label: 'Receita', value: money(top.d.revenue) },
        { label: 'Investimento', value: money(top.d.investment) },
        { label: 'ROAS', value: ratio(top.d.roas) },
        { label: 'Conversões', value: num(top.d.customers) },
      ],
      chart: { title: 'Lucro estimado por campanha (top 8)', kpi: 'profit', items: ranked.slice(0, 8).map((s) => ({ id: s.campaign.id, name: s.campaign.name, value: s.d.profit, color: s.channel.color })) },
      basis,
    }
  }

  // 2. Menor CAC por canal
  if (has(q, 'menor cac', 'cac mais baixo', 'menor custo de aquisicao')) {
    const r = chs.filter((c) => c.d.cac !== null && c.d.customers >= 5).sort((a, b) => a.d.cac! - b.d.cac!)
    const paid = r.filter((c) => c.d.mediaSpend > 0)
    return {
      text: [
        `O canal com menor CAC é **${r[0].channel.name}**, com ${money(r[0].d.cac)} por cliente (${num(r[0].d.customers)} clientes para ${money(r[0].d.investment)} investidos). A média da conta é ${money(total.cac)}.`,
        paid[0] && paid[0] !== r[0] ? `Entre canais de mídia paga, o menor CAC é **${paid[0].channel.name}** (${money(paid[0].d.cac)}). Canais sem mídia costumam ter CAC menor porque seus custos são basicamente produção e ferramentas.` : '',
      ].filter(Boolean),
      chart: { title: 'CAC por canal (menor é melhor)', kpi: 'cac', items: r.map((c) => ({ id: c.channel.id, name: c.channel.name, value: c.d.cac, color: c.channel.color })) },
      caveat: 'O CAC usa o investimento total (mídia + custos não-mídia) dividido pelos novos clientes atribuídos pelo modelo last-click.',
      basis,
    }
  }

  // 3. Por que o ROAS caiu
  if (has(q, 'roas caiu', 'queda do roas', 'queda no roas', 'roas diminuiu', 'roas piorou', 'por que o roas')) {
    if (!prev) return { text: ['Não há período anterior equivalente no histórico para comparar o ROAS. Selecione um período mais curto.'], basis }
    const delta = total.roas !== null && prev.roas ? ((total.roas - prev.roas) / prev.roas) * 100 : null
    const prevCh = new Map(channelStats(ctx.campaigns, ctx.channels, ctx.prevRows, m).map((c) => [c.channel.id, c]))
    const contrib = chs
      .filter((c) => c.d.mediaSpend > 0 && prevCh.get(c.channel.id)?.d.roas)
      .map((c) => {
        const p = prevCh.get(c.channel.id)!
        return { c, p, dRoas: ((c.d.roas! - p.d.roas!) / p.d.roas!) * 100, dCpc: c.d.cpc && p.d.cpc ? ((c.d.cpc - p.d.cpc) / p.d.cpc) * 100 : null, dConv: c.d.convRate && p.d.convRate ? ((c.d.convRate - p.d.convRate) / p.d.convRate) * 100 : null, share: c.d.mediaSpend / total.mediaSpend }
      })
      .sort((a, b) => a.dRoas * a.share - b.dRoas * b.share)
    const fell = delta !== null && delta < -1
    const text = fell
      ? [`O ROAS passou de ${ratio(prev.roas)} para ${ratio(total.roas)} (${signedPct(delta)}). Receita ${signedPct(((total.revenue - prev.revenue) / prev.revenue) * 100)} e mídia ${signedPct(((total.mediaSpend - prev.mediaSpend) / prev.mediaSpend) * 100)} no mesmo intervalo.`, 'Os canais que mais pesaram na variação (queda de ROAS ponderada pela participação na mídia) foram:']
      : [`O ROAS não caiu no período selecionado: está em ${ratio(total.roas)} contra ${ratio(prev.roas)} no período anterior (${signedPct(delta)}). Veja abaixo os canais com pior evolução, que merecem acompanhamento.`]
    return {
      text,
      bullets: contrib.slice(0, 4).map((x) => `**${x.c.channel.name}** — ROAS ${ratio(x.p.d.roas)} → ${ratio(x.c.d.roas)} (${signedPct(x.dRoas)}), ${percent(x.share * 100, 0)} da mídia; CPC ${signedPct(x.dCpc)}, conversão ${signedPct(x.dConv)}.`),
      metrics: [
        { label: 'ROAS atual', value: ratio(total.roas), tone: fell ? 'bad' : 'good' },
        { label: 'ROAS anterior', value: ratio(prev.roas) },
        { label: 'CPC', value: `${money(total.cpc)} (${signedPct(prev.cpc && total.cpc ? ((total.cpc - prev.cpc) / prev.cpc) * 100 : null)})` },
        { label: 'Conversão', value: `${percent(total.convRate)} (${signedPct(prev.convRate && total.convRate ? ((total.convRate - prev.convRate) / prev.convRate) * 100 : null)})` },
      ],
      caveat: 'Estas são variações observadas nos dados, não causas comprovadas. Alta de CPC ou queda de conversão estão associadas à queda de ROAS; confirme investigando leilão, criativos, landing pages e tracking.',
      basis,
    }
  }

  // 4. Desperdício
  if (has(q, 'desperdic', 'jogando dinheiro', 'perdendo dinheiro', 'onde cortar')) {
    const neg = cs.filter((s) => s.d.profit < 0).sort((a, b) => a.d.profit - b.d.profit)
    const lowRoas = cs.filter((s) => s.d.roas !== null && s.d.roas < ctx.settings.roasTarget && s.d.profit >= 0)
    const lost = neg.reduce((a, s) => a + s.d.profit, 0)
    return {
      text: neg.length
        ? [`${neg.length} campanha(s) tiveram lucro estimado negativo no período, somando **${money(lost)}**: o investimento superou o lucro bruto que geraram. Elas concentram ${money(neg.reduce((a, s) => a + s.d.investment, 0))} de investimento (${percent((neg.reduce((a, s) => a + s.d.investment, 0) / total.investment) * 100, 0)} do total).`]
        : ['Nenhuma campanha teve lucro estimado negativo no período.'],
      bullets: [
        ...neg.slice(0, 5).map((s) => `**${s.campaign.name}** — investimento ${money(s.d.investment)}, lucro estimado ${money(s.d.profit)}, ROAS ${ratio(s.d.roas)}, CAC ${money(s.d.cac)}`),
        ...(lowRoas.length ? [`Também abaixo da meta de ROAS (mas ainda lucrativas): ${lowRoas.map((s) => s.campaign.name).join(', ')}.`] : []),
      ],
      chart: neg.length ? { title: 'Lucro estimado negativo por campanha', kpi: 'profit', items: neg.map((s) => ({ id: s.campaign.id, name: s.campaign.name, value: s.d.profit, color: s.channel.color })) } : undefined,
      caveat: neg.some((s) => s.campaign.objective === 'Awareness') ? 'Campanhas de Awareness têm retorno direto baixo por natureza no modelo last-click; avalie-as também por alcance e efeito em busca de marca antes de cortar.' : undefined,
      basis,
    }
  }

  const insights = generateInsights({ campaigns: ctx.campaigns, channels: ctx.channels, rows: ctx.dimRows, start: ctx.start, end: ctx.end, settings: ctx.settings })

  // 5. Atenção
  if (has(q, 'atencao', 'precisam de', 'prioridade', 'alertas', 'problemas')) {
    const probs = insights.filter((i) => i.type === 'problem')
    const byCamp = new Map<string, Insight[]>()
    for (const i of probs) if (i.entityType === 'Campanha') byCamp.set(i.entity, [...(byCamp.get(i.entity) ?? []), i])
    const ranked = Array.from(byCamp.entries()).sort((a, b) => b[1].filter((i) => i.priority === 'Alta').length - a[1].filter((i) => i.priority === 'Alta').length || b[1].length - a[1].length)
    return {
      text: [`Encontrei ${probs.length} alertas em ${byCamp.size} campanhas. As que mais precisam de atenção, pela quantidade e prioridade dos alertas:`],
      bullets: ranked.slice(0, 6).map(([name, list]) => `**${name}** — ${list.map((i) => i.title.toLowerCase()).join('; ')}`),
      caveat: 'Os detalhes e recomendações de cada alerta estão na aba "Insights automáticos".',
      basis,
    }
  }

  // 6. Potencial de crescimento
  if (has(q, 'potencial', 'escalar', 'crescimento', 'investir mais', 'onde investir')) {
    const paid = chs.filter((c) => c.d.mediaSpend > 0 && c.d.roi !== null)
    const cand = paid.map((c) => ({ c, share: c.d.investment / total.investment, score: (c.d.roi ?? 0) * (1 - c.d.investment / total.investment) })).sort((a, b) => b.score - a.score)
    const top = cand[0]
    return {
      text: [`Entre os canais de mídia paga, **${top.c.channel.name}** combina ROI alto (${percent(top.c.d.roi, 1)}) com participação ainda pequena no investimento (${percent(top.share * 100, 0)}), o que indica espaço para testar incrementos de verba.`, 'O ranking abaixo pondera ROI pela participação no orçamento (maior ROI e menor participação = mais espaço).'],
      bullets: cand.slice(0, 5).map((x) => `**${x.c.channel.name}** — ROI ${percent(x.c.d.roi, 1)}, ROAS ${ratio(x.c.d.roas)}, ${percent(x.share * 100, 0)} do investimento`),
      chart: { title: 'ROI por canal pago', kpi: 'roi', items: paid.sort((a, b) => (b.d.roi ?? 0) - (a.d.roi ?? 0)).map((c) => ({ id: c.channel.id, name: c.channel.name, value: c.d.roi, color: c.channel.color })) },
      caveat: 'Retornos tendem a diminuir conforme o investimento cresce. Use o Budget Simulator para projetar cenários e valide com aumentos graduais.',
      basis,
    }
  }

  // 7. Melhorar conversão
  if (has(q, 'taxa de conversao', 'melhorar conversao', 'melhorar minha conversao', 'converter mais', 'funil')) {
    const stages = [
      { l: 'Clique → visita', r: total.visitors / Math.max(1, total.clicks) * 100, b: 85 },
      { l: 'Visita → lead', r: total.leads / Math.max(1, total.visitors) * 100, b: 5 },
      { l: 'Lead → oportunidade', r: total.opportunities / Math.max(1, total.leads) * 100, b: 35 },
      { l: 'Oportunidade → cliente', r: total.customers / Math.max(1, total.opportunities) * 100, b: 30 },
    ].map((s) => ({ ...s, gap: ((s.r - s.b) / s.b) * 100 }))
    const weakest = [...stages].sort((a, b) => a.gap - b.gap)[0]
    const worstCh = chs.filter((c) => c.d.clicks > 1000 && c.d.convRate !== null).sort((a, b) => a.d.convRate! - b.d.convRate!).slice(0, 3)
    return {
      text: [`A taxa de conversão (clientes ÷ cliques) está em **${percent(total.convRate)}**${prev ? ` (${signedPct(prev.convRate && total.convRate ? ((total.convRate - prev.convRate) / prev.convRate) * 100 : null)} vs. período anterior)` : ''}. A etapa com menor folga sobre a referência é **${weakest.l}**: ${percent(weakest.r)} contra ${percent(weakest.b, 0)}.`],
      bullets: [
        ...stages.map((s) => `${s.l}: ${percent(s.r)} (referência ${percent(s.b, 0)}, ${signedPct(s.gap)})`),
        `Canais com menor conversão: ${worstCh.map((c) => `${c.channel.name} (${percent(c.d.convRate)})`).join(', ')}.`,
        weakest.l === 'Visita → lead' ? 'Ação sugerida: alinhar anúncio e landing page, reduzir campos do formulário e testar ofertas.' : weakest.l === 'Lead → oportunidade' ? 'Ação sugerida: lead scoring, SLA de contato rápido e nutrição por e-mail.' : weakest.l === 'Oportunidade → cliente' ? 'Ação sugerida: revisar motivos de perda no CRM e condições de fechamento.' : 'Ação sugerida: velocidade do site e qualidade do tráfego (cliques acidentais).',
      ],
      caveat: 'Detalhes por etapa e canal estão em Conversion Funnel.',
      basis,
    }
  }

  // 8. Pergunta sobre métrica de uma entidade
  if (metricWord) {
    const k = metricWord as KpiKey
    const scope = camp ? cs.find((s) => s.campaign.id === camp.id)?.d : ch ? chs.find((s) => s.channel.id === ch.id)?.d : total
    const name = camp?.name ?? ch?.name ?? 'a conta (todos os filtros atuais)'
    if (!scope) return { text: [`Não há dados de ${name} no período e filtros selecionados.`], basis }
    const v = getKpi(scope, k)
    return {
      text: [`${KPIS[k].label} de **${name}** no período: **${KPIS[k].fmt(v)}**${v === null ? ' — indisponível (sem base de cálculo, por exemplo sem investimento em mídia ou sem conversões).' : '.'} Média da conta: ${KPIS[k].fmt(getKpi(total, k))}.`],
      metrics: (['investment', 'revenue', 'customers', 'cac', 'roas', 'roi'] as KpiKey[]).filter((x) => x !== k).slice(0, 4).map((x) => ({ label: KPIS[x].short, value: (KPIS[x].fmtCompact ?? KPIS[x].fmt)(getKpi(scope, x)) })),
      chart: !camp && !ch ? { title: `${KPIS[k].label} por canal`, kpi: k, items: chs.map((c) => ({ id: c.channel.id, name: c.channel.name, value: getKpi(c.d, k), color: c.channel.color })).filter((x) => x.value !== null).sort((a, b) => (KPIS[k].better === false ? a.value! - b.value! : b.value! - a.value!)) } : undefined,
      caveat: KPIS[k].formula ? `Fórmula: ${KPIS[k].label} = ${KPIS[k].formula}.` : undefined,
      basis,
    }
  }

  // Resumo geral
  if (has(q, 'resumo', 'como estamos', 'visao geral', 'performance geral')) {
    return {
      text: [`No período, foram investidos ${money(total.investment)} e gerados ${money(total.revenue)} em receita atribuída, com ${num(total.customers)} novos clientes. CAC de ${money(total.cac)}, ROAS de ${ratio(total.roas)} e ROI de ${percent(total.roi, 1)}.`],
      bullets: insights.slice(0, 4).map((i) => `[${i.priority}] ${i.entity}: ${i.title}`),
      basis,
    }
  }

  return {
    text: ['Ainda não sei responder essa pergunta com os dados disponíveis — prefiro não inventar. Posso responder sobre campanhas, canais, CAC, ROAS, ROI, CPL, CTR, CPC, receita, leads, conversões, desperdício de orçamento, potencial de crescimento e funil.', 'Experimente uma das sugestões abaixo ou cite um canal/campanha pelo nome (ex.: "Qual o CPL do LinkedIn Ads?").'],
    basis,
  }
}
