# Brief for Claude Code: public, no-login version of the London Frontier Week app

## Why this brief exists

The app in this folder already works in two modes:

1. **Static** (`index.html` on any web host, e.g. GitHub Pages): read-only, data comes from `data.js`.
2. **Live** (published as a claude.ai artifact): shared editing through the artifact's `db` capability. Everyone with access sees edits within a second or two; a change log and undo are built in.

The live mode has one constraint that may not suit a 17-person delegation that includes guests from outside Fidelity: every viewer has to be signed in to claude.ai, and editors have to be invited by email at Contributor level or above. If the team needs a plain link that works for anyone, with no sign-in, and a small group of organisers who can edit, build the version described here.

Nothing in the UI needs to change. The job is to replace the data layer (`store.js`) with one backed by a small hosted database, and to deploy the static files to GitHub Pages.

## What the app does (so you can test it properly)

- **Schedule**: a day's sessions in time order; sessions that run at the same time sit side by side.
- **Who's where**: one row per person, blocks per session, blank space is free time. Overlaps of over 30 minutes stack into a second lane.
- **Viewing as**: switch to one person's itinerary (free blocks, "leave at" times). The hash encodes it: `#schedule-wed-as-ger`.
- **People**: directory with roles, hotels, bios.
- **Travel & stays**: departure times per session, dinner bookings, hotel groups.
- **Open items**: conflicts, things to confirm per event (tickable), computed free time per person, data checks, resolved items.
- **Edit mode** (when the store allows writes): add/edit/duplicate/delete events; edit attendance with per-person TBC; move a person between sessions; add/remove a person from a session; add/edit/remove people; add/edit/resolve/delete open items; tick per-event actions; add/edit/delete dinner bookings; change log with names; single-level undo; concurrent-edit guard (warns if an item changed while a form was open).

Preview "now" with `#schedule-wed-at-wed-1430` (page behaves as if it were 14:30 on the Wednesday).

## The contract `app.js` depends on

`app.js` only talks to `window.Store`. Keep this surface identical and nothing else needs touching:

```js
Store.state   // { mode: 'static'|'connecting'|'live', reason, stale, empty, canWrite, isOwner, me,
              //   people[], events[], issues[], dining[], log[], markers[], days[], hotels{}, meta{} }
Store.init()                       // loads the seed, then connects; emits on every change
Store.subscribe(fn)                // fn(state) on every change; returns unsubscribe
Store.editable()                   // true when mode === 'live' && canWrite !== false
Store.readDoc(col, id)             // Promise<doc|null> (used for the rev guard)
Store.apply(ops, logText)          // ops: [{col, id, data|null}] applied in order; data null = delete;
                                   // sets rev (+1), updatedAt, updatedBy; pushes an undo record; writes a log line
Store.undo()                       // reverts the last apply; Promise<logText|null>
Store.canUndo()
Store.seedShared()                 // loads data.js into an empty store (owner-only recovery)
Store.profiles(ids)                // Promise<{[id]: {name}}> for the change log
Store.exportJson()
```

Documents are plain JSON objects. Collections: `people`, `events`, `issues`, `dining`, `log`. Every document has `id`, `rev`, `updatedAt`, `updatedBy`. See `data.js` for the shape of each.

## Target architecture

- **Hosting**: GitHub Pages, repo `dpowert2/london-frontier-week` (public). Static files only. Keep `<meta name="robots" content="noindex">`.
- **Database**: Supabase (Postgres) with Realtime. One project, four tables mirroring the collections plus `log`. Each row: `id text primary key`, `data jsonb`, `rev int`, `updated_at timestamptz`, `updated_by text`.
- **Reads**: anonymous, through the Supabase anon key and RLS policy `select` for everyone. Subscribe with `supabase.channel(...).on('postgres_changes', ...)` for live updates, and fall back to polling every 30 s if the channel disconnects.
- **Writes**: never directly from the browser with the anon key. Route them through one Supabase Edge Function, `edit`, which checks an **edit code** sent in the `x-edit-code` header against a secret (`EDIT_CODE`) and performs the writes with the service role. The function accepts the same `ops` array the store uses (`[{col, id, data|null}]`), plus `logText` and an `editor` display name, applies them in one transaction, bumps `rev`, and appends the log row.
- **Edit code**: the organisers share one code. The page asks for it the first time someone turns on Edit, keeps it in `localStorage` (wrapped in try/catch), and clears it if the function answers 401. The same place asks for the person's name, which goes into `updated_by` and the change log (there is no identity provider, so names are self-declared).
- **Concurrency**: keep the `rev` guard. The Edge Function should reject an op whose `expectedRev` (send the rev the form opened with) no longer matches, with a 409, so the UI's "someone changed this, overwrite?" flow still works. Add `expectedRev` to each op in `Store.apply`.
- **Undo**: unchanged, it just replays `apply` with the stored previous bodies.
- **Change log**: `log` table, keep the last 500 rows (the function can delete older rows on insert).
- **Seeding**: a one-off script (`scripts/seed.mjs`) that reads `data.js` and upserts every document. Also keep the in-app owner recovery button working by routing `seedShared()` through the same Edge Function (it requires the edit code).

Supabase has a free tier; confirm the cost before creating the project. Put the project URL and anon key in `config.js` (they are public by design); never put the service role key or the edit code in the repo.

## Files to produce or change

- `store.js`: replace the `claude.use('db')` implementation with the Supabase one. Keep the static fallback exactly as it is (`data.js` when the network is unavailable or the tables are empty).
- `config.js`: `window.FRONTIER_CONFIG = { supabaseUrl, supabaseAnonKey, functionsUrl }`. Load it before `store.js`.
- `supabase/migrations/0001_schema.sql`: tables, RLS (select for anon on the four content tables and `log`; no insert/update/delete for anon), realtime publication.
- `supabase/functions/edit/index.ts`: the Edge Function described above. CORS for the Pages origin only.
- `scripts/seed.mjs`: seeding from `data.js` via the function (or directly with the service role key from an env var, run locally only).
- `index.html`: add the Supabase client from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` and `config.js`. Keep the service worker; it is network-first with cache fallback, so stale data is not a problem.
- `README.md`: how to deploy, rotate the edit code, reseed, and update the built-in copy from the "Copy all data as JSON" button in the About sheet.

## Acceptance tests (run these in a browser, phone width too)

1. Fresh visitor with no code: sees the live schedule, cannot see the Edit button, "Read-only" is not shown (status should read "Live").
2. Enter a wrong edit code: Edit stays off, a clear message, nothing stored.
3. Enter the right code: Edit appears; add an event on Wednesday at 13:00 for David; it appears for a second browser within 2 seconds without a reload.
4. Move Nick from Level39 to King's Cross from his person sheet; both events update; the log shows "Moved Nick Altice from Level39 + Canary Wharf to King's Cross walk + Lendlease / EustonX" with the editor's name; Undo reverts both events.
5. Open the same event in two browsers, save in one, then save in the other: the second gets the overwrite warning.
6. Resolve an open item, tick a per-event action, edit a dinner booking, change a person's hotel: each lands in the other browser and in the log.
7. Kill the network: the page keeps showing the last data and the status pill changes; writes fail with a readable message, not a hang.
8. Static fallback: open `index.html` from a plain file server with no `config.js`: read-only copy from `data.js`, no console errors.
9. Mobile: bottom nav, sheets open from the bottom, forms usable, who's-where scrolls sideways with the name column fixed.

## Known data checks to leave visible

The Open items tab lists six "data checks" found while rebuilding the app, where the briefing notes and the schedule disagree (Wednesday afternoon placements for Will, Ger, Brittany and Danielle; Nick's Wednesday afternoon; the Physical AI session's logistics; the Ognisko time; the Friday breakfast attendees; "Aaron has nothing scheduled"). Keep them in the seed; the organisers resolve them in the app.

## Style

Follow `styles.css` as the design system (light canvas, white cards, one coral accent, Inter). Do not add a framework. No build step; the site must work as plain files.
