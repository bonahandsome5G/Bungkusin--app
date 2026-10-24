import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import {
  dateLabel, discountPct, errMsg, foodCategories, rupiah, timeWindow, toHHMM, todayAt,
} from '../../lib/format'
import type { FoodCategory, ListingInput } from '../../lib/types'
import { BackLink, Empty, FoodThumb, Spinner } from '../../components/ui'
import { useToast } from '../../lib/toast'
import { NoStore } from './Dashboard'

export function PartnerListings() {
  const store = useAsync(() => api.myStore(), [])
  const { data, loading } = useAsync(() => api.myListings().catch(() => []), [store.data?.id])
  if (store.loading || loading) return <Spinner />
  if (!store.data) return <NoStore />
  const now = Date.now()
  const rows = data ?? []
  const isActive = (l: typeof rows[0]) => l.status === 'active' && new Date(l.pickup_end).getTime() > now

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Stok</h1>
        <Link to="/mitra/stok/baru" className="btn btn-primary"><Plus className="size-4" /> Unggah stok</Link>
      </div>
      {rows.length === 0 ? (
        <div className="mt-6"><Empty title="Belum ada stok" body="Unggah surplus pertama kamu: foto, harga diskon, dan jam pengambilan." action={<Link to="/mitra/stok/baru" className="btn btn-dark">Unggah stok</Link>} /></div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-sand">
                <th className="py-2 font-semibold">Menu</th><th className="font-semibold">Tanggal</th><th className="font-semibold">Jam ambil</th>
                <th className="text-right font-semibold">Harga</th><th className="text-right font-semibold">Terjual</th><th className="pl-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5">
                    <Link to={`/mitra/stok/${l.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                      <FoodThumb listing={l} className="size-10 rounded-lg" />{l.title}
                    </Link>
                  </td>
                  <td>{dateLabel(l.pickup_start)}</td>
                  <td>{timeWindow(l.pickup_start, l.pickup_end)}</td>
                  <td className="text-right tabular-nums">{rupiah(l.price)}</td>
                  <td className="text-right tabular-nums">{l.qty_total - l.qty_available}/{l.qty_total}</td>
                  <td className="pl-4">
                    {isActive(l)
                      ? <span className="rounded-full bg-mustard px-2 py-0.5 text-xs font-bold text-forest">{l.qty_available ? 'Tayang' : 'Habis'}</span>
                      : <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-muted">Selesai</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const CHECKS = [
  'Makanan dibuat hari ini dan belum pernah disajikan ke pelanggan',
  'Disimpan pada suhu yang sesuai (panas tetap panas, dingin tetap dingin)',
  'Dikemas tertutup dan diberi label nama menu',
]

export function ListingForm() {
  const { id } = useParams()
  const editing = !!id && id !== 'baru'
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const existing = useAsync(() => (editing ? api.myListings().then((ls) => ls.find((l) => l.id === id) ?? null) : Promise.resolve(null)), [id])
  const store = useAsync(() => api.myStore(), [])

  const defaultEnd = store.data?.closing_time?.slice(0, 5) ?? '21:00'
  const [f, setF] = useState({
    title: '', description: '', category: 'makanan-berat' as FoodCategory,
    original_price: '', price: '', qty_total: '5', start: '', end: '',
    allergens: '', made: '', photo_url: '' as string, delivery_available: false,
  })
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // isi default jam dari jam tutup toko / data lama
  useEffect(() => {
    const l = existing.data
    if (l) {
      setF({
        title: l.title, description: l.description ?? '', category: l.category,
        original_price: String(l.original_price), price: String(l.price), qty_total: String(l.qty_total),
        start: toHHMM(l.pickup_start), end: toHHMM(l.pickup_end), allergens: l.allergens ?? '',
        made: l.made_at ? toHHMM(l.made_at) : '', photo_url: l.photo_url ?? '', delivery_available: l.delivery_available,
      })
      setChecks(CHECKS.map(() => l.quality_checked))
    } else if (!editing && store.data) {
      const [h, m] = defaultEnd.split(':').map(Number)
      const startH = Math.max(0, h - 1)
      setF((x) => ({ ...x, start: x.start || `${String(startH).padStart(2, '0')}:${String(m).padStart(2, '0')}`, end: x.end || defaultEnd }))
    }
  }, [existing.data, store.data, editing, defaultEnd])

  if (existing.loading || store.loading) return <Spinner />
  if (!store.data) return <NoStore />
  if (editing && !existing.data) return <div><BackLink to="/mitra/stok" /><p className="mt-4 font-display text-2xl font-bold">Stok tidak ditemukan.</p></div>

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setError(null) }
  const op = Number(f.original_price) || 0
  const p = Number(f.price) || 0
  const pct = op && p ? discountPct(op, p) : null
  const sold = existing.data ? existing.data.qty_total - existing.data.qty_available : 0

  const upload = async (file?: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran foto maksimal 5 MB'); return }
    setUploading(true)
    try { set('photo_url', await api.uploadPhoto(file)) }
    catch (e) { setError(errMsg(e)) }
    finally { setUploading(false) }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return setError('Isi nama menu')
    if (!op || !p) return setError('Isi harga normal dan harga Bungkus!')
    if (p >= op) return setError('Harga Bungkus! harus lebih murah dari harga normal')
    if (!f.start || !f.end || f.end <= f.start) return setError('Jam selesai ambil harus setelah jam mulai')
    if (Number(f.qty_total) < 1) return setError('Jumlah porsi minimal 1')
    if (!checks.every(Boolean)) return setError('Centang semua poin cek kelayakan sebelum menayangkan')
    const base = existing.data ? new Date(existing.data.pickup_start) : new Date()
    const input: ListingInput = {
      id: editing ? id : undefined,
      title: f.title.trim(), description: f.description.trim() || null, category: f.category,
      original_price: op, price: p, qty_total: Number(f.qty_total),
      pickup_start: todayAt(f.start, base), pickup_end: todayAt(f.end, base),
      photo_url: f.photo_url || null, allergens: f.allergens.trim() || null,
      made_at: f.made ? todayAt(f.made, base) : null, quality_checked: true, delivery_available: f.delivery_available,
    }
    setBusy(true)
    try {
      await api.saveListing(input)
      toast({ kind: 'success', title: editing ? 'Stok diperbarui' : 'Stok tayang', body: editing ? undefined : 'Pembeli di sekitar tokomu langsung mendapat notifikasi.' })
      navigate('/mitra')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <BackLink to="/mitra/stok" label="Stok" />
      <h1 className="mt-3 text-3xl font-extrabold">{editing ? 'Ubah stok' : 'Unggah stok surplus'}</h1>
      <p className="mt-1 text-muted">Tayang untuk hari ini. Pembeli terdekat dapat notifikasi saat kamu menayangkan.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="group relative block w-full overflow-hidden rounded-2xl border-2 border-dashed border-sand-deep">
            {f.photo_url
              ? <img src={f.photo_url} alt="Foto menu" className="aspect-square w-full object-cover" />
              : <FoodThumb listing={{ photo_url: null, category: f.category, title: f.title }} className="aspect-square w-full" />}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-forest/85 py-2 text-sm font-semibold text-cream">
              <Camera className="size-4" /> {uploading ? 'Mengunggah…' : f.photo_url ? 'Ganti foto' : 'Tambah foto'}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          {f.photo_url && <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted underline" onClick={() => set('photo_url', '')}><Trash2 className="size-3" /> Hapus foto</button>}
          <p className="mt-2 text-xs text-muted">Foto asli makanan hari ini membuat pembeli lebih percaya.</p>
        </div>

        <div className="space-y-4">
          <label className="field"><span>Nama menu</span>
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Contoh: Nasi ayam bakar + sayur" maxLength={60} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field"><span>Kategori</span>
              <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as FoodCategory)}>
                {foodCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></label>
            <label className="field"><span>Jumlah porsi</span>
              <input className="input" type="number" min={Math.max(1, sold)} max={200} value={f.qty_total} onChange={(e) => set('qty_total', e.target.value)} />
              {sold > 0 && <small className="text-xs text-muted">Sudah terjual {sold} porsi.</small>}</label>
          </div>
          <label className="field"><span>Isi paket (opsional)</span>
            <textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Apa saja yang didapat pembeli" /></label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field"><span>Harga normal</span>
              <input className="input" type="number" inputMode="numeric" min={1000} step={500} value={f.original_price} onChange={(e) => set('original_price', e.target.value)} placeholder="30000" /></label>
            <label className="field"><span>Harga Bungkus!</span>
              <input className="input" type="number" inputMode="numeric" min={500} step={500} value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="9000" /></label>
          </div>
          {pct !== null && pct > 0 && (
            <p className={`text-sm font-semibold ${pct < 50 ? 'text-mustard-deep' : 'text-leaf'}`}>
              Diskon {pct}%{pct < 50 ? '. Pembeli Bungkus! terbiasa dengan potongan 50–70%, stok dengan diskon lebih dalam biasanya cepat habis.' : `, pembeli hemat ${rupiah(op - p)} per porsi.`}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="field"><span>Ambil mulai</span><input className="input" type="time" value={f.start} onChange={(e) => set('start', e.target.value)} /></label>
            <label className="field"><span>Ambil sampai</span><input className="input" type="time" value={f.end} onChange={(e) => set('end', e.target.value)} /></label>
            <label className="field"><span>Dibuat pukul</span><input className="input" type="time" value={f.made} onChange={(e) => set('made', e.target.value)} /></label>
          </div>
          <label className="field"><span>Alergen (opsional)</span>
            <input className="input" value={f.allergens} onChange={(e) => set('allergens', e.target.value)} placeholder="Contoh: gluten, susu, kacang" /></label>
          <label className="flex items-center gap-3 rounded-2xl border-[1.5px] border-sand-deep p-3">
            <input type="checkbox" className="size-5 accent-[#214a30]" checked={f.delivery_available} onChange={(e) => set('delivery_available', e.target.checked)} />
            <span><b className="block text-sm">Bisa diantar kurir</b><span className="text-xs text-muted">Pembeli membayar ongkir; kurir menjemput di jam pengambilan.</span></span>
          </label>

          <fieldset className="rounded-2xl bg-sand p-4">
            <legend className="sr-only">Cek kelayakan</legend>
            <p className="font-display text-lg font-bold">Cek kelayakan</p>
            <p className="text-sm text-muted">Wajib sebelum tayang. Pembeli melihat tanda “Lolos cek kelayakan”.</p>
            <div className="mt-3 space-y-2">
              {CHECKS.map((c, i) => (
                <label key={c} className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[#214a30]" checked={checks[i]}
                    onChange={(e) => { setChecks((xs) => xs.map((x, j) => (j === i ? e.target.checked : x))); setError(null) }} />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-semibold text-tomato" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || uploading}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tayangkan stok'}</button>
            <Link to="/mitra/stok" className="btn btn-ghost">Batal</Link>
          </div>
        </div>
      </div>
    </form>
  )
}
