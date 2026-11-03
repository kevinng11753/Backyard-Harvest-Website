import { useState } from 'react'
import { api } from '../lib/api.js'

export default function AuthScreen({ demo, initialMode = 'signup', onBack }) {
  const [mode, setMode] = useState(initialMode) // 'signup' | 'signin'
  const [form, setForm] = useState({ displayName: '', neighborhood: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checkEmail, setCheckEmail] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await api.signUp(form)
        if (needsConfirmation) setCheckEmail(true)
      } else {
        await api.signIn(form)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      {onBack && (
        <button type="button" className="btn btn-quiet btn-small auth-back" onClick={onBack}>
          ← Back to listings
        </button>
      )}
      <div className="auth-hero">
        {onBack ? (
          <button type="button" className="wordmark wordmark-link" aria-label="Backyard Harvest, go to the home page" onClick={onBack}>
            Backyard Harvest
          </button>
        ) : (
          <p className="wordmark">Backyard Harvest</p>
        )}
        <h1>More zucchini than you can eat? Someone on your street wants it.</h1>
        <p className="auth-lede">
          Post what your garden can’t keep up with. Neighbors ask for it, you say yes, and it gets picked up
          from your porch instead of rotting on the vine.
        </p>
      </div>

      {checkEmail ? (
        <div className="panel">
          <h2>Check your email</h2>
          <p>We sent a link to {form.email}. Open it to finish creating your account, then sign in here.</p>
          <button className="btn btn-quiet" onClick={() => { setCheckEmail(false); setMode('signin') }}>
            Go to sign in
          </button>
        </div>
      ) : (
        <form className="panel" onSubmit={submit}>
          <div className="switch" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
              Create account
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>
              Sign in
            </button>
          </div>

          {mode === 'signup' && (
            <>
              <label className="field">
                <span>Your name</span>
                <input required maxLength={40} autoComplete="name" value={form.displayName} onChange={set('displayName')} />
                <small>Neighbors see only your first name.</small>
              </label>
              <label className="field">
                <span>Street or neighborhood</span>
                <input maxLength={60} placeholder="Linden Street" value={form.neighborhood} onChange={set('neighborhood')} />
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input required type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              required
              type="password"
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
            />
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          {demo && (
            <p className="note small">
              Demo mode: accounts and listings are saved only in this browser, so you can try everything safely.
            </p>
          )}
        </form>
      )}
    </div>
  )
}
