# Backyard Harvest

Neighbors post extra produce from their gardens. Others nearby ask for it, the grower says yes, and it gets picked up from the porch instead of going to waste.

Built for the 2026 Congressional App Challenge.

## Run it on your computer

You need Node.js (LTS). On Windows, use **Command Prompt**, not PowerShell.

```
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173).

With no keys set, the app runs in **demo mode**: sample neighbors and listings are created around you, everything is saved only in your browser, and sample neighbors accept your requests after a few seconds so you can try the whole flow alone. Use **Reset demo data** on the Activity screen to start over.

## Connect the real database (Supabase)

1. Sign in at supabase.com and create a new project.
2. Open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Copy `.env.example` to a new file named `.env.local` and paste the two values in.
5. Stop and restart `npm run dev`. The demo banner disappears when you're live.

Supabase asks new users to confirm their email by default. For testing, you can turn that off under **Authentication → Sign In / Providers → Email → Confirm email**.

## Publish it (Vercel)

1. Push this project to GitHub.
2. At vercel.com, choose **Add New → Project** and import the repo.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. In Supabase, go to **Authentication → URL Configuration** and set the Site URL to your Vercel address.

## Install it on a phone

Open the published site on a phone.
- **iPhone (Safari):** Share button → **Add to Home Screen**
- **Android (Chrome):** menu → **Install app**

## How it works

| Piece | What it does |
|---|---|
| React + Vite | The screens |
| Supabase | Accounts, the database, and photo storage |
| Leaflet + OpenStreetMap | The map (free, no billing) |
| vite-plugin-pwa | Makes it installable and fast to reopen |

**Privacy by design.** A listing's public location is blurred by up to about 200 m before it's saved (`src/lib/geo.js`), and the map shows soft circles instead of pins. The real address lives in a separate table (`listing_pickups`) that the database only lets the grower, and the one neighbor they accept, read. These rules are enforced in the database itself (row level security in `supabase/schema.sql`), so they hold even if someone bypasses the app.

**Fairness.** Each person can have at most 3 open requests, so one person can't claim everything nearby.

**Auto-expire.** Every listing has a "good until" time. The freshness ring around each photo shrinks and changes color (green → yellow → red), and expired listings stop appearing on their own.

### Files

```
src/
  App.jsx                 screen switching, sign-in state
  screens/                Nearby, Map, Share (post), Activity, sign-in
  components/             listing card, detail sheet, freshness ring, tab bar
  lib/api.js              picks live Supabase or demo mode
  lib/supabaseApi.js      all database calls
  lib/demoApi.js          the same calls, saved in the browser
  lib/geo.js              location, blurring, distance
  lib/produce.js          categories, freshness math
supabase/schema.sql       tables, security rules, photo storage
```

## AI use disclosure

The Congressional App Challenge allows AI tools if all use is disclosed. Fill this in honestly for your submission, for example:

> I used Claude (Anthropic) to help plan the project and generate the first version of the code, including the database schema and React screens. I set up the project, connected Supabase, deployed it, tested it with neighbors, and wrote/changed: [list what you built or changed yourself].
