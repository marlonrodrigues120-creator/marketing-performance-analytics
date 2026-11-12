import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { FlaskConical, Info, Lock, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Badge, Card, EmptyState, Field, InfoTip, Modal, PageHeader, toast } from '../components/ui'
import { Legend, makeTip, useChartTheme } from '../components/charts'
import { derive, sum } from '../lib/metrics'
import { addDays, between, channelStats } from '../lib/query'
import { money, num, percent, ratio, signedPct } from '../lib/format'

interface Proj {
  spend: number
  leads: number
  customers: number
  revenue: number
  other: number
}

export default function Simulator() {
  const { campaigns, channels, metrics, dataEnd, settings, scenarios, saveScenario, deleteScenario, can } = useStore()
  const t = useChartTheme()
  const start = addDays(dataEnd, -29)
  const base = useMemo(() => {
    const rows = between(metrics, start, dataEnd)
    const stats = channelStats(campaigns, channels, rows, settings.grossMargin)
    const paid = stats.filter((s) => s.d.mediaSpend > 0)
    const fixed = stats.filter((s) => s.d.mediaSpend === 0)
    return { paid, fixed, total: derive(sum(rows), settings.grossMargin) }
  }, [metrics, campaigns, channels, start, dataEnd, settings.grossMargin])

  const baseAlloc = useMemo(() => Object.fromEntries(base.paid.map((s) => [s.channel.id, Math.round(s.d.mediaSpend)])), [base])
  const baseTotal = Object.values(baseAlloc).reduce((a, b) => a + b, 0)
  const [alloc, setAlloc] = useState<Record<string, number>>(baseAlloc)
  const [beta, setBeta] = useState(0.75)
  const [name, setName] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const total = Object.values(alloc).reduce((a, b) => a + b, 0)

  const project = (al: Record<string, number>) => {
    const per = base.paid.map((s) => {
      const s0 = s.d.mediaSpend
      const s1 = al[s.channel.id] ?? s0
      const f = s0 > 0 ? Math.pow(Math.max(0, s1) / s0, beta) : 0
      // custos não-mídia variam proporcionalmente à mídia (produção de criativos, fee de agência)
      return { id: s.channel.id, name: s.channel.name, color: s.channel.color, base: s.d, p: { spend: s1, leads: s.d.leads * f, customers: s.d.customers * f, revenue: s.d.revenue * f, other: s.d.otherCost * (s0 > 0 ? s1 / s0 : 0) } as Proj }
    })
    const fx = base.fixed.reduce((acc, s) => ({ leads: acc.leads + s.d.leads, customers: acc.customers + s.d.customers, revenue: acc.revenue + s.d.revenue, other: acc.other + s.d.otherCost }), { leads: 0, customers: 0, revenue: 0, other: 0 })
    const tot = per.reduce((acc, x) => ({ spend: acc.spend + x.p.spend, leads: acc.leads + x.p.leads, customers: acc.customers + x.p.customers, revenue: acc.revenue + x.p.revenue, other: acc.other + x.p.other }), { spend: 0, ...fx })
    const inv = tot.spend + tot.other
    return {
      per,
      tot: { ...tot, inv, cac: tot.customers ? inv / tot.customers : null, cpl: tot.leads ? inv / tot.leads : null, roas: tot.spend ? (tot.revenue - fx.revenue) / tot.spend : null, roasAll: tot.spend ? tot.revenue / tot.spend : null, roi: inv ? ((tot.revenue * settings.grossMargin - inv) / inv) * 100 : null },
    }
  }
  const proj = project(alloc)
  const real = project(baseAlloc)

  const setTotal = (v: number) => {
    if (!isFinite(v) || v < 0) return
    const f = baseTotal ? v / (total || baseTotal) : 0
    setAlloc(Object.fromEntries(Object.entries(total ? alloc : baseAlloc).map(([k, x]) => [k, Math.round(x * f)])))
  }
  const optimize = () => {
    // realocação gulosa: move verba em passos de 2% do pior para o melhor ROAS marginal mantendo o total
    const al = { ...alloc }
    const step = total * 0.02
    for (let i = 0; i < 40; i++) {
      const marg = base.paid.map((s) => {
        const s0 = s.d.mediaSpend
        const s1 = al[s.channel.id]
        const r = (x: number) => s.d.revenue * Math.pow(Math.max(0, x) / s0, beta)
        return { id: s.channel.id, gain: r(s1 + step) - r(s1), loss: s1 >= step ? r(s1) - r(s1 - step) : Infinity }
      })
      const best = marg.reduce((a, b) => (b.gain > a.gain ? b : a))
      const worst = marg.filter((m) => m.id !== best.id).reduce((a, b) => (b.loss < a.loss ? b : a))
      if (best.gain <= worst.loss * 1.02) break
      al[best.id] += step
      al[worst.id] -= step
    }
    setAlloc(Object.fromEntries(Object.entries(al).map(([k, v]) => [k, Math.round(v)])))
    toast.info('Sugestão aplicada ao cenário (somente simulação).')
  }

  const cmpScenarios = scenarios.map((s) => ({ s, r: project(s.allocation).tot }))
  const kpi = (label: string, cur: number | null, ref: number | null, fmt: (v: number | null) => string, better: boolean) => {
    const d = cur !== null && ref ? ((cur - ref) / Math.abs(ref)) * 100 : null
    const good = d === null || Math.abs(d) < 0.5 ? null : (d > 0) === better
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between text-xs muted">{label}<Badge tone="purple">Projeção</Badge></div>
        <div className="mt-1 text-xl font-semibold">{fmt(cur)}</div>
        <div className="mt-0.5 text-xs"><span className={clsx('font-medium', good === true && 'text-good-ink dark:text-good', good === false && 'text-bad')}>{signedPct(d)}</span> <span className="muted">vs. real {fmt(ref)}</span></div>
      </div>
    )
  }

  if (!base.paid.length) return <><PageHeader title="Simulador de orçamento" /><div className="card"><EmptyState title="Sem canais pagos nos últimos 30 dias" /></div></>

  return (
    <>
      <PageHeader
        title="Simulador de orçamento"
        description={<>Simule a redistribuição de mídia entre canais pagos. Base: resultados <b>reais</b> dos últimos 30 dias. Resultados simulados são <b>projeções</b> com retornos decrescentes, não resultados reais.</>}
        badge={<Badge tone="purple" icon={<FlaskConical size={11} />}>Simulação</Badge>}
        actions={<><button className="btn-secondary" onClick={() => setAlloc(baseAlloc)}><RotateCcw size={14} /> Restaurar real</button><button className="btn-ai" onClick={optimize}>Sugerir redistribuição</button><button className="btn-primary" onClick={() => setApplyOpen(true)}><Lock size={14} /> Aplicar nas plataformas</button></>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpi('Investimento total', proj.tot.inv, real.tot.inv, (v) => money(v, { compact: true }), false)}
        {kpi('Leads', proj.tot.leads, real.tot.leads, (v) => num(v), true)}
        {kpi('Conversões', proj.tot.customers, real.tot.customers, (v) => num(v), true)}
        {kpi('CAC', proj.tot.cac, real.tot.cac, money, false)}
        {kpi('ROAS (canais pagos)', proj.tot.roas, real.tot.roas, ratio, true)}
        {kpi('ROI', proj.tot.roi, real.tot.roi, (v) => percent(v, 1), true)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Orçamento de mídia (30 dias)" subtitle={`Real: ${money(baseTotal)} · canais orgânicos mantidos constantes`}>
          <Field label="Orçamento total de mídia" hint={`${signedPct(baseTotal ? ((total - baseTotal) / baseTotal) * 100 : null)} vs. real — ajusta todos os canais proporcionalmente`}>
            <input type="number" min={0} step={1000} className="input" value={Math.round(total)} onChange={(e) => setTotal(Number(e.target.value))} />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[-20, -10, 10, 20, 50].map((p) => <button key={p} className="btn-secondary btn-sm" onClick={() => setTotal(total * (1 + p / 100))}>{p > 0 ? '+' : ''}{p}%</button>)}
          </div>
          <div className="mt-4 space-y-4">
            {base.paid.map((s) => {
              const v = alloc[s.channel.id] ?? 0
              const d = s.d.mediaSpend ? ((v - s.d.mediaSpend) / s.d.mediaSpend) * 100 : 0
              return (
                <div key={s.channel.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium"><span className="h-2 w-2 rounded-sm" style={{ background: s.channel.color }} />{s.channel.name}<span className="font-normal muted">ROAS real {ratio(s.d.roas)}</span></span>
                    <span className={clsx('tabular-nums', d > 0.5 ? 'text-brand-600 dark:text-brand-300' : d < -0.5 ? 'text-amber-600' : 'muted')}>{signedPct(d, 0)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="range" min={0} max={Math.round(s.d.mediaSpend * 3)} step={100} value={v} onChange={(e) => setAlloc({ ...alloc, [s.channel.id]: Number(e.target.value) })} className="w-full accent-brand-500" aria-label={`Investimento ${s.channel.name}`} />
                    <input type="number" min={0} className="input w-28 py-1 text-xs" value={v} onChange={(e) => setAlloc({ ...alloc, [s.channel.id]: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Valor ${s.channel.name}`} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5">
            <div className="flex items-center gap-1.5 font-medium">Elasticidade (β) <InfoTip text="Resultado projetado = resultado real × (novo investimento ÷ investimento real)^β. β < 1 representa retornos decrescentes: dobrar a verba não dobra os resultados. Ajuste conforme testes de incrementalidade." /></div>
            <div className="mt-1 flex items-center gap-2">
              <input type="range" min={0.4} max={1} step={0.05} value={beta} onChange={(e) => setBeta(Number(e.target.value))} className="w-full accent-ai-500" aria-label="Elasticidade" />
              <span className="w-10 text-right font-semibold tabular-nums">{beta.toFixed(2)}</span>
            </div>
          </div>
        </Card>
        <Card className="xl:col-span-3" title="Real vs. projetado por canal">
          <Legend items={[{ label: 'Real (últimos 30 dias)', color: t.muted }, { label: 'Projeção', color: t.ai }]} />
          {(['spend', 'leads', 'customers'] as const).map((k) => (
            <div key={k} className="mt-2">
              <div className="text-xs font-medium">{k === 'spend' ? 'Investimento em mídia' : k === 'leads' ? 'Leads' : 'Conversões'}</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={proj.per.map((x) => ({ name: x.name.replace(' Ads', ''), real: k === 'spend' ? x.base.mediaSpend : k === 'leads' ? x.base.leads : x.base.customers, proj: x.p[k] }))} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid stroke={t.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={{ stroke: t.axis }} tickLine={false} interval={0} />
                  <YAxis tick={t.tick} axisLine={false} tickLine={false} width={76} tickFormatter={(v) => (k === 'spend' ? money(v, { compact: true }) : num(v, { compact: true }))} />
                  <Tooltip cursor={{ fill: t.cursor }} content={makeTip((_k, v) => (k === 'spend' ? money(v) : num(v)))} />
                  <Bar dataKey="real" name="Real" fill={t.muted} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="proj" name="Projeção" fill={t.ai} radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </Card>
      </div>

      <Card className="mt-4" title="Cenários salvos" subtitle="Compare CAC, ROAS e volume projetados entre cenários" actions={
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return toast.error('Dê um nome ao cenário.'); saveScenario({ name: name.trim(), total, allocation: alloc }); setName(''); toast.success('Cenário salvo.') }}>
          <input className="input w-48 py-1.5 text-xs" placeholder="Nome do cenário" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <button className="btn-primary btn-sm"><Save size={13} /> Salvar atual</button>
        </form>
      }>
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                {['Cenário', 'Mídia', 'Investimento total', 'Leads', 'Conversões', 'CAC', 'CPL', 'ROAS pagos', 'ROI', ''].map((h, i) => <th key={i} className={clsx('th', i === 0 ? 'pl-5' : 'text-right', i === 9 && 'pr-5')}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[{ s: { id: 'real', name: 'Real (últimos 30 dias)', total: baseTotal }, r: real.tot, real: true }, { s: { id: 'cur', name: 'Cenário em edição', total }, r: proj.tot, real: false }, ...cmpScenarios.map((x) => ({ ...x, real: false }))].map(({ s, r, real: isReal }) => (
                <tr key={s.id} className="border-b border-slate-50 dark:border-white/5">
                  <td className="td pl-5 font-medium">{s.name} {isReal ? <Badge tone="green">Real</Badge> : <Badge tone="purple">Projeção</Badge>}</td>
                  <td className="td text-right">{money(s.total)}</td>
                  <td className="td text-right">{money(r.inv)}</td>
                  <td className="td text-right">{num(r.leads)}</td>
                  <td className="td text-right">{num(r.customers)}</td>
                  <td className="td text-right">{money(r.cac)}</td>
                  <td className="td text-right">{money(r.cpl)}</td>
                  <td className="td text-right">{ratio(r.roas)}</td>
                  <td className="td text-right">{percent(r.roi, 1)}</td>
                  <td className="td pr-5 text-right">
                    {!['real', 'cur'].includes(s.id) && (
                      <span className="flex justify-end gap-1">
                        <button className="btn-ghost btn-sm" onClick={() => setAlloc((scenarios.find((x) => x.id === s.id)!).allocation)}>Carregar</button>
                        <button className="btn-ghost btn-sm text-bad" onClick={() => deleteScenario(s.id)} aria-label="Excluir cenário"><Trash2 size={13} /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] muted"><Info size={12} className="mt-0.5 shrink-0" /> ROAS dos canais pagos considera apenas a receita atribuída aos canais com mídia. Projeções assumem que a eficiência por canal segue a curva de retornos decrescentes definida pela elasticidade.</p>
      </Card>

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Aplicar orçamento nas plataformas" footer={<><button className="btn-secondary" onClick={() => setApplyOpen(false)}>Fechar</button><button className="btn-primary" disabled title="Requer integração autorizada">Confirmar alterações</button></>}>
        <div className="space-y-3 text-sm">
          <p>O simulador <b>nunca altera orçamentos automaticamente</b>. Para enviar este cenário às plataformas de anúncios é necessário:</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li>Conectar a integração autorizada (Google Ads API / Meta Marketing API) em <b>Settings → Integrações</b>, via OAuth no backend.</li>
            <li>Um usuário com perfil <b>Administrador</b> revisar o diff por campanha.</li>
            <li>Confirmar explicitamente a alteração — o backend registra quem aprovou e o valor anterior para rollback.</li>
          </ol>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Status: integração com plataformas de anúncios <b>não configurada</b>. {can('admin') ? '' : 'Seu perfil também não tem permissão para aplicar.'}
          </div>
          <div className="text-xs">
            <div className="mb-1 font-medium">Alterações que seriam enviadas</div>
            {proj.per.filter((x) => Math.abs(x.p.spend - x.base.mediaSpend) > 1).map((x) => <div key={x.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-white/5"><span>{x.name}</span><span className="tabular-nums">{money(x.base.mediaSpend)} → <b>{money(x.p.spend)}</b></span></div>)}
            {proj.per.every((x) => Math.abs(x.p.spend - x.base.mediaSpend) <= 1) && <p className="muted">Nenhuma alteração em relação ao real.</p>}
          </div>
        </div>
      </Modal>
    </>
  )
}
