import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, ArrowDown, CheckCircle2 } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Badge, Card, DemoBadge, EmptyState, InfoTip, PageHeader } from '../components/ui'
import { useChartTheme } from '../components/charts'
import { sum } from '../lib/metrics'
import type { Totals } from '../data/types'
import { num, percent, signedPct } from '../lib/format'
import { groupBy } from '../lib/metrics'
import { PageGuide } from '../components/didactic'

const STAGES = [
  { key: 'impressions', label: 'Impressions', pt: 'Impressões' },
  { key: 'clicks', label: 'Clicks', pt: 'Cliques' },
  { key: 'visitors', label: 'Visitors', pt: 'Visitantes' },
  { key: 'leads', label: 'Leads', pt: 'Leads' },
  { key: 'opportunities', label: 'Opportunities', pt: 'Oportunidades' },
  { key: 'customers', label: 'Customers', pt: 'Clientes' },
] as const
type StageKey = (typeof STAGES)[number]['key']

/** Referências de mercado usadas para detectar gargalos (ajuste conforme o negócio). */
const BENCH: Record<Exclude<StageKey, 'impressions'>, { rate: number; label: string; tips: string[] }> = {
  clicks: { rate: 1.2, label: 'CTR', tips: ['Teste novos criativos e chamadas (CTA) com foco no benefício.', 'Refine segmentação e palavras-chave negativas para reduzir impressões irrelevantes.', 'Use extensões de anúncio e formatos nativos (Reels, Shopping).'] },
  visitors: { rate: 85, label: 'Clique → visita', tips: ['Reduza o tempo de carregamento da página (meta < 2,5s LCP).', 'Verifique redirecionamentos e a marcação UTM/tracking.', 'Revise cliques acidentais em posicionamentos de display/app.'] },
  leads: { rate: 5, label: 'Visita → lead', tips: ['Alinhe a promessa do anúncio com o título da landing page.', 'Simplifique o formulário (menos campos, autopreenchimento).', 'Adicione prova social e uma oferta de conversão clara acima da dobra.'] },
  opportunities: { rate: 35, label: 'Lead → oportunidade', tips: ['Implemente lead scoring e SLA de contato em até 1 hora.', 'Crie fluxos de nutrição por e-mail segmentados por interesse.', 'Revise critérios de qualificação junto ao time comercial.'] },
  customers: { rate: 30, label: 'Oportunidade → cliente', tips: ['Analise motivos de perda no CRM e ajuste a proposta.', 'Ofereça condições de fechamento (teste, desconto por prazo).', 'Acompanhe o ciclo de vendas e follow-ups pendentes.'] },
}

function rates(t: Totals) {
  return STAGES.map((s, i) => {
    const v = t[s.key]
    const prev = i > 0 ? t[STAGES[i - 1].key] : null
    const rate = prev ? (v / prev) * 100 : null
    return { ...s, v, rate, loss: rate === null ? null : 100 - rate, cumulative: t.impressions ? (v / t.impressions) * 100 : null }
  })
}

export default function Funnel() {
  const a = useAnalytics()
  const { channels } = useStore()
  const t = useChartTheme()
  const [scope, setScope] = useState('all')

  const scopedRows = useMemo(() => {
    if (scope === 'all') return { cur: a.rows, prev: a.prevRows }
    const [kind, id] = scope.split(':')
    const ids = new Set(a.campaigns.filter((c) => (kind === 'ch' ? c.channelId === id : c.id === id)).map((c) => c.id))
    return { cur: a.rows.filter((r) => ids.has(r.campaignId)), prev: a.prevRows.filter((r) => ids.has(r.campaignId)) }
  }, [scope, a])

  const cur = rates(sum(scopedRows.cur))
  const prev = scopedRows.prev.length ? rates(sum(scopedRows.prev)) : null

  const diagnostics = cur.slice(1).map((s, i) => {
    const b = BENCH[s.key as Exclude<StageKey, 'impressions'>]
    const p = prev?.[i + 1]
    const gap = s.rate === null ? null : ((s.rate - b.rate) / b.rate) * 100
    const trend = s.rate !== null && p?.rate ? ((s.rate - p.rate) / p.rate) * 100 : null
    return { ...s, bench: b, gap, trend }
  })
  const bottlenecks = diagnostics.filter((d) => d.gap !== null && (d.gap < -15 || (d.trend !== null && d.trend < -10))).sort((x, y) => (x.gap ?? 0) - (y.gap ?? 0))
  const weakest = [...diagnostics].filter((d) => d.gap !== null).sort((x, y) => x.gap! - y.gap!)[0]

  const byChannel = useMemo(() => {
    const ids = new Map(a.campaigns.map((c) => [c.id, c.channelId]))
    const g = groupBy(a.rows, (r) => ids.get(r.campaignId) ?? '')
    return channels.filter((c) => g.has(c.id)).map((c) => ({ ch: c, r: rates(sum(g.get(c.id)!)) }))
  }, [a, channels])

  if (!a.rows.length) return <><PageHeader title="Funil de conversão" /><div className="card"><EmptyState title="Sem dados para os filtros selecionados" /></div></>

  const max = Math.log10(Math.max(10, cur[0].v))
  return (
    <>
      <PageHeader
        title="Funil de conversão"
        description="Funil de aquisição da impressão ao cliente. Os gargalos são detectados comparando cada taxa com referências de mercado e com o período anterior."
        badge={<DemoBadge />}
        actions={
          <select className="input w-auto text-xs dark:[color-scheme:dark]" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Escopo do funil">
            <option value="all">Todos os canais e campanhas (filtros globais)</option>
            <optgroup label="Por canal">{a.channels.map((c) => <option key={c.id} value={`ch:${c.id}`}>{c.name}</option>)}</optgroup>
            <optgroup label="Por campanha">{a.campaigns.map((c) => <option key={c.id} value={`cp:${c.id}`}>{c.name}</option>)}</optgroup>
          </select>
        }
      />
      <PageGuide id="funnel" />
      {!scopedRows.cur.length ? (
        <div className="card"><EmptyState title="Sem dados para este escopo no período" /></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3" title="Funil de conversão" subtitle="Largura das barras em escala logarítmica — os volumes variam de milhões a centenas">
            <div className="space-y-1.5 py-2">
              {cur.map((s, i) => {
                const w = Math.max(12, (Math.log10(Math.max(1, s.v)) / max) * 100)
                const isBottleneck = bottlenecks[0]?.key === s.key
                return (
                  <div key={s.key}>
                    {i > 0 && (
                      <div className="flex items-center justify-center gap-2 py-0.5 text-[11px] muted">
                        <ArrowDown size={11} />
                        <span className={clsx('font-medium', isBottleneck && 'text-bad')}>{percent(s.rate)} avançam</span>
                        <span>· perda de {percent(s.loss, 1)}</span>
                      </div>
                    )}
                    <div className="flex justify-center">
                      <div className={clsx('relative flex h-11 items-center justify-between rounded-lg px-3 text-white transition-all duration-500', isBottleneck && 'ring-2 ring-bad ring-offset-2 dark:ring-offset-[#0d1430]')} style={{ width: `${w}%`, background: t.dark ? ['#3987e5', '#2f78d4', '#2a6bbf', '#2a5fa8', '#6250d6', '#4f3fc0'][i] : ['#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#6250d6', '#41339f'][i] }}>
                        <span className="truncate text-xs font-medium">{s.label}</span>
                        <span className="text-sm font-semibold tabular-nums">{num(s.v, { compact: true })}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-center text-xs muted">Conversão total impressão → cliente: <span className="font-semibold text-slate-700 dark:text-slate-200">{percent(cur[5].cumulative, 4)}</span> · clique → cliente: <span className="font-semibold text-slate-700 dark:text-slate-200">{percent(cur[1].v ? (cur[5].v / cur[1].v) * 100 : null)}</span></p>
          </Card>
          <Card className="xl:col-span-2" title={<span className="flex items-center gap-1.5"><AlertTriangle size={15} className="text-bad" /> Gargalos identificados</span>} subtitle="Etapas abaixo da referência em mais de 15% ou com queda > 10% vs. período anterior">
            {bottlenecks.length === 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> Nenhuma etapa abaixo das referências no período.</div>
                {weakest && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <div className="text-sm font-semibold">Ponto de atenção: {weakest.bench.label}</div>
                    <p className="mt-1 text-xs muted">Menor folga sobre a referência: {percent(weakest.rate)} vs. {percent(weakest.bench.rate, 1)} ({signedPct(weakest.gap)}). Recomendações para melhorar a taxa:</p>
                    <ul className="mt-2 space-y-1 text-xs">{weakest.bench.tips.map((tip) => <li key={tip} className="flex gap-1.5"><span className="text-ai-500">•</span>{tip}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {bottlenecks.slice(0, 3).map((b, i) => (
                  <div key={b.key} className={clsx('rounded-lg border p-3', i === 0 ? 'border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10' : 'border-slate-200 dark:border-white/10')}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{b.bench.label}</span>
                      {i === 0 && <Badge tone="red">Principal gargalo</Badge>}
                    </div>
                    <p className="mt-1 text-xs muted">
                      Taxa de {percent(b.rate)} vs. referência de {percent(b.bench.rate, 1)} ({signedPct(b.gap)}){b.trend !== null && <> · {signedPct(b.trend)} vs. período anterior</>}.
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {b.bench.tips.map((tip) => <li key={tip} className="flex gap-1.5"><span className="text-ai-500">•</span>{tip}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="xl:col-span-5" title="Etapas do funil" subtitle={prev ? 'Comparação com o período anterior equivalente' : 'Sem período anterior disponível para comparação'}>
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    {['Etapa', 'Volume', 'Período anterior', 'Variação', 'Taxa de conversão', 'Perda', 'Taxa anterior', 'Referência'].map((h, i) => <th key={h} className={clsx('th', i === 0 ? 'pl-5' : 'text-right', i === 7 && 'pr-5')}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {cur.map((s, i) => {
                    const p = prev?.[i]
                    const dv = p && p.v ? ((s.v - p.v) / p.v) * 100 : null
                    const d = diagnostics[i - 1]
                    return (
                      <tr key={s.key} className="border-b border-slate-50 dark:border-white/5">
                        <td className="td pl-5 font-medium">{s.label} <span className="font-normal muted">· {s.pt}</span></td>
                        <td className="td text-right font-semibold">{num(s.v)}</td>
                        <td className="td text-right muted">{num(p?.v)}</td>
                        <td className={clsx('td text-right', dv !== null && (dv >= 0 ? 'text-good-ink dark:text-good' : 'text-bad'))}>{signedPct(dv)}</td>
                        <td className="td text-right">{percent(s.rate)}</td>
                        <td className="td text-right">{percent(s.loss, 1)}</td>
                        <td className="td text-right muted">{percent(p?.rate)}</td>
                        <td className="td pr-5 text-right">{d ? <span className={clsx(d.gap !== null && d.gap < -15 ? 'text-bad' : 'text-good-ink dark:text-good')}>{percent(d.bench.rate, 1)}</span> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="xl:col-span-5" title={<span className="flex items-center gap-1.5">Taxas por etapa e canal <InfoTip text="Cada célula mostra a taxa de conversão da etapa anterior para a coluna. Vermelho: abaixo da referência de mercado em mais de 15%." /></span>} subtitle="Identifique em qual etapa cada canal perde mais volume">
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="th pl-5">Canal</th>
                    {STAGES.slice(1).map((s) => <th key={s.key} className="th text-right">{BENCH[s.key as Exclude<StageKey, 'impressions'>].label}</th>)}
                    <th className="th pr-5 text-right">Clique → cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {byChannel.map(({ ch, r }) => (
                    <tr key={ch.id} className="border-b border-slate-50 dark:border-white/5">
                      <td className="td pl-5 font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: ch.color }} />{ch.name}</td>
                      {r.slice(1).map((s) => {
                        const b = BENCH[s.key as Exclude<StageKey, 'impressions'>].rate
                        const bad = s.rate !== null && s.rate < b * 0.85
                        return <td key={s.key} className={clsx('td text-right', bad ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : '')}>{percent(s.rate)}</td>
                      })}
                      <td className="td pr-5 text-right font-medium">{percent(r[1].v ? (r[5].v / r[1].v) * 100 : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
