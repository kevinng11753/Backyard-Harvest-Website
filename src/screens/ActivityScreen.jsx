import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { resetDemo } from '../lib/demoApi.js'
import { useLoad } from '../lib/useLoad.js'
import { firstName, freshness, isActive, timeAgo } from '../lib/produce.js'
import ProduceThumb from '../components/ProduceThumb.jsx'
import PickupDetails from '../components/PickupDetails.jsx'

const REQUEST_STATUS = {
  pending: 'Waiting for an answer',
  accepted: 'Yes! Go pick it up',
  declined: 'Went to another neighbor',
  cancelled: 'You cancelled'
}

export default function ActivityScreen({ user, refreshKey, onChanged, onToast }) {
  // Check for new answers every 5 seconds while this screen is open.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(timer)
  }, [])

  const listings = useLoad(() => api.myListings(), [refreshKey, tick])
  const requests = useLoad(() => api.myRequests(), [refreshKey, tick])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  async function act(id, action, message) {
    setBusyId(id)
    setError(null)
    try {
      await action()
      onToast(message)
      onChanged()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const incoming = (listings.data ?? []).flatMap((l) =>
    (l.requests ?? []).filter((r) => r.status === 'pending').map((r) => ({ ...r, listing: l }))
  )

  return (
    <section className="activity">
      <h1 className="screen-title">Activity</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <h2 className="section-title">Requests for your harvest</h2>
      {incoming.length === 0 ? (
        <p className="note">No one is waiting on you right now.</p>
      ) : (
        <ul className="rows">
          {incoming.map((r) => (
            <li key={r.id} className="row row-request">
              <ProduceThumb listing={r.listing} size={52} showRing={false} />
              <div className="row-body">
                <p className="row-title">
                  {firstName(r.requester?.display_name)}
                  {r.requester?.neighborhood ? ` from ${r.requester.neighborhood}` : ''} wants your {r.listing.title.toLowerCase()}
                </p>
                {r.message && <p className="quote">“{r.message}”</p>}
                <p className="row-sub">{timeAgo(r.created_at)}</p>
                <div className="row-actions">
                  <button
                    className="btn btn-primary btn-small"
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, () => api.respond(r.id, 'accepted'), `Accepted. ${firstName(r.requester?.display_name)} can now see your pickup details.`)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-quiet btn-small"
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, () => api.respond(r.id, 'declined'), 'Declined.')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Things you asked for</h2>
      {(requests.data ?? []).length === 0 ? (
        <p className="note">When you ask a neighbor for something, it shows up here.</p>
      ) : (
        <ul className="rows">
          {requests.data.map((r) => (
            <li key={r.id} className={`row status-${r.status}`}>
              {r.listing && <ProduceThumb listing={r.listing} size={52} showRing={false} />}
              <div className="row-body">
                <p className="row-title">
                  {r.listing?.title ?? 'Removed listing'}
                  <span className="row-from"> from {firstName(r.listing?.owner?.display_name)}</span>
                </p>
                <p className={`badge badge-${r.status}`}>{REQUEST_STATUS[r.status]}</p>
                {r.status === 'accepted' && (
                  <>
                    <PickupDetails grower={firstName(r.listing?.owner?.display_name)} pickup={r.pickup} />
                    <button
                      className="btn btn-quiet btn-small"
                      disabled={busyId === r.id}
                      onClick={() => {
                        const what = r.listing?.title?.toLowerCase() ?? 'this'
                        if (window.confirm(`Give up the ${what}? It will go back to the neighborhood so someone else can ask for it.`)) {
                          act(r.id, () => api.cancelRequest(r.id), 'Released. It’s open to other neighbors again.')
                        }
                      }}
                    >
                      Can’t make it
                    </button>
                  </>
                )}
                {r.status === 'pending' && (
                  <button
                    className="btn btn-quiet btn-small"
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, () => api.cancelRequest(r.id), 'Request cancelled.')}
                  >
                    Cancel request
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Your listings</h2>
      {(listings.data ?? []).length === 0 ? (
        <p className="note">Nothing posted yet. Tap Share to give away your extra.</p>
      ) : (
        <ul className="rows">
          {listings.data.map((l) => {
            const status = isActive(l)
              ? freshness(l).label
              : l.status === 'claimed'
                ? 'Claimed'
                : l.status === 'gone'
                  ? 'All gone'
                  : 'Expired'
            return (
              <li key={l.id} className="row">
                <ProduceThumb listing={l} size={52} showRing={isActive(l)} />
                <div className="row-body">
                  <p className="row-title">{l.title}</p>
                  <p className="row-sub">
                    {status}. Posted {timeAgo(l.created_at)}.
                  </p>
                  {(l.status === 'available' || l.status === 'claimed') && (
                    <button
                      className="btn btn-quiet btn-small"
                      disabled={busyId === l.id}
                      onClick={() => act(l.id, () => api.setListingStatus(l.id, 'gone'), 'Marked as all gone.')}
                    >
                      Mark as all gone
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="account">
        <p>
          Signed in as <strong>{user.display_name}</strong>
          {user.email ? ` (${user.email})` : ''}
        </p>
        <div className="row-actions">
          <button className="btn btn-quiet btn-small" onClick={() => api.signOut()}>Sign out</button>
          {api.mode === 'demo' && (
            <button className="btn btn-quiet btn-small" onClick={resetDemo}>Reset demo data</button>
          )}
        </div>
      </div>
    </section>
  )
}
