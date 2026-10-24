import { Link } from 'react-router-dom'
import { Apple, Cookie, Croissant, CupSoda, Soup, Minus, Plus, Star, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FoodCategory, Listing } from '../lib/types'
import { discountPct, rupiah } from '../lib/format'

export function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`font-serif font-bold tracking-tight ${light ? 'text-cream' : 'text-leaf'} ${className}`}>
      Bungkus<span className="text-mustard">!</span>
    </span>
  )
}

const catStyle: Record<FoodCategory, { Icon: typeof Soup; bg: string; fg: string }> = {
  'makanan-berat': { Icon: Soup, bg: '#E9D7B4', fg: '#8A5A12' },
  'roti-kue': { Icon: Croissant, bg: '#F2D98F', fg: '#7A5508' },
  minuman: { Icon: CupSoda, bg: '#CFE0C1', fg: '#2F5E3A' },
  camilan: { Icon: Cookie, bg: '#E8CFB8', fg: '#7B4A22' },
  'sayur-buah': { Icon: Apple, bg: '#C9DDB1', fg: '#3D6B2A' },
}

/** Foto makanan, atau ilustrasi kategori bila belum ada foto */
export function FoodThumb({ listing, className = '' }: { listing: Pick<Listing, 'photo_url' | 'category' | 'title'>; className?: string }) {
  if (listing.photo_url) {
    return <img src={listing.photo_url} alt={listing.title} className={`object-cover ${className}`} loading="lazy" />
  }
  const { Icon, bg, fg } = catStyle[listing.category] ?? catStyle['makanan-berat']
  return (
    <div className={`grid place-items-center ${className}`} style={{ background: bg, color: fg }} aria-hidden>
      <Icon className="size-[42%] max-h-20 max-w-20" strokeWidth={1.6} />
    </div>
  )
}

export function DiscountBadge({ original, price, className = '' }: { original: number; price: number; className?: string }) {
  return (
    <span className={`inline-block rounded-full bg-mustard px-2 py-0.5 text-xs font-extrabold text-forest ${className}`}>
      −{discountPct(original, price)}%
    </span>
  )
}

export function PriceStack({ original, price, size = 'md' }: { original: number; price: number; size?: 'md' | 'lg' }) {
  return (
    <div className="text-right leading-tight">
      <div className={`text-muted line-through ${size === 'lg' ? 'text-base' : 'text-xs'}`}>{rupiah(original)}</div>
      <div className={`font-display font-extrabold text-leaf ${size === 'lg' ? 'text-4xl' : 'text-lg'}`}>{rupiah(price)}</div>
    </div>
  )
}

export function Stepper({ value, min = 1, max, onChange }: { value: number; min?: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border-[1.5px] border-sand-deep bg-[#fffdf8]">
      <button type="button" aria-label="Kurangi" disabled={value <= min} onClick={() => onChange(value - 1)}
        className="grid size-10 place-items-center rounded-full disabled:opacity-30"><Minus className="size-4" /></button>
      <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label="Tambah" disabled={value >= max} onClick={() => onChange(value + 1)}
        className="grid size-10 place-items-center rounded-full disabled:opacity-30"><Plus className="size-4" /></button>
    </div>
  )
}

export function Rating({ value, count, className = '' }: { value: number; count?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Star className="size-3.5 fill-mustard text-mustard" />
      <span className="font-semibold">{value ? value.toFixed(1).replace('.', ',') : 'Baru'}</span>
      {count !== undefined && count > 0 && <span className="text-muted">({count})</span>}
    </span>
  )
}

export function StockBar({ left, total }: { left: number; total: number }) {
  const pct = total ? Math.max(4, (left / total) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand" role="presentation">
      <div className={`h-full rounded-full ${left <= 2 ? 'bg-tomato' : 'bg-sage'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-tomato/30 bg-tomato/5 p-4 text-sm text-tomato">
      <p className="font-semibold">{message}</p>
      {onRetry && <button className="mt-2 font-bold underline" onClick={onRetry}>Muat ulang</button>}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-sand-deep px-6 py-12 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function BackLink({ to, label = 'Kembali' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
      <span aria-hidden>‹</span> {label}
    </Link>
  )
}

export function StatusPill({ status }: { status: 'paid' | 'completed' | 'cancelled' }) {
  const map = {
    paid: ['Menunggu diambil', 'bg-mustard text-forest'],
    completed: ['Sudah diambil', 'bg-sage/25 text-leaf'],
    cancelled: ['Dibatalkan', 'bg-sand text-muted'],
  } as const
  const [label, cls] = map[status]
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>
}
