# Planting Tracker — Project Status Log

Snapshots of where the project stood at each milestone. Backfilled retroactively on 2026-08-09; add a new row at each meaningful milestone going forward rather than catching up later.

| # | Status |
|---|--------|
| 1 | First version built: `PlantingLog.jsx` — generic list-based tracker (add a location, tap a bed, plant it). No map, no real farm layout yet. |
| 2 | Farm's real field/tunnel layout fully confirmed (fields, tunnels, small plots, reference-only areas, greenhouse) through several rounds of Q&A with the user. Saved to memory as an ongoing project. |
| 3 | `PlantingMap.jsx` v1 built: user's hand-annotated aerial map photo embedded as the background, with tappable markers for every location, positioned by eye. |
| 4 | Editable bed counts added per location; each bed individually plantable (single planting per bed at this stage). |
| 5 | Confirmed working inside the Claude Android app (artifacts render natively; storage is tied to the user's Claude account, not a separate database). |
| 6 | Marker positions recalibrated using a percent-grid overlay read off the map photo, closer to true positions. "Adjust positions" (manual drag) and "Reset positions" (recompute defaults) added. |
| 7 | Crowded marker cluster (tunnels/small plots) respaced after user reported overlapping dots. |
| 8 | Live OpenStreetMap version (`PlantingMapOSM.jsx`) attempted using Leaflet + real GPS coordinates. Confirmed it does not render map tiles inside the Claude artifact sandbox (network restriction) — markers show on a blank background only. Shelved in favor of continuing the photo-based version; OSM file kept for future use outside the sandbox. |
| 9 | Multi-crop-per-bed support added (a bed can hold more than one planting, each tagged with a portion of the bed) — supersedes the single-planting-per-bed model from status #4. |
| 10 | Mid-project design phase: bed direction convention, large-section chunking (grid + collapsible bands + jump-to-bed), and automatic-with-override bed grouping all designed and agreed but not yet built. |
| 11 | Build of the above (direction toggle, auto-grouped bands, jump-to-bed) started, then interrupted before completion when working files were lost to a sandbox reset. Confirmed incomplete when the user asked directly; picked back up and finished. |
| 12 | `PlantingMap.jsx` (Claude artifact) reached its current feature-complete state: map overlay, editable bed counts, multi-crop beds with portions, drag-to-adjust + reset positions, bed direction labels, auto-grouped collapsible bands with manual override, jump-to-bed. |
| 13 | GPS calibration for a possible future OSM version refined from 2 reference points (Barn, Field 6 SW corner) to 4 (adding High Tunnel, Greenhouse) using a least-squares affine fit — residual error roughly 3–6 meters against the user's real readings. |
| 14 | Standalone multi-user web app scaffold built: Vite + React project, Supabase backend (Postgres + Auth + Realtime), assigned-username login, per-row planting storage with live sync, PWA manifest, full README with setup steps. Packaged as `planting-tracker-webapp.zip`. |
| 15 | JSON backup/restore (export the whole tracker, or restore from a file) added to both the Claude artifact and the web app version. |
| 16 | User created their Supabase project and began the setup walkthrough: locating Project URL and anon/publishable API key (dashboard layout has changed since the README was written — "Connect" button is the fastest way to find both together now). |
| 17 | Clarified for the user: Supabase is the backend/database only, not a code host — GitHub + Vercel (or similar) is still needed to actually serve the app's UI. Confirmed Vercel's free Hobby tier is sufficient for this (personal/non-commercial use). |
| 18 | Local `npm install`/`npm run dev` testing ruled out — user is working from an Android phone at that point, which can't run a Node dev environment. Pivoted the deployment plan to: unzip project → upload to GitHub → connect repo to Vercel → set Supabase URL/key as Vercel environment variables (no local run needed). |
| 19 | User uploaded the web app project files to GitHub, set up the Supabase project/schema, connected the repo to Vercel, and added the environment variables — deployed, but the deployed page loaded blank (likely stale deploy from before env vars were added, or a build issue in the browser console; unresolved at time of writing). |
| 20 | Worked through a Supabase user-creation snag: "Add user" via "Send invitation" was hitting Supabase's built-in email rate limit (expected, since the app uses fake `@farmusers.local` addresses that can't receive real email) — resolved by using "Create new user" with a password set directly and Auto Confirm enabled, instead. |
| 21 | Re-attempted the OpenStreetMap map now that the tracker runs on a real server (Vercel) instead of Claude's sandboxed artifact — merged the GPS-calibrated Leaflet map into the full-featured web app component. Web app zip repackaged and redelivered; not yet confirmed working live by the user. |
| 22 | **Current status:** web app code (with the new OpenStreetMap map) has been repackaged and handed to the user to push to GitHub/redeploy. Outstanding from before: the blank-white-screen deploy issue needs diagnosing (browser console check pending), and end-to-end login + planting test hasn't been confirmed successful yet. |
