export type Role = 'buyer' | 'partner'

export interface Profile {
  id: string
  full_name: string
  role: Role
  phone?: string | null
  email?: string | null
}

export type StoreCategory = 'restoran' | 'kafe' | 'bakery' | 'umkm'

export interface Store {
  id: string
  owner_id: string | null
  name: string
  category: StoreCategory
  description?: string | null
  address: string
  lat: number
  lng: number
  phone?: string | null
  closing_time?: string | null
  rating_avg: number
  rating_count: number
  created_at?: string
}

export type FoodCategory = 'makanan-berat' | 'roti-kue' | 'minuman' | 'camilan' | 'sayur-buah'

export interface Listing {
  id: string
  store_id: string
  title: string
  description?: string | null
  category: FoodCategory
  original_price: number
  price: number
  qty_total: number
  qty_available: number
  pickup_start: string
  pickup_end: string
  photo_url?: string | null
  allergens?: string | null
  made_at?: string | null
  quality_checked: boolean
  delivery_available: boolean
  status: 'active' | 'closed'
  created_at: string
}

export interface ListingWithStore extends Listing {
  store: Store
}

export type Fulfillment = 'pickup' | 'delivery'
export type OrderStatus = 'paid' | 'completed' | 'cancelled'

export interface Order {
  id: string
  code: string
  listing_id: string
  store_id: string
  buyer_id: string
  qty: number
  unit_price: number
  original_unit_price: number
  delivery_fee: number
  total: number
  fulfillment: Fulfillment
  delivery_address?: string | null
  payment_method: string
  status: OrderStatus
  created_at: string
  completed_at?: string | null
}

export interface Review {
  id: string
  order_id: string
  store_id: string
  buyer_id: string
  buyer_name: string
  rating: number
  comment?: string | null
  created_at: string
}

export interface OrderWithDetails extends Order {
  listing: Listing
  store: Store
  buyer_name?: string
  review?: Review | null
}

export interface Schedule {
  id: string
  store_id: string
  title: string
  description?: string | null
  category: FoodCategory
  original_price: number
  price: number
  qty: number
  days: number[]
  pickup_start: string // "HH:MM"
  pickup_end: string
  active: boolean
  last_published_on?: string | null
}

export interface StoreDetail {
  store: Store
  listings: Listing[]
  reviews: Review[]
}

export interface PlaceOrderInput {
  listingId: string
  qty: number
  fulfillment: Fulfillment
  paymentMethod: string
  deliveryAddress?: string
}

export type ListingInput = Omit<Listing, 'id' | 'store_id' | 'created_at' | 'status' | 'qty_available'> & {
  id?: string
  qty_available?: number
}

export type StoreInput = Omit<Store, 'id' | 'owner_id' | 'rating_avg' | 'rating_count' | 'created_at'>

export type ScheduleInput = Omit<Schedule, 'id' | 'store_id' | 'last_published_on'> & { id?: string }

export interface SignUpInput {
  email: string
  password: string
  fullName: string
  role: Role
}

export interface Api {
  mode: 'supabase' | 'demo'
  // akun
  getProfile(): Promise<Profile | null>
  onAuthChange(cb: () => void): () => void
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  updateProfile(patch: Partial<Pick<Profile, 'full_name' | 'phone'>>): Promise<void>
  // pembeli
  listActiveListings(): Promise<ListingWithStore[]>
  getListing(id: string): Promise<ListingWithStore | null>
  getStoreDetail(id: string): Promise<StoreDetail | null>
  placeOrder(input: PlaceOrderInput): Promise<Order>
  myOrders(): Promise<OrderWithDetails[]>
  getOrder(id: string): Promise<OrderWithDetails | null>
  cancelOrder(id: string): Promise<void>
  submitReview(orderId: string, rating: number, comment: string): Promise<void>
  listFavorites(): Promise<string[]>
  toggleFavorite(storeId: string): Promise<boolean>
  // mitra
  myStore(): Promise<Store | null>
  saveStore(input: StoreInput): Promise<Store>
  myListings(): Promise<Listing[]>
  saveListing(input: ListingInput): Promise<Listing>
  closeListing(id: string): Promise<void>
  uploadPhoto(file: File): Promise<string>
  storeOrders(): Promise<OrderWithDetails[]>
  completeOrder(code: string): Promise<OrderWithDetails>
  listSchedules(): Promise<Schedule[]>
  saveSchedule(input: ScheduleInput): Promise<Schedule>
  deleteSchedule(id: string): Promise<void>
  publishSchedules(): Promise<number>
  // real-time
  subscribeNewListings(cb: (listing: ListingWithStore) => void): () => void
  subscribeOrders(filter: { storeId?: string; buyerId?: string }, cb: () => void): () => void
}
