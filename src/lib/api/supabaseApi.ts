import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Api, Listing, ListingWithStore, Order, OrderWithDetails, Profile, Review, Schedule, Store,
} from '../types'

/** Ambil satu objek dari relasi embed PostgREST (kadang berupa array) */
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

type OrderRow = Order & {
  listing: Listing | Listing[]
  store: Store | Store[]
  review?: Review | Review[] | null
  buyer?: { full_name: string } | { full_name: string }[] | null
}

const toDetails = (r: OrderRow): OrderWithDetails => ({
  ...r,
  listing: one(r.listing)!,
  store: one(r.store)!,
  review: one(r.review ?? null),
  buyer_name: one(r.buyer ?? null)?.full_name || undefined,
})

const ORDER_SELECT = '*, listing:listings(*), store:stores(*), review:reviews(*)'

export function createSupabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key)

  const uid = async () => {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('Masuk dulu untuk melanjutkan')
    return id
  }

  let cachedStoreId: string | null = null
  const myStoreId = async () => {
    if (cachedStoreId) return cachedStoreId
    const id = await uid()
    const s = check(await sb.from('stores').select('id').eq('owner_id', id).maybeSingle())
    if (!s) throw new Error('Lengkapi data toko dulu')
    cachedStoreId = s.id
    return s.id as string
  }

  const nowIso = () => new Date().toISOString()

  const api: Api = {
    mode: 'supabase',

    async getProfile() {
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      const p = check(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()) as Profile | null
      if (!p) {
        // fallback bila trigger belum terpasang
        return {
          id: user.id,
          full_name: (user.user_metadata?.full_name as string) ?? '',
          role: (user.user_metadata?.role as Profile['role']) ?? 'buyer',
          email: user.email,
        }
      }
      return { ...p, email: user.email }
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => {
        cachedStoreId = null
        cb()
      })
      return () => data.subscription.unsubscribe()
    },

    async signUp({ email, password, fullName, role }) {
      const res = await sb.auth.signUp({
        email, password, options: { data: { full_name: fullName, role } },
      })
      if (res.error) throw new Error(res.error.message)
      return { needsConfirmation: !res.data.session }
    },

    async signIn(email, password) {
      const res = await sb.auth.signInWithPassword({ email, password })
      if (res.error) {
        throw new Error(res.error.message === 'Invalid login credentials'
          ? 'Email atau kata sandi salah'
          : res.error.message)
      }
    },

    async signOut() {
      cachedStoreId = null
      await sb.auth.signOut()
    },

    async updateProfile(patch) {
      const id = await uid()
      check(await sb.from('profiles').update(patch).eq('id', id))
    },

    // ---------------- pembeli ----------------
    async listActiveListings() {
      const rows = check(await sb.from('listings')
        .select('*, store:stores(*)')
        .eq('status', 'active')
        .gt('pickup_end', nowIso())
        .gt('qty_available', 0)
        .order('pickup_end', { ascending: true }))
      return (rows as (Listing & { store: Store | Store[] })[]).map((r) => ({ ...r, store: one(r.store)! }))
    },

    async getListing(id) {
      const r = check(await sb.from('listings').select('*, store:stores(*)').eq('id', id).maybeSingle())
      if (!r) return null
      return { ...r, store: one(r.store) } as ListingWithStore
    },

    async getStoreDetail(id) {
      const store = check(await sb.from('stores').select('*').eq('id', id).maybeSingle()) as Store | null
      if (!store) return null
      const [listings, reviews] = await Promise.all([
        sb.from('listings').select('*').eq('store_id', id).eq('status', 'active')
          .gt('pickup_end', nowIso()).order('pickup_start'),
        sb.from('reviews').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(20),
      ])
      return { store, listings: check(listings) as Listing[], reviews: check(reviews) as Review[] }
    },

    async placeOrder({ listingId, qty, fulfillment, paymentMethod, deliveryAddress }) {
      const res = await sb.rpc('place_order', {
        p_listing_id: listingId,
        p_qty: qty,
        p_fulfillment: fulfillment,
        p_payment_method: paymentMethod,
        p_delivery_address: deliveryAddress ?? null,
      })
      return check(res) as Order
    },

    async myOrders() {
      const id = await uid()
      const rows = check(await sb.from('orders').select(ORDER_SELECT)
        .eq('buyer_id', id).order('created_at', { ascending: false }))
      return (rows as OrderRow[]).map(toDetails)
    },

    async getOrder(id) {
      const r = check(await sb.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle())
      return r ? toDetails(r as OrderRow) : null
    },

    async cancelOrder(id) {
      check(await sb.rpc('cancel_order', { p_order_id: id }))
    },

    async submitReview(orderId, rating, comment) {
      const id = await uid()
      // store_id & buyer_name diisi trigger di database
      check(await sb.from('reviews').insert({
        order_id: orderId, buyer_id: id, rating, comment: comment || null,
      } as Record<string, unknown>))
    },

    async listFavorites() {
      const { data } = await sb.auth.getSession()
      if (!data.session) return []
      const rows = check(await sb.from('favorites').select('store_id'))
      return (rows as { store_id: string }[]).map((r) => r.store_id)
    },

    async toggleFavorite(storeId) {
      const id = await uid()
      const exists = check(await sb.from('favorites').select('store_id')
        .eq('buyer_id', id).eq('store_id', storeId).maybeSingle())
      if (exists) {
        check(await sb.from('favorites').delete().eq('buyer_id', id).eq('store_id', storeId))
        return false
      }
      check(await sb.from('favorites').insert({ buyer_id: id, store_id: storeId }))
      return true
    },

    // ---------------- mitra ----------------
    async myStore() {
      const id = await uid()
      const s = check(await sb.from('stores').select('*').eq('owner_id', id).maybeSingle()) as Store | null
      if (s) cachedStoreId = s.id
      return s
    },

    async saveStore(input) {
      const id = await uid()
      const existing = check(await sb.from('stores').select('id').eq('owner_id', id).maybeSingle())
      const res = existing
        ? await sb.from('stores').update(input).eq('id', existing.id).select().single()
        : await sb.from('stores').insert({ ...input, owner_id: id }).select().single()
      const s = check(res) as Store
      cachedStoreId = s.id
      return s
    },

    async myListings() {
      const storeId = await myStoreId()
      const rows = check(await sb.from('listings').select('*').eq('store_id', storeId)
        .order('created_at', { ascending: false }).limit(100))
      return rows as Listing[]
    },

    async saveListing(input) {
      const storeId = await myStoreId()
      const { id, ...rest } = input
      if (id) {
        const cur = check(await sb.from('listings').select('qty_total, qty_available').eq('id', id).single()) as { qty_total: number; qty_available: number }
        const sold = cur.qty_total - cur.qty_available
        if (rest.qty_total < sold) throw new Error(`Sudah terjual ${sold} porsi, jumlah total tidak boleh kurang dari itu`)
        const patch = { ...rest, qty_available: rest.qty_total - sold }
        return check(await sb.from('listings').update(patch).eq('id', id).select().single()) as Listing
      }
      return check(await sb.from('listings')
        .insert({ ...rest, store_id: storeId, qty_available: rest.qty_total })
        .select().single()) as Listing
    },

    async closeListing(id) {
      check(await sb.from('listings').update({ status: 'closed' }).eq('id', id))
    },

    async uploadPhoto(file) {
      const id = await uid()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${id}/${Date.now()}.${ext}`
      const up = await sb.storage.from('listing-photos').upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) throw new Error(up.error.message)
      return sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl
    },

    async storeOrders() {
      const storeId = await myStoreId()
      const rows = check(await sb.from('orders')
        .select('*, listing:listings(*), store:stores(*), buyer:profiles(full_name)')
        .eq('store_id', storeId).order('created_at', { ascending: false }).limit(500))
      return (rows as OrderRow[]).map(toDetails)
    },

    async completeOrder(code) {
      const o = check(await sb.rpc('complete_order', { p_code: code })) as Order
      const full = await sb.from('orders')
        .select('*, listing:listings(*), store:stores(*), buyer:profiles(full_name)').eq('id', o.id).single()
      return toDetails(check(full) as OrderRow)
    },

    async listSchedules() {
      const storeId = await myStoreId()
      const rows = check(await sb.from('schedules').select('*').eq('store_id', storeId).order('pickup_start'))
      return (rows as Schedule[]).map((s) => ({
        ...s, pickup_start: s.pickup_start.slice(0, 5), pickup_end: s.pickup_end.slice(0, 5),
      }))
    },

    async saveSchedule(input) {
      const storeId = await myStoreId()
      const { id, ...rest } = input
      const res = id
        ? await sb.from('schedules').update(rest).eq('id', id).select().single()
        : await sb.from('schedules').insert({ ...rest, store_id: storeId }).select().single()
      return check(res) as Schedule
    },

    async deleteSchedule(id) {
      check(await sb.from('schedules').delete().eq('id', id))
    },

    async publishSchedules() {
      const storeId = await myStoreId()
      return check(await sb.rpc('publish_schedules', { p_store_id: storeId })) as number
    },

    // ---------------- real-time ----------------
    subscribeNewListings(cb) {
      const ch = sb.channel(`listings-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' }, async (payload) => {
          const l = await api.getListing((payload.new as Listing).id)
          if (l) cb(l)
        })
        .subscribe()
      return () => { sb.removeChannel(ch) }
    },

    subscribeOrders({ storeId, buyerId }, cb) {
      const filter = storeId ? `store_id=eq.${storeId}` : buyerId ? `buyer_id=eq.${buyerId}` : undefined
      const ch = sb.channel(`orders-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, () => cb())
        .subscribe()
      return () => { sb.removeChannel(ch) }
    },
  }
  return api
}
