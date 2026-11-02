import { categoryOf, freshness } from '../lib/produce.js'

// A round photo wrapped in a "freshness ring". The ring shrinks and
// changes color as the listing gets closer to expiring:
// green = fresh, yellow = going soon, red = last chance.
export default function ProduceThumb({ listing, size = 76, showRing = true }) {
  const fresh = freshness(listing)
  const stroke = Math.max(4, Math.round(size / 16))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const inner = size - stroke * 2 - 4
  const cat = categoryOf(listing.category)

  return (
    <div className="thumb" style={{ width: size, height: size }}>
      {showRing && (
        <svg className="thumb-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
          <circle
            className={`ring-fill ring-${fresh.level}`}
            strokeLinecap={fresh.fraction > 0.97 ? 'butt' : 'round'}
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fresh.fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
      )}
      <div className={`thumb-img cat-${cat.id}`} style={{ width: inner, height: inner }}>
        {listing.photo_url ? (
          <img src={listing.photo_url} alt="" loading="lazy" />
        ) : (
          <span className="thumb-emoji" style={{ fontSize: inner * 0.46 }} aria-hidden="true">
            {cat.emoji}
          </span>
        )}
      </div>
    </div>
  )
}
