import { api } from '../lib/api.js'
import { useLoad } from '../lib/useLoad.js'
import { summarize, summarizeYou, formatKg, formatUsd } from '../lib/impact.js'

// "Our neighborhood's impact": estimated CO2e avoided and money saved by the
// shares that have happened. On a wide screen it sits to the right of the page;
// on a phone it is a strip above the listings (`hideNarrow` tucks it away on
// screens where it would only get in the way).
export default function ImpactPanel({ refreshKey = 0, signedIn = false, hideNarrow = false }) {
  const { data } = useLoad(() => api.impactStats(), [refreshKey])

  // Still loading, or the database function isn't switched on yet: show nothing.
  if (!data) return null

  const all = summarize(data.community)
  const you = signedIn ? summarizeYou(data) : null

  return (
    <aside className={`impact ${hideNarrow ? 'impact-hide-narrow' : ''}`} aria-labelledby="impact-title">
      <h2 id="impact-title" className="impact-title">Our neighborhood’s impact</h2>

      {all.shares === 0 ? (
        <p className="impact-empty">No shares yet. The first one starts the count.</p>
      ) : (
        <dl className="impact-stats">
          <div className="impact-stat">
            <dt><span aria-hidden="true">💵</span> Money saved</dt>
            <dd>{formatUsd(all.usd)}</dd>
          </div>
          <div className="impact-stat">
            <dt><span aria-hidden="true">🌍</span> CO₂e avoided</dt>
            <dd>{formatKg(all.co2e)}</dd>
          </div>
          <div className="impact-stat">
            <dt><span aria-hidden="true">🧺</span> Shares</dt>
            <dd>{all.shares}</dd>
          </div>
        </dl>
      )}

      {you && (
        <p className="impact-you">
          {you.given + you.received === 0 ? (
            'Share something, or ask for something, and your part shows up here.'
          ) : (
            <>
              <strong>Your part:</strong> {you.given} shared, {you.received} received. About {formatKg(you.co2e)} CO₂e
              avoided{you.usd > 0 ? ` and ${formatUsd(you.usd)} saved` : ''}.
            </>
          )}
        </p>
      )}

      <details className="impact-how">
        <summary>How we estimate this</summary>
        <p>
          A share counts once a grower says yes to a neighbor’s request. We don’t record weights or prices, so each
          share is a typical amount for its kind: about 1.5 kg for vegetables or fruit, less for greens and herbs.
          Money saved is roughly what that would cost in a shop. CO₂e assumes about 1 kg for every kilogram of
          produce, and flowers and seedlings don’t count toward it. These are rough estimates, not measurements.
        </p>
      </details>
    </aside>
  )
}
