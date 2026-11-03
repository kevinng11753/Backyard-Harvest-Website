import { useState } from 'react'
import { api } from '../lib/api.js'

// Shown after someone follows the link in a password-reset email. They're
// already signed in by the link, so this is just the step where they pick a
// new password.
export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Those two passwords don’t match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.updatePassword(password)
      onDone('Password updated. You’re signed in.')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <p className="wordmark">Backyard Harvest</p>
        <h1>Choose a new password.</h1>
      </div>

      <form className="panel" onSubmit={submit}>
        <p className="note">Pick something you haven’t used before. You’ll use it the next time you sign in.</p>

        <label className="field">
          <span>New password</span>
          <input
            required
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>At least 6 characters.</small>
        </label>

        <label className="field">
          <span>Type it again</span>
          <input
            required
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => onDone()} disabled={busy}>
          Not now
        </button>
      </form>
    </div>
  )
}
