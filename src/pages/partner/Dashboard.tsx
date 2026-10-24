import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Plus, ScanLine } from 'lucide-react'
import { api } from '../../lib/api'
import { useAsync, useTick } from '../../lib/useAsync'
import { COMMISSION, errMsg, rupiah, timeWindow, clock } from '../../lib/format'
import type { OrderWithDetails } from '../../lib/types'
import { Empty, FoodThumb, Spinner, StockBar } from '../../components/ui'
import { useToast } from '../../lib/toast'

export const netOf = (o: OrderWithDetails) => Math.round((o.total - o.delivery_fee) * (1 - COMMISSION))
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

export function NoStore() {
  return (
    <Empty title="Lengkapi data toko dulu" body="Nama, alamat, dan titik lokasi tokomu dibutuhkan supaya stok muncul di pembeli terdekat."
      action={<Link to="/mitra/toko" className="btn btn-primary">Isi data toko</Link>} />
  )
}

export function VerifyCode({ onDone }: { onDone?: () => void }) {
  const toast = useToast()
  const [code, setCode] = useState('BGS-')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string; sub?: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.replace('BGS-', '').trim().length < 4) { setResult({ ok: false, text: 'Masukkan 4 digit kode dari pembeli' }); return }
    setBusy(true)
    try {
      const o = await api.completeOrder(code)
      setResult({ ok: true, text: `${o.code} selesai`, sub: `Serahkan ${o.qty}× ${o.listing.title} ke ${o.buyer_name ?? 'pembeli'}.` })
      toast({ kind: 'success', title: `Pesanan ${o.code} selesai`, body: `+${rupiah(netOf(o))} ke saldo toko` })
      setCode('BGS-')
      onDone?.()
    } catch (err) {
      setResult({ ok: false, text: errMsg(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-forest p-5 text-cream sm:p-6">
      <label htmlFor="code" className="flex items-center gap-2 font-display text-xl font-bold"><ScanLine className="size-5 text-mustard" /> Verifikasi kode pembeli</label>
      <p className="mt-1 text-sm text-cream/70">Minta pembeli menunjukkan kode di aplikasinya, ketik di sini, lalu serahkan pesanan.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input id="code" value={code} autoComplete="off" spellCheck={false}
          onChange={(e) => { setResult(null); const v = e.target.value.toUpperCase(); setCode(v.startsWith('BGS-') ? v : `BGS-${v.replace(/^B?G?S?-?/, '')}`) }}
          className="min-w-0 flex-1 rounded-2xl border-2 border-cream/20 bg-white/5 px-4 py-3 font-mono text-3xl font-bold tracking-widest text-mustard outline-none placeholder:text-cream/30 focus:border-mustard"
          placeholder="BGS-1042" maxLength={12} />
        <button className="btn btn-primary !rounded-2xl !py-3 text-base" disabled={busy}>{busy ? 'Memeriksa…' : 'Verifikasi'}</button>
      </div>
      {result && (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${result.ok ? 'bg-sage/25 text-cream' : 'bg-tomato/90 text-white'}`}>
          <b>{result.text}</b>{result.sub && <span className="block">{result.sub}</span>}
        </p>
      )}
    </form>
  )
}

export default function PartnerDashboard() {
  const toast = useToast()
  const now = useTick(30000)
  const store = useAsync(() => api.myStore(), [])
  const listings = useAsync(() => api.myListings().catch(() => []), [store.data?.id])
  const orders = useAsync(() => api.storeOrders().catch(() => []), [store.data?.id])

  useEffect(() => {
    if (!store.data) return
    return api.subscribeOrders({ storeId: store.data.id }, () => { orders.reload(true); listings.reload(true) })
  }, [store.data, orders.reload, listings.reload])

  if (store.loading) return <Spinner />
  if (!store.data) return <NoStore />

  const today = (orders.data ?? []).filter((o) => isToday(o.created_at) && o.status !== 'cancelled')
  const portions = today.reduce((a, o) => a + o.qty, 0)
  const net = today.reduce((a, o) => a + netOf(o), 0)
  const waiting = (orders.data ?? []).filter((o) => o.status === 'paid')
  const active = (listings.data ?? []).filter((l) => l.status === 'active' && new Date(l.pickup_end).getTime() > now)

  const close = async (id: string) => {
    try { await api.closeListing(id); listings.reload(true); toast({ kind: 'success', title: 'Stok ditutup', body: 'Tidak lagi tampil di pembeli.' }) }
    catch (e) { toast({ kind: 'error', title: errMsg(e) }) }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-extrabold">{store.data.name}</h1>
        </div>
        <Link to="/mitra/stok/baru" className="btn btn-primary"><Plus className="size-4" /> Unggah stok surplus</Link>
      </div>

      <VerifyCode onDone={() => { orders.reload(true) }} />

      <dl className="grid grid-cols-3 gap-3 border-y border-sand py-5">
        <Stat label="Porsi terjual hari ini" value={String(portions)} />
        <Stat label="Pendapatan bersih hari ini" value={rupiah(net)} />
        <Stat label="Menunggu diambil" value={String(waiting.length)} />
      </dl>

      <section>
        <h2 className="text-xl font-bold">Menunggu diambil</h2>
        {waiting.length === 0 ? <p className="mt-2 text-muted">Belum ada pesanan yang menunggu.</p> : (
          <ul className="mt-3 divide-y divide-sand">
            {waiting.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <span className="font-mono text-lg font-bold tracking-wide text-leaf">{o.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.qty}× {o.listing.title}</p>
                  <p className="truncate text-sm text-muted">{o.buyer_name ?? 'Pembeli'} <span aria-hidden>•</span> dipesan {clock(o.created_at)} <span aria-hidden>•</span> {o.fulfillment === 'delivery' ? 'antar kurir' : 'ambil sendiri'}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{rupiah(o.total - o.delivery_fee)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Stok aktif</h2>
          <Link to="/mitra/stok" className="text-sm font-semibold text-leaf underline">Semua stok</Link>
        </div>
        {active.length === 0 ? (
          <div className="mt-3"><Empty title="Belum ada stok aktif" body="Unggah stok sisa 1–2 jam sebelum tutup, atau atur jadwal supaya terbit otomatis."
            action={<div className="flex flex-wrap justify-center gap-2"><Link to="/mitra/stok/baru" className="btn btn-dark">Unggah stok</Link><Link to="/mitra/jadwal" className="btn btn-ghost">Atur jadwal</Link></div>} /></div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {active.map((l) => (
              <li key={l.id} className="panel flex gap-3 p-3">
                <FoodThumb listing={l} className="size-16 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Link to={`/mitra/stok/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                  <p className="text-sm text-muted">{timeWindow(l.pickup_start, l.pickup_end)} <span aria-hidden>•</span> {rupiah(l.price)}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1"><StockBar left={l.qty_available} total={l.qty_total} /></div>
                    <span className="text-xs font-semibold">{l.qty_available}/{l.qty_total}</span>
                  </div>
                </div>
                <button className="self-start text-xs font-semibold text-muted underline hover:text-tomato" onClick={() => close(l.id)}>Tutup</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 className="size-3.5" /> Pendapatan bersih = harga jual dikurangi komisi Bungkus! {COMMISSION * 100}%. Pembayaran masih simulasi; nantinya dana diteruskan otomatis lewat payment gateway.</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted sm:text-sm">{label}</dt>
      <dd className="font-display text-2xl font-extrabold sm:text-3xl">{value}</dd>
    </div>
  )
}
