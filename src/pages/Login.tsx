import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, User, UserRound } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { normEmail, passwordIssues, requestReset, resetPassword, validEmail } from '../store/auth'
import { Logo } from '../components/Logo'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

export default function Login() {
  const { user, login, signup, enterAsVisitor } = useStore()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string }; search?: string }
  const [mode, setMode] = useState<Mode>(() => (new URLSearchParams(loc.search ?? '').get('mode') === 'signup' ? 'signup' : 'login'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [shownCode, setShownCode] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (user) return <Navigate to={loc.state?.from ?? '/'} replace />

  const go = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
    setPassword('')
  }
  const issues = passwordIssues(password)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode !== 'reset' && !validEmail(email)) return setError('Digite um e-mail válido, como voce@empresa.com.')
    if (mode === 'signup' && name.trim().length < 2) return setError('Digite seu nome.')
    if ((mode === 'signup' || mode === 'reset') && issues.length) return setError(`A senha precisa ter ${issues.join(', ')}.`)
    if (mode === 'reset' && code.length !== 6) return setError('Digite os 6 dígitos do código.')
    if (mode === 'login' && !password) return setError('Digite sua senha.')
    setLoading(true)
    try {
      if (mode === 'login') {
        const err = await login(email, password)
        if (err) setError(err)
        else nav(loc.state?.from ?? '/', { replace: true })
      } else if (mode === 'signup') {
        const err = await signup(name, email, password)
        if (err) setError(err)
        else nav('/', { replace: true })
      } else if (mode === 'forgot') {
        const c = requestReset(email)
        setShownCode(c)
        setMode('reset')
        setInfo(c ? null : 'Se existir uma conta com este e-mail, o código de redefinição é enviado para ele.')
      } else {
        await resetPassword(email, code, password)
        setInfo('Senha redefinida. Entre com a nova senha.')
        setMode('login')
        setPassword('')
        setCode('')
        setShownCode(null)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const visitor = () => {
    enterAsVisitor()
    nav('/', { replace: true })
  }

  const title = { login: 'Entrar', signup: 'Criar conta', forgot: 'Redefinir senha', reset: 'Defina uma nova senha' }[mode]
  const subtitle = {
    login: 'Acompanhe investimento, retorno e funil das suas campanhas.',
    signup: 'Leva menos de um minuto. Seus dados ficam salvos neste navegador.',
    forgot: 'Informe o e-mail da conta para receber um código de 6 dígitos.',
    reset: `Digite o código enviado para ${normEmail(email)} e a nova senha.`,
  }[mode]

  return (
    <div className="grid min-h-screen bg-white dark:bg-navy-950 lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 px-14 py-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Marketing Performance</span>
        </div>
        <div className="my-auto max-w-xl">
          <h2 className="text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.03em]">Descubra quais campanhas dão lucro e quais só consomem verba.</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-300">Investimento, receita, CAC, ROAS e ROI de todos os canais em um só painel, com alertas automáticos quando algo sai da meta.</p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[
              ['ROAS', '3,86x', '+12%'],
              ['CAC', 'R$ 150', '−8%'],
              ['ROI', '80%', '+5 p.p.'],
            ].map(([l, v, dlt]) => (
              <div key={l} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <div className="text-xs text-slate-400">{l}</div>
                <div className="mt-1 text-xl font-semibold tabular">{v}</div>
                <div className="mt-0.5 text-xs text-emerald-300">{dlt}</div>
              </div>
            ))}
          </div>
          <MiniBars />
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">Marketing Performance</span>
          </div>
          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button" onClick={() => go('login')} className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <ArrowLeft size={15} /> Voltar para entrar
            </button>
          )}
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1.5 text-[15px] text-slate-500 dark:text-slate-400">{subtitle}</p>

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="tablist">
              {(['login', 'signup'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => go(m)} className={clsx('rounded-lg py-2 text-sm font-medium transition', mode === m ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400')}>
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === 'signup' && <Input icon={<User size={16} />} label="Nome" value={name} onChange={setName} autoComplete="name" placeholder="Como devemos chamar você" />}
            {mode !== 'reset' && <Input icon={<Mail size={16} />} label="E-mail" type="email" value={email} onChange={(v) => { setEmail(v); setError(null) }} autoComplete="email" placeholder="voce@empresa.com" />}
            {mode === 'reset' && (
              <>
                {shownCode && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-3.5 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
                    Seu código: <span className="ml-1 text-lg font-semibold tracking-[0.2em] tabular">{shownCode}</span>
                    <p className="mt-1 text-xs opacity-80">Esta versão roda sem servidor de e-mail, então o código aparece aqui. Com o backend, ele chega por e-mail.</p>
                  </div>
                )}
                <Input icon={<KeyRound size={16} />} label="Código de 6 dígitos" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />
              </>
            )}
            {mode !== 'forgot' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="pw" className="text-sm font-medium text-slate-700 dark:text-slate-300">{mode === 'reset' ? 'Nova senha' : 'Senha'}</label>
                  {mode === 'login' && <button type="button" onClick={() => go('forgot')} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">Esqueceu a senha?</button>}
                </div>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
                  <input id="pw" className="input h-11 pl-10 pr-11 text-[15px]" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Sua senha' : 'Mínimo de 8 caracteres'} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1.5 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {(mode === 'signup' || mode === 'reset') && password && (
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {([['8 caracteres', password.length >= 8], ['uma letra', /[A-Za-z]/.test(password)], ['um número', /\d/.test(password)]] as const).map(([l, ok]) => (
                      <li key={l} className={ok ? 'text-good-ink dark:text-good' : 'text-slate-400'}>{ok ? '✓' : '○'} {l}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            {info && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{info}</p>}
            <button className="btn-primary h-11 w-full text-[15px]" disabled={loading}>
              {loading ? 'Aguarde…' : { login: 'Entrar', signup: 'Criar conta', forgot: 'Enviar código', reset: 'Salvar nova senha' }[mode]}
            </button>
          </form>

          {(mode === 'login' || mode === 'signup') && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /> ou <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              </div>
              <button type="button" onClick={visitor} className="btn-secondary h-11 w-full text-[15px]">
                <UserRound size={16} /> Entrar como visitante
              </button>
              <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">Explore todas as telas sem cadastro.</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function MiniBars() {
  const v = [38, 44, 41, 52, 48, 57, 63, 59, 68, 74, 71, 82]
  return (
    <div className="mt-3 flex h-20 max-w-md items-end gap-1.5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" aria-hidden="true">
      {v.map((h, i) => <div key={i} className="flex-1 rounded-t-[5px]" style={{ height: `${h}%`, background: i === v.length - 1 ? '#6c82fe' : 'rgba(255,255,255,0.12)' }} />)}
    </div>
  )
}

function Input({ icon, label, value, onChange, type = 'text', ...rest }: { icon: ReactNode; label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; placeholder?: string; inputMode?: 'numeric' }) {
  const id = 'f-' + label.toLowerCase().replace(/\W+/g, '-')
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400">{icon}</span>
        <input id={id} className="input h-11 pl-10 text-[15px]" type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      </div>
    </div>
  )
}
