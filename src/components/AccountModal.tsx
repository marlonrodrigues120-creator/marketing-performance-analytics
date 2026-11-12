import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { changePassword, passwordIssues } from '../store/auth'
import { Field, Modal, toast } from './ui'

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile, logout } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      setName(user?.name ?? '')
      setCur('')
      setNext('')
      setErr(null)
      setPwErr(null)
    }
  }, [open, user?.name])
  if (!user) return null
  const visitor = user.role === 'visitor'

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    const r = updateProfile(name)
    if (r) setErr(r)
    else toast.success('Nome atualizado.')
  }
  const savePw = async (e: FormEvent) => {
    e.preventDefault()
    const issues = passwordIssues(next)
    if (issues.length) return setPwErr(`A nova senha precisa ter ${issues.join(', ')}.`)
    setSaving(true)
    try {
      await changePassword(user.email, cur, next)
      toast.success('Senha alterada.')
      setCur('')
      setNext('')
      setPwErr(null)
    } catch (ex) {
      setPwErr((ex as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Minha conta">
      <form onSubmit={saveName} className="space-y-3">
        <Field label="Nome" error={err}>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(null) }} maxLength={60} />
        </Field>
        {!visitor && <Field label="E-mail"><input className="input" value={user.email} disabled /></Field>}
        <div className="flex justify-end"><button className="btn-primary" disabled={name.trim() === user.name}>Salvar nome</button></div>
      </form>
      <div className="my-5 h-px bg-slate-100 dark:bg-white/10" />
      {visitor ? (
        <div className="text-sm">
          <p className="font-medium">Você está como visitante</p>
          <p className="mt-1 text-slate-500">Crie uma conta para entrar de novo com e-mail e senha. O que você criou neste navegador continua disponível.</p>
          <button className="btn-secondary mt-3" onClick={() => { onClose(); logout(); nav('/login?mode=signup') }}>Criar conta</button>
        </div>
      ) : (
        <form onSubmit={savePw} className="space-y-3">
          <p className="text-sm font-medium">Alterar senha</p>
          <Field label="Senha atual"><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => { setCur(e.target.value); setPwErr(null) }} /></Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres, com letra e número." error={pwErr}><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setPwErr(null) }} /></Field>
          <div className="flex justify-end"><button className="btn-primary" disabled={!cur || !next || saving}>{saving ? 'Salvando…' : 'Alterar senha'}</button></div>
        </form>
      )}
    </Modal>
  )
}
