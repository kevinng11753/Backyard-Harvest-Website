import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { CATEGORIES, SHELF_LIFE_OPTIONS, freshness } from '../lib/produce.js'

// The panel a grower opens to change something they posted. The photo and
// the map spot stay as they were; text, type, pickup details and how long
// it stays up can change.
export default function EditListingSheet({ listing, onClose, onSaved }) {
  const closeRef = useRef(null)
  const [form, setForm] = useState({
    title: listing.title,
    category: listing.category,
    quantity: listing.quantity ?? '',
    description: listing.description ?? '',
    days: null, // null = keep the current "good until"
    address: '',
    instructions: ''
  })
  const [loadingPickup, setLoadingPickup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const current = freshness(listing)

  // Fetch the private pickup details so they can be edited too.
  useEffect(() => {
    let cancelled = false
    api
      .getMyPickup(listing.id)
      .then((p) => {
        if (cancelled) return
        setForm((f) => ({ ...f, address: p?.address ?? '', instructions: p?.instructions ?? '' }))
        setLoadingPickup(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
        setLoadingPickup(false)
      })
    return () => {
      cancelled = true
    }
  }, [listing.id])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const fields = {
        title: form.title.trim(),
        category: form.category,
        quantity: form.quantity.trim() || null,
        description: form.description.trim() || null
      }
      if (form.days !== null) {
        fields.expires_at = new Date(Date.now() + Number(form.days) * 24 * 60 * 60 * 1000).toISOString()
      }
      await api.updateListing(listing.id, {
        ...fields,
        pickup: { address: form.address.trim(), instructions: form.instructions.trim() || null }
      })
      onSaved('Saved your changes.')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 id="edit-sheet-title" className="section-title" style={{ marginTop: 0 }}>Edit your listing</h2>

        <form className="post-form" onSubmit={submit}>
          <label className="field">
            <span>What is it?</span>
            <input required maxLength={60} value={form.title} onChange={set('title')} />
          </label>

          <fieldset className="field">
            <legend>Type</legend>
            <div className="chips chips-wrap">
              {CATEGORIES.map((c) => (
                <label key={c.id} className={`chip ${form.category === c.id ? 'chip-on' : ''}`}>
                  <input type="radio" name="edit-category" value={c.id} checked={form.category === c.id} onChange={set('category')} />
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>How much?</span>
            <input maxLength={40} value={form.quantity} onChange={set('quantity')} />
          </label>

          <label className="field">
            <span>Anything to know?</span>
            <textarea rows={2} maxLength={300} value={form.description} onChange={set('description')} />
          </label>

          <fieldset className="field">
            <legend>Good until</legend>
            <div className="segmented">
              {SHELF_LIFE_OPTIONS.map((o) => (
                <label key={o.days} className={form.days !== null && Number(form.days) === o.days ? 'seg-on' : ''}>
                  <input type="radio" name="edit-days" value={o.days} checked={form.days !== null && Number(form.days) === o.days} onChange={set('days')} />
                  {o.label}
                </label>
              ))}
            </div>
            <small>
              {form.days === null
                ? `Now: ${current.label.toLowerCase()}. Pick one to restart the clock from today.`
                : 'It will stay up for this long from today.'}
            </small>
          </fieldset>

          <div className="private">
            <p className="private-head">Pickup details</p>
            <p className="small">Kept private. Only the neighbor you say yes to will see these.</p>
            <label className="field">
              <span>Pickup address</span>
              <input required maxLength={120} disabled={loadingPickup} value={form.address} onChange={set('address')} />
            </label>
            <label className="field">
              <span>Where to find it</span>
              <input maxLength={200} disabled={loadingPickup} value={form.instructions} onChange={set('instructions')} />
            </label>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn btn-primary" disabled={busy || loadingPickup}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </form>
      </section>
    </div>
  )
}
