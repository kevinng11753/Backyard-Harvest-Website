import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from 'react-leaflet'
import { api } from '../lib/api.js'
import { useLoad } from '../lib/useLoad.js'
import { freshness } from '../lib/produce.js'

// Ring colors, matching the freshness ring on each photo.
const COLORS = { fresh: '#2f7d4a', soon: '#d99a0b', last: '#d2412c' }

export default function MapScreen({ location, refreshKey, onOpen }) {
  const { data } = useLoad(() => api.listActive(), [refreshKey])

  return (
    <section className="map-screen">
      <h1 className="screen-title">On the map</h1>
      <div className="map-wrap">
        <MapContainer center={[location.lat, location.lng]} zoom={14} scrollWheelZoom className="map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* You are here */}
          <CircleMarker
            center={[location.lat, location.lng]}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1f5b3a', fillOpacity: 1 }}
          >
            <Tooltip>You</Tooltip>
          </CircleMarker>

          {/* Each listing is a soft circle, not a pin: it shows the general
              area only, so a grower's exact house stays private. */}
          {data?.map((l) => {
            const color = COLORS[freshness(l).level]
            return (
              <Circle
                key={l.id}
                center={[l.approx_lat, l.approx_lng]}
                radius={180}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.25 }}
                eventHandlers={{ click: () => onOpen(l) }}
              >
                <Tooltip>{l.title}</Tooltip>
              </Circle>
            )
          })}
        </MapContainer>
      </div>
      <p className="note small">
        Circles show the general area. A grower’s exact address is shared only after they accept your request.
      </p>
    </section>
  )
}
