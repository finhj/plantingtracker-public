# Planting Tracker — standalone web app

Multi-user version of the Planting Map: shared data, live sync between people,
and login with usernames you assign yourself (no open signup).

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, "New project" (free tier is plenty for this).
2. Once it's created, go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Set up the database

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste in everything from `supabase/schema.sql` in this folder and click **Run**.
   This creates the two tables (`farm_locations`, `plantings`) and the access rules.

## 3. Create logins for your team

Since usernames are assigned by you rather than self-registered:

1. In Supabase, go to **Authentication → Users → Add user**.
2. For each person, set:
   - Email: `THEIRUSERNAME@farmusers.local` (e.g. `jon@farmusers.local`)
   - Password: a temporary password you give them
3. Tell each person their **username** (just `jon`, not the fake email) and password.
   They'll type the plain username into the app — the `@farmusers.local` part is invisible to them.

*(They can't change their own password from inside the app yet — if you want a
"forgot password" flow later, that's a small addition, just ask.)*

## 4. Configure and run locally

```bash
npm install
cp .env.example .env
# edit .env and paste in your Project URL and anon key from step 1
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`) and sign in.

## 5. Deploy it for real

Easiest free option is **Vercel**:

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com), "Add New Project," import the repo.
3. In the project's **Environment Variables** settings, add `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY` with the same values from your `.env`.
4. Deploy. You'll get a real `https://...vercel.app` URL anyone on your team
   can open on their phone.

## 6. Add it to an Android home screen

Once deployed, open the URL in Chrome on Android → menu (⋮) → **Add to Home
screen**. It'll launch full-screen like a real app, using the basic
`public/manifest.json` already included here.

## How data sharing works

- Every planting is its own row in the database, tagged with who created and
  last updated it — two people editing different beds at the same time never
  overwrite each other.
- Map layout (marker positions, bed counts, direction, groupings) is stored
  as one shared row, since it changes far less often.
- The app subscribes to live database changes, so if someone else logs a
  planting while you have the app open, you'll see it update without
  refreshing.

## Map: OpenStreetMap, not the photo

This version uses a real, zoomable/pannable OpenStreetMap (via Leaflet),
loaded from a CDN at runtime — unlike the Claude artifact version, this isn't
sandboxed, so map tiles load normally here. Marker positions are calibrated
from real GPS points (the barn and three other known spots on the farm) fit
with a least-squares transform, so they're close but not perfectly surveyed —
use "Adjust positions" to drag any marker exactly into place; that's much
easier here since you can zoom in first.

`public/farm-map.jpg` (the original hand-annotated photo) is no longer used
by `src/PlantingMap.jsx` but is left in the project in case you want to
switch back to the static-photo version instead — that's the same file the
Claude artifact version uses.

## What's not included yet

- Self-serve password reset (accounts are fully admin-managed for now)
- Offline support (needs a network connection to load/save, and to load map tiles)
