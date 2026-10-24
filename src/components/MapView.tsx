import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import type { Coords } from '../lib/location'

export interface Pin { id: string; lat: number; lng: number; label: string; active?: boolean }

const pinIcon = (label: string, active?: boolean) =>
  L.divIcon({ className: '', html: `<span class="price-pin${active ? ' is-active' : ''}">${label}</span>`, iconSize: [0, 0] })
const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [0, 0] })

function Recenter({ center }: { center: Coords }) {
  const map = useMap()
  useEffect(() => { map.setView([center.lat, center.lng], map.getZoom()) }, [center.lat, center.lng, map])
  return null
}

function ClickPicker({ onPick }: { onPick: (c: Coords) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export function MapView({
  center, pins = [], me, onPinClick, onPick, zoom = 15, className = '',
}: {
  center: Coords
  pins?: Pin[]
  me?: Coords
  onPinClick?: (id: string) => void
  onPick?: (c: Coords) => void
  zoom?: number
  className?: string
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} className={className}
      attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />}
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.label, p.active)}
          eventHandlers={{ click: () => onPinClick?.(p.id) }} />
      ))}
      {onPick && <ClickPicker onPick={onPick} />}
    </MapContainer>
  )
}
