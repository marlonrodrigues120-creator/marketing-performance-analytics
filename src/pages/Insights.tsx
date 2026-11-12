import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Bot, Copy, Download, FileText, Printer, Send, Sparkles, User } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Badge, Card, DemoBadge, EmptyState, PageHeader, Segmented, Tabs, toast } from '../components/ui'
import { InsightCard, RankBars } from '../components/widgets'
import { generateInsights, type Priority } from '../lib/insights'
import { answer, SUGGESTIONS, type AnalystAnswer, type AnalystCtx } from '../lib/analyst'
import { buildReport } from '../lib/report'
import { KPIS } from '../lib/kpis'
import { PageGuide } from '../components/didactic'
import { useSearchParams } from 'react-router-dom'

type Tab = 'insights' | 'analyst' | 'report'

export default function Insights() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') === 'analyst' || params.get('ask') ? 'analyst' : 'insights'))
  useEffect(() => { if (params.get('tab') === 'analyst' || params.get('ask')) setTab('analyst') }, [params])
  const a = useAnalytics()
  const { channels, settings } = useStore()
  const ctx: AnalystCtx = useMemo(() => ({ campaigns: a.campaigns, channels, rows: a.rows, prevRows: a.prevRows, dimRows: a.dimRows, start: a.range.start, end: a.range.end, settings }), [a, channels, settings])
  const insights = useMemo(() => generateInsights({ campaigns: a.campaigns, channels, rows: a.dimRows, start: a.range.start, end: a.range.end, settings }), [a, channels, settings])

  return (
    <>
      <PageHeader title="Insights e IA" description="Recomendações estratégicas geradas a partir dos indicadores filtrados. Nenhuma métrica é inventada: todo número vem dos dados da plataforma." badge={<DemoBadge />} />
      <PageGuide id="insights" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'insights', label: 'Insights automáticos', count: insights.length }, { value: 'analyst', label: 'AI Marketing Analyst' }, { value: 'report', label: 'AI Report Generator' }]} />
      {tab === 'insights' && <InsightList insights={insights} />}
      {tab === 'analyst' && <Analyst ctx={ctx} initial={params.get('ask') ?? undefined} />}
      {tab === 'report' && <Report ctx={ctx} />}
    </>
  )
}

function InsightList({ insights }: { insights: ReturnType<typeof generateInsights> }) {
  const [type, setType] = useState<'all' | 'problem' | 'opportunity'>('all')
  const [prio, setPrio] = useState<'all' | Priority>('all')
  const [rule, setRule] = useState('all')
  const rules = Array.from(new Set(insights.map((i) => i.rule)))
  const shown = insights.filter((i) => (type === 'all' || i.type === type) && (prio === 'all' || i.priority === prio) && (rule === 'all' || i.rule === rule))
  const count = (p: Priority) => insights.filter((i) => i.priority === p).length
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: 'Total de insights', v: insights.length, tone: 'text-slate-900 dark:text-slate-100' },
          { l: 'Prioridade alta', v: count('Alta'), tone: 'text-bad' },
          { l: 'Problemas', v: insights.filter((i) => i.type === 'problem').length, tone: 'text-amber-600' },
          { l: 'Oportunidades', v: insights.filter((i) => i.type === 'opportunity').length, tone: 'text-ai-500' },
        ].map((x) => (
          <div key={x.l} className="card p-4"><div className="text-xs muted">{x.l}</div><div className={clsx('mt-1 text-2xl font-semibold', x.tone)}>{x.v}</div></div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Todos' }, { value: 'problem', label: 'Problemas' }, { value: 'opportunity', label: 'Oportunidades' }]} />
        <Segmented value={prio} onChange={setPrio} options={[{ value: 'all', label: 'Qualquer prioridade' }, { value: 'Alta', label: 'Alta' }, { value: 'Média', label: 'Média' }, { value: 'Baixa', label: 'Baixa' }]} />
        <select className="input w-auto py-1.5 text-xs dark:[color-scheme:dark]" value={rule} onChange={(e) => setRule(e.target.value)} aria-label="Tipo de regra">
          <option value="all">Todas as regras</option>
          {rules.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {shown.length === 0 ? (
        <div className="card"><EmptyState icon={<Sparkles size={20} />} title="Nenhum insight para esta combinação" description="Os insights são recalculados a cada mudança de filtro." /></div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{shown.map((i) => <InsightCard key={i.id} i={i} />)}</div>
      )}
      <p className="mt-4 text-[11px] muted">Regras: CAC &gt; 140% da média do mesmo objetivo (com ROI &lt; 50%), ROAS abaixo da meta, alto investimento com conversão &lt; 40% da média, CPC +20% (7 dias vs. 28 anteriores), lead rate −25%, receita +25% vs. período anterior, diferença de ROAS ≥ 1,5x entre canais, variabilidade semanal do ROAS.</p>
    </>
  )
}

interface Msg {
  role: 'user' | 'assistant'
  text?: string
  a?: AnalystAnswer
}

function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) => (p.startsWith('**') ? <strong key={i} className="font-semibold text-slate-900 dark:text-white">{p.slice(2, -2)}</strong> : p))}</>
}

function Analyst({ ctx, initial }: { ctx: AnalystCtx; initial?: string }) {
  const { settings } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [thinking, setThinking] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [msgs, thinking])

  const ask = async (question: string) => {
    const text = question.trim()
    if (!text || thinking) return
    setMsgs((m) => [...m, { role: 'user', text }])
    setQ('')
    setThinking(true)
    let res: AnalystAnswer | null = null
    if (settings.integrations.apiBaseUrl) {
      try {
        const r = await fetch(`${settings.integrations.apiBaseUrl.replace(/\/$/, '')}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, start: ctx.start, end: ctx.end }), signal: AbortSignal.timeout(20000) })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        res = { text: [j.answer], basis: `Resposta da API (${j.model ?? 'OpenAI'}) com contexto calculado no backend.` }
      } catch (e) {
        toast.error(`Backend de IA indisponível (${(e as Error).message}). Usando o analista local.`)
      }
    } else {
      await new Promise((r) => setTimeout(r, 500))
    }
    res ??= answer(text, ctx)
    setMsgs((m) => [...m, { role: 'assistant', a: res! }])
    setThinking(false)
  }

  const asked = useRef<string | null>(null)
  useEffect(() => {
    if (initial && asked.current !== initial) {
      asked.current = initial
      ask(initial)
    }
  }, [initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(q)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <Card className="xl:col-span-3" bodyClass="!p-0" title={<span className="flex items-center gap-1.5"><Bot size={16} className="text-ai-500" /> AI Marketing Analyst</span>} subtitle="Pergunte em linguagem natural. As respostas usam apenas os indicadores dos filtros atuais." actions={<Badge tone={settings.integrations.apiBaseUrl ? 'green' : 'purple'}>{settings.integrations.apiBaseUrl ? 'OpenAI via backend' : 'Analista local (demo)'}</Badge>}>
        <div className="flex h-[620px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {msgs.length === 0 && (
              <div className="mx-auto max-w-lg py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ai-400 to-brand-500 text-white"><Sparkles size={22} /></div>
                <p className="font-medium">Como posso ajudar na análise?</p>
                <p className="mt-1 text-xs muted">Respondo com números reais da plataforma, mostro gráficos de apoio e indico quando uma conclusão seria só correlação.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.slice(0, 6).map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-ai-200 bg-ai-50 px-3 py-1.5 text-xs text-ai-700 transition hover:bg-ai-100 dark:border-ai-500/30 dark:bg-ai-500/10 dark:text-ai-200">{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={clsx('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' : 'bg-ai-500 text-white')}>{m.role === 'user' ? <User size={15} /> : <Sparkles size={15} />}</div>
                {m.role === 'user' ? (
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-sm text-white">{m.text}</div>
                ) : (
                  <AnswerView a={m.a!} />
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ai-500 text-white"><Sparkles size={15} /></div>
                <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-white/5">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-400" style={{ animationDelay: `${d * 120}ms` }} />)}<span className="ml-2 text-xs muted">consultando indicadores…</span></div>
              </div>
            )}
            <div ref={end} />
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 p-3 dark:border-white/10">
            <input className="input" placeholder="Ex.: Qual canal possui o menor CAC?" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} aria-label="Pergunta" />
            <button className="btn-ai" disabled={!q.trim() || thinking}><Send size={14} /> Perguntar</button>
          </form>
        </div>
      </Card>
      <Card title="Perguntas sugeridas">
        <div className="space-y-1.5">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} disabled={thinking} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition hover:border-ai-300 hover:bg-ai-50 dark:border-white/10 dark:hover:bg-ai-500/10">{s}</button>)}
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed muted dark:bg-white/5">
          <b className="text-slate-700 dark:text-slate-200">Como funciona:</b> nesta demo, um analista determinístico interpreta a pergunta e calcula a resposta sobre os dados filtrados. Com o backend configurado (Settings → Integrações), a pergunta vai para <code>/api/ai/ask</code>, que envia à OpenAI apenas os agregados calculados em SQL — a chave fica no servidor.
        </div>
      </Card>
    </div>
  )
}

function AnswerView({ a }: { a: AnalystAnswer }) {
  return (
    <div className="max-w-[88%] space-y-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
      {a.text.map((t, i) => <p key={i}><Md text={t} /></p>)}
      {a.metrics && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {a.metrics.map((m) => <div key={m.label} className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/5"><div className="text-[10px] muted">{m.label}</div><div className={clsx('text-xs font-semibold tabular-nums', m.tone === 'good' && 'text-good-ink dark:text-good', m.tone === 'bad' && 'text-bad')}>{m.value}</div></div>)}
        </div>
      )}
      {a.bullets && <ul className="space-y-1">{a.bullets.map((b, i) => <li key={i} className="flex gap-2 text-xs"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ai-500" /><span><Md text={b} /></span></li>)}</ul>}
      {a.chart && (
        <div className="rounded-lg border border-slate-100 p-2 dark:border-white/5">
          <div className="mb-1 text-xs font-medium">{a.chart.title}</div>
          <RankBars items={a.chart.items} fmt={KPIS[a.chart.kpi].fmtCompact ?? KPIS[a.chart.kpi].fmt} colorByEntity />
        </div>
      )}
      {a.caveat && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{a.caveat}</p>}
      <p className="text-[10px] muted">{a.basis}</p>
    </div>
  )
}

function Report({ ctx }: { ctx: AnalystCtx }) {
  const [rep, setRep] = useState<ReturnType<typeof buildReport> | null>(null)
  const [loading, setLoading] = useState(false)
  const gen = () => {
    setLoading(true)
    setTimeout(() => {
      setRep(buildReport(ctx))
      setLoading(false)
    }, 600)
  }
  const download = () => {
    if (!rep) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rep.markdown], { type: 'text/markdown;charset=utf-8' }))
    a.download = `relatorio_marketing_${ctx.start}_${ctx.end}.md`
    a.click()
  }
  const print = () => {
    if (!rep) return
    const w = window.open('', '_blank')
    if (!w) return toast.error('Permita pop-ups para imprimir/salvar em PDF.')
    w.document.write(`<html><head><title>${rep.title}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;color:#0b0b0b;line-height:1.55}h1{font-size:22px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}li{font-size:13px;margin:4px 0}.n{color:#777;font-size:11px}</style></head><body><h1>${rep.title}</h1><p class="n">Dados demonstrativos (fictícios) · gerado pela plataforma Marketing Performance Analytics</p>${rep.sections.map((s) => `<h2>${s.title}</h2><ul>${s.lines.map((l) => `<li>${l}</li>`).join('')}</ul>`).join('')}</body></html>`)
    w.document.close()
    w.print()
  }
  let body: ReactNode
  if (!ctx.rows.length) body = <EmptyState title="Sem dados para gerar o relatório" />
  else if (!rep) body = <EmptyState icon={<FileText size={20} />} title="Gere um relatório executivo do período" description="Resumo de performance, principais resultados, campanhas de destaque, problemas e recomendações — tudo calculado a partir dos filtros atuais." action={<button className="btn-ai" onClick={gen} disabled={loading}><Sparkles size={14} /> {loading ? 'Gerando…' : 'Gerar relatório'}</button>} />
  else
    body = (
      <article className="mx-auto max-w-3xl">
        <h2 className="text-lg font-semibold">{rep.title}</h2>
        <p className="mt-1 text-xs muted">Dados demonstrativos (fictícios) · atribuição {ctx.settings.attributionModel} · sem métricas externas</p>
        {rep.sections.map((s) => (
          <section key={s.title} className="mt-5">
            <h3 className="border-b border-slate-100 pb-1 text-sm font-semibold dark:border-white/10">{s.title}</h3>
            <ul className="mt-2 space-y-1.5 text-sm">{(s.lines.length ? s.lines : ['Nada a destacar no período.']).map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ai-500" />{l}</li>)}</ul>
          </section>
        ))}
      </article>
    )
  return (
    <Card title={<span className="flex items-center gap-1.5"><FileText size={15} className="text-ai-500" /> AI Report Generator</span>} subtitle="Relatório executivo automático do período filtrado" actions={rep && <><button className="btn-secondary btn-sm" onClick={gen}><Sparkles size={13} /> Regerar</button><button className="btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(rep.markdown).then(() => toast.success('Relatório copiado.'))}><Copy size={13} /> Copiar</button><button className="btn-secondary btn-sm" onClick={download}><Download size={13} /> Markdown</button><button className="btn-secondary btn-sm" onClick={print}><Printer size={13} /> Imprimir / PDF</button></>}>
      {body}
    </Card>
  )
}
