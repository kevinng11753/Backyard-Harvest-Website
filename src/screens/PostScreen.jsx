import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { blurLocation } from '../lib/geo.js'
import { CATEGORIES, SHELF_LIFE_OPTIONS } from '../lib/produce.js'

const EMPTY = {
  title: '',
  category: 'vegetables',
  quantity: '',
  description: '',
  days: 2,
  address: '',
  instructions: ''
}

export default function PostScreen({ location, onPosted }) {
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  // Show a preview of the chosen photo, and free its memory afterwards.
  useEffect(() => {
    if (!photo) return setPreview(null)
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const approx = blurLocation(location) // never save the exact spot
      await api.createListing({
        title: form.title.trim(),
        category: form.category,
        quantity: form.quantity.trim() || null,
        description: form.description.trim() || null,
        approx_lat: approx.lat,
        approx_lng: approx.lng,
        expires_at: new Date(Date.now() + form.days * 24 * 60 * 60 * 1000).toISOString(),
        photoFile: photo,
        pickup: { address: form.address.trim(), instructions: form.instructions.trim() || null }
      })
      setForm(EMPTY)
      setPhoto(null)
      onPosted()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1 className="screen-title">Share your extra</h1>

      <form className="post-form" onSubmit={submit}>
        <label className="photo-pick">
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          {preview ? (
            <img src={preview} alt="Your photo" />
          ) : (
            <span>
              <strong>Add a photo</strong>
              <small>Listings with photos get asked for first</small>
            </span>
          )}
        </label>

        <label className="field">
          <span>What is it?</span>
          <input required maxLength={60} placeholder="Cherry tomatoes" value={form.title} onChange={set('title')} />
        </label>

        <fieldset className="field">
          <legend>Type</legend>
          <div className="chips chips-wrap">
            {CATEGORIES.map((c) => (
              <label key={c.id} className={`chip ${form.category === c.id ? 'chip-on' : ''}`}>
                <input type="radio" name="category" value={c.id} checked={form.category === c.id} onChange={set('category')} />
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>How much?</span>
          <input maxLength={40} placeholder="About 2 lbs, a grocery bag…" value={form.quantity} onChange={set('quantity')} />
        </label>

        <label className="field">
          <span>Anything to know?</span>
          <textarea rows={2} maxLength={300} placeholder="Picked this morning. A little bruised but sweet." value={form.description} onChange={set('description')} />
        </label>

        <fieldset className="field">
          <legend>Good until</legend>
          <div className="segmented">
            {SHELF_LIFE_OPTIONS.map((o) => (
              <label key={o.days} className={Number(form.days) === o.days ? 'seg-on' : ''}>
                <input type="radio" name="days" value={o.days} checked={Number(form.days) === o.days} onChange={set('days')} />
                {o.label}
              </label>
            ))}
          </div>
          <small>The listing disappears on its own after this.</small>
        </fieldset>

        <div className="private">
          <p className="private-head">Pickup details</p>
          <p className="small">Kept private. Only the neighbor you say yes to will see these.</p>
          <label className="field">
            <span>Pickup address</span>
            <input required maxLength={120} autoComplete="street-address" placeholder="42 Linden St" value={form.address} onChange={set('address')} />
          </label>
          <label className="field">
            <span>Where to find it</span>
            <input maxLength={200} placeholder="In a box on the porch bench" value={form.instructions} onChange={set('instructions')} />
          </label>
        </div>

        {!location.precise && (
          <p className="note small">
            Location is off, so this will be pinned to the sample area. Allow location in your browser for neighbors to find it.
          </p>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Posting…' : 'Post it'}
        </button>
      </form>
    </section>
  )
}
