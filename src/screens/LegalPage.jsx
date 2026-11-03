import { useEffect } from 'react'
import { SITE } from '../lib/site.js'
import AppLink from '../components/AppLink.jsx'

// The Terms of Use and the Privacy Policy. Everything said here is meant to
// match what the app really does; if the app changes (new services, new data),
// update this text and SITE.legalUpdated in src/lib/site.js.

function Contact() {
  if (!SITE.contactEmail) return null
  return (
    <>
      <h2>Contact</h2>
      <p>
        Questions, or want something fixed or removed? Write to{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated {SITE.legalUpdated}</p>
      <p>
        These are the ground rules for using {SITE.name}. By creating an account or using the site, you agree to
        them. If you don’t agree, please don’t use it.
      </p>

      <h2>What {SITE.name} is</h2>
      <p>
        {SITE.name} helps neighbors share extra backyard produce, herbs, flowers and seedlings. Growers post what they
        have, neighbors ask for it, and the grower decides who gets it. We’re not a store or a marketplace, we don’t
        handle payments, and we don’t grow, inspect, deliver or guarantee anything that’s shared.
      </p>

      <h2>Who can use it</h2>
      <ul>
        <li>You must be at least 13. If you’re under 18, ask a parent or guardian before you sign up.</li>
        <li>Give accurate information, keep your password to yourself, and use one account for yourself only.</li>
        <li>You’re responsible for what happens under your account.</li>
      </ul>

      <h2>If you share produce</h2>
      <ul>
        <li>Only post things you grew or have the right to give away.</li>
        <li>
          Describe them honestly: what it is, how much, and anything a person should know, such as sprays, allergens,
          bruising or how ripe it is.
        </li>
        <li>Don’t post anything unsafe, illegal, or that isn’t plants or produce.</li>
        <li>
          Your pickup address stays private until you say yes to a request. Choose a pickup spot you’re comfortable
          with, like a porch or curb.
        </li>
        <li>Follow any local rules that apply to sharing food. That’s on you, not us.</li>
      </ul>

      <h2>If you ask for produce</h2>
      <ul>
        <li>Only ask for what you’ll really pick up, and cancel if your plans change so someone else can have it.</li>
        <li>
          Use a grower’s address only to collect what they agreed to give you. Don’t share it, and don’t come by at
          other times.
        </li>
        <li>To keep things fair, each person can have at most three open requests at a time.</li>
      </ul>

      <h2>Staying safe</h2>
      <p>
        We can’t check who anyone is or what they’re offering. Use your judgment. Pick up in daylight, tell someone
        where you’re going, you don’t need to go inside anyone’s home, and wash produce before you eat it. If
        something feels wrong, don’t go. Call local emergency services if you’re in danger.
      </p>

      <h2>Be decent</h2>
      <p>Please don’t:</p>
      <ul>
        <li>harass, threaten or discriminate against anyone;</li>
        <li>post spam, fake listings, or things meant to mislead;</li>
        <li>try to get at other people’s private information or break the site’s security;</li>
        <li>copy the site’s listings in bulk, or use the site for anything illegal.</li>
      </ul>

      <h2>What you post</h2>
      <p>
        You keep ownership of your listings, photos and notes. By posting them you let us store and show them as part
        of {SITE.name}, including to people who aren’t signed in, as described in the Privacy Policy. You can delete a
        listing at any time, which removes it from the site.
      </p>

      <h2>Reporting and blocking</h2>
      <p>
        If a listing or a request worries you, use <strong>Report or block</strong> on it. A report is read by the
        person who runs {SITE.name}, and the person you reported isn’t told it came from you. Blocking a neighbor
        hides your listings from each other, stops you asking each other for produce, and ends any open requests
        between you. Blocking is your own choice and doesn’t need a reason. You can undo it in the Activity tab.
      </p>

      <h2>Our right to step in</h2>
      <p>
        We may remove listings, or suspend or close accounts, that break these rules or put people at risk, and we may
        change or stop the service at any time.
      </p>

      <h2>No guarantees</h2>
      <p>
        Produce is shared as is. Growers are neighbors, not licensed sellers. We can’t promise that anything is safe,
        fresh, available or as described, or that any person will show up or behave well. The site is provided as it
        is, and may sometimes be down or wrong. Use it at your own risk.
      </p>
      <p>
        To the extent the law allows, {SITE.name} and the people who run it aren’t responsible for harm that comes
        from food, from meeting someone, or from the service itself. Nothing here takes away rights you have by law.
      </p>

      <h2>Changes and leaving</h2>
      <p>
        We may update these Terms. When we do, we’ll change the date at the top, and using the site after that means
        you accept the new version. You can stop using {SITE.name} at any time.
      </p>

      <Contact />
    </>
  )
}

function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated {SITE.legalUpdated}</p>

      <div className="legal-summary">
        <p>
          <strong>The short version.</strong> We collect only what {SITE.name} needs to work. We don’t sell your
          information, show ads, or run analytics or tracking tools. Your exact pickup address is shared only with
          the neighbor a grower says yes to.
        </p>
      </div>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, your password (stored scrambled by our sign-in service,
          so we never see it), the name you enter, and the street or neighborhood you enter.
        </li>
        <li>
          <strong>What you post:</strong> listing titles, types, quantities, descriptions and photos; how long a
          listing stays up; a private pickup address and instructions; and the approximate spot on the map.
        </li>
        <li>
          <strong>What you request:</strong> which listings you ask for, and the short note you can include.
        </li>
        <li>
          <strong>Reports and blocks:</strong> if you report a listing or request, we keep the reason, your note, and a
          copy of the listing text or request message you reported, along with the names of the two people. If you block
          a neighbor, we keep that you did.
        </li>
        <li>
          <strong>Technical details:</strong> like your IP address and device type, which our hosting and database
          providers receive whenever you use the site and may keep in their security and traffic logs.
        </li>
      </ul>

      <h2>Your location</h2>
      <ul>
        <li>Your browser asks your permission before sharing your location. You can say no and still use the site.</li>
        <li>
          Your location is used to show what’s near you and to put your listing on the map. To find nearby listings,
          the app asks for listings inside a square roughly twenty miles wide. The square is centered on a rounded
          version of your position (rounded to a grid a few miles across), so your exact position isn’t sent. That
          request goes to our database provider and may appear in its logs. We don’t keep it ourselves.
        </li>
        <li>
          When you post, the location we save is moved by up to about 200 meters and rounded, so it never marks your
          exact spot. Your exact position is not saved.
        </li>
        <li>If you say no, the app uses a sample area instead.</li>
      </ul>

      <h2>Photos</h2>
      <p>
        Photos are resized in your browser before they’re uploaded. This also drops hidden details that phone cameras
        attach, such as where a picture was taken. Photos on listings can be seen by anyone who can see the listing.
      </p>

      <h2>Who can see what</h2>
      <ul>
        <li>
          <strong>Anyone, even without an account:</strong> each open listing’s title, photo, type, quantity and
          description; the grower’s first name; how long it has left; and a rounded area of about one kilometer.
        </li>
        <li>
          <strong>Signed-in members:</strong> all of that, plus a slightly more precise area on the map, and the name
          and street or neighborhood other members entered when they signed up (the app shows first names).
        </li>
        <li>
          <strong>A grower:</strong> sees the names and notes of the people who ask for their produce.
        </li>
        <li>
          <strong>The pickup address and instructions:</strong> only the grower and the one neighbor they accept.
        </li>
        <li>
          <strong>Reports:</strong> only the people who run {SITE.name}. The person you reported can’t see them.
        </li>
        <li>
          <strong>Blocks:</strong> only you. The neighbor you blocked isn’t told, though they will no longer see your
          listings.
        </li>
        <li>
          <strong>The people who run {SITE.name}:</strong> can access the database in order to run and fix the
          service. We only look at private details when we need to, such as to deal with a report or a problem.
        </li>
      </ul>
      <p>Please don’t put personal details in listing text or photos, because the listing can be seen publicly.</p>

      <h2>Services we use</h2>
      <ul>
        <li>
          <strong>Supabase</strong> keeps accounts, the database and uploaded photos, and sends sign-in emails.
        </li>
        <li>
          <strong>Cloudflare</strong> hosts the site, and handles requests to it.
        </li>
        <li>
          <strong>OpenStreetMap</strong> supplies the map pictures. Your browser asks its servers for them, so they
          see your IP address and which part of the map you’re looking at.
        </li>
        <li>
          <strong>Google Fonts</strong> supplies the site’s fonts. Your browser asks Google for them, so Google sees
          your IP address.
        </li>
      </ul>
      <p>These providers have their own privacy policies. We don’t share your information with anyone else, unless the law requires it.</p>

      <h2>Cookies and storage</h2>
      <p>
        {SITE.name} doesn’t use cookies for tracking or ads. Our hosting provider may use cookies that are needed for
        security. Your browser’s local storage keeps you signed in, and the installable-app feature saves a copy of
        the site on your device so it opens faster.
      </p>

      <h2>Keeping and deleting</h2>
      <ul>
        <li>
          Deleting a listing removes it, its pickup details, any requests for it and its photo.
        </li>
        <li>Listings that expire stop showing up, but aren’t removed automatically. You can delete them yourself.</li>
        <li>
          You can delete your account yourself: open the Activity tab and choose Delete my account. That removes your
          profile and sign-in, every listing you posted with its photo and pickup details, your requests, the people
          you blocked, and any reports you sent or that were made about you. Providers may keep routine backups for a
          short while.
          {SITE.contactEmail ? ' If you can’t sign in, write to the contact below and we’ll help.' : ''}
        </li>
      </ul>

      <h2>Children</h2>
      <p>{SITE.name} isn’t for children under 13, and we don’t knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change what we collect or how we use it, we’ll update this page and the date at the top.</p>

      <Contact />
    </>
  )
}

export default function LegalPage({ kind, onBack }) {
  const title = kind === 'terms' ? 'Terms of Use' : 'Privacy Policy'

  useEffect(() => {
    const previous = document.title
    document.title = `${title} · ${SITE.name}`
    return () => {
      document.title = previous
    }
  }, [title])

  return (
    <div className="legal">
      <header className="topbar">
        <button type="button" className="wordmark wordmark-link" aria-label={`${SITE.name}, go to the home page`} onClick={onBack}>
          {SITE.name}
        </button>
        <button type="button" className="btn btn-quiet btn-small" onClick={onBack}>
          ← Back
        </button>
      </header>

      <article className="legal-body">
        {kind === 'terms' ? <Terms /> : <Privacy />}

        <p className="legal-other">
          {kind === 'terms' ? (
            <>See also the <AppLink to="/privacy">Privacy Policy</AppLink>.</>
          ) : (
            <>See also the <AppLink to="/terms">Terms of Use</AppLink>.</>
          )}
        </p>
      </article>
    </div>
  )
}
