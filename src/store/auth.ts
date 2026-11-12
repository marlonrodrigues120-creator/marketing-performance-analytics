/**
 * Contas locais da versão estática. Senhas nunca são guardadas em texto:
 * PBKDF2-SHA256 (210 mil iterações) com salt aleatório por conta, via Web Crypto.
 * Na versão com backend, o mesmo fluxo usa /api/auth (bcrypt + JWT + e-mail).
 */
export interface Account {
  name: string
  email: string
  salt: string
  hash: string
  createdAt: string
}

const KEY = 'mpa.accounts.v1'
const RESET_KEY = 'mpa.reset.v1'
const ITER = 210_000

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITER }, key, 256)
  return b64(bits)
}

function load(): Account[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
function save(a: Account[]) {
  localStorage.setItem(KEY, JSON.stringify(a))
}

export const normEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

export function passwordIssues(p: string): string[] {
  const out: string[] = []
  if (p.length < 8) out.push('8 caracteres')
  if (!/[A-Za-z]/.test(p)) out.push('uma letra')
  if (!/\d/.test(p)) out.push('um número')
  return out
}

export async function createAccount(name: string, email: string, password: string): Promise<Account> {
  const accounts = load()
  if (accounts.some((a) => a.email === normEmail(email))) throw new Error('Já existe uma conta com este e-mail. Entre ou redefina a senha.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const acc: Account = { name: name.trim(), email: normEmail(email), salt: b64(salt), hash: await derive(password, salt), createdAt: new Date().toISOString() }
  save([...accounts, acc])
  return acc
}

export async function authenticate(email: string, password: string): Promise<Account> {
  const acc = load().find((a) => a.email === normEmail(email))
  // mensagem única para não revelar quais e-mails têm conta
  if (!acc || (await derive(password, unb64(acc.salt))) !== acc.hash) throw new Error('E-mail ou senha incorretos.')
  return acc
}

/** Gera um código de 6 dígitos válido por 15 minutos. Sem servidor de e-mail, o código é exibido na tela. */
export function requestReset(email: string): string | null {
  const acc = load().find((a) => a.email === normEmail(email))
  if (!acc) return null
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  sessionStorage.setItem(RESET_KEY, JSON.stringify({ email: acc.email, code, exp: Date.now() + 15 * 60_000 }))
  return code
}

export async function resetPassword(email: string, code: string, password: string) {
  const r = JSON.parse(sessionStorage.getItem(RESET_KEY) ?? 'null') as { email: string; code: string; exp: number } | null
  if (!r || r.email !== normEmail(email) || r.code !== code.trim()) throw new Error('Código inválido. Confira os 6 dígitos ou peça um novo.')
  if (Date.now() > r.exp) throw new Error('O código expirou. Peça um novo.')
  const accounts = load()
  const acc = accounts.find((a) => a.email === r.email)!
  const salt = crypto.getRandomValues(new Uint8Array(16))
  acc.salt = b64(salt)
  acc.hash = await derive(password, salt)
  save(accounts)
  sessionStorage.removeItem(RESET_KEY)
}
