import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'

const REASONS = [
  { id: 'unsafe', label: 'Unsafe, or not plants or produce' },
  { id: 'misleading', label: 'Fake, or not as described' },
  { id: 'harassment', label: 'Rude, threatening or harassing' },
  { id: 'spam', label: 'Spam' },
  { id: 'privacy', label: 'Shares private information' },
  { id: 'other', label: 'Something else' }
]

// The panel for reporting a listing (or a neighbor's request) and for blocking
// that neighbor. Pass `listingId` to report a listing, or `requestId` to report
// a request made on one of your own listings. `onDone(message, blocked)` runs
// after either action succeeds.
export default function SafetySheet({ name, userId, listingId, requestId, onClose, onDone }) {
  const closeRef = useRef(null)
  const [view, setView] = useState('menu') // 'menu' | 'report' | 'block'
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const what = requestId ? 'request' : 'listing'

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function run(action, successMessage, blocked) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone(successMessage, blocked)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function sendReport(e) {
    e.preventDefault()
    const send = requestId ? () => api.reportRequest(requestId, reason, note.trim()) : () => api.reportListing(listingId, reason, note.trim())
    run(send, 'Thanks. Your report was sent.', false)
  }

  function goTo(next) {
    setError(null)
    setView(next)
  }

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} disabled={busy} aria-label="Close">
          ×
        </button>

        {view === 'menu' && (
          <>
            <h2 id="safety-title" className="section-title" style={{ marginTop: 0 }}>Report or block</h2>
            <p>If something about {name} or this {what} worries you, you can tell us, or stop seeing each other.</p>
            <div className="safety-actions">
              <button type="button" className="btn btn-quiet" onClick={() => goTo('report')}>
                Report this {what}
              </button>
              <button type="button" className="btn btn-quiet btn-quiet-danger" onClick={() => goTo('block')}>
                Block {name}
              </button>
              <button type="button" className="btn btn-quiet" onClick={onClose}>
                Never mind
              </button>
            </div>
          </>
        )}

        {view === 'report' && (
          <form className="post-form" onSubmit={sendReport}>
            <h2 id="safety-title" className="section-title" style={{ marginTop: 0 }}>Report this {what}</h2>
            <p>
              The person who runs Backyard Harvest will read it. {name} isn’t told that you reported them. If anyone is
              in danger, call your local emergency number instead.
            </p>

            <fieldset className="field">
              <legend>What’s wrong?</legend>
              <div className="reason-list">
                {REASONS.map((r) => (
                  <label key={r.id} className="agree">
                    <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>Anything else we should know? (optional)</span>
              <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>

            {error && <p className="error" role="alert">{error}</p>}

            <button className="btn btn-primary" disabled={busy || !reason}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => goTo('menu')} disabled={busy}>
              Back
            </button>
          </form>
        )}

        {view === 'block' && (
          <div className="post-form">
            <h2 id="safety-title" className="section-title" style={{ marginTop: 0 }}>Block {name}?</h2>
            <ul className="delete-list">
              <li>You won’t see each other’s listings.</li>
              <li>{name} can’t ask for your produce, and you can’t ask for theirs.</li>
              <li>Any open requests between you will end.</li>
            </ul>
            <p className="delete-warning">{name} isn’t told. You can undo this any time in Activity.</p>

            {error && <p className="error" role="alert">{error}</p>}

            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => run(() => api.blockUser(userId), `Blocked ${name}.`, true)}
            >
              {busy ? 'Blocking…' : `Block ${name}`}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => goTo('menu')} disabled={busy}>
              Back
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
