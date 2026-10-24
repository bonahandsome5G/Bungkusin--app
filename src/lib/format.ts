import type { FoodCategory, StoreCategory } from './types'

const idr = new Intl.NumberFormat('id-ID')

export const rupiah = (n: number) => `Rp${idr.format(Math.round(n))}`

/** 9000 → "9rb" untuk pin peta */
export const rupiahShort = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}rb`.replace('.', ',') : `${n}`)

export const discountPct = (original: number, price: number) =>
  Math.round(((original - price) / original) * 100)

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')

export const timeWindow = (start: string, end: string) => `${clock(start)}–${clock(end)}`

export const dateLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(Date.now() - 86400000)
  if (d.toDateString() === today.toDateString()) return 'Hari ini'
  if (d.toDateString() === yest.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export const km = (d: number) =>
  d < 1 ? `${Math.round(d * 1000 / 10) * 10} m` : `${(Math.round(d * 10) / 10).toString().replace('.', ',')} km`

/** "1 j 20 m" — sisa waktu sampai iso */
export const remaining = (iso: string, now = Date.now()) => {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const min = Math.ceil(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h} j ${m} m` : `${m} m`
}

export const foodCategories: { id: FoodCategory; label: string }[] = [
  { id: 'makanan-berat', label: 'Makanan berat' },
  { id: 'roti-kue', label: 'Roti & kue' },
  { id: 'minuman', label: 'Minuman' },
  { id: 'camilan', label: 'Camilan' },
  { id: 'sayur-buah', label: 'Sayur & buah' },
]
export const foodCategoryLabel = (c: FoodCategory) => foodCategories.find((x) => x.id === c)?.label ?? c

export const storeCategories: { id: StoreCategory; label: string }[] = [
  { id: 'restoran', label: 'Restoran' },
  { id: 'kafe', label: 'Kafe' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'umkm', label: 'UMKM / warung' },
]
export const storeCategoryLabel = (c: StoreCategory) => storeCategories.find((x) => x.id === c)?.label ?? c

export const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export const paymentMethods = ['GoPay', 'OVO', 'DANA', 'QRIS', 'Kartu debit']

/** Komisi platform dari setiap transaksi (lihat Business Model Canvas) */
export const COMMISSION = 0.1
export const DELIVERY_FEE = 10000

/** Perkiraan dampak: 1 porsi ≈ 0,4 kg makanan ≈ 1 kg CO2e tercegah */
export const KG_PER_PORTION = 0.4
export const CO2_PER_KG = 2.5

/** "HH:MM" hari ini → ISO */
export const todayAt = (hhmm: string, base = new Date()) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** ISO → "HH:MM" waktu lokal (untuk input type=time) */
export const toHHMM = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Terjadi kesalahan. Coba lagi.'
