# Basketball Playbook

A coaching tool: diagram plays on a half/full court, manage them (CRUD), attach
video examples, track live game stats, and export box scores to CSV.

**Stack** — Vite · Vue 3 (`<script setup>` + TS) · Tailwind CSS · Supabase
(Postgres + Storage). All free / open source.

## Features

- **Play diagrams** — freehand pen, arrows (pass / cut / dribble / screen),
  player markers (home / defense / ball), color + width, undo / clear, and a
  half ↔ full court toggle. Stored as normalized JSON so plays stay editable and
  render crisply at any size.
- **Plays CRUD** — create, edit, delete; grid view with live diagram thumbnails.
- **Video clips** — upload examples per play to Supabase Storage, play inline.
- **Stat tracking** — roster + games, tap-to-record stat events (append-only
  audit trail), a box score that aggregates live.
- **Export** — one-click CSV of the current game's box score.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

At https://supabase.com → New project. Then **SQL Editor → New query**, paste
the contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. That
creates the tables, the `play-videos` storage bucket, and RLS policies.

> The schema ships in **dev mode**: the `anon` key has full access so the app
> runs with no login. Fine for a local / single-coach setup. Before exposing it
> publicly, swap to the authenticated policies at the bottom of the SQL file and
> add a login screen — see "Hardening" below.

### 3. Configure env

```bash
cp .env.example .env.local
```

Fill in from **Supabase → Project Settings → API**:

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

### 4. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
npm run preview  # serve the built bundle
```

If the env vars are missing, the app loads but shows a "Supabase not configured"
badge and read calls no-op — check `.env.local`.

## Project layout

```
src/
  components/
    CourtCanvas.vue      SVG court + drawing engine (the core piece)
    PlayEditorModal.vue  create/edit a play
    VideoUploader.vue    Storage upload + inline playback
    AppNav.vue
  views/
    PlaysView.vue        playbook grid + CRUD
    StatsView.vue        roster, games, live tracker, box score, CSV
  composables/
    usePlays.ts          plays + video data layer
    useStats.ts          players/games/events + box-score aggregation + CSV
  lib/supabase.ts        client singleton
  types.ts               shared types (diagram model, stats)
supabase/schema.sql      run this once in the SQL editor
```

The Supabase calls are isolated in the two composables, so swapping in a
Node/TS API later (your "if needed" layer) means reimplementing those two files
against your own endpoints — the components don't touch Supabase directly.

## Stat model

Events are stored individually (e.g. `fg_made`, `rebound_def`, `assist`) rather
than as running totals, so the box score is always a pure function of the log
and nothing is destructively overwritten. "Undo" deletes the player's most
recent event. Points are derived (FT=1, FG=2, 3PT=3); a made three also counts
toward FG made/attempted, matching standard box-score convention.

## Hardening (before going beyond local)

1. In `schema.sql`, drop the `dev_*` policies and uncomment the `auth_*` ones.
2. Enable an auth provider in Supabase (email is simplest).
3. Add a login screen and gate the router; `supabase.auth` is already available
   via `src/lib/supabase.ts`.
4. Consider per-user/per-team ownership columns if more than one coach uses it.
