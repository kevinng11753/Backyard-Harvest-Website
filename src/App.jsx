import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api.js'
import { getCurrentPosition } from './lib/geo.js'
import AuthScreen from './screens/AuthScreen.jsx'
import PublicHome from './screens/PublicHome.jsx'
import NearbyScreen from './screens/NearbyScreen.jsx'
import MapScreen from './screens/MapScreen.jsx'
import PostScreen from './screens/PostScreen.jsx'
import ActivityScreen from './screens/ActivityScreen.jsx'
import ListingSheet from './components/ListingSheet.jsx'
import TabBar from './components/TabBar.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [tab, setTab] = useState('nearby')
  const [location, setLocation] = useState(null)
  const [openListing, setOpenListing] = useState(null)
  const [homeKey, setHomeKey] = useState(0) // bumping this resets the Nearby screen
  const [authMode, setAuthMode] = useState(null) // null = public home; 'signin' | 'signup' = sign-in screen
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
    return api.onAuthChange(load)
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

  if (user === undefined) {
    return <div className="splash" aria-busy="true">Backyard Harvest</div>
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
