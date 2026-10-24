/**
 * MODE DEMO — meniru perilaku database Supabase sepenuhnya di browser (localStorage).
 * Dipakai otomatis bila VITE_SUPABASE_URL belum diisi, supaya aplikasi bisa
 * langsung dicoba / dipresentasikan. Aturan bisnisnya sama dengan fungsi SQL
 * di supabase/schema.sql (stok atomik, kode BGS-XXXX, komisi, dll).
 */
import type {
  Api, Listing, ListingWithStore, Order, OrderWithDetails, Profile, Review, Schedule, Store, FoodCategory,
} from '../types'
import { DELIVERY_FEE } from '../format'

interface DemoUser extends Profile { email: string; password: string }
interface Fav { buyer_id: string; store_id: string }
interface DB {
  version: number
  seededOn: string
  session: string | null
  users: DemoUser[]
  stores: Store[]
  listings: Listing[]
  orders: Order[]
  reviews: Review[]
  favorites: Fav[]
  schedules: Schedule[]
}

const KEY = 'bungkus-demo-db'
const VERSION = 2
export const DEMO_BUYER = { email: 'pembeli@demo.id', password: 'demo123' }
export const DEMO_PARTNER = { email: 'mitra@demo.id', password: 'demo123' }

const uuid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

const minutesFromNow = (m: number, base = Date.now()) => new Date(base + m * 60000).toISOString()
const todayKey = () => new Date().toDateString()

// ------------------------------------------------------------------ seed
const SEED_STORES: Omit<Store, 'id' | 'owner_id'>[] = [
  { name: 'Roti Senja Kemanggisan', category: 'bakery', description: 'Roti dan pastry dipanggang tiap pagi.', address: 'Jl. Kemanggisan Raya No. 12', lat: -6.1987, lng: 106.7841, closing_time: '21:00', rating_avg: 4.7, rating_count: 38 },
  { name: 'Warung Bu Tini', category: 'umkm', description: 'Nasi rames dan lauk rumahan.', address: 'Jl. Rawa Belong No. 45', lat: -6.2049, lng: 106.7862, closing_time: '20:30', rating_avg: 4.6, rating_count: 52 },
  { name: 'Kopi Rindang', category: 'kafe', description: 'Kopi susu, sandwich, dan kue.', address: 'Jl. Anggrek Cakra No. 3', lat: -6.2021, lng: 106.7795, closing_time: '22:00', rating_avg: 4.5, rating_count: 21 },
  { name: 'Ayam Bakar Mas Yon', category: 'restoran', description: 'Ayam bakar madu dan sambal korek.', address: 'Jl. Palmerah Barat No. 88', lat: -6.2078, lng: 106.791, closing_time: '21:30', rating_avg: 4.8, rating_count: 67 },
  { name: 'Es Teh Segar Pak Ujang', category: 'umkm', description: 'Es teh, es jeruk, dan gorengan.', address: 'Jl. Syahdan No. 7', lat: -6.2003, lng: 106.7856, closing_time: '21:00', rating_avg: 4.4, rating_count: 15 },
  { name: 'Dapur Hijau Salad Bar', category: 'restoran', description: 'Salad, buah potong, dan jus.', address: 'Jl. Kebon Jeruk Raya No. 21', lat: -6.1952, lng: 106.776, closing_time: '20:00', rating_avg: 4.6, rating_count: 29 },
]

type SeedListing = [store: number, title: string, desc: string, cat: FoodCategory, orig: number, price: number, total: number, left: number, startMin: number, endMin: number, allergens: string | null, delivery: boolean]
const SEED_LISTINGS: SeedListing[] = [
  [0, 'Paket roti manis isi 4', 'Campur: cokelat, keju, srikaya, pisang.', 'roti-kue', 40000, 14000, 8, 5, 0, 150, 'Gluten, susu, telur', true],
  [0, 'Croissant butter', 'Dipanggang pagi ini, masih renyah.', 'roti-kue', 22000, 8000, 6, 6, 30, 180, 'Gluten, susu', false],
  [1, 'Nasi ayam bakar + sayur', 'Nasi, ayam bakar, sayur asem, sambal.', 'makanan-berat', 30000, 9000, 6, 4, 0, 90, null, true],
  [1, 'Paket lauk rumahan', 'Tempe orek, perkedel, telur balado.', 'makanan-berat', 25000, 9000, 5, 5, 0, 90, 'Telur', false],
  [2, 'Sandwich tuna', 'Roti gandum, tuna mayo, selada.', 'makanan-berat', 35000, 12000, 4, 3, 0, 200, 'Gluten, ikan, telur', true],
  [2, 'Slice cheesecake', 'Cheesecake panggang, potongan besar.', 'roti-kue', 32000, 11000, 3, 2, 15, 200, 'Susu, telur, gluten', false],
  [3, 'Ayam bakar madu + nasi', 'Paha atas, nasi, lalapan, sambal korek.', 'makanan-berat', 38000, 13000, 10, 7, 45, 165, null, true],
  [4, 'Es teh jumbo 2 gelas', 'Teh melati, gula aren terpisah.', 'minuman', 16000, 6000, 12, 9, 0, 150, null, false],
  [4, 'Gorengan campur 6 pcs', 'Bakwan, tahu isi, tempe mendoan.', 'camilan', 15000, 5000, 8, 8, 0, 150, 'Gluten', false],
  [5, 'Buah potong 400 g', 'Melon, semangka, pepaya, nanas.', 'sayur-buah', 28000, 9000, 5, 4, 0, 60, null, true],
]

function makeSeedListings(stores: Store[], base = Date.now()): Listing[] {
  return SEED_LISTINGS.map(([si, title, description, category, original_price, price, qty_total, qty_available, s, e, allergens, delivery_available]) => ({
    id: uuid(), store_id: stores[si].id, title, description, category, original_price, price,
    qty_total, qty_available, pickup_start: minutesFromNow(s, base), pickup_end: minutesFromNow(e, base),
    photo_url: null, allergens, made_at: minutesFromNow(-300, base), quality_checked: true,
    delivery_available, status: 'active', created_at: minutesFromNow(-20, base),
  }))
}

function seed(): DB {
  const buyer: DemoUser = { id: uuid(), email: DEMO_BUYER.email, password: DEMO_BUYER.password, full_name: 'Nadia Putri', role: 'buyer' }
  const partner: DemoUser = { id: uuid(), email: DEMO_PARTNER.email, password: DEMO_PARTNER.password, full_name: 'Sari (Roti Senja)', role: 'partner' }
  const stores: Store[] = SEED_STORES.map((s, i) => ({ ...s, id: uuid(), owner_id: i === 0 ? partner.id : null, created_at: minutesFromNow(-60 * 24 * 30) }))
  const listings = makeSeedListings(stores)

  // riwayat 10 hari terakhir untuk laporan mitra & dampak pembeli
  const history: Listing[] = []
  const orders: Order[] = []
  const reviews: Review[] = []
  const names = ['Raka', 'Dewi', 'Bima', 'Laras', 'Fajar', 'Citra', 'Yoga']
  const extraBuyers: DemoUser[] = names.map((n) => ({ id: uuid(), email: `${n.toLowerCase()}@demo.id`, password: 'demo123', full_name: n, role: 'buyer' }))
  const items: [string, FoodCategory, number, number][] = [
    ['Paket roti manis isi 4', 'roti-kue', 40000, 14000],
    ['Croissant butter', 'roti-kue', 22000, 8000],
    ['Donat gula 3 pcs', 'roti-kue', 18000, 6000],
  ]
  let n = 0
  for (let day = 10; day >= 1; day--) {
    const dayBase = Date.now() - day * 86400000
    items.forEach(([title, category, op, p], k) => {
      const total = 4 + ((day + k) % 4)
      const sold = Math.max(1, total - ((day * 3 + k) % 3))
      const l: Listing = {
        id: uuid(), store_id: stores[0].id, title, description: null, category, original_price: op, price: p,
        qty_total: total, qty_available: total - sold, pickup_start: minutesFromNow(0, dayBase), pickup_end: minutesFromNow(90, dayBase),
        photo_url: null, allergens: 'Gluten', made_at: minutesFromNow(-300, dayBase), quality_checked: true,
        delivery_available: false, status: 'closed', created_at: minutesFromNow(-30, dayBase),
      }
      history.push(l)
      let left = sold
      while (left > 0) {
        const q = Math.min(left, 1 + (n % 2))
        left -= q
        const who = n % 5 === 0 ? buyer : extraBuyers[n % extraBuyers.length]
        const o: Order = {
          id: uuid(), code: `BGS-${String(1000 + n * 37).slice(-4)}`, listing_id: l.id, store_id: l.store_id, buyer_id: who.id,
          qty: q, unit_price: p, original_unit_price: op, delivery_fee: 0, total: p * q, fulfillment: 'pickup',
          payment_method: ['GoPay', 'QRIS', 'OVO', 'DANA'][n % 4], status: 'completed',
          created_at: minutesFromNow(10 + n % 40, dayBase), completed_at: minutesFromNow(60, dayBase),
        }
        orders.push(o)
        if (n % 3 === 0) {
          reviews.push({
            id: uuid(), order_id: o.id, store_id: o.store_id, buyer_id: who.id, buyer_name: who.full_name,
            rating: n % 7 === 0 ? 4 : 5,
            comment: ['Masih empuk, porsinya banyak.', 'Hemat banget buat makan malam.', 'Ramah, kodenya langsung dicek.', 'Rotinya masih wangi.'][n % 4],
            created_at: minutesFromNow(120, dayBase),
          })
        }
        n++
      }
    })
  }

  const schedules: Schedule[] = [
    { id: uuid(), store_id: stores[0].id, title: 'Paket roti manis isi 4', description: 'Campuran roti hari ini.', category: 'roti-kue', original_price: 40000, price: 14000, qty: 6, days: [1, 2, 3, 4, 5], pickup_start: '20:00', pickup_end: '21:00', active: true, last_published_on: null },
    { id: uuid(), store_id: stores[0].id, title: 'Donat gula 3 pcs', description: null, category: 'roti-kue', original_price: 18000, price: 6000, qty: 5, days: [0, 6], pickup_start: '19:30', pickup_end: '21:00', active: true, last_published_on: null },
  ]

  return {
    version: VERSION, seededOn: todayKey(), session: null,
    users: [buyer, partner, ...extraBuyers], stores, listings: [...history, ...listings],
    orders, reviews, favorites: [{ buyer_id: buyer.id, store_id: stores[1].id }], schedules,
  }
}

// ------------------------------------------------------------------ storage
let memory: DB | null = null

function load(): DB {
  if (memory) return memory
  let db: DB | null = null
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) db = JSON.parse(raw)
  } catch { /* abaikan */ }
  if (!db || db.version !== VERSION) db = seed()
  // hari baru → stok contoh diperbarui supaya selalu ada yang aktif
  if (db.seededOn !== todayKey()) {
    const seedStores = db.stores.filter((s) => SEED_STORES.some((x) => x.name === s.name))
    if (seedStores.length === SEED_STORES.length) {
      const ordered = SEED_STORES.map((x) => seedStores.find((s) => s.name === x.name)!)
      db.listings.push(...makeSeedListings(ordered))
    }
    db.seededOn = todayKey()
  }
  memory = db
  persist()
  return db
}

// sesi disimpan per tab (sessionStorage) supaya satu tab bisa jadi pembeli dan tab lain jadi mitra
const SESSION_KEY = 'bungkus-demo-session'
let memSession: string | null = null
function getSession(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY) } catch { return memSession }
}
function setSession(id: string | null) {
  memSession = id
  try { if (id) sessionStorage.setItem(SESSION_KEY, id); else sessionStorage.removeItem(SESSION_KEY) } catch { /* abaikan */ }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* penuh / diblokir */ }
}

export function resetDemo() {
  setSession(null)
  memory = seed()
  persist()
  bus.emit('auth')
  bus.emit('listings')
  bus.emit('orders')
}

// ------------------------------------------------------------------ event bus (antar-tab juga)
type Evt = 'auth' | 'listings' | 'orders' | 'listing-insert'
const bus = (() => {
  const target = new EventTarget()
  let bc: BroadcastChannel | null = null
  try { bc = new BroadcastChannel('bungkus-demo') } catch { /* tidak didukung */ }
  bc?.addEventListener('message', (e) => {
    memory = null // muat ulang dari localStorage tab lain
    target.dispatchEvent(new CustomEvent(e.data.type, { detail: e.data.detail }))
  })
  return {
    emit(type: Evt, detail?: unknown) {
      target.dispatchEvent(new CustomEvent(type, { detail }))
      bc?.postMessage({ type, detail })
    },
    on(type: Evt, fn: (detail: unknown) => void) {
      const h = (e: Event) => fn((e as CustomEvent).detail)
      target.addEventListener(type, h)
      return () => target.removeEventListener(type, h)
    },
  }
})()

const delay = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms))
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function me(db: DB): DemoUser {
  const u = db.users.find((x) => x.id === getSession())
  if (!u) throw new Error('Masuk dulu untuk melanjutkan')
  return u
}
function myStoreOf(db: DB): Store {
  const u = me(db)
  const s = db.stores.find((x) => x.owner_id === u.id)
  if (!s) throw new Error('Lengkapi data toko dulu')
  return s
}
function details(db: DB, o: Order): OrderWithDetails {
  return {
    ...o,
    listing: db.listings.find((l) => l.id === o.listing_id)!,
    store: db.stores.find((s) => s.id === o.store_id)!,
    review: db.reviews.find((r) => r.order_id === o.id) ?? null,
    buyer_name: db.users.find((u) => u.id === o.buyer_id)?.full_name,
  }
}
function withStore(db: DB, l: Listing): ListingWithStore {
  return { ...l, store: db.stores.find((s) => s.id === l.store_id)! }
}
function addRating(db: DB, storeId: string, rating: number) {
  const s = db.stores.find((x) => x.id === storeId)!
  const total = s.rating_avg * s.rating_count + rating
  s.rating_count += 1
  s.rating_avg = Math.round((total / s.rating_count) * 10) / 10
}

export function createDemoApi(): Api {
  const api: Api = {
    mode: 'demo',

    async getProfile() {
      const db = load()
      const u = db.users.find((x) => x.id === getSession())
      if (!u) return delay(null, 0)
      const { password: _pw, ...p } = u
      void _pw
      return delay(clone(p), 0)
    },

    onAuthChange(cb) {
      return bus.on('auth', cb)
    },

    async signUp({ email, password, fullName, role }) {
      const db = load()
      const e = email.trim().toLowerCase()
      if (db.users.some((u) => u.email === e)) throw new Error('Email ini sudah terdaftar. Silakan masuk.')
      if (password.length < 6) throw new Error('Kata sandi minimal 6 karakter')
      const u: DemoUser = { id: uuid(), email: e, password, full_name: fullName.trim(), role }
      db.users.push(u)
      setSession(u.id)
      persist()
      bus.emit('auth')
      return delay({ needsConfirmation: false })
    },

    async signIn(email, password) {
      const db = load()
      const u = db.users.find((x) => x.email === email.trim().toLowerCase() && x.password === password)
      if (!u) throw new Error('Email atau kata sandi salah')
      setSession(u.id)
      bus.emit('auth')
      await delay(null)
    },

    async signOut() {
      setSession(null)
      bus.emit('auth')
    },

    async updateProfile(patch) {
      const db = load()
      Object.assign(me(db), patch)
      persist()
      bus.emit('auth')
    },

    // ---------------- pembeli ----------------
    async listActiveListings() {
      const db = load()
      const now = Date.now()
      return delay(clone(db.listings
        .filter((l) => l.status === 'active' && new Date(l.pickup_end).getTime() > now && l.qty_available > 0)
        .sort((a, b) => a.pickup_end.localeCompare(b.pickup_end))
        .map((l) => withStore(db, l))))
    },

    async getListing(id) {
      const db = load()
      const l = db.listings.find((x) => x.id === id)
      return delay(l ? clone(withStore(db, l)) : null)
    },

    async getStoreDetail(id) {
      const db = load()
      const store = db.stores.find((s) => s.id === id)
      if (!store) return delay(null)
      const now = Date.now()
      return delay(clone({
        store,
        listings: db.listings.filter((l) => l.store_id === id && l.status === 'active' && new Date(l.pickup_end).getTime() > now)
          .sort((a, b) => a.pickup_start.localeCompare(b.pickup_start)),
        reviews: db.reviews.filter((r) => r.store_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20),
      }))
    },

    async placeOrder({ listingId, qty, fulfillment, paymentMethod, deliveryAddress }) {
      const db = load()
      const u = me(db)
      if (qty < 1 || qty > 5) throw new Error('Jumlah porsi harus 1 sampai 5')
      const l = db.listings.find((x) => x.id === listingId)
      if (!l) throw new Error('Stok tidak ditemukan')
      if (l.status !== 'active' || new Date(l.pickup_end).getTime() <= Date.now()) throw new Error('Stok ini sudah ditutup')
      if (l.qty_available < qty) throw new Error(`Sisa porsi tinggal ${l.qty_available}`)
      let fee = 0
      if (fulfillment === 'delivery') {
        if (!l.delivery_available) throw new Error('Toko ini belum melayani antar kurir')
        if (!deliveryAddress?.trim()) throw new Error('Isi alamat pengantaran')
        fee = DELIVERY_FEE
      }
      let code = ''
      do { code = `BGS-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}` } while (db.orders.some((o) => o.code === code))
      l.qty_available -= qty
      const o: Order = {
        id: uuid(), code, listing_id: l.id, store_id: l.store_id, buyer_id: u.id, qty,
        unit_price: l.price, original_unit_price: l.original_price, delivery_fee: fee, total: l.price * qty + fee,
        fulfillment, delivery_address: fulfillment === 'delivery' ? deliveryAddress : null,
        payment_method: paymentMethod, status: 'paid', created_at: new Date().toISOString(), completed_at: null,
      }
      db.orders.push(o)
      persist()
      bus.emit('orders')
      bus.emit('listings')
      return delay(clone(o), 500)
    },

    async myOrders() {
      const db = load()
      const u = me(db)
      return delay(clone(db.orders.filter((o) => o.buyer_id === u.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map((o) => details(db, o))))
    },

    async getOrder(id) {
      const db = load()
      const u = me(db)
      const o = db.orders.find((x) => x.id === id)
      if (!o) return delay(null)
      const ownsStore = db.stores.some((s) => s.id === o.store_id && s.owner_id === u.id)
      if (o.buyer_id !== u.id && !ownsStore) return delay(null)
      return delay(clone(details(db, o)))
    },

    async cancelOrder(id) {
      const db = load()
      const u = me(db)
      const o = db.orders.find((x) => x.id === id && x.buyer_id === u.id)
      if (!o) throw new Error('Pesanan tidak ditemukan')
      if (o.status !== 'paid') throw new Error('Pesanan ini tidak bisa dibatalkan')
      o.status = 'cancelled'
      const l = db.listings.find((x) => x.id === o.listing_id)
      if (l) l.qty_available += o.qty
      persist()
      bus.emit('orders')
      bus.emit('listings')
      await delay(null)
    },

    async submitReview(orderId, rating, comment) {
      const db = load()
      const u = me(db)
      const o = db.orders.find((x) => x.id === orderId && x.buyer_id === u.id)
      if (!o || o.status !== 'completed') throw new Error('Ulasan hanya untuk pesanan yang sudah diambil')
      if (db.reviews.some((r) => r.order_id === orderId)) throw new Error('Pesanan ini sudah diulas')
      db.reviews.push({
        id: uuid(), order_id: orderId, store_id: o.store_id, buyer_id: u.id, buyer_name: u.full_name || 'Pembeli',
        rating, comment: comment || null, created_at: new Date().toISOString(),
      })
      addRating(db, o.store_id, rating)
      persist()
      bus.emit('orders')
      await delay(null)
    },

    async listFavorites() {
      const db = load()
      const sid = getSession()
      if (!sid) return []
      return delay(db.favorites.filter((f) => f.buyer_id === sid).map((f) => f.store_id), 0)
    },

    async toggleFavorite(storeId) {
      const db = load()
      const u = me(db)
      const i = db.favorites.findIndex((f) => f.buyer_id === u.id && f.store_id === storeId)
      if (i >= 0) db.favorites.splice(i, 1)
      else db.favorites.push({ buyer_id: u.id, store_id: storeId })
      persist()
      return delay(i < 0)
    },

    // ---------------- mitra ----------------
    async myStore() {
      const db = load()
      const u = me(db)
      return delay(clone(db.stores.find((s) => s.owner_id === u.id) ?? null))
    },

    async saveStore(input) {
      const db = load()
      const u = me(db)
      if (u.role !== 'partner') throw new Error('Hanya akun mitra yang bisa membuat toko')
      let s = db.stores.find((x) => x.owner_id === u.id)
      if (s) Object.assign(s, input)
      else {
        s = { ...input, id: uuid(), owner_id: u.id, rating_avg: 0, rating_count: 0, created_at: new Date().toISOString() }
        db.stores.push(s)
      }
      persist()
      bus.emit('listings')
      return delay(clone(s))
    },

    async myListings() {
      const db = load()
      const s = myStoreOf(db)
      return delay(clone(db.listings.filter((l) => l.store_id === s.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100)))
    },

    async saveListing(input) {
      const db = load()
      const s = myStoreOf(db)
      if (input.price >= input.original_price) throw new Error('Harga Bungkus! harus lebih murah dari harga normal')
      if (new Date(input.pickup_end) <= new Date(input.pickup_start)) throw new Error('Jam selesai ambil harus setelah jam mulai')
      const { id, ...rest } = input
      if (id) {
        const l = db.listings.find((x) => x.id === id && x.store_id === s.id)
        if (!l) throw new Error('Stok tidak ditemukan')
        const sold = l.qty_total - l.qty_available
        if (rest.qty_total < sold) throw new Error(`Sudah terjual ${sold} porsi, jumlah total tidak boleh kurang dari itu`)
        Object.assign(l, rest, { qty_available: rest.qty_total - sold })
        persist()
        bus.emit('listings')
        return delay(clone(l))
      }
      const l: Listing = {
        ...rest, id: uuid(), store_id: s.id, qty_available: rest.qty_total, status: 'active', created_at: new Date().toISOString(),
      }
      db.listings.push(l)
      persist()
      bus.emit('listings')
      bus.emit('listing-insert', l.id)
      return delay(clone(l))
    },

    async closeListing(id) {
      const db = load()
      const s = myStoreOf(db)
      const l = db.listings.find((x) => x.id === id && x.store_id === s.id)
      if (l) l.status = 'closed'
      persist()
      bus.emit('listings')
    },

    async uploadPhoto(file) {
      // kecilkan gambar lalu simpan sebagai data URL
      const url = URL.createObjectURL(file)
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image()
          i.onload = () => res(i)
          i.onerror = () => rej(new Error('File ini bukan gambar yang bisa dibaca'))
          i.src = url
        })
        const scale = Math.min(1, 720 / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        return c.toDataURL('image/jpeg', 0.78)
      } finally {
        URL.revokeObjectURL(url)
      }
    },

    async storeOrders() {
      const db = load()
      const s = myStoreOf(db)
      return delay(clone(db.orders.filter((o) => o.store_id === s.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map((o) => details(db, o))))
    },

    async completeOrder(code) {
      const db = load()
      const s = myStoreOf(db)
      const c = code.trim().toUpperCase()
      const o = db.orders.filter((x) => x.store_id === s.id && x.code.toUpperCase() === c)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (!o) throw new Error(`Kode ${c} tidak ditemukan di toko ini`)
      if (o.status === 'completed') throw new Error(`Kode ${o.code} sudah dipakai`)
      if (o.status === 'cancelled') throw new Error(`Pesanan ${o.code} sudah dibatalkan pembeli`)
      o.status = 'completed'
      o.completed_at = new Date().toISOString()
      persist()
      bus.emit('orders')
      return delay(clone(details(db, o)), 300)
    },

    async listSchedules() {
      const db = load()
      const s = myStoreOf(db)
      return delay(clone(db.schedules.filter((x) => x.store_id === s.id).sort((a, b) => a.pickup_start.localeCompare(b.pickup_start))))
    },

    async saveSchedule(input) {
      const db = load()
      const s = myStoreOf(db)
      if (input.price >= input.original_price) throw new Error('Harga Bungkus! harus lebih murah dari harga normal')
      if (input.pickup_end <= input.pickup_start) throw new Error('Jam selesai ambil harus setelah jam mulai')
      if (!input.days.length) throw new Error('Pilih minimal satu hari')
      const { id, ...rest } = input
      if (id) {
        const sc = db.schedules.find((x) => x.id === id && x.store_id === s.id)
        if (!sc) throw new Error('Jadwal tidak ditemukan')
        Object.assign(sc, rest)
        persist()
        return delay(clone(sc))
      }
      const sc: Schedule = { ...rest, id: uuid(), store_id: s.id, last_published_on: null }
      db.schedules.push(sc)
      persist()
      return delay(clone(sc))
    },

    async deleteSchedule(id) {
      const db = load()
      const s = myStoreOf(db)
      db.schedules = db.schedules.filter((x) => !(x.id === id && x.store_id === s.id))
      persist()
    },

    async publishSchedules() {
      const db = load()
      const s = myStoreOf(db)
      const today = new Date()
      const key = today.toISOString().slice(0, 10)
      let count = 0
      for (const sc of db.schedules) {
        if (sc.store_id !== s.id || !sc.active || !sc.days.includes(today.getDay())) continue
        if (sc.last_published_on && sc.last_published_on >= key) continue
        const [eh, em] = sc.pickup_end.split(':').map(Number)
        const end = new Date(today); end.setHours(eh, em, 0, 0)
        if (end.getTime() <= Date.now()) continue
        const [sh, sm] = sc.pickup_start.split(':').map(Number)
        const start = new Date(today); start.setHours(sh, sm, 0, 0)
        const l: Listing = {
          id: uuid(), store_id: s.id, title: sc.title, description: sc.description, category: sc.category,
          original_price: sc.original_price, price: sc.price, qty_total: sc.qty, qty_available: sc.qty,
          pickup_start: start.toISOString(), pickup_end: end.toISOString(), photo_url: null, allergens: null,
          made_at: new Date().toISOString(), quality_checked: true, delivery_available: false, status: 'active',
          created_at: new Date().toISOString(),
        }
        db.listings.push(l)
        sc.last_published_on = key
        count++
        bus.emit('listing-insert', l.id)
      }
      persist()
      if (count) bus.emit('listings')
      return delay(count)
    },

    // ---------------- real-time ----------------
    subscribeNewListings(cb) {
      return bus.on('listing-insert', (id) => {
        const db = load()
        const l = db.listings.find((x) => x.id === id)
        if (l) cb(clone(withStore(db, l)))
      })
    },

    subscribeOrders(_filter, cb) {
      void _filter
      return bus.on('orders', () => cb())
    },
  }
  return api
}
