import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation as useRoute, useNavigate } from 'react-router-dom'
import {
  ChartColumn, CalendarClock, Compass, LayoutDashboard, LocateFixed, MapPin, Package, Receipt, Sprout, Store, User, ChevronDown, ShoppingBag,
} from 'lucide-react'
import { Logo, Spinner } from './ui'
import { useAuth } from '../lib/auth'
import { PRESETS, distanceKm, useUserLocation } from '../lib/location'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { km, rupiah } from '../lib/format'

// ------------------------------------------------------------------ lokasi
export function LocationChip({ dark = false }: { dark?: boolean }) {
  const loc = useUserLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex max-w-[60vw] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold sm:max-w-none ${dark ? 'bg-white/10 text-cream' : 'bg-sand text-ink'}`}>
        <MapPin className="size-4 shrink-0 text-mustard-deep" />
        <span className="truncate">{loc.locating ? 'Mendeteksi lokasi…' : loc.label}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-72 rounded-2xl border border-sand bg-[#fffdf8] p-2 text-ink shadow-xl">
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-sand"
            onClick={() => { loc.useGps(); setOpen(false) }}>
            <LocateFixed className="size-4 text-leaf" /> Deteksi lokasi saya
          </button>
          <div className="my-1 border-t border-sand" />
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => { loc.usePreset(p.id); setOpen(false) }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-sand ${loc.label === p.label ? 'font-bold' : ''}`}>
              <MapPin className="size-4 text-muted" /> {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ notifikasi real-time stok baru
export function NewListingNotifier() {
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useUserLocation()
  const { profile } = useAuth()
  const favs = useRef<string[]>([])
  const coords = useRef(loc.coords)
  coords.current = loc.coords

  useEffect(() => { api.listFavorites().then((f) => { favs.current = f }).catch(() => {}) }, [profile?.id])

  useEffect(() => api.subscribeNewListings((l) => {
    if (profile?.role === 'partner') return
    const d = distanceKm(coords.current, l.store)
    const isFav = favs.current.includes(l.store_id)
    if (d > 5 && !isFav) return
    const title = isFav ? `${l.store.name} baru mengunggah stok` : `Stok baru ${km(d)} dari kamu`
    const body = `${l.title} — ${rupiah(l.price)} (normal ${rupiah(l.original_price)})`
    toast({ kind: 'info', title, body, action: { label: 'Lihat', onClick: () => navigate(`/listing/${l.id}`) } })
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(title, { body, icon: './favicon.svg' }) } catch { /* abaikan */ }
    }
  }), [profile?.role, toast, navigate])
  return null
}

// ------------------------------------------------------------------ layout pembeli
const buyerNav = [
  { to: '/', label: 'Jelajah', Icon: Compass, end: true },
  { to: '/pesanan', label: 'Pesanan', Icon: Receipt },
  { to: '/dampak', label: 'Dampak', Icon: Sprout },
  { to: '/akun', label: 'Akun', Icon: User },
]

export function BuyerLayout() {
  const { profile } = useAuth()
  const route = useRoute()
  const hideBottom = route.pathname.startsWith('/listing/')
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <NewListingNotifier />
      <header className="sticky top-0 z-[1000] border-b border-sand/80 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" aria-label="Bungkus! beranda"><Logo className="text-2xl" /></Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {buyerNav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-forest text-cream' : 'text-muted hover:text-ink'}`}>
                {label}
              </NavLink>
            ))}
            {profile?.role === 'partner' && (
              <NavLink to="/mitra" className="rounded-full px-3 py-1.5 text-sm font-semibold text-leaf hover:underline">Dashboard mitra</NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LocationChip />
            {!profile && <Link to="/masuk" className="btn btn-dark btn-sm hidden md:inline-flex">Masuk</Link>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4">
        <Outlet />
      </main>
      {!hideBottom && (
        <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-sand bg-[#fffdf8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navigasi utama">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {buyerNav.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-leaf' : 'text-muted'}`}>
                {({ isActive }) => (<>
                  <Icon className={`size-5 ${isActive ? 'stroke-[2.4]' : ''}`} />{label}
                </>)}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ guard
export function RequireAuth({ role, children }: { role?: 'buyer' | 'partner'; children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const route = useRoute()
  if (loading) return <Spinner />
  if (!profile) return <Navigate to={`/masuk?next=${encodeURIComponent(route.pathname)}`} replace />
  if (role === 'partner' && profile.role !== 'partner') return <Navigate to="/" replace />
  return <>{children}</>
}

// ------------------------------------------------------------------ layout mitra
const partnerNav = [
  { to: '/mitra', label: 'Ringkasan', Icon: LayoutDashboard, end: true },
  { to: '/mitra/stok', label: 'Stok', Icon: Package },
  { to: '/mitra/pesanan', label: 'Pesanan', Icon: ShoppingBag },
  { to: '/mitra/jadwal', label: 'Jadwal', Icon: CalendarClock },
  { to: '/mitra/laporan', label: 'Laporan', Icon: ChartColumn },
  { to: '/mitra/toko', label: 'Toko', Icon: Store },
]

export function PartnerLayout() {
  const { profile } = useAuth()
  const toast = useToast()
  const [storeName, setStoreName] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const route = useRoute()

  useEffect(() => {
    api.myStore().then((s) => { setStoreName(s?.name ?? null); setStoreId(s?.id ?? null) }).catch(() => {})
  }, [route.pathname])

  // pesanan masuk real-time
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!storeId) return
    const check = async () => {
      const orders = await api.storeOrders().catch(() => [])
      const paid = orders.filter((o) => o.status === 'paid')
      if (seen.current) {
        for (const o of paid) {
          if (!seen.current.has(o.id)) {
            toast({ kind: 'info', title: `Pesanan baru ${o.code}`, body: `${o.qty}× ${o.listing.title} — ${o.buyer_name ?? 'Pembeli'}` })
          }
        }
      }
      seen.current = new Set(orders.map((o) => o.id))
    }
    check()
    return api.subscribeOrders({ storeId }, check)
  }, [storeId, toast])

  return (
    <div className="min-h-dvh bg-cream md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-forest p-5 text-cream md:flex">
        <Link to="/mitra"><Logo light className="text-2xl" /></Link>
        <p className="mt-1 text-sm text-cream/60">Mitra</p>
        <nav className="mt-8 flex flex-col gap-1">
          {partnerNav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-mustard text-forest' : 'text-cream/80 hover:bg-white/10'}`}>
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 text-sm">
          <p className="font-semibold">{storeName ?? 'Toko belum diisi'}</p>
          <p className="text-cream/60">{profile?.full_name}</p>
          <div className="flex flex-col gap-1">
            <Link to="/" className="text-cream/70 hover:text-cream">Lihat aplikasi pembeli</Link>
            <Link to="/akun" className="text-cream/70 hover:text-cream">Akun</Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-24 md:pb-10">
        <header className="sticky top-0 z-[1000] flex h-14 items-center gap-3 bg-forest px-4 text-cream md:hidden">
          <Link to="/mitra"><Logo light className="text-xl" /></Link>
          <span className="truncate text-sm text-cream/70">{storeName ?? 'Mitra'}</span>
          <Link to="/akun" className="ml-auto" aria-label="Akun"><User className="size-5" /></Link>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-sand bg-[#fffdf8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navigasi mitra">
        <div className="grid grid-cols-6">
          {partnerNav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${isActive ? 'text-leaf' : 'text-muted'}`}>
              <Icon className="size-5" />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
