import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bike, Clock, ExternalLink, MapPin, Star } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync, useTick } from '../../lib/useAsync'
import { clock, dateLabel, errMsg, remaining, rupiah, timeWindow } from '../../lib/format'
import type { OrderWithDetails } from '../../lib/types'
import { BackLink, Empty, ErrorBox, FoodThumb, Spinner, StatusPill } from '../../components/ui'
import { useToast } from '../../lib/toast'

export function OrdersPage() {
  const { profile } = useAuth()
  const { data, loading, error, reload } = useAsync(() => api.myOrders(), [profile?.id])
  useEffect(() => (profile ? api.subscribeOrders({ buyerId: profile.id }, () => reload(true)) : undefined), [profile, reload])

  if (loading) return <Spinner />
  const active = (data ?? []).filter((o) => o.status === 'paid')
  const past = (data ?? []).filter((o) => o.status !== 'paid')

  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-extrabold">Pesanan</h1>
      {error && <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div>}
      {!data?.length ? (
        <div className="mt-6">
          <Empty title="Belum ada pesanan" body="Pesan paket surplus pertama kamu malam ini dan ambil dengan kode BGS."
            action={<Link to="/" className="btn btn-dark">Cari makanan</Link>} />
        </div>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-bold">Siap diambil</h2>
          {active.length === 0
            ? <p className="mt-1 text-muted">Tidak ada pesanan yang menunggu diambil.</p>
            : <ul className="mt-3 space-y-3">{active.map((o) => <ActiveCard key={o.id} o={o} />)}</ul>}
          {past.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-bold">Riwayat</h2>
              <ul className="mt-2 divide-y divide-sand">
                {past.map((o) => (
                  <li key={o.id}>
                    <Link to={`/pesanan/${o.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <FoodThumb listing={o.listing} className="size-14 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{o.qty}× {o.listing.title}</p>
                        <p className="truncate text-sm text-muted">{o.store.name} <span aria-hidden>•</span> {dateLabel(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{rupiah(o.total)}</p>
                        {o.status === 'completed' && !o.review
                          ? <span className="text-xs font-bold text-mustard-deep">Beri ulasan</span>
                          : <StatusPill status={o.status} />}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ActiveCard({ o }: { o: OrderWithDetails }) {
  return (
    <li>
      <Link to={`/pesanan/${o.id}`} className="flex items-center gap-4 rounded-2xl bg-forest p-4 text-cream hover:bg-leaf">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xl font-bold tracking-wider text-mustard">{o.code}</p>
          <p className="truncate font-semibold">{o.qty}× {o.listing.title}</p>
          <p className="truncate text-sm text-cream/70">{o.store.name} <span aria-hidden>•</span> ambil {timeWindow(o.listing.pickup_start, o.listing.pickup_end)}</p>
        </div>
        <span className="text-sm font-bold text-mustard">Buka kode</span>
      </Link>
    </li>
  )
}

// ------------------------------------------------------------------ tiket / detail pesanan
export function OrderTicketPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const fresh = params.get('baru') === '1'
  const toast = useToast()
  const now = useTick(30000)
  const { profile } = useAuth()
  const { data: o, loading, error, reload } = useAsync(() => api.getOrder(id!), [id])

  useEffect(() => (profile ? api.subscribeOrders({ buyerId: profile.id }, () => reload(true)) : undefined), [profile, reload])

  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (loading) return <Spinner />
  if (error) return <div className="py-6"><ErrorBox message={error} onRetry={reload} /></div>
  if (!o) return <div className="py-10"><BackLink to="/pesanan" /><p className="mt-4 font-display text-2xl font-bold">Pesanan tidak ditemukan.</p></div>

  const l = o.listing
  const ended = new Date(l.pickup_end).getTime() <= now
  const started = new Date(l.pickup_start).getTime() <= now
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${o.store.lat},${o.store.lng}`

  const cancel = async () => {
    setCancelling(true)
    try {
      await api.cancelOrder(o.id)
      toast({ kind: 'success', title: 'Pesanan dibatalkan', body: 'Dana dikembalikan ke metode pembayaranmu.' })
      reload(true)
    } catch (e) {
      toast({ kind: 'error', title: errMsg(e) })
    } finally {
      setCancelling(false)
      setConfirmCancel(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-5">
      <BackLink to="/pesanan" label="Pesanan" />

      <section className={`ticket mt-4 overflow-hidden ${fresh ? 'animate-wrap-in' : ''}`} style={{ ['--tear' as string]: '62%' }}>
        <div className="p-6 pb-7">
          <div className="flex items-center justify-between">
            <span className="font-serif text-lg font-bold">Bungkus<span className="text-mustard">!</span></span>
            <StatusPill status={o.status} />
          </div>
          <p className="mt-6 text-sm text-cream/70">
            {o.status === 'paid' ? (o.fulfillment === 'delivery' ? 'Kode untuk kurir' : 'Tunjukkan kode ini ke kasir') : 'Kode pengambilan'}
          </p>
          <p className={`font-mono text-[3.25rem] font-bold leading-none tracking-wider ${o.status === 'paid' ? 'text-mustard' : 'text-cream/40 line-through decoration-2'}`}
            aria-label={`Kode ${o.code.split('').join(' ')}`}>{o.code}</p>
          <p className="mt-5 font-display text-xl font-bold">{o.qty}× {l.title}</p>
          <p className="text-cream/70">{o.store.name}</p>
        </div>
        <div className="ticket-tear mx-6" />
        <div className="space-y-3 p-6 pt-5 text-sm">
          <Row icon={<Clock className="size-4" />}>
            Ambil hari ini <b>{timeWindow(l.pickup_start, l.pickup_end)}</b>
            {o.status === 'paid' && !ended && (
              <span className="block text-cream/60">{started ? `Tutup ${remaining(l.pickup_end, now)} lagi` : `Mulai ${remaining(l.pickup_start, now)} lagi`}</span>
            )}
          </Row>
          {o.fulfillment === 'delivery' ? (
            <Row icon={<Bike className="size-4" />}>Diantar ke <b>{o.delivery_address}</b></Row>
          ) : (
            <Row icon={<MapPin className="size-4" />}>
              {o.store.address}
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 font-semibold text-mustard hover:underline">
                Petunjuk arah <ExternalLink className="size-3" />
              </a>
            </Row>
          )}
          <div className="flex justify-between border-t border-cream/15 pt-3">
            <span className="text-cream/70">Dibayar via {o.payment_method}</span>
            <span className="font-bold tabular-nums">{rupiah(o.total)}</span>
          </div>
          <div className="flex justify-between text-mustard">
            <span>Kamu hemat</span>
            <span className="font-bold tabular-nums">{rupiah((o.original_unit_price - o.unit_price) * o.qty)}</span>
          </div>
        </div>
      </section>

      {o.status === 'paid' && (
        <ol className="mt-6 space-y-2 text-sm">
          <Step done label={`Dibayar pukul ${clock(o.created_at)}`} />
          <Step label={o.fulfillment === 'delivery' ? 'Kurir mengambil pesanan di toko' : 'Datang ke toko pada jam pengambilan'} />
          <Step label="Kasir memasukkan kode, pesanan selesai" />
        </ol>
      )}
      {o.status === 'completed' && o.completed_at && (
        <p className="mt-5 text-center text-sm text-muted">Diambil pukul {clock(o.completed_at)}. Terima kasih sudah menyelamatkan makanan.</p>
      )}

      {o.status === 'completed' && <ReviewBox order={o} onDone={() => reload(true)} />}

      {o.status === 'paid' && !started && (
        <div className="mt-6 text-center">
          {confirmCancel ? (
            <div className="rounded-2xl bg-sand p-4">
              <p className="font-semibold">Batalkan pesanan ini?</p>
              <p className="text-sm text-muted">Porsi dikembalikan ke toko dan dana kembali ke {o.payment_method}.</p>
              <div className="mt-3 flex justify-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>Tidak jadi</button>
                <button className="btn btn-sm bg-tomato text-white" disabled={cancelling} onClick={cancel}>
                  {cancelling ? 'Membatalkan…' : 'Batalkan pesanan'}
                </button>
              </div>
            </div>
          ) : (
            <button className="text-sm font-semibold text-muted underline" onClick={() => setConfirmCancel(true)}>Batalkan pesanan</button>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex gap-2.5"><span className="mt-0.5 text-mustard">{icon}</span><p className="min-w-0 flex-1">{children}</p></div>
}

function Step({ label, done }: { label: string; done?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`size-3 rounded-full border-2 ${done ? 'border-leaf bg-leaf' : 'border-sand-deep'}`} />
      <span className={done ? 'font-semibold' : 'text-muted'}>{label}</span>
    </li>
  )
}

function ReviewBox({ order, onDone }: { order: OrderWithDetails; onDone: () => void }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  if (order.review) {
    return (
      <div className="panel mt-6 p-5">
        <p className="font-semibold">Ulasanmu</p>
        <p className="mt-1 flex gap-0.5" aria-label={`${order.review.rating} dari 5 bintang`}>
          {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`size-5 ${i <= order.review!.rating ? 'fill-mustard text-mustard' : 'text-sand-deep'}`} />)}
        </p>
        {order.review.comment && <p className="mt-2 text-muted">“{order.review.comment}”</p>}
      </div>
    )
  }

  const submit = async () => {
    setBusy(true)
    try {
      await api.submitReview(order.id, rating, comment.trim())
      toast({ kind: 'success', title: 'Ulasan terkirim', body: 'Membantu pembeli lain menilai kualitas makanan.' })
      onDone()
    } catch (e) {
      toast({ kind: 'error', title: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel mt-6 space-y-3 p-5">
      <p className="font-display text-lg font-bold">Bagaimana makanannya?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} role="radio" aria-checked={rating === i} aria-label={`${i} bintang`} onClick={() => setRating(i)}>
            <Star className={`size-8 ${i <= rating ? 'fill-mustard text-mustard' : 'text-sand-deep'}`} />
          </button>
        ))}
      </div>
      <textarea className="input" rows={2} placeholder="Kualitas, porsi, pelayanan saat ambil (opsional)"
        value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn btn-dark w-full" disabled={!rating || busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim ulasan'}</button>
    </div>
  )
}
