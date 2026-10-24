import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingBag, Store } from 'lucide-react'
import { api } from '../lib/api'
import { DEMO_BUYER, DEMO_PARTNER } from '../lib/api/demoApi'
import { useAuth } from '../lib/auth'
import { errMsg } from '../lib/format'
import type { Role } from '../lib/types'
import { Logo } from '../components/ui'

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-forest p-10 text-cream md:flex">
        <Link to="/"><Logo light className="text-3xl" /></Link>
        <div>
          <p className="font-display text-5xl font-extrabold leading-[1.05]">Makanan diselamatkan, bukan dibuang.</p>
          <p className="mt-4 max-w-md text-cream/70">Stok sisa restoran, kafe, bakery, dan UMKM di sekitarmu, 50–70% lebih murah. Pesan, bayar, tunjukkan kode.</p>
        </div>
        <p className="text-sm text-cream/50">Venture Creation LS01, BINUS University</p>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="md:hidden"><Logo className="text-3xl" /></Link>
          <h1 className="mt-6 text-3xl font-extrabold md:mt-0">{title}</h1>
          <p className="mt-1 text-muted">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

const dest = (role: Role, next: string | null) => next && next !== '/masuk' ? next : role === 'partner' ? '/mitra' : '/'

export function SignInPage() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const navigate = useNavigate()
  const { profile, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (profile) return <Navigate to={dest(profile.role, next)} replace />

  const go = async (e?: string, p?: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.signIn(e ?? email, p ?? password)
      await refresh()
      const prof = await api.getProfile()
      navigate(dest(prof?.role ?? 'buyer', next), { replace: true })
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }
  const submit = (ev: FormEvent) => { ev.preventDefault(); go() }

  return (
    <Shell title="Masuk" sub="Lanjutkan menyelamatkan makanan malam ini.">
      {api.mode === 'demo' && (
        <div className="mb-6 space-y-2 rounded-2xl bg-sand p-4">
          <p className="text-sm font-semibold">Coba langsung dengan akun demo</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => go(DEMO_BUYER.email, DEMO_BUYER.password)}>
              <ShoppingBag className="size-4" /> Pembeli
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => go(DEMO_PARTNER.email, DEMO_PARTNER.password)}>
              <Store className="size-4" /> Mitra
            </button>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <label className="field"><span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Kata sandi</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="text-sm font-semibold text-tomato" role="alert">{error}</p>}
        <button className="btn btn-dark w-full" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Belum punya akun? <Link to={`/daftar${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-leaf underline">Daftar</Link></p>
    </Shell>
  )
}

export function SignUpPage() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const navigate = useNavigate()
  const { profile, refresh } = useAuth()
  const [role, setRole] = useState<Role>(params.get('peran') === 'mitra' ? 'partner' : 'buyer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)

  if (profile && !confirmSent) return <Navigate to={dest(profile.role, next)} replace />

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Kata sandi minimal 6 karakter'); return }
    setBusy(true)
    try {
      const { needsConfirmation } = await api.signUp({ email, password, fullName, role })
      if (needsConfirmation) { setConfirmSent(true); return }
      await refresh()
      navigate(role === 'partner' ? '/mitra/toko' : dest(role, next), { replace: true })
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  if (confirmSent) {
    return (
      <Shell title="Cek email kamu" sub={`Kami mengirim tautan konfirmasi ke ${email}. Buka tautan itu, lalu masuk.`}>
        <Link to="/masuk" className="btn btn-dark w-full">Ke halaman masuk</Link>
      </Shell>
    )
  }

  return (
    <Shell title="Daftar" sub="Satu akun untuk mulai memesan atau menjual stok surplus.">
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Saya mendaftar sebagai</legend>
          <div className="grid grid-cols-2 gap-2">
            {([['buyer', 'Pembeli', 'Cari makanan hemat', ShoppingBag], ['partner', 'Mitra penjual', 'Jual stok sisa', Store]] as const).map(([r, t, s, I]) => (
              <label key={r} className={`cursor-pointer rounded-2xl border-[1.5px] p-3 ${role === r ? 'border-leaf bg-leaf/5' : 'border-sand-deep'}`}>
                <input type="radio" name="role" className="sr-only" checked={role === r} onChange={() => setRole(r)} />
                <I className="size-5 text-leaf" />
                <span className="mt-1 block font-semibold">{t}</span>
                <span className="block text-xs text-muted">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field"><span>{role === 'partner' ? 'Nama pemilik / pengelola' : 'Nama'}</span>
          <input className="input" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
        <label className="field"><span>Email</span>
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Kata sandi</span>
          <input className="input" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <small className="text-xs text-muted">Minimal 6 karakter.</small></label>
        {error && <p className="text-sm font-semibold text-tomato" role="alert">{error}</p>}
        <button className="btn btn-dark w-full" disabled={busy}>{busy ? 'Membuat akun…' : 'Buat akun'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Sudah punya akun? <Link to="/masuk" className="font-semibold text-leaf underline">Masuk</Link></p>
    </Shell>
  )
}
