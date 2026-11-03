import { useEffect, useRef } from 'react'
import { firstName, freshness, timeAgo } from '../lib/produce.js'
import ProduceThumb from './ProduceThumb.jsx'

// The panel a signed-out visitor sees when they tap a listing. Asking for
// produce needs an account, so the only action here is to sign up or in.
export default function PublicListingSheet({ listing, onClose, onAuth }) {
  const closeRef = useRef(null)
  const fresh = freshness(listing)
  const grower = firstName(listing.owner?.display_name)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} className="sheet-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="sheet-hero">
          <ProduceThumb listing={listing} size={168} />
          <p className={`fresh-label fresh-${fresh.level}`}>{fresh.label}</p>
        </div>

        <h2 id="public-sheet-title" className="sheet-title">{listing.title}</h2>
        {listing.quantity && <p className="sheet-qty">{listing.quantity}</p>}

        <dl className="facts">
          <div>
            <dt>Grown by</dt>
            <dd>{grower}</dd>
          </div>
          <div>
            <dt>Posted</dt>
            <dd>{timeAgo(listing.created_at)}</dd>
          </div>
          <div>
            <dt>Good until</dt>
            <dd>{fresh.label}</dd>
          </div>
        </dl>

        {listing.description && <p className="sheet-desc">{listing.description}</p>}

        <div className="sheet-action">
          <p className="note">
            Create a free account to ask {grower} for this. The pickup address is shared only after they say yes.
          </p>
          <button className="btn btn-primary" onClick={() => onAuth('signup')}>
            Create account to ask {grower}
          </button>
          <button className="btn btn-quiet" onClick={() => onAuth('signin')}>
            I already have an account
          </button>
        </div>
      </section>
    </div>
  )
}
