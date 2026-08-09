# Planting Tracker — Decisions Log

Structural and product decisions for the Planting Tracker project. Entries are numbered in the order they were made (backfilled retroactively from project history on 2026-08-09; new decisions should be added as one short row going forward, in the same session they're made).

| # | Decision |
|---|----------|
| 1 | Track plantings at the field/tunnel level, organized by the farm's real layout, rather than a generic list. |
| 2 | Build a visual map overlay on the farm's hand-annotated aerial photo instead of a plain list-based UI. |
| 3 | Confirmed farm layout: Field 1/Upper Field (NW/NE/SW/SE), Field 2 (no sub-sections), Field 3/Lower Field/Downstairs (NN/N/S), Field 4/U-Pick (N/E/W/S), no Field 5, Field 6 (NW/SW/E). |
| 4 | Confirmed tunnel list, each a single planting area with no sub-sections: High Tunnel, OMT 1, OMT 2, FT1–FT5, Cat 1, Cat 2. |
| 5 | Confirmed small standalone plots between tunnels (not sub-sections of the tunnels): SOM1, SOMT2, NFT1, SFT1, SFT2, SFT3 — N/S prefix means north/south of the associated tunnel. |
| 6 | Barn, Chicken World, Goat World, and Nature Trail shown on the map for orientation only — not trackable planting locations. Greenhouse is both shown and trackable. |
| 7 | Every location's bed count is user-editable (not fixed), since it changes over time. |
| 8 | Marker positions on the map are best-effort estimates read off the photo (later refined with a percent grid), with a drag-to-adjust "Adjust positions" mode and a "Reset positions" button to restore computed defaults without touching plantings. |
| 9 | A single bed can hold more than one planting at once, each tagged with a free-text "portion" (e.g. "north half") rather than exact measurements — chosen over splitting beds into fractional sub-beds (4a/4b), which would inflate the bed count and muddy its meaning. |
| 10 | Tried a live OpenStreetMap (Leaflet) version using real GPS coordinates. Map tiles don't load inside the Claude artifact sandbox (blocked outbound requests) — markers render but no basemap. Kept the photo-based version as primary; OSM code exists but needs to run outside the sandbox (local dev, CodeSandbox, or a deployed site) to actually show tiles. |
| 11 | GPS calibration approach: use 2+ known real-world points (Barn, Field 6 SW corner, later High Tunnel and Greenhouse) and a least-squares affine fit to convert the map photo's pixel positions to lat/lon, rather than a single-point/rough estimate. |
| 12 | Confirmed: paths exist between every individual bed (not just between larger groups), and the smallest boundary the farm's management has actually defined is the field-section level (e.g. NW). Any banding/grouping of beds within a section is a pure UI display choice, not a real physical boundary. |
| 13 | Each section stores and displays its own bed-direction ("Bed 1 starts at the North end" or "starts at the East end") rather than relying on one global rule, since orientation varies by section. |
| 14 | For sections with many beds (e.g. ~27), combine three things: a dense compact grid of numbered, color-coded tiles as the default view; collapsible bands (e.g. "Beds 1–9") to chunk very large sections; and a "jump to bed #" input for fast lookup while in the field. |
| 15 | Bed grouping/banding within a large section is automatic by default (groups neighboring beds that share the same crop set), with a manual override available (custom breakpoints) if the auto-grouping doesn't match reality. |
| 16 | Ease of quick use out in the field, on a phone, is the top priority guiding UI decisions — over more elaborate features that would slow that down. |
| 17 | General working preference (not project-specific, but applied here): finish the task that was started earliest first, unless there's a good reason to switch. |
| 18 | Decided to build a standalone multi-user web app version (outside the Claude artifact), since Claude's `window.storage` only supports one Claude account, not a shared team. |
| 19 | Multi-user auth approach: usernames are assigned by the farm admin (not self-service signup). Supabase Auth requires an email under the hood, so usernames map invisibly to `username@farmusers.local`. |
| 20 | Web app data model: `farm_locations` — one shared JSON-blob row for map layout/config (rarely changes); `plantings` — one row per individual planting entry, tagged with `created_by`/`updated_by`, so two people editing different beds at once never overwrite each other. Live sync via Supabase realtime so changes appear for everyone without refreshing. |
| 21 | Hosting plan for the web app: free tiers throughout — Supabase (backend/DB/auth), GitHub (code + version control), Vercel (hosting/deploy), given this is personal/non-commercial farm use. |
| 22 | Added JSON export/import (backup and restore) to both the Claude artifact and the standalone web app, rather than CSV — preserves the full nested data structure exactly. Restoring in the web app replaces the shared data for all users, with a confirmation warning first. |
| 23 | Downloading real satellite map tiles for an offline zoomable map isn't feasible from Claude's code sandbox (no outbound network access at all) — ruled out for now; static single-image satellite snapshot remains a possible future fallback if OSM/live tiles are still wanted later. |

| 24 | Once the tracker was running as a real deployed web app (outside Claude's sandbox), retried the OpenStreetMap approach — merged the earlier GPS-calibrated Leaflet rendering into the full-featured Supabase web app component (auth, bed direction, auto-grouping, backup/restore all carried over), replacing the static photo as the web app's map. The Claude artifact version keeps the static photo, since tile loading is still blocked inside that sandbox. |

## Deferred / not yet decided
- Exact scope of "planting history" tracking (first harvest, last harvest, etc. beyond current anticipated-harvest field).
- Whether/how to add full-text search across the whole log.
- Self-serve password reset for web app users (currently fully admin-managed).
