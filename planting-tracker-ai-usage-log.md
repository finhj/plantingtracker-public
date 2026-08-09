# Planting Tracker — AI Usage Log

What Claude was used for on this project, for transparency. Backfilled retroactively on 2026-08-09; add a row in the same session as the work going forward, not caught up later. Outlines/brainstorming are Claude's own work; final prose/copy written *for* the user elsewhere is out of scope for this project (this is a code/product-design project, not a writing one).

| # | What Claude did |
|---|------------------|
| 1 | Built the first version of the tracker (`PlantingLog.jsx`) from scratch: React artifact, persistent storage, add/edit locations and beds. |
| 2 | Asked clarifying questions about the uploaded farm map photo and confirmed the full field/tunnel/plot layout with the user over several exchanges. |
| 3 | Built `PlantingMap.jsx` v1: embedded the user's map photo (resized/compressed to a base64 data URI), placed markers for every location by visual estimate. |
| 4 | Added editable per-location bed counts and a bed-detail panel with a plant/edit/clear form. |
| 5 | Answered product questions (running on Android, where/how data is saved) by explaining Claude's artifact and storage mechanics accurately. |
| 6 | Generated a percent-grid overlay of the map photo (image processing via the code sandbox) and used it to read more accurate marker coordinates; added drag-to-adjust and reset-to-default marker positioning. |
| 7 | Respaced a crowded cluster of markers after the user reported overlapping dots. |
| 8 | Explained the Claude/Anthropic products landscape accurately when asked (Claude apps, artifacts) without overstating capability. |
| 9 | Built a full Leaflet + OpenStreetMap version (`PlantingMapOSM.jsx`), including dynamic CDN script loading for Leaflet, real GPS-based marker placement, and drag-to-reposition writing back to lat/lon. Diagnosed and clearly explained the sandbox's tile-loading limitation when it didn't render, including a live test (bash `curl`) to confirm the sandbox has no outbound network access at all. |
| 10 | Computed real-world GPS calibration by hand: converted the user's provided lat/lon points and the map's pixel positions into a least-squares affine transform (via Python/numpy in the code sandbox), first with 2 points then refined with 4. |
| 11 | Designed and implemented multi-crop-per-bed support (portion-tagged entries) after a design discussion with the user about partial-bed planting. |
| 12 | Facilitated an extended design discussion (asked clarifying questions, presented options) on bed subgrouping, bed-direction conventions, and chunking large sections — corrected course mid-discussion when the user clarified there's no physical subgroup boundary smaller than a section. |
| 13 | Started building the direction/auto-grouping/jump-to-bed feature; work was interrupted by a sandbox reset before the UI pieces were finished. Verified this honestly when asked, rather than assuming it was complete. |
| 14 | Rebuilt and finished the direction toggle, auto-grouped collapsible bands (with manual override), and jump-to-bed input from scratch after the interruption. |
| 15 | Explained, at a product level, what would be needed to run the tracker as a real standalone web app (storage swap, project scaffold, hosting, PWA). |
| 16 | Designed and built a full multi-user web app scaffold: Vite + React project structure, Supabase client setup, assigned-username login screen (mapped to disguised emails), Postgres schema with row-level security (`schema.sql`), a Supabase-backed rewrite of the tracker component (per-row planting storage, realtime sync, sign-out), PWA manifest, and a step-by-step `README.md`. Packaged and delivered as a zip. |
| 17 | Added JSON backup/export and restore/import to both the Claude artifact and the web app version, including validation and confirmation prompts before an overwrite/restore. |
| 18 | Searched for and explained current, accurate setup steps for creating a Supabase project and finding the Project URL/API keys, since the dashboard layout had changed since the README was written. |
| 19 | Searched for and explained Vercel's free-tier pricing and terms accurately when asked. |
| 20 | Corrected a misunderstanding (Supabase vs. GitHub Pages) and adapted the deployment plan on the fly once it became clear the user was working from an Android phone and couldn't run local Node tooling — proposed and explained a GitHub + Vercel path instead. |
| 21 | Re-shared the project zip file when the user switched devices and lost track of where to find it. |
| 22 | Created this decisions log, status log, and AI usage log, backfilled retroactively from the full project history. |
| 23 | Diagnosed a Supabase "email rate limit exceeded" error from the exact error message the user pasted, and explained the correct alternative flow (Create new user + Auto Confirm) rather than the invite-email flow that doesn't work with the app's fake-email usernames. |
| 24 | Merged the earlier GPS-calibrated Leaflet/OpenStreetMap rendering code into the full-featured Supabase web app component — surgical edits (not a full rewrite) to swap the photo-based marker positioning for real lat/lng Leaflet markers while preserving auth, bed direction, auto-grouping, jump-to-bed, and backup/restore untouched. Validated with brace-balance and reference checks in the sandbox (no JSX parser available offline, so relied on manual review plus static checks). Repackaged and redelivered the web app zip. |
