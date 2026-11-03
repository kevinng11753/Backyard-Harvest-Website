import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useLoad } from '../lib/useLoad.js'
import { distanceMiles, formatDistance } from '../lib/geo.js'
import { firstName, freshness, isActive, timeAgo } from '../lib/produce.js'
import ProduceThumb from './ProduceThumb.jsx'
import PickupDetails from './PickupDetails.jsx'
import SafetySheet from './SafetySheet.jsx'

// The panel that slides up when you tap a listing.
export default function ListingSheet({ listing, user, location, onClose, onChanged }) {
  const closeRef = useRef(null)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)

  // Did I already ask for this one? Look it up among my requests.
  const mine = useLoad(() => api.myRequests(), [listing.id, version])
  const myRequest = mine.data?.find((r) => r.listing_id === listing.id) ?? null
  const current = myRequest?.listing ?? listing

  const isOwner = listing.owner_id === user.id
  const fresh = freshness(current)
  const grower = firstName(listing.owner?.display_name)
  const miles = distanceMiles(location, { lat: listing.approx_lat, lng: listing.approx_lng })

  useEffect(() => {
    closeRef.current?.focus()
    // While the report/block panel is open, Escape closes just that panel.
    const onKey = (e) => e.key === 'Escape' && !safetyOpen && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, safetyOpen])

  async function run(action, successMessage) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setVersion((v) => v + 1)
      onChanged(successMessage)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}>
        <section
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          onClick={(e) => e.stopPropagation()}
        >
          <button ref={closeRef} className="sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <div className="sheet-hero">
            <ProduceThumb listing={current} size={168} />
            <p className={`fresh-label fresh-${fresh.level}`}>{fresh.label}</p>
          </div>

          <h2 id="sheet-title" className="sheet-title">{listing.title}</h2>
          {listing.quantity && <p className="sheet-qty">{listing.quantity}</p>}

          <dl className="facts">
            <div>
              <dt>Grown by</dt>
              <dd>
                {isOwner ? 'You' : grower}
                {listing.owner?.neighborhood ? `, ${listing.owner.neighborhood}` : ''}
              </dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>{formatDistance(miles)}</dd>
            </div>
            <div>
              <dt>Posted</dt>
              <dd>{timeAgo(listing.created_at)}</dd>
            </div>
          </dl>

          {listing.description && <p className="sheet-desc">{listing.description}</p>}

          <div className="sheet-action">
            {mine.loading && !mine.data ? null : isOwner ? (
              <p className="note">This is your listing. Answer requests in Activity.</p>
            ) : myRequest?.status === 'accepted' ? (
              <PickupDetails grower={grower} pickup={myRequest.pickup} />
            ) : myRequest?.status === 'pending' ? (
              <>
                <p className="note">Request sent. {grower} will see it next time they open the app.</p>
                <button
                  className="btn btn-quiet"
                  disabled={busy}
                  onClick={() => run(() => api.cancelRequest(myRequest.id), 'Request cancelled.')}
                >
                  Cancel request
                </button>
              </>
            ) : myRequest?.status === 'declined' ? (
              <p className="note">{grower} gave this to another neighbor. Check Nearby for more.</p>
            ) : myRequest?.status === 'cancelled' ? (
              <p className="note">You cancelled this request.</p>
            ) : isActive(current) ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  run(() => api.requestListing(listing.id, message.trim()), `Asked ${grower}. You’ll see the answer in Activity.`)
                }}
              >
                <label className="field">
                  <span>Note to {grower} (optional)</span>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="When can you pick up? What will you make?"
                  />
                </label>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? 'Sending…' : `Ask ${grower} for this`}
                </button>
              </form>
            ) : (
              <p className="note">This one has been claimed or has expired.</p>
            )}
            {error && <p className="error" role="alert">{error}</p>}
          </div>

          {!isOwner && (
            <button type="button" className="safety-link" onClick={() => setSafetyOpen(true)}>
              Report or block
            </button>
          )}
        </section>
      </div>

      {/* Beside the listing panel, not inside it, so a click here doesn't also close the listing. */}
      {safetyOpen && (
        <SafetySheet
          name={grower}
          userId={listing.owner_id}
          listingId={listing.id}
          onClose={() => setSafetyOpen(false)}
          onDone={(message, blocked) => {
            setSafetyOpen(false)
            onChanged(message)
            // A blocked neighbor's listing is no longer visible, so close it too.
            if (blocked) onClose()
          }}
        />
      )}
    </>
  )
}
