import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LocateFixed, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { PRESETS } from '../../lib/location'
import {
  COMMISSION, clock, dateLabel, dayNames, errMsg, foodCategories, foodCategoryLabel, rupiah, storeCategories,
} from '../../lib/format'
import type { FoodCategory, OrderStatus, ScheduleInput, StoreCategory } from '../../lib/types'
import { Empty, Rating, Spinner, StatusPill } from '../../components/ui'
import { MapView } from '../../components/MapView'
import { useToast } from '../../lib/toast'
import { NoStore, VerifyCode, netOf } from './Dashboard'
import { useNavigate } from 'react-router-dom'

// ------------------------------------------------------------------ pesanan
export function PartnerOrders() {
  const store = useAsync(() => api.myStore(), [])
  const orders = useAsync(() => api.storeOrders().catch(() => []), [store.data?.id])
  const [tab, setTab] = useState<OrderStatus | 'all'>('paid')
  useEffect(() => (store.data ? api.subscribeOrders({ storeId: store.data.id }, () => orders.reload(true)) : undefined), [store.data, orders.reload])

  if (store.loading || orders.loading) return <Spinner />
  if (!store.data) return <NoStore />
  const rows = (orders.data ?? []).filter((o) => tab === 'all' || o.status === tab)
  const tabs: [typeof tab, string][] = [['paid', 'Menunggu diambil'], ['completed', 'Selesai'], ['cancelled', 'Dibatalkan'], ['all', 'Semua']]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Pesanan</h1>
      <VerifyCode onDone={() => orders.reload(true)} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {tabs.map(([t, label]) => (
          <button key={t} className="chip" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {label} <span className="opacity-60">{(orders.data ?? []).filter((o) => t === 'all' || o.status === t).length}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="text-muted">Tidak ada pesanan di sini.</p> : (
        <ul className="divide-y divide-sand">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="w-28 font-mono text-lg font-bold text-leaf">{o.code}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{o.qty}× {o.listing.title}</p>
                <p className="text-sm text-muted">{o.buyer_name ?? 'Pembeli'} <span aria-hidden>•</span> {dateLabel(o.created_at)} {clock(o.created_at)} <span aria-hidden>•</span> {o.payment_method}{o.fulfillment === 'delivery' ? ` • antar ke ${o.delivery_address}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{rupiah(netOf(o))}</p>
                <StatusPill status={o.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ jadwal
const emptySchedule = (): ScheduleInput => ({
  title: '', description: '', category: 'makanan-berat', original_price: 0, price: 0, qty: 5,
  days: [1, 2, 3, 4, 5], pickup_start: '20:00', pickup_end: '21:00', active: true,
})

export function PartnerSchedules() {
  const toast = useToast()
  const store = useAsync(() => api.myStore(), [])
  const list = useAsync(() => api.listSchedules().catch(() => []), [store.data?.id])
  const [editing, setEditing] = useState<ScheduleInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (store.loading || list.loading) return <Spinner />
  if (!store.data) return <NoStore />
  const today = new Date().getDay()

  const publish = async () => {
    setBusy(true)
    try {
      const n = await api.publishSchedules()
      toast(n
        ? { kind: 'success', title: `${n} stok terbit dari jadwal`, body: 'Sudah tampil di pembeli.' }
        : { kind: 'info', title: 'Tidak ada jadwal yang perlu diterbitkan', body: 'Jadwal hari ini sudah terbit, jamnya sudah lewat, atau tidak ada jadwal untuk hari ini.' })
      list.reload(true)
    } catch (e) { toast({ kind: 'error', title: errMsg(e) }) } finally { setBusy(false) }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.title.trim()) return setError('Isi nama menu')
    if (!editing.original_price || !editing.price || editing.price >= editing.original_price) return setError('Harga Bungkus! harus lebih murah dari harga normal')
    if (editing.pickup_end <= editing.pickup_start) return setError('Jam selesai ambil harus setelah jam mulai')
    if (!editing.days.length) return setError('Pilih minimal satu hari')
    try {
      await api.saveSchedule({ ...editing, title: editing.title.trim(), description: editing.description?.trim() || null })
      toast({ kind: 'success', title: 'Jadwal disimpan' })
      setEditing(null)
      list.reload(true)
    } catch (err) { setError(errMsg(err)) }
  }

  const remove = async (id: string) => {
    try { await api.deleteSchedule(id); list.reload(true); toast({ kind: 'success', title: 'Jadwal dihapus' }) }
    catch (e) { toast({ kind: 'error', title: errMsg(e) }) }
  }

  const toggle = async (s: ScheduleInput) => {
    try { await api.saveSchedule({ ...s, active: !s.active }); list.reload(true) }
    catch (e) { toast({ kind: 'error', title: errMsg(e) }) }
  }

  const upd = <K extends keyof ScheduleInput>(k: K, v: ScheduleInput[K]) => { setEditing((x) => x && { ...x, [k]: v }); setError(null) }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Jadwal stok</h1>
          <p className="mt-1 max-w-xl text-muted">Untuk menu yang hampir selalu tersisa menjelang tutup. Jadwal terbit otomatis setiap hari, atau terbitkan sekarang dengan satu klik.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => { setEditing(emptySchedule()); setError(null) }}><Plus className="size-4" /> Jadwal baru</button>
          <button className="btn btn-primary" disabled={busy} onClick={publish}>{busy ? 'Menerbitkan…' : 'Terbitkan jadwal hari ini'}</button>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="panel space-y-4 p-5">
          <p className="font-display text-xl font-bold">{editing.id ? 'Ubah jadwal' : 'Jadwal baru'}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field"><span>Nama menu</span><input className="input" value={editing.title} onChange={(e) => upd('title', e.target.value)} placeholder="Paket roti manis isi 4" /></label>
            <label className="field"><span>Kategori</span>
              <select className="input" value={editing.category} onChange={(e) => upd('category', e.target.value as FoodCategory)}>
                {foodCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-5">
            <label className="field sm:col-span-1"><span>Harga normal</span><input className="input" type="number" min={0} step={500} value={editing.original_price || ''} onChange={(e) => upd('original_price', Number(e.target.value))} /></label>
            <label className="field sm:col-span-1"><span>Harga Bungkus!</span><input className="input" type="number" min={0} step={500} value={editing.price || ''} onChange={(e) => upd('price', Number(e.target.value))} /></label>
            <label className="field sm:col-span-1"><span>Porsi</span><input className="input" type="number" min={1} value={editing.qty} onChange={(e) => upd('qty', Number(e.target.value))} /></label>
            <label className="field sm:col-span-1"><span>Ambil mulai</span><input className="input" type="time" value={editing.pickup_start} onChange={(e) => upd('pickup_start', e.target.value)} /></label>
            <label className="field sm:col-span-1"><span>Sampai</span><input className="input" type="time" value={editing.pickup_end} onChange={(e) => upd('pickup_end', e.target.value)} /></label>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Hari</legend>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((d, i) => (
                <button type="button" key={d} className="chip" aria-pressed={editing.days.includes(i)}
                  onClick={() => upd('days', editing.days.includes(i) ? editing.days.filter((x) => x !== i) : [...editing.days, i].sort())}>{d}</button>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm font-semibold text-tomato" role="alert">{error}</p>}
          <div className="flex gap-2"><button className="btn btn-dark">Simpan jadwal</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Batal</button></div>
        </form>
      )}

      {(list.data ?? []).length === 0 && !editing ? (
        <Empty title="Belum ada jadwal" body="Contoh: setiap Senin–Jumat pukul 20.00–21.00, 6 paket roti manis." action={<button className="btn btn-dark" onClick={() => setEditing(emptySchedule())}>Buat jadwal</button>} />
      ) : (
        <ul className="divide-y divide-sand">
          {(list.data ?? []).map((s) => (
            <li key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-4 ${s.active ? '' : 'opacity-50'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title} <span className="font-normal text-muted">({foodCategoryLabel(s.category)})</span></p>
                <p className="text-sm text-muted">{s.pickup_start.replace(':', '.')}–{s.pickup_end.replace(':', '.')} <span aria-hidden>•</span> {s.qty} porsi <span aria-hidden>•</span> {rupiah(s.price)} <span className="line-through">{rupiah(s.original_price)}</span></p>
                <div className="mt-1.5 flex gap-1">
                  {dayNames.map((d, i) => (
                    <span key={d} title={i === today ? 'Hari ini' : undefined} className={`grid h-7 w-10 place-items-center rounded-full text-[11px] font-bold ${s.days.includes(i) ? 'bg-leaf text-cream' : 'bg-sand text-muted'} ${i === today ? 'ring-2 ring-mustard' : ''}`}>{d}</span>
                  ))}
                </div>
              </div>
              <span className="text-sm text-muted">{s.last_published_on && s.last_published_on >= new Date().toISOString().slice(0, 10) ? 'Sudah terbit hari ini' : ''}</span>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-5 accent-[#214a30]" checked={s.active} onChange={() => toggle(s)} /> Aktif
              </label>
              <button aria-label="Ubah jadwal" className="p-2 text-muted hover:text-ink" onClick={() => { setEditing(s); setError(null) }}><Pencil className="size-4" /></button>
              <button aria-label="Hapus jadwal" className="p-2 text-muted hover:text-tomato" onClick={() => remove(s.id)}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ laporan
export function PartnerReport() {
  const store = useAsync(() => api.myStore(), [])
  const orders = useAsync(() => api.storeOrders().catch(() => []), [store.data?.id])
  const [days, setDays] = useState(7)

  const report = useMemo(() => {
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1))
    const valid = (orders.data ?? []).filter((o) => o.status !== 'cancelled' && new Date(o.created_at) >= since)
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(since); d.setDate(since.getDate() + i)
      return { key: d.toDateString(), label: d.toLocaleDateString('id-ID', days > 7 ? { day: 'numeric' } : { weekday: 'short' }), portions: 0 }
    })
    const items = new Map<string, { portions: number; revenue: number }>()
    for (const o of valid) {
      const b = buckets.find((x) => x.key === new Date(o.created_at).toDateString())
      if (b) b.portions += o.qty
      const it = items.get(o.listing.title) ?? { portions: 0, revenue: 0 }
      it.portions += o.qty; it.revenue += o.total - o.delivery_fee
      items.set(o.listing.title, it)
    }
    const gross = valid.reduce((a, o) => a + o.total - o.delivery_fee, 0)
    return {
      buckets, gross, commission: Math.round(gross * COMMISSION), net: valid.reduce((a, o) => a + netOf(o), 0),
      portions: valid.reduce((a, o) => a + o.qty, 0), orders: valid.length,
      top: [...items.entries()].sort((a, b) => b[1].portions - a[1].portions).slice(0, 5),
    }
  }, [orders.data, days])

  if (store.loading || orders.loading) return <Spinner />
  if (!store.data) return <NoStore />
  const max = Math.max(1, ...report.buckets.map((b) => b.portions))
  const kg = (report.portions * 0.4).toLocaleString('id-ID', { maximumFractionDigits: 1 })

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Laporan penjualan</h1>
        <div className="flex gap-2" role="group" aria-label="Periode">
          {[7, 30].map((d) => <button key={d} className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>{d} hari</button>)}
        </div>
      </div>

      <section className="grid gap-6 rounded-3xl bg-forest p-6 text-cream sm:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-display text-7xl font-extrabold leading-none text-mustard">{report.portions}</p>
          <p className="mt-2 font-display text-xl font-bold">porsi diselamatkan dari tempat sampah</p>
          <p className="text-cream/70">± {kg} kg makanan, {report.orders} pesanan, dalam {days} hari terakhir.</p>
        </div>
        <dl className="space-y-2 self-end text-sm">
          <div className="flex justify-between"><dt className="text-cream/70">Penjualan kotor</dt><dd className="tabular-nums">{rupiah(report.gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-cream/70">Komisi Bungkus! ({COMMISSION * 100}%)</dt><dd className="tabular-nums">−{rupiah(report.commission)}</dd></div>
          <div className="flex justify-between border-t border-cream/20 pt-2 text-base font-bold"><dt>Pendapatan tambahan</dt><dd className="tabular-nums text-mustard">{rupiah(report.net)}</dd></div>
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-bold">Porsi terjual per hari</h2>
        <div className="mt-4 flex h-48 items-end gap-1.5 border-b border-sand-deep" role="img"
          aria-label={`Grafik porsi per hari: ${report.buckets.map((b) => `${b.label} ${b.portions}`).join(', ')}`}>
          {report.buckets.map((b, i) => (
            <div key={b.key} className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-bold tabular-nums text-muted">{b.portions || ''}</span>
              <div className={`w-full max-w-10 rounded-t-md ${i === report.buckets.length - 1 ? 'bg-mustard' : 'bg-leaf'}`}
                style={{ height: `${(b.portions / max) * 82}%`, minHeight: b.portions ? 4 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          {report.buckets.map((b) => <span key={b.key} className="flex-1 text-center text-[11px] text-muted">{b.label}</span>)}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Menu paling laku</h2>
          {report.top.length === 0 ? <p className="mt-2 text-muted">Belum ada penjualan di periode ini.</p> : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-muted"><tr className="border-b border-sand"><th className="py-2 text-left font-semibold">Menu</th><th className="text-right font-semibold">Porsi</th><th className="text-right font-semibold">Penjualan</th></tr></thead>
              <tbody className="divide-y divide-sand">
                {report.top.map(([t, v]) => <tr key={t}><td className="py-2">{t}</td><td className="text-right tabular-nums">{v.portions}</td><td className="text-right tabular-nums">{rupiah(v.revenue)}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>
        <section>
          <h2 className="text-xl font-bold">Rating toko</h2>
          <p className="mt-2 flex items-baseline gap-2"><Rating value={store.data.rating_avg} className="font-display text-4xl font-extrabold" /><span className="text-muted">dari {store.data.rating_count} ulasan</span></p>
          <p className="mt-1 text-sm text-muted">Pembeli memberi rating setelah pesanan diambil. Foto asli dan pengemasan rapi paling sering disebut di ulasan bagus.</p>
        </section>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ pengaturan toko
export function StoreSettings() {
  const toast = useToast()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const store = useAsync(() => api.myStore(), [])
  const [f, setF] = useState({
    name: '', category: 'restoran' as StoreCategory, description: '', address: '', phone: '',
    closing_time: '21:00', lat: PRESETS[0].coords.lat, lng: PRESETS[0].coords.lng,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = store.data
    if (s) setF({ name: s.name, category: s.category, description: s.description ?? '', address: s.address, phone: s.phone ?? '', closing_time: s.closing_time?.slice(0, 5) ?? '21:00', lat: s.lat, lng: s.lng })
  }, [store.data])

  if (store.loading) return <Spinner />
  const isNew = !store.data
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setError(null) }

  const gps = () => navigator.geolocation?.getCurrentPosition(
    (p) => { set('lat', p.coords.latitude); set('lng', p.coords.longitude) },
    () => setError('Lokasi tidak terdeteksi. Klik titik toko di peta.'),
    { enableHighAccuracy: true, timeout: 10000 },
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim() || !f.address.trim()) return setError('Isi nama dan alamat toko')
    setBusy(true)
    try {
      await api.saveStore({
        name: f.name.trim(), category: f.category, description: f.description.trim() || null, address: f.address.trim(),
        phone: f.phone.trim() || null, closing_time: f.closing_time || null, lat: f.lat, lng: f.lng,
      })
      toast({ kind: 'success', title: isNew ? 'Toko siap berjualan' : 'Data toko disimpan' })
      if (isNew) navigate('/mitra/stok/baru')
      else store.reload(true)
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">{isNew ? `Halo${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! Isi data tokomu` : 'Data toko'}</h1>
        <p className="mt-1 text-muted">{isNew ? 'Sekali saja. Setelah ini kamu bisa langsung mengunggah stok surplus.' : 'Tampil di halaman toko dan dipakai untuk menghitung jarak ke pembeli.'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field"><span>Nama toko</span><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Warung Bu Tini" /></label>
        <label className="field"><span>Jenis usaha</span>
          <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as StoreCategory)}>
            {storeCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
      </div>
      <label className="field"><span>Alamat</span><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Jl. Rawa Belong No. 45, Jakarta Barat" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field"><span>No. HP / WhatsApp</span><input className="input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08xx" /></label>
        <label className="field"><span>Jam tutup</span><input className="input" type="time" value={f.closing_time} onChange={(e) => set('closing_time', e.target.value)} />
          <small className="text-xs text-muted">Dipakai sebagai jam pengambilan default.</small></label>
      </div>
      <label className="field"><span>Deskripsi singkat (opsional)</span><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Apa yang biasa tersisa di tokomu" /></label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Titik lokasi toko</span>
          <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-leaf" onClick={gps}><LocateFixed className="size-4" /> Pakai lokasi saya</button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-sand">
          <MapView center={{ lat: f.lat, lng: f.lng }} pins={[{ id: 'store', lat: f.lat, lng: f.lng, label: f.name || 'Tokomu', active: true }]}
            onPick={(c) => { set('lat', c.lat); set('lng', c.lng) }} zoom={16} className="h-72 w-full" />
        </div>
        <p className="mt-1 text-xs text-muted">Klik peta untuk memindahkan titik. {f.lat.toFixed(5)}, {f.lng.toFixed(5)}</p>
      </div>

      {error && <p className="text-sm font-semibold text-tomato" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : isNew ? 'Simpan dan unggah stok pertama' : 'Simpan data toko'}</button>
    </form>
  )
}
