import { useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useLoad } from '../lib/useLoad.js'
import { distanceMiles } from '../lib/geo.js'
import { CATEGORIES } from '../lib/produce.js'
import ListingCard from '../components/ListingCard.jsx'

export default function NearbyScreen({ location, userId, refreshKey, onOpen, onPost }) {
  const [filter, setFilter] = useState('all')
  const [retry, setRetry] = useState(0)
  const { data, error, loading } = useLoad(() => api.listActive(), [refreshKey, retry])

  // Closest first, then apply the category filter.
  const listings = useMemo(() => {
    if (!data) return []
    return data
      .map((l) => ({ l, d: distanceMiles(location, { lat: l.approx_lat, lng: l.approx_lng }) }))
      .filter(({ l }) => filter === 'all' || l.category === filter)
      .sort((a, b) => a.d - b.d)
      .map(({ l }) => l)
  }, [data, filter, location])

  return (
    <section>
      <h1 className="screen-title">Ripe near you</h1>

      <div className="chips" role="group" aria-label="Filter by type">
        <button className={`chip ${filter === 'all' ? 'chip-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Everything
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip ${filter === c.id ? 'chip-on' : ''}`}
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
          >
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="empty">
          <p>Couldn’t load listings: {error.message}</p>
          <button className="btn btn-quiet" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : loading && !data ? (
        <p className="loading">Loading…</p>
      ) : listings.length === 0 ? (
        <div className="empty">
          <p>
            {filter === 'all'
              ? 'Nothing is listed near you yet. Got extra from your garden? Be the first.'
              : 'None of these nearby right now. Try another type, or check back tomorrow.'}
          </p>
          {filter === 'all' && <button className="btn btn-primary" onClick={onPost}>Share something</button>}
        </div>
      ) : (
        <ul className="cards">
          {listings.map((l) => (
            <li key={l.id}>
              <ListingCard listing={l} location={location} userId={userId} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}

      <p className="legend">
        <span className="dot dot-fresh" /> Fresh <span className="dot dot-soon" /> Going soon{' '}
        <span className="dot dot-last" /> Last chance
      </p>
    </section>
  )
}
