import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, List, Map as MapIcon, MapPin, Search, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAsync, useTick } from '../../lib/useAsync'
import { distanceKm, useUserLocation } from '../../lib/location'
import { discountPct, foodCategories, km, remaining, rupiah, rupiahShort, timeWindow } from '../../lib/format'
import type { FoodCategory, ListingWithStore } from '../../lib/types'
import { DiscountBadge, Empty, ErrorBox, FoodThumb, Spinner } from '../../components/ui'
import { MapView } from '../../components/MapView'

const RADII = [1, 3, 5, 0] as const // 0 = semua
const PRICE_CAPS = [10000, 15000, 0] as const
type Sort = 'nearest' | 'cheapest' | 'ending' | 'discount'

const INTRO_KEY = 'bungkus-intro-dismissed'

export default function Explore() {
  const loc = useUserLocation()
  const navigate = useNavigate()
  const now = useTick(30000)
  const { data, loading, error, reload } = useAsync(() => api.listActiveListings(), [])

  useEffect(() => api.subscribeNewListings(() => reload(true)), [reload])

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FoodCategory | null>(null)
  const [radius, setRadius] = useState<number>(5)
  const [cap, setCap] = useState<number>(0)
  const [sort, setSort] = useState<Sort>('nearest')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [active, setActive] = useState<string | null>(null)
  const [intro, setIntro] = useState(() => {
    try { return localStorage.getItem(INTRO_KEY) !== '1' } catch { return true }
  })

  const items = useMemo(() => {
    const rows = (data ?? [])
      .filter((l) => new Date(l.pickup_end).getTime() > now)
      .map((l) => ({ ...l, distance: distanceKm(loc.coords, l.store) }))
      .filter((l) => !radius || l.distance <= radius)
      .filter((l) => !cat || l.category === cat)
      .filter((l) => !cap || l.price <= cap)
      .filter((l) => {
        if (!q.trim()) return true
        const s = q.trim().toLowerCase()
        return l.title.toLowerCase().includes(s) || l.store.name.toLowerCase().includes(s)
      })
    const by: Record<Sort, (a: typeof rows[0], b: typeof rows[0]) => number> = {
      nearest: (a, b) => a.distance - b.distance,
      cheapest: (a, b) => a.price - b.price,
      ending: (a, b) => a.pickup_end.localeCompare(b.pickup_end),
      discount: (a, b) => discountPct(b.original_price, b.price) - discountPct(a.original_price, a.price),
    }
    return rows.sort(by[sort])
  }, [data, loc.coords, radius, cat, cap, q, sort, now])

  const storeCount = new Set(items.map((i) => i.store_id)).size
  const avgSave = items.length ? Math.round(items.reduce((a, l) => a + discountPct(l.original_price, l.price), 0) / items.length) : 0
  const filtersOn = !!cat || !!cap || !!q || radius !== 5

  return (
    <div className="pt-5">
      <section className="max-w-2xl">
        <h1 className="text-[1.75rem] font-extrabold sm:text-5xl">Selamatkan makanan berlebih, sebelum jadi sampah.</h1>
        <p className="mt-2 text-muted">
          {loading ? 'Mencari stok surplus di sekitarmu…'
            : items.length ? `${items.length} paket dari ${storeCount} toko di sekitar ${loc.label.toLowerCase() === 'lokasi saya' ? 'kamu' : loc.label}, rata-rata ${avgSave}% lebih murah.`
              : 'Belum ada stok yang cocok di sekitarmu.'}
        </p>
        {loc.error && <p className="mt-2 text-sm font-semibold text-tomato">{loc.error}</p>}
      </section>

      {intro && (
        <section className="relative mt-5 grid grid-cols-3 gap-3 rounded-3xl bg-forest p-4 pr-10 text-cream sm:p-6 sm:pr-10">
          <button aria-label="Tutup penjelasan" className="absolute right-3 top-3 text-cream/60 hover:text-cream"
            onClick={() => { setIntro(false); try { localStorage.setItem(INTRO_KEY, '1') } catch { /* abaikan */ } }}>
            <X className="size-5" />
          </button>
          {[
            ['Cari', 'Restoran dan UMKM terdekat mengunggah stok sisa 1–2 jam sebelum tutup.'],
            ['Pesan', 'Bayar di aplikasi dengan harga 50–70% lebih murah.'],
            ['Ambil', 'Tunjukkan kode BGS ke kasir pada jam pengambilan.'],
          ].map(([t, b], i) => (
            <div key={t} className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mustard font-display font-extrabold text-forest sm:size-8">{i + 1}</span>
              <div>
                <p className="font-display text-base font-bold sm:text-lg">{t}</p>
                <p className="hidden text-sm text-cream/75 sm:block">{b}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* pencarian & filter */}
      <section className="-mx-4 mt-5 space-y-3 bg-cream/95 px-4 pb-3 pt-2 backdrop-blur lg:sticky lg:top-14 lg:z-[900]">
        <label className="relative block">
          <span className="sr-only">Cari makanan atau toko</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nasi, roti, kopi, atau nama toko"
            className="input rounded-full pl-10" />
        </label>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button className="chip" aria-pressed={!cat} onClick={() => setCat(null)}>Semua</button>
          {foodCategories.map((c) => (
            <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex items-center gap-x-4 overflow-x-auto px-4 text-sm lg:flex-wrap lg:gap-y-2">
          <FilterGroup label="Jarak">
            {RADII.map((r) => (
              <button key={r} className="chip !py-1" aria-pressed={radius === r} onClick={() => setRadius(r)}>{r ? `≤ ${r} km` : 'Semua'}</button>
            ))}
          </FilterGroup>
          <FilterGroup label="Harga">
            {PRICE_CAPS.map((c) => (
              <button key={c} className="chip !py-1" aria-pressed={cap === c} onClick={() => setCap(c)}>{c ? `≤ ${rupiahShort(c)}` : 'Semua'}</button>
            ))}
          </FilterGroup>
          <label className="flex shrink-0 items-center gap-2">
            <span className="font-semibold text-muted">Urutkan</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-full border-[1.5px] border-sand-deep bg-transparent px-3 py-1 font-semibold">
              <option value="nearest">Terdekat</option>
              <option value="ending">Segera tutup</option>
              <option value="cheapest">Termurah</option>
              <option value="discount">Diskon terbesar</option>
            </select>
          </label>
          <div className="ml-auto inline-flex shrink-0 rounded-full bg-sand p-1 lg:hidden" role="group" aria-label="Tampilan">
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}
              className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${view === 'list' ? 'bg-[#fffdf8] shadow-sm' : 'text-muted'}`}><List className="size-4" />Daftar</button>
            <button aria-pressed={view === 'map'} onClick={() => setView('map')}
              className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${view === 'map' ? 'bg-[#fffdf8] shadow-sm' : 'text-muted'}`}><MapIcon className="size-4" />Peta</button>
          </div>
        </div>
      </section>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}
      {loading ? <Spinner label="Mencari stok di sekitarmu…" /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className={view === 'map' ? 'hidden lg:block' : ''}>
            {items.length === 0 ? (
              <Empty
                title={filtersOn ? 'Tidak ada yang cocok dengan filter ini' : 'Belum ada stok di sekitarmu'}
                body={filtersOn ? 'Coba perluas jarak atau hapus filter harga dan kategori.' : 'Stok biasanya muncul 1–2 jam sebelum toko tutup. Ganti lokasi atau cek lagi nanti malam.'}
                action={filtersOn
                  ? <button className="btn btn-dark" onClick={() => { setCat(null); setCap(0); setQ(''); setRadius(0) }}>Hapus semua filter</button>
                  : undefined}
              />
            ) : (
              <ul className="divide-y divide-sand">
                {items.map((l) => (
                  <ListingRow key={l.id} l={l} distance={l.distance} now={now}
                    highlighted={active === l.id} onHover={() => setActive(l.id)} />
                ))}
              </ul>
            )}
          </div>
          <div className={`${view === 'list' ? 'hidden lg:block' : ''}`}>
            <div className="overflow-hidden rounded-3xl border border-sand lg:sticky lg:top-[13.5rem]">
              <MapView
                center={loc.coords}
                me={loc.coords}
                zoom={radius && radius <= 1 ? 16 : 15}
                className="h-[60vh] w-full lg:h-[calc(100dvh-15rem)]"
                pins={items.map((l) => ({ id: l.id, lat: l.store.lat, lng: l.store.lng, label: rupiahShort(l.price), active: active === l.id }))}
                onPinClick={(id) => navigate(`/listing/${id}`)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 font-semibold text-muted">{label}</span>
      {children}
    </div>
  )
}

function ListingRow({ l, distance, now, highlighted, onHover }: {
  l: ListingWithStore; distance: number; now: number; highlighted: boolean; onHover: () => void
}) {
  const started = new Date(l.pickup_start).getTime() <= now
  const left = remaining(l.pickup_end, now)
  return (
    <li onMouseEnter={onHover}>
      <Link to={`/listing/${l.id}`}
        className={`-mx-3 flex gap-4 rounded-2xl px-3 py-4 transition-colors hover:bg-sand/50 ${highlighted ? 'lg:bg-sand/50' : ''}`}>
        <div className="relative shrink-0">
          <FoodThumb listing={l} className="size-24 rounded-2xl sm:size-28" />
          <DiscountBadge original={l.original_price} price={l.price} className="absolute -left-1.5 -top-1.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-snug">{l.title}</p>
              <p className="truncate text-sm text-muted">{l.store.name}</p>
            </div>
            <div className="text-right leading-tight">
              <div className="text-xs text-muted line-through">{rupiah(l.original_price)}</div>
              <div className="font-display text-xl font-extrabold text-leaf">{rupiah(l.price)}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold text-muted"><MapPin className="size-3.5" />{km(distance)}</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Clock className="size-3.5 text-muted" /> Ambil {timeWindow(l.pickup_start, l.pickup_end)}
            </span>
            <span className={`font-semibold ${l.qty_available <= 2 ? 'text-tomato' : 'text-leaf'}`}>Sisa {l.qty_available} porsi</span>
            {!started
              ? <span className="text-muted">mulai {remaining(l.pickup_start, now)} lagi</span>
              : left && <span className="text-muted">tutup {left} lagi</span>}
          </div>
        </div>
      </Link>
    </li>
  )
}
