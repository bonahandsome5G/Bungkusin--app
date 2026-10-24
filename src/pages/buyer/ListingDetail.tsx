import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bike, Clock, ExternalLink, Info, MapPin, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAsync, useTick } from '../../lib/useAsync'
import { distanceKm, useUserLocation } from '../../lib/location'
import {
  DELIVERY_FEE, clock, discountPct, errMsg, foodCategoryLabel, km, paymentMethods, remaining, rupiah, timeWindow,
} from '../../lib/format'
import type { Fulfillment } from '../../lib/types'
import { BackLink, DiscountBadge, ErrorBox, FoodThumb, Rating, Spinner, StockBar, Stepper } from '../../components/ui'
import { useToast } from '../../lib/toast'

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const loc = useUserLocation()
  const now = useTick(30000)
  const { data: l, loading, error, reload } = useAsync(() => api.getListing(id!), [id])

  const [qty, setQty] = useState(1)
  const [mode, setMode] = useState<Fulfillment>('pickup')
  const [address, setAddress] = useState('')
  const [pay, setPay] = useState(paymentMethods[0])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <Spinner />
  if (error) return <div className="py-6"><ErrorBox message={error} onRetry={reload} /></div>
  if (!l) return <div className="py-10"><BackLink to="/" /><p className="mt-4 font-display text-2xl font-bold">Stok ini tidak ditemukan.</p></div>

  const ended = new Date(l.pickup_end).getTime() <= now || l.status !== 'active'
  const soldOut = l.qty_available <= 0
  const started = new Date(l.pickup_start).getTime() <= now
  const maxQty = Math.min(5, l.qty_available)
  const fee = mode === 'delivery' ? DELIVERY_FEE : 0
  const total = l.price * qty + fee
  const saved = (l.original_price - l.price) * qty
  const dist = distanceKm(loc.coords, l.store)
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${l.store.lat},${l.store.lng}`

  const order = async () => {
    setFormError(null)
    if (!profile) {
      navigate(`/masuk?next=${encodeURIComponent(`/listing/${l.id}`)}`)
      return
    }
    if (profile.role === 'partner') {
      setFormError('Akun mitra tidak bisa memesan. Masuk dengan akun pembeli untuk mencoba.')
      return
    }
    if (mode === 'delivery' && !address.trim()) {
      setFormError('Isi alamat pengantaran dulu.')
      return
    }
    setBusy(true)
    try {
      const o = await api.placeOrder({ listingId: l.id, qty, fulfillment: mode, paymentMethod: pay, deliveryAddress: address })
      toast({ kind: 'success', title: `Pembayaran ${pay} berhasil`, body: `Kode pengambilanmu ${o.code}` })
      navigate(`/pesanan/${o.id}?baru=1`, { replace: true })
    } catch (e) {
      setFormError(errMsg(e))
      reload(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-40 pt-4 md:pb-10">
      <BackLink to="/" label="Jelajah" />
      <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,1fr)_380px]">
        <article>
          <div className="relative">
            <FoodThumb listing={l} className="aspect-[16/10] w-full rounded-3xl" />
            <DiscountBadge original={l.original_price} price={l.price} className="absolute left-4 top-4 !px-3 !py-1 !text-base" />
          </div>
          <p className="mt-5 text-sm font-semibold text-muted">{foodCategoryLabel(l.category)}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{l.title}</h1>
          {l.description && <p className="mt-2 max-w-prose text-muted">{l.description}</p>}

          <div className="mt-5 flex items-end gap-4">
            <span className="font-display text-5xl font-extrabold text-leaf">{rupiah(l.price)}</span>
            <span className="pb-1.5 text-lg text-muted line-through">{rupiah(l.original_price)}</span>
          </div>
          <p className="mt-1 font-semibold text-mustard-deep">Hemat {rupiah(l.original_price - l.price)} per porsi ({discountPct(l.original_price, l.price)}%)</p>

          <dl className="mt-6 divide-y divide-sand border-y border-sand">
            <InfoRow icon={<Clock className="size-5" />} title={`Ambil hari ini ${timeWindow(l.pickup_start, l.pickup_end)}`}>
              {ended ? 'Jam pengambilan sudah lewat.' : started ? `Tutup ${remaining(l.pickup_end, now)} lagi.` : `Bisa diambil mulai ${clock(l.pickup_start)}.`}
            </InfoRow>
            <InfoRow icon={<ShoppingBag className="size-5" />} title={soldOut ? 'Habis' : `Sisa ${l.qty_available} dari ${l.qty_total} porsi`}>
              <div className="mt-1.5 max-w-xs"><StockBar left={l.qty_available} total={l.qty_total} /></div>
            </InfoRow>
            <InfoRow icon={<MapPin className="size-5" />} title={<Link to={`/toko/${l.store.id}`} className="hover:underline">{l.store.name}</Link>}>
              <span className="block">{l.store.address} <span aria-hidden>•</span> {km(dist)}</span>
              <span className="mt-1 flex items-center gap-3">
                <Rating value={l.store.rating_avg} count={l.store.rating_count} />
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-leaf hover:underline">
                  Petunjuk arah <ExternalLink className="size-3.5" />
                </a>
              </span>
            </InfoRow>
            <InfoRow icon={<ShieldCheck className="size-5" />} title={l.quality_checked ? 'Lolos cek kelayakan mitra' : 'Belum dicek kelayakan'}>
              {l.made_at ? `Dibuat hari ini pukul ${clock(l.made_at)}. ` : ''}
              Mitra menyatakan makanan disimpan sesuai standar dan layak konsumsi hari ini.
            </InfoRow>
            {l.allergens && (
              <InfoRow icon={<Info className="size-5" />} title="Mengandung alergen">{l.allergens}</InfoRow>
            )}
          </dl>
        </article>

        {/* panel pesan */}
        <aside className="md:sticky md:top-20 md:self-start">
          <div className="panel space-y-5 p-5">
            <h2 className="text-xl font-bold">Pesan</h2>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Jumlah porsi</span>
              <Stepper value={Math.min(qty, Math.max(1, maxQty))} max={Math.max(1, maxQty)} onChange={setQty} />
            </div>

            <fieldset>
              <legend className="mb-2 font-semibold">Cara ambil</legend>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard checked={mode === 'pickup'} onSelect={() => setMode('pickup')} name="mode"
                  title="Ambil sendiri" sub="Tanpa ongkir" icon={<ShoppingBag className="size-4" />} />
                <ChoiceCard checked={mode === 'delivery'} onSelect={() => setMode('delivery')} name="mode" disabled={!l.delivery_available}
                  title="Antar kurir" sub={l.delivery_available ? `+${rupiah(DELIVERY_FEE)}` : 'Belum tersedia'} icon={<Bike className="size-4" />} />
              </div>
              {mode === 'delivery' && (
                <label className="field mt-3">
                  <span>Alamat pengantaran</span>
                  <textarea rows={2} className="input" value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="Contoh: Kos Melati kamar 4, Jl. Kemanggisan Ilir III No. 9" />
                  <small className="text-xs text-muted">Kurir rekanan menjemput pada jam pengambilan. Integrasi armada Gojek sedang disiapkan.</small>
                </label>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 font-semibold"><Wallet className="size-4" /> Bayar dengan</legend>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={pay === m} onClick={() => setPay(m)}>{m}</button>
                ))}
              </div>
              {api.mode === 'demo' && <p className="mt-2 text-xs text-muted">Mode demo: pembayaran disimulasikan, tidak ada uang yang ditarik.</p>}
            </fieldset>

            <div className="space-y-1 border-t border-sand pt-4 text-sm">
              <Line label={`${qty} × ${rupiah(l.price)}`} value={rupiah(l.price * qty)} />
              {fee > 0 && <Line label="Ongkir kurir" value={rupiah(fee)} />}
              <Line label="Kamu hemat" value={rupiah(saved)} accent />
            </div>

            {formError && <p className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-semibold text-tomato" role="alert">{formError}</p>}

            <button className="btn btn-primary hidden w-full !py-3.5 text-base md:flex" disabled={busy || ended || soldOut} onClick={order}>
              {ended ? 'Sudah ditutup' : soldOut ? 'Habis' : busy ? 'Memproses pembayaran…' : `Bayar ${rupiah(total)}`}
            </button>
          </div>
        </aside>
      </div>

      {/* CTA lengket di ponsel */}
      <div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-sand bg-[#fffdf8] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 md:hidden">
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <p className="text-xs text-muted">Total</p>
            <p className="font-display text-xl font-extrabold">{rupiah(total)}</p>
          </div>
          <button className="btn btn-primary ml-auto flex-1 !py-3.5 text-base" disabled={busy || ended || soldOut} onClick={order}>
            {ended ? 'Sudah ditutup' : soldOut ? 'Habis' : busy ? 'Memproses…' : profile ? 'Pesan & bayar' : 'Masuk untuk pesan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, title, children }: { icon: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-4">
      <span className="mt-0.5 text-leaf">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="font-semibold">{title}</dt>
        {children && <dd className="text-sm text-muted">{children}</dd>}
      </div>
    </div>
  )
}

function ChoiceCard({ checked, onSelect, title, sub, icon, disabled, name }: {
  checked: boolean; onSelect: () => void; title: string; sub: string; icon: React.ReactNode; disabled?: boolean; name: string
}) {
  return (
    <label className={`flex cursor-pointer flex-col rounded-2xl border-[1.5px] p-3 ${checked ? 'border-leaf bg-leaf/5' : 'border-sand-deep'} ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}>
      <input type="radio" name={name} className="sr-only" checked={checked} disabled={disabled} onChange={onSelect} />
      <span className="flex items-center gap-1.5 font-semibold">{icon}{title}</span>
      <span className="text-xs text-muted">{sub}</span>
    </label>
  )
}

function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? 'font-semibold text-mustard-deep' : ''}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  )
}
