import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, KeyRound, Loader2, Plug, RotateCcw, Save, Shield, Target, Users } from 'lucide-react'
import { useStore } from '../store/AppStore'
import type { ScoreMetric, Settings as S } from '../store/settings'
import { Badge, Card, Field, Modal, PageHeader, Tabs, toast } from '../components/ui'
import { SCORE_LABELS } from '../lib/score'
import type { Objective } from '../data/types'

type Tab = 'rules' | 'score' | 'integrations' | 'users' | 'data'

export default function Settings() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>(() => (location.hash.includes('#score') ? 'score' : location.hash.includes('#integrations') ? 'integrations' : 'rules'))
  const [draft, setDraft] = useState<S>(s.settings)
  const [resetOpen, setResetOpen] = useState(false)
  useEffect(() => { setDraft(s.settings) }, [s.settings])
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.settings)
  const admin = s.can('admin')

  const num = (v: string) => (v === '' ? NaN : Number(v))
  const errors: Record<string, string> = {}
  if (!(draft.grossMargin > 0 && draft.grossMargin <= 1)) errors.grossMargin = 'Entre 1% e 100%.'
  if (!(draft.roasTarget > 0)) errors.roasTarget = 'Maior que zero.'
  if (!(draft.cacLimit > 0)) errors.cacLimit = 'Maior que zero.'
  if (!(draft.cplLimit > 0)) errors.cplLimit = 'Maior que zero.'
  if (!(draft.convRateMin >= 0 && draft.convRateMin <= 100)) errors.convRateMin = 'Entre 0 e 100.'
  if (!(draft.budgetAlertPct > 0 && draft.budgetAlertPct <= 200)) errors.budgetAlertPct = 'Entre 1 e 200.'
  if (!(draft.monthlyRevenueGoal >= 0)) errors.monthlyRevenueGoal = 'Valor inválido.'
  if (draft.integrations.apiBaseUrl && !/^https?:\/\/.+/.test(draft.integrations.apiBaseUrl)) errors.api = 'Use uma URL http(s) válida.'
  for (const o of Object.keys(draft.scoreWeights) as Objective[]) {
    const tot = Object.values(draft.scoreWeights[o]).reduce((a, b) => a + (b || 0), 0)
    if (tot <= 0) errors[`w-${o}`] = 'A soma dos pesos deve ser maior que zero.'
  }
  const valid = Object.keys(errors).length === 0

  const saveAll = () => {
    if (!admin) return toast.error('Apenas administradores alteram configurações.')
    if (!valid) return toast.error('Corrija os campos destacados.')
    s.updateSettings(draft)
    toast.success('Configurações salvas. Indicadores, scores e insights foram recalculados.')
  }

  return (
    <>
      <PageHeader title="Settings" description="Configurações gerais, metas usadas por insights/alertas/score e integrações." actions={<>{dirty && <Badge tone="blue">Alterações não salvas</Badge>}<button className="btn-secondary" disabled={!dirty} onClick={() => setDraft(s.settings)}>Descartar</button><button className="btn-primary" disabled={!dirty || !valid || !admin} onClick={saveAll}><Save size={14} /> Salvar</button></>} />
      {!admin && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Você está com perfil <b>{s.user?.role === 'analyst' ? 'Analista' : 'Leitura'}</b>: pode visualizar, mas somente administradores alteram configurações.</p>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'rules', label: 'Metas e regras de negócio' }, { value: 'score', label: 'Campaign Score' }, { value: 'integrations', label: 'Integrações' }, { value: 'users', label: 'Usuários e acesso' }, { value: 'data', label: 'Dados' }]} />

      {tab === 'rules' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-1.5"><Target size={15} /> Metas e limites</span>} subtitle="Usados nas linhas de referência dos gráficos, nos insights e como padrão dos gatilhos">
            <fieldset disabled={!admin} className="grid gap-3 sm:grid-cols-2">
              <Field label="Meta de ROAS (x)" error={errors.roasTarget}><input className="input" type="number" step="0.1" value={draft.roasTarget} onChange={(e) => setDraft({ ...draft, roasTarget: num(e.target.value) })} /></Field>
              <Field label="Limite de CAC (R$)" error={errors.cacLimit}><input className="input" type="number" value={draft.cacLimit} onChange={(e) => setDraft({ ...draft, cacLimit: num(e.target.value) })} /></Field>
              <Field label="Limite de CPL (R$)" error={errors.cplLimit}><input className="input" type="number" value={draft.cplLimit} onChange={(e) => setDraft({ ...draft, cplLimit: num(e.target.value) })} /></Field>
              <Field label="Conversão mínima (%)" error={errors.convRateMin}><input className="input" type="number" step="0.1" value={draft.convRateMin} onChange={(e) => setDraft({ ...draft, convRateMin: num(e.target.value) })} /></Field>
              <Field label="Alerta de orçamento (% consumido)" error={errors.budgetAlertPct}><input className="input" type="number" value={draft.budgetAlertPct} onChange={(e) => setDraft({ ...draft, budgetAlertPct: num(e.target.value) })} /></Field>
              <Field label="Meta de receita mensal (R$)" error={errors.monthlyRevenueGoal}><input className="input" type="number" value={draft.monthlyRevenueGoal} onChange={(e) => setDraft({ ...draft, monthlyRevenueGoal: num(e.target.value) })} /></Field>
            </fieldset>
          </Card>
          <Card title="Financeiro e atribuição" subtitle="Afeta ROI, lucro estimado e a leitura da receita">
            <fieldset disabled={!admin} className="space-y-3">
              <Field label="Margem bruta (%)" hint="ROI = ((receita × margem − investimento total) ÷ investimento total) × 100. Receita não é lucro." error={errors.grossMargin}>
                <input className="input" type="number" min={1} max={100} value={Math.round(draft.grossMargin * 1000) / 10} onChange={(e) => setDraft({ ...draft, grossMargin: num(e.target.value) / 100 })} />
              </Field>
              <Field label="Modelo de atribuição" hint="A base demonstrativa foi gerada com last-click. Outros modelos exigem dados de jornada (GA4/CRM) e são recalculados no backend.">
                <select className="input dark:[color-scheme:dark]" value={draft.attributionModel} onChange={(e) => setDraft({ ...draft, attributionModel: e.target.value as S['attributionModel'] })}>
                  <option value="last-click">Last-click (último clique)</option>
                  <option value="first-click" disabled>First-click — requer backend + GA4</option>
                  <option value="linear" disabled>Linear — requer backend + GA4</option>
                </select>
              </Field>
              <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed muted dark:bg-white/5">
                <b className="text-slate-700 dark:text-slate-200">Custos considerados:</b> o investimento total soma mídia e custos não-mídia (produção, ferramentas, comissões de parceiros e fee de agência), registrados por campanha/dia. CAC e ROI usam o investimento total; ROAS e CPC usam só a mídia.
              </div>
            </fieldset>
          </Card>
        </div>
      )}

      {tab === 'score' && (
        <Card title="Metas e pesos do Campaign Score" subtitle="A nota de cada campanha usa as metas e pesos do seu objetivo. Atingir exatamente a meta = 60 pontos; 50% melhor = 100.">
          <fieldset disabled={!admin} className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(draft.scoreTargets) as Objective[]).map((o) => {
              const w = draft.scoreWeights[o]
              const tot = Object.values(w).reduce((a, b) => a + (b || 0), 0)
              return (
                <div key={o} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold">{o}</span><span className="text-[11px] muted">{s.campaigns.filter((c) => c.objective === o).length} campanhas</span></div>
                  <table className="mt-3 w-full text-xs">
                    <thead><tr><th className="pb-1 text-left font-medium muted">Indicador</th><th className="pb-1 text-left font-medium muted">Meta</th><th className="pb-1 text-left font-medium muted">Peso</th></tr></thead>
                    <tbody>
                      {(Object.keys(w) as ScoreMetric[]).map((m) => (
                        <tr key={m}>
                          <td className="py-1 pr-2">{SCORE_LABELS[m]}</td>
                          <td className="py-1 pr-2"><input className="input py-1 text-xs" type="number" step="any" value={draft.scoreTargets[o][m]} onChange={(e) => setDraft({ ...draft, scoreTargets: { ...draft.scoreTargets, [o]: { ...draft.scoreTargets[o], [m]: num(e.target.value) } } })} aria-label={`Meta ${m} ${o}`} /></td>
                          <td className="py-1"><input className="input py-1 text-xs" type="number" min={0} value={w[m]} onChange={(e) => setDraft({ ...draft, scoreWeights: { ...draft.scoreWeights, [o]: { ...w, [m]: Math.max(0, num(e.target.value) || 0) } } })} aria-label={`Peso ${m} ${o}`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={clsx('mt-2 text-[11px]', errors[`w-${o}`] ? 'text-bad' : 'muted')}>{errors[`w-${o}`] ?? `Soma dos pesos: ${tot} (normalizada para 100%)`}</div>
                </div>
              )
            })}
          </fieldset>
          <p className="mt-3 text-[11px] muted">Unidades: CAC e CPL em R$ (menor é melhor); ROAS em x; ROI, conversão e CTR em %. Classificação: ≥ 80 Excelente · ≥ 60 Bom · ≥ 40 Regular · &lt; 40 Necessita atenção.</p>
        </Card>
      )}

      {tab === 'integrations' && <Integrations draft={draft} setDraft={setDraft} admin={admin} apiError={errors.api} />}

      {tab === 'users' && (
        <Card title={<span className="flex items-center gap-1.5"><Users size={15} /> Usuários e perfis de acesso</span>} subtitle="Controle de acesso baseado em papéis (RBAC), aplicado no frontend e validado no backend em cada endpoint">
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-slate-100 dark:border-white/5">{['Usuário', 'Perfil', 'Visualizar', 'Criar/editar workflows e importar', 'Excluir, reverter e configurar'].map((h, i) => <th key={h} className={clsx('th', i === 0 && 'pl-5')}>{h}</th>)}</tr></thead>
              <tbody>
                {[
                  ['admin@demo.com', 'Administrador', true, true, true],
                  ['analista@demo.com', 'Analista', true, true, false],
                  ['leitor@demo.com', 'Leitura', true, false, false],
                ].map(([e, r, ...p]) => (
                  <tr key={String(e)} className="border-b border-slate-50 dark:border-white/5">
                    <td className="td pl-5">{e} {s.user?.email === e && <Badge tone="blue">você</Badge>}</td>
                    <td className="td">{r}</td>
                    {p.map((v, i) => <td key={i} className="td">{v ? <CheckCircle2 size={15} className="text-good" /> : <span className="muted">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs muted dark:bg-white/5"><Shield size={14} className="mt-0.5 shrink-0" /> No backend, senhas são armazenadas com bcrypt, a sessão usa JWT de curta duração e cada rota verifica o papel do usuário. Esta demo estática simula as permissões no navegador.</div>
        </Card>
      )}

      {tab === 'data' && (
        <Card title="Dados demonstrativos" subtitle="Restaura a base fictícia e o estado inicial de workflows, execuções, importações e configurações">
          <p className="text-sm muted">A base possui 12 meses de dados diários para {s.campaigns.length} campanhas em {s.channels.length} canais, gerada de forma determinística. Tudo o que você criar fica salvo apenas neste navegador.</p>
          <button className="btn-danger mt-4" disabled={!admin} onClick={() => setResetOpen(true)}><RotateCcw size={14} /> Restaurar dados de demonstração</button>
          <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Restaurar demonstração" size="sm" footer={<><button className="btn-secondary" onClick={() => setResetOpen(false)}>Cancelar</button><button className="btn-danger" onClick={s.resetDemo}>Restaurar</button></>}>
            <p className="text-sm">Workflows criados, histórico, importações, cenários e configurações voltarão ao estado inicial. Continuar?</p>
          </Modal>
        </Card>
      )}
    </>
  )
}

function Integrations({ draft, setDraft, admin, apiError }: { draft: S; setDraft: (s: S) => void; admin: boolean; apiError?: string }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const test = async () => {
    if (!draft.integrations.apiBaseUrl) return setResult({ ok: false, msg: 'Informe a URL da API.' })
    setTesting(true)
    setResult(null)
    try {
      const r = await fetch(`${draft.integrations.apiBaseUrl.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(8000) })
      const j = await r.json()
      setResult({ ok: r.ok, msg: r.ok ? `API ${j.version ?? ''} online · banco: ${j.database} · n8n: ${j.n8n} · OpenAI: ${j.openai}` : `HTTP ${r.status}` })
      if (r.ok) setDraft({ ...draft, integrations: { ...draft.integrations, n8nConnected: j.n8n === 'ok' } })
    } catch (e) {
      setResult({ ok: false, msg: `Não foi possível conectar: ${(e as Error).message}. Verifique se o backend está rodando e se o CORS permite esta origem.` })
    } finally {
      setTesting(false)
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={<span className="flex items-center gap-1.5"><Plug size={15} /> Backend (FastAPI)</span>} subtitle="Opcional. Sem backend, a aplicação roda em modo demonstração com dados locais.">
        <fieldset disabled={!admin} className="space-y-3">
          <Field label="URL da API" hint="Ex.: http://localhost:8000 — o frontend nunca recebe tokens do n8n ou da OpenAI." error={apiError}>
            <input className="input" placeholder="http://localhost:8000" value={draft.integrations.apiBaseUrl} onChange={(e) => setDraft({ ...draft, integrations: { ...draft.integrations, apiBaseUrl: e.target.value.trim() } })} />
          </Field>
          <button className="btn-secondary" onClick={test} disabled={testing}>{testing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Testar conexão</button>
          {result && <p className={clsx('rounded-lg p-2.5 text-xs', result.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200')}>{result.msg}</p>}
        </fieldset>
      </Card>
      <Card title={<span className="flex items-center gap-1.5"><KeyRound size={15} /> Credenciais e segurança</span>}>
        <div className="space-y-2 text-xs">
          {[
            ['n8n', draft.integrations.n8nConnected ? 'Conectado' : 'Não configurado', 'N8N_BASE_URL, N8N_API_KEY e N8N_WEBHOOK_SECRET no .env do backend. Chamadas app → n8n e n8n → app são assinadas com HMAC-SHA256 e timestamp (anti-replay).'],
            ['OpenAI', 'Não configurado', 'OPENAI_API_KEY no backend. Apenas agregados calculados são enviados ao modelo, com instrução para não inventar métricas.'],
            ['Google Ads / Meta / LinkedIn / TikTok', 'Não configurado', 'OAuth no backend; tokens criptografados na tabela integrations. Alterações de orçamento exigem confirmação explícita.'],
            ['SMTP / Slack', 'Não configurado', 'Credenciais ficam no n8n (Credentials), nunca no app.'],
          ].map(([n, st, d]) => (
            <div key={n} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{n}</span><Badge tone={st === 'Conectado' ? 'green' : 'amber'}>{st}</Badge></div>
              <p className="mt-1 muted">{d}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-2" title="Como configurar (resumo)">
        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
          <li>Na raiz do repositório: <code>cp backend/.env.example backend/.env</code> e preencha as variáveis.</li>
          <li>Suba tudo com <code>docker compose up -d</code> (PostgreSQL, API FastAPI em :8000 e n8n em :5678).</li>
          <li>Rode <code>docker compose exec api python -m app.seed</code> para carregar a base demonstrativa no PostgreSQL.</li>
          <li>Importe os workflows de <code>n8n/workflows/*.json</code> no n8n e configure as credenciais de SMTP/Slack lá.</li>
          <li>Informe a URL da API acima e clique em “Testar conexão”. Com o n8n respondendo, as execuções passam a ser feitas por ele.</li>
        </ol>
      </Card>
    </div>
  )
}
