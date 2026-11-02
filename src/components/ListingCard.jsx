import ProduceThumb from './ProduceThumb.jsx'
import { distanceMiles, formatDistance } from '../lib/geo.js'
import { firstName, freshness } from '../lib/produce.js'

export default function ListingCard({ listing, location, userId, onOpen }) {
  const fresh = freshness(listing)
  const miles = distanceMiles(location, { lat: listing.approx_lat, lng: listing.approx_lng })

  return (
    <button className="card" onClick={() => onOpen(listing)}>
      <ProduceThumb listing={listing} />
      <span className="card-body">
        <span className="card-title">{listing.title}</span>
        {listing.quantity && <span className="card-qty">{listing.quantity}</span>}
        <span className="card-meta">
          <span>{listing.owner_id === userId ? 'Yours' : firstName(listing.owner?.display_name)}</span>
          <span>{formatDistance(miles)}</span>
          <span className={`fresh-label fresh-${fresh.level}`}>{fresh.label}</span>
        </span>
      </span>
    </button>
  )
}
