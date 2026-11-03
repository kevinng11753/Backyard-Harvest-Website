import { useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useLoad } from '../lib/useLoad.js'
import { distanceMiles, getCurrentPosition } from '../lib/geo.js'
import { CATEGORIES } from '../lib/produce.js'
import ListingCard from '../components/ListingCard.jsx'
import PublicListingSheet from '../components/PublicListingSheet.jsx'

// The home page for people who aren't signed in: everything that's
// available right now. Looking is open to anyone; asking needs an account.
export default function PublicHome({ demo, onAuth }) {
  const [filter, setFilter] = useState('all')
  const [retry, setRetry] = useState(0)
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationFailed, setLocationFailed] = useState(false)
  const [open, setOpen] = useState(null)
  const { data, error, loading } = useLoad(() => api.listPublic(), [retry])

  // Newest first, as the database returns them. Once the visitor shares
  // their location, closest first.
  const listings = useMemo(() => {
    if (!data) return []
    const rows = data.filter((l) => filter === 'all' || l.category === filter)
    if (!location) return rows
    return rows
      .map((l) => ({ l, d: distanceMiles(location, { lat: l.approx_lat, lng: l.approx_lng }) }))
      .sort((a, b) => a.d - b.d)
      .map(({ l }) => l)
  }, [data, filter, location])

  async function sortByDistance() {
    setLocating(true)
    setLocationFailed(false)
    const pos = await getCurrentPosition()
    if (pos.precise) setLocation(pos)
    else setLocationFailed(true)
    setLocating(false)
  }

  return (
    <div className="public">
      <header className="topbar">
        <span className="wordmark">Backyard Harvest</span>
        <span className="topbar-actions">
          <button className="btn btn-quiet btn-small" onClick={() => onAuth('signin')}>Sign in</button>
        </span>
      </header>

      {demo && <p className="demo-note">Demo mode: everything stays in this browser.</p>}

      <section className="public-hero">
        <h1>Fresh from your neighbors’ gardens</h1>
        <p>
          Neighbors share the extra produce they can’t keep up with. Browse what’s available now, then create a free
          account to ask for something or share your own.
        </p>
        <div className="public-cta">
          <button className="btn btn-primary" onClick={() => onAuth('signup')}>Create a free account</button>
        </div>
      </section>

      <main className="screen">
        <h2 className="section-title">Available now</h2>

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

        <div className="public-locate">
          {location ? (
            <p className="note small">Sorted by distance from you.</p>
          ) : (
            <button className="btn btn-quiet btn-small" onClick={sortByDistance} disabled={locating}>
              {locating ? 'Finding you…' : 'Show closest first'}
            </button>
          )}
          {locationFailed && (
            <p className="note small">Couldn’t get your location, so listings are shown newest first.</p>
          )}
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
                ? 'Nothing is listed right now. Got extra from your garden? Be the first.'
                : 'None of these right now. Try another type, or check back tomorrow.'}
            </p>
            {filter === 'all' && (
              <button className="btn btn-primary" onClick={() => onAuth('signup')}>Create a free account</button>
            )}
          </div>
        ) : (
          <ul className="cards">
            {listings.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} location={location} onOpen={setOpen} />
              </li>
            ))}
          </ul>
        )}

        <p className="note small public-foot">
          Exact pickup addresses are never shown here. Growers share them only with the neighbor they say yes to.
        </p>
      </main>

      {open && <PublicListingSheet listing={open} onClose={() => setOpen(null)} onAuth={onAuth} />}
    </div>
  )
}
