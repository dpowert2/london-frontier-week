# London Frontier Week

Schedule, who's-where, travel and open-items app for the FCAT London trip, 11–13 November 2026.

## Files

- `index.html`, `styles.css`, `app.js` — the app. No build step, plain files.
- `store.js` — data layer. Uses the claude.ai artifact's shared store when the page runs as an artifact; otherwise shows the read-only built-in copy.
- `data.js` — the built-in copy and the seed for the shared store. Edit this to change the static version.
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — "Add to Home Screen" and offline shell for the static version.
- `BRIEF.md` — brief for a public, no-login version with its own database (Supabase + GitHub Pages).
- `dev.html`, `mock-claude.js` — local testing of the live mode without the artifact runtime (not for publishing).

## Links

- Schedule for a day: `#schedule-wed`, `#board-thu`, `#issues-fri`, `#people`, `#logistics`
- One person's itinerary: `#schedule-wed-as-ger` (ids are the keys in `data.js`)
- Preview the page at a given time: `#schedule-wed-at-wed-1430`

## Updating the static copy from the live one

In the live app, open About (the i button), use "Copy all data as JSON", and paste the `people`, `events`, `issues` and `dining` arrays into `data.js`.
