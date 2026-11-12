import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrainCircuit, ChartLine, Lock, Mail, Workflow } from 'lucide-react'
import { useStore } from '../store/AppStore'

const ACCOUNTS = [
  { email: 'admin@demo.com', role: 'Administrador', desc: 'acesso total' },
  { email: 'analista@demo.com', role: 'Analista', desc: 'cria e edita, não exclui' },
  { email: 'leitor@demo.com', role: 'Leitura', desc: 'somente visualização' },
]

export default function Login() {
  const { user, login } = useStore()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('admin@demo.com')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (user) return <Navigate to="/" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Informe um e-mail válido.')
    if (password.length < 6) return setError('A senha precisa ter ao menos 6 caracteres.')
    setLoading(true)
    setTimeout(() => {
      const err = login(email, password)
      setLoading(false)
      if (err) setError(err)
      else nav(loc.state?.from ?? '/', { replace: true })
    }, 450)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#0b1220] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-ai-500/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-ai-500">
            <ChartLine size={18} />
          </div>
          <span className="font-semibold">Marketing Performance Analytics</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">Transforme dados de marketing em decisões e automações.</h1>
          <p className="mt-3 text-sm text-slate-300">CAC, ROAS, ROI e funil em um só lugar, insights gerados a partir dos seus indicadores e workflows executados pelo n8n.</p>
          <div className="mt-8 space-y-3 text-sm">
            {[
              { icon: ChartLine, t: 'Marketing Analytics', d: 'Campanhas, canais, funil e finanças com filtros globais.' },
              { icon: BrainCircuit, t: 'Marketing Intelligence', d: 'Insights por regras e assistente que responde com os dados reais.' },
              { icon: Workflow, t: 'Marketing Automation', d: 'Construtor visual de workflows integrado ao n8n.' },
            ].map((f) => (
              <div key={f.t} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <f.icon size={18} className="mt-0.5 shrink-0 text-brand-300" />
                <div>
                  <div className="font-medium">{f.t}</div>
                  <div className="text-xs text-slate-400">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative mt-10 text-[11px] text-slate-500">Projeto de portfólio · todos os dados exibidos são fictícios.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-fade-up" noValidate>
          <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-1 text-sm muted">Use uma das contas de demonstração.</p>
          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="label">E-mail</span>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input className="input pl-9" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
              </div>
            </label>
            <label className="block">
              <span className="label">Senha</span>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input className="input pl-9" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} />
              </div>
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</p>}
            <button className="btn-primary w-full py-2.5" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <p className="mb-2 text-xs font-medium">Contas de demonstração (senha: demo123)</p>
            {ACCOUNTS.map((a) => (
              <button type="button" key={a.email} onClick={() => { setEmail(a.email); setPassword('demo123'); setError(null) }} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/5">
                <span className="font-medium">{a.email}</span>
                <span className="muted">{a.role} · {a.desc}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed muted">Na versão com backend, a autenticação usa JWT emitido pela API FastAPI (senhas com bcrypt). Esta demonstração estática valida as contas no navegador.</p>
        </form>
      </div>
    </div>
  )
}
