import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface Coords { lat: number; lng: number }

export const PRESETS: { id: string; label: string; coords: Coords }[] = [
  { id: 'binus-anggrek', label: 'Kampus BINUS Anggrek', coords: { lat: -6.2018, lng: 106.7818 } },
  { id: 'binus-syahdan', label: 'Kampus BINUS Syahdan', coords: { lat: -6.2006, lng: 106.7856 } },
  { id: 'slipi', label: 'Slipi', coords: { lat: -6.1996, lng: 106.7975 } },
]

export function distanceKm(a: Coords, b: Coords) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

interface LocationState {
  coords: Coords
  label: string
  source: 'gps' | 'preset'
  locating: boolean
  error: string | null
  useGps: () => void
  usePreset: (id: string) => void
}

const Ctx = createContext<LocationState | null>(null)
const KEY = 'bungkus-location'

function load(): { coords: Coords; label: string; source: 'gps' | 'preset' } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* abaikan */ }
  return { coords: PRESETS[0].coords, label: PRESETS[0].label, source: 'preset' }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = (s: typeof state) => {
    setState(s)
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* abaikan */ }
  }

  const useGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Browser ini tidak mendukung deteksi lokasi.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        save({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, label: 'Lokasi saya', source: 'gps' })
      },
      (err) => {
        setLocating(false)
        setError(err.code === err.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Pilih lokasi dari daftar, atau izinkan lokasi di pengaturan browser.'
          : 'Lokasi belum terdeteksi. Coba lagi atau pilih dari daftar.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  const usePreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (p) save({ coords: p.coords, label: p.label, source: 'preset' })
    setError(null)
  }, [])

  return (
    <Ctx.Provider value={{ ...state, locating, error, useGps, usePreset }}>
      {children}
    </Ctx.Provider>
  )
}

export function useUserLocation() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUserLocation di luar LocationProvider')
  return v
}
