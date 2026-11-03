import { useCallback, useEffect, useRef, useState } from 'react'
import { api, startedInRecovery, resetLinkExpired } from './lib/api.js'
import { getCurrentPosition } from './lib/geo.js'
import AuthScreen from './screens/AuthScreen.jsx'
import ResetPasswordScreen from './screens/ResetPasswordScreen.jsx'
import LegalPage from './screens/LegalPage.jsx'
import { navigate, NAV_EVENT } from './lib/nav.js'
import PublicHome from './screens/PublicHome.jsx'
import NearbyScreen from './screens/NearbyScreen.jsx'
import MapScreen from './screens/MapScreen.jsx'
import PostScreen from './screens/PostScreen.jsx'
import ActivityScreen from './screens/ActivityScreen.jsx'
import ListingSheet from './components/ListingSheet.jsx'
import TabBar from './components/TabBar.jsx'
import Toast from './components/Toast.jsx'

// Remove "#access_token=…&type=recovery" (or an error) from the address bar.
function clearAddressHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [tab, setTab] = useState('nearby')
  const [location, setLocation] = useState(null)
  const [openListing, setOpenListing] = useState(null)
  const [homeKey, setHomeKey] = useState(0) // bumping this resets the Nearby screen
  // null = public home; 'signin' | 'signup' | 'forgot' = the sign-in screen.
  // An expired reset link lands straight on the "forgot password" form.
  const [authMode, setAuthMode] = useState(resetLinkExpired ? 'forgot' : null)
  // True while someone who followed a reset email is choosing a new password.
  const [recovering, setRecovering] = useState(startedInRecovery)
  const [toast, setToast] = useState(null)
  // Bumping this number tells every screen to reload its data.
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Who is signed in? Check now, and again whenever that changes.
  useEffect(() => {
    const load = () =>
      api
        .getUser()
        .then((u) => {
          setUser(u)
          if (u) setAuthMode(null) // signed in: leave the sign-in screen behind
        })
        .catch(() => setUser(null))
    load()
    return api.onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      load()
    })
  }, [])

  // Two pages have their own address: /terms and /privacy. Follow the address
  // bar, including the browser's back and forward buttons.
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    window.addEventListener(NAV_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(NAV_EVENT, sync)
    }
  }, [])

  // Once an expired reset link has been noticed, drop its leftovers from the address bar.
  useEffect(() => {
    if (resetLinkExpired) clearAddressHash()
  }, [])

  // The reset link should sign the person in within moments. If it never does
  // (a bad link), don't leave "choosing a new password" switched on, or the
  // next normal sign-in would be sent to that screen by mistake.
  const userRef = useRef(user)
  userRef.current = user
  useEffect(() => {
    if (!startedInRecovery) return undefined
    const timer = setTimeout(() => {
      if (!userRef.current) setRecovering(false)
    }, 15000)
    return () => clearTimeout(timer)
  }, [])

  // Find where the person is once they're signed in.
  useEffect(() => {
    if (user) getCurrentPosition().then(setLocation)
  }, [user])

  // The wordmark at the top is the way back to the home page (Nearby):
  // switch to it, close anything open, clear its filter, and scroll up.
  const goHome = useCallback(() => {
    setTab('nearby')
    setOpenListing(null)
    setHomeKey((k) => k + 1)
    window.scrollTo({ top: 0 })
  }, [])

  const showToast = useCallback((message) => {
    setToast({ message, id: Date.now() })
  }, [])

  // The legal pages are open to everyone, signed in or not.
  const legalPage = { '/terms': 'terms', '/privacy': 'privacy' }[path.replace(/\/+$/, '')]
  if (legalPage) {
    return <LegalPage kind={legalPage} onBack={() => navigate('/')} />
  }

  if (user === undefined) {
    return <div className="splash" aria-busy="true">Backyard Harvest</div>
  }

  // Followed a reset email: they're signed in by the link, so first ask for the new password.
  if (user && recovering) {
    return (
      <ResetPasswordScreen
        onDone={(message) => {
          setRecovering(false)
          clearAddressHash()
          if (message) showToast(message)
        }}
      />
    )
  }

  if (!user) {
    // Signed out: show the public listings, and the sign-in screen only
    // once they choose to sign in or create an account.
    if (authMode) {
      return <AuthScreen demo={api.mode === 'demo'} initialMode={authMode} onBack={() => setAuthMode(null)} />
    }
    return <PublicHome demo={api.mode === 'demo'} onAuth={setAuthMode} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="wordmark wordmark-link" aria-label="Backyard Harvest, go to the home page" onClick={goHome}>
          Backyard Harvest
        </button>
        {location && (
          <span className={`where ${location.precise ? '' : 'where-approx'}`}>
            {location.precise ? 'Near you' : 'Sample area'}
          </span>
        )}
      </header>

      {api.mode === 'demo' && (
        <p className="demo-note">Demo mode: everything stays in this browser.</p>
      )}

      <main className="screen">
        {!location ? (
          <p className="loading">Finding what’s growing near you…</p>
        ) : tab === 'nearby' ? (
          <NearbyScreen key={homeKey} location={location} userId={user.id} refreshKey={refreshKey} onOpen={setOpenListing} onPost={() => setTab('post')} />
        ) : tab === 'map' ? (
          <MapScreen location={location} refreshKey={refreshKey} onOpen={setOpenListing} />
        ) : tab === 'post' ? (
          <PostScreen
            location={location}
            onPosted={() => {
              showToast('Posted. Neighbors can see it now.')
              refresh()
              setTab('nearby')
            }}
          />
        ) : (
          <ActivityScreen user={user} refreshKey={refreshKey} onChanged={refresh} onToast={showToast} />
        )}
      </main>

      <TabBar tab={tab} onChange={setTab} />

      {openListing && (
        <ListingSheet
          listing={openListing}
          user={user}
          location={location}
          onClose={() => setOpenListing(null)}
          onChanged={(message) => {
            if (message) showToast(message)
            refresh()
          }}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
    </div>
  )
}
