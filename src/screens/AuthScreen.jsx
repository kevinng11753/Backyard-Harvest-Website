import { useState } from 'react'
import { api, resetLinkExpired } from '../lib/api.js'
import AppLink from '../components/AppLink.jsx'

export default function AuthScreen({ demo, initialMode = 'signup', onBack }) {
  const [mode, setMode] = useState(initialMode) // 'signup' | 'signin' | 'forgot'
  const [form, setForm] = useState({ displayName: '', neighborhood: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [agreed, setAgreed] = useState(false) // must be ticked to create an account

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  // Arrived by an emailed reset link that no longer works.
  const expiredNotice = initialMode === 'forgot' && resetLinkExpired

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'forgot') {
        await api.requestPasswordReset(form.email)
        setResetSent(true)
      } else if (mode === 'signup') {
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

  function goTo(next) {
    setMode(next)
    setError(null)
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

      {resetSent ? (
        <div className="panel">
          <h2>Check your email</h2>
          <p>
            If there’s an account for {form.email}, we’ve sent a link to choose a new password. Open it on this
            device. It can take a minute, and it may land in spam.
          </p>
          <button className="btn btn-quiet" onClick={() => { setResetSent(false); goTo('signin') }}>
            Back to sign in
          </button>
        </div>
      ) : checkEmail ? (
        <div className="panel">
          <h2>Check your email</h2>
          <p>We sent a link to {form.email}. Open it to finish creating your account, then sign in here.</p>
          <button className="btn btn-quiet" onClick={() => { setCheckEmail(false); setMode('signin') }}>
            Go to sign in
          </button>
        </div>
      ) : (
        <form className="panel" onSubmit={submit}>
          {mode === 'forgot' ? (
            <>
              <h2>Reset your password</h2>
              {expiredNotice && (
                <p className="error" role="alert">
                  That reset link has expired or was already used. Enter your email to get a new one.
                </p>
              )}
              <p className="note">Enter the email you signed up with and we’ll send you a link to choose a new password.</p>
            </>
          ) : (
            <div className="switch" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => goTo('signup')}>
                Create account
              </button>
              <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => goTo('signin')}>
                Sign in
              </button>
            </div>
          )}

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
          {mode !== 'forgot' && (
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
          )}

          {mode === 'signup' && (
            <label className="agree">
              <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I agree to the <AppLink to="/terms" newTab>Terms of Use</AppLink> and{' '}
                <AppLink to="/privacy" newTab>Privacy Policy</AppLink>.
              </span>
            </label>
          )}

          {mode === 'signin' && (
            <button type="button" className="link-button" onClick={() => goTo('forgot')}>
              Forgot your password?
            </button>
          )}

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn btn-primary" disabled={busy}>
            {busy
              ? 'One moment…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Sign in'}
          </button>
          {mode === 'forgot' && (
            <button type="button" className="btn btn-quiet" onClick={() => goTo('signin')} disabled={busy}>
              Back to sign in
            </button>
          )}

          {demo && (
            <p className="note small">
              Demo mode: accounts and listings are saved only in this browser, so you can try everything safely.
              {mode === 'forgot' && ' No email is sent here, so the reset link opens right away.'}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
