import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'

// The panel for permanently deleting your account. It says plainly what goes,
// and asks for the password so that nobody else on a signed-in device can do it.
export default function DeleteAccountSheet({ onClose, onDeleted }) {
  const closeRef = useRef(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.deleteAccount(password)
      onDeleted()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} disabled={busy} aria-label="Close">
          ×
        </button>

        <h2 id="delete-account-title" className="section-title" style={{ marginTop: 0 }}>Delete your account?</h2>

        <p>This permanently removes:</p>
        <ul className="delete-list">
          <li>your profile and sign-in</li>
          <li>every listing you posted, with its photo and pickup details</li>
          <li>your requests, and the requests other people made on your listings</li>
        </ul>
        <p className="delete-warning">
          This can’t be undone. A neighbor who is on their way to pick something up won’t be told.
        </p>

        <form className="post-form" onSubmit={submit}>
          <label className="field">
            <span>Type your password to confirm</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn btn-danger" disabled={busy || !password}>
            {busy ? 'Deleting…' : 'Delete my account for good'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Keep my account
          </button>
        </form>
      </section>
    </div>
  )
}
