import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BellRing, Clock, Heart, LogOut, Store as StoreIcon } from 'lucide-react'
import { api } from '../../lib/api'
import { resetDemo } from '../../lib/api/demoApi'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { distanceKm, useUserLocation } from '../../lib/location'
import {
  CO2_PER_KG, KG_PER_PORTION, dateLabel, errMsg, km, rupiah, storeCategoryLabel, timeWindow,
} from '../../lib/format'
import { BackLink, DiscountBadge, Empty, ErrorBox, FoodThumb, Rating, Spinner } from '../../components/ui'
import { useToast } from '../../lib/toast'

// ------------------------------------------------------------------ halaman toko
export function StorePage() {
  const { id } = useParams()
  const loc = useUserLocation()
  const toast = useToast()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, loading, error, reload } = useAsync(() => api.getStoreDetail(id!), [id])
  const [fav, setFav] = useState(false)

  useEffect(() => { api.listFavorites().then((f) => setFav(f.includes(id!))).catch(() => {}) }, [id, profile?.id])

  if (loading) return <Spinner />
  if (error) return <div className="py-6"><ErrorBox message={error} onRetry={reload} /></div>
  if (!data) return <div className="py-10"><BackLink to="/" /><p className="mt-4 font-display text-2xl font-bold">Toko tidak ditemukan.</p></div>
  const { store, listings, reviews } = data

  const toggleFav = async () => {
    if (!profile) { navigate(`/masuk?next=/toko/${store.id}`); return }
    try {
      const now = await api.toggleFavorite(store.id)
      setFav(now)
      toast({ kind: 'success', title: now ? `${store.name} jadi favorit` : 'Dihapus dari favorit', body: now ? 'Kamu akan dapat notifikasi saat toko ini mengunggah stok.' : undefined })
    } catch (e) { toast({ kind: 'error', title: errMsg(e) }) }
  }

  return (
    <div className="max-w-3xl py-5">
      <BackLink to="/" label="Jelajah" />
      <div className="mt-4 flex items-start gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-leaf text-cream"><StoreIcon className="size-7" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold">{store.name}</h1>
          <p className="text-muted">{storeCategoryLabel(store.category)} <span aria-hidden>•</span> {km(distanceKm(loc.coords, store))} <span aria-hidden>•</span> <Rating value={store.rating_avg} count={store.rating_count} /></p>
          <p className="mt-1 text-sm text-muted">{store.address}{store.closing_time ? `, tutup ${store.closing_time.slice(0, 5).replace(':', '.')}` : ''}</p>
        </div>
        <button onClick={toggleFav} aria-pressed={fav} className={`btn btn-sm ${fav ? 'btn-dark' : 'btn-ghost'}`}>
          <Heart className={`size-4 ${fav ? 'fill-mustard text-mustard' : ''}`} /> {fav ? 'Favorit' : 'Jadikan favorit'}
        </button>
      </div>
      {store.description && <p className="mt-4 max-w-prose">{store.description}</p>}

      <h2 className="mt-8 text-xl font-bold">Stok hari ini</h2>
      {listings.length === 0 ? (
        <p className="mt-2 text-muted">Belum ada stok aktif. Jadikan favorit untuk dapat notifikasi saat stok muncul.</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {listings.map((l) => (
            <li key={l.id}>
              <Link to={`/listing/${l.id}`} className={`panel flex gap-3 p-3 hover:border-sand-deep ${l.qty_available === 0 ? 'opacity-50' : ''}`}>
                <FoodThumb listing={l} className="size-20 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{l.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><Clock className="size-3.5" />{timeWindow(l.pickup_start, l.pickup_end)}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="font-display font-extrabold text-leaf">{rupiah(l.price)}</span>
                    <DiscountBadge original={l.original_price} price={l.price} />
                    <span className="text-xs font-semibold text-muted">{l.qty_available ? `sisa ${l.qty_available}` : 'habis'}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-xl font-bold">Ulasan pembeli</h2>
      {reviews.length === 0 ? <p className="mt-2 text-muted">Belum ada ulasan.</p> : (
        <ul className="mt-2 divide-y divide-sand">
          {reviews.map((r) => (
            <li key={r.id} className="py-3">
              <p className="flex items-center gap-2 text-sm"><span className="font-semibold">{r.buyer_name}</span><Rating value={r.rating} /><span className="text-muted">{dateLabel(r.created_at)}</span></p>
              {r.comment && <p className="mt-0.5">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ dampak
export function ImpactPage() {
  const { profile } = useAuth()
  const { data, loading } = useAsync(() => (profile ? api.myOrders() : Promise.resolve([])), [profile?.id])
  if (!profile) {
    return (
      <div className="max-w-xl py-8">
        <h1 className="text-3xl font-extrabold">Dampakmu</h1>
        <div className="mt-6"><Empty title="Masuk untuk melihat dampakmu" body="Setiap porsi yang kamu selamatkan tercatat di sini." action={<Link to="/masuk?next=/dampak" className="btn btn-dark">Masuk</Link>} /></div>
      </div>
    )
  }
  if (loading) return <Spinner />
  const done = (data ?? []).filter((o) => o.status === 'completed')
  const portions = done.reduce((a, o) => a + o.qty, 0)
  const saved = done.reduce((a, o) => a + (o.original_unit_price - o.unit_price) * o.qty, 0)
  const kg = portions * KG_PER_PORTION
  const co2 = kg * CO2_PER_KG
  const stores = new Set(done.map((o) => o.store_id)).size
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })

  return (
    <div className="max-w-3xl py-6">
      <h1 className="text-3xl font-extrabold">Dampakmu</h1>
      <p className="mt-1 text-muted">Dihitung dari pesanan yang sudah kamu ambil.</p>

      <section className="mt-6 rounded-3xl bg-forest p-6 text-cream sm:p-8">
        <p className="font-display text-7xl font-extrabold leading-none text-mustard sm:text-8xl">{portions}</p>
        <p className="mt-2 font-display text-2xl font-bold">porsi makanan diselamatkan</p>
        <p className="mt-1 text-cream/70">dari {stores} toko, tidak berakhir di tempat sampah.</p>
        <dl className="mt-8 grid gap-6 border-t border-cream/15 pt-6 sm:grid-cols-3">
          <div><dt className="text-sm text-cream/60">Uang yang kamu hemat</dt><dd className="font-display text-2xl font-bold">{rupiah(saved)}</dd></div>
          <div><dt className="text-sm text-cream/60">Makanan tidak terbuang</dt><dd className="font-display text-2xl font-bold">± {fmt(kg)} kg</dd></div>
          <div><dt className="text-sm text-cream/60">Emisi CO₂e tercegah</dt><dd className="font-display text-2xl font-bold">± {fmt(co2)} kg</dd></div>
        </dl>
      </section>
      <p className="mt-3 text-xs text-muted">Perkiraan: 1 porsi ≈ {String(KG_PER_PORTION).replace('.', ',')} kg makanan; 1 kg sampah makanan ≈ {String(CO2_PER_KG).replace('.', ',')} kg CO₂e (termasuk metana dari TPA).</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ['SDG 2', 'Tanpa kelaparan', 'Makanan layak jadi lebih terjangkau bagi mahasiswa dan pekerja muda.'],
          ['SDG 12', 'Konsumsi bertanggung jawab', 'Surplus restoran dijual kembali, bukan dibuang.'],
          ['SDG 13', 'Penanganan perubahan iklim', 'Makanan yang tidak membusuk di TPA berarti emisi metana berkurang.'],
        ].map(([n, t, b]) => (
          <div key={n} className="border-t-2 border-leaf pt-3">
            <p className="text-sm font-bold text-leaf">{n}</p>
            <p className="font-display text-lg font-bold">{t}</p>
            <p className="text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ akun
export function AccountPage() {
  const { profile, loading, refresh } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  useEffect(() => { setName(profile?.full_name ?? ''); setPhone(profile?.phone ?? '') }, [profile])

  if (loading) return <Spinner />
  if (!profile) {
    return (
      <div className="max-w-md py-8">
        <h1 className="text-3xl font-extrabold">Akun</h1>
        <div className="mt-6"><Empty title="Kamu belum masuk" body="Masuk untuk memesan, menyimpan toko favorit, dan melihat dampakmu."
          action={<div className="flex justify-center gap-2"><Link to="/masuk" className="btn btn-dark">Masuk</Link><Link to="/daftar" className="btn btn-ghost">Daftar</Link></div>} /></div>
        <ModeNote />
      </div>
    )
  }

  const save = async () => {
    try {
      await api.updateProfile({ full_name: name.trim(), phone: phone.trim() || null })
      await refresh()
      toast({ kind: 'success', title: 'Profil disimpan' })
    } catch (e) { toast({ kind: 'error', title: errMsg(e) }) }
  }

  const askNotif = async () => {
    if (typeof Notification === 'undefined') return
    setPerm(await Notification.requestPermission())
  }

  return (
    <div className="max-w-md py-6">
      <h1 className="text-3xl font-extrabold">Akun</h1>
      <p className="mt-1 text-muted">{profile.email} <span aria-hidden>•</span> {profile.role === 'partner' ? 'Mitra penjual' : 'Pembeli'}</p>

      {profile.role === 'partner' && (
        <Link to="/mitra" className="mt-5 flex items-center justify-between rounded-2xl bg-forest p-4 text-cream">
          <span className="font-semibold">Buka dashboard mitra</span><StoreIcon className="size-5 text-mustard" />
        </Link>
      )}

      <div className="panel mt-5 space-y-4 p-5">
        <label className="field"><span>Nama</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>No. HP (opsional)</span><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx" /></label>
        <button className="btn btn-dark" onClick={save}>Simpan profil</button>
      </div>

      <div className="panel mt-4 flex items-center gap-3 p-5">
        <BellRing className="size-5 text-leaf" />
        <div className="flex-1">
          <p className="font-semibold">Notifikasi stok baru</p>
          <p className="text-sm text-muted">{perm === 'granted' ? 'Aktif. Kamu diberi tahu saat ada stok baru dalam 5 km atau dari toko favorit.' : perm === 'denied' ? 'Diblokir di browser. Ubah lewat pengaturan situs.' : 'Dapat kabar walau tab ini sedang tidak dibuka.'}</p>
        </div>
        {perm === 'default' && <button className="btn btn-ghost btn-sm" onClick={askNotif}>Nyalakan</button>}
      </div>

      <button className="btn btn-ghost mt-6 w-full" onClick={async () => { await api.signOut(); navigate('/') }}>
        <LogOut className="size-4" /> Keluar
      </button>
      <ModeNote />
    </div>
  )
}

function ModeNote() {
  const toast = useToast()
  if (api.mode !== 'demo') return <p className="mt-6 text-center text-xs text-muted">Terhubung ke database Supabase.</p>
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-sand-deep p-4 text-sm text-muted">
      <p><b className="text-ink">Mode demo.</b> Data tersimpan di browser ini saja. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di file <code>.env</code> untuk memakai database Supabase.</p>
      <button className="mt-2 font-semibold text-leaf underline" onClick={() => { resetDemo(); toast({ kind: 'success', title: 'Data demo dikembalikan ke awal' }) }}>Reset data demo</button>
    </div>
  )
}
