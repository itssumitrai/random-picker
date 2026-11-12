# Spindle

**Let chance decide.** A fast, friendly randomizer wheel that runs entirely in your browser.

Spindle gives every decision its own wheel. Spin for a movie, a meal, a weekend plan, or anything
else you can think of. Wheels can be shared through a small self-hosted database, so every device
sees the same ones, or kept entirely in your browser. You can export a backup at any time.

## Features

- **A wheel per category** — switch between tabs for Movies, Food, Weekend, Music, or your own.
- **Real spin physics** — the wheel eases out over a few turns and lands on a randomly chosen
  option in roughly three seconds.
- **Confetti results** — the winner appears in a modal with a burst of confetti.
- **Fully editable** — rename wheels, change prompts, emoji, accent colors, and options. Create and
  reorder as many wheels as you like.
- **Light, dark, or system theme** — follows your device by default, with a one-tap override.
- **Shared or local data** — a self-hosted Postgres database (Docker) keeps every device in sync,
  with IndexedDB as an offline cache. Without one, data stays in the browser.
- **Backup and restore** — export everything to a JSON file and import it on another device.
- **Responsive** — designed for phones first and scaled up to desktop.

## Tech stack

- [SvelteKit 3](https://svelte.dev/docs/kit) with Svelte 5 runes
- `@sveltejs/adapter-static` for a fully static build
- Canvas-rendered wheel (no chart library)
- [`canvas-confetti`](https://github.com/catdad/canvas-confetti) for celebrations
- [`@lucide/svelte`](https://lucide.dev/) icons and Plus Jakarta Sans

## Getting started

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev
```

Open the printed URL, usually <http://localhost:5173>.

## Scripts

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the development server              |
| `npm run build`   | Build the static site into `build/`       |
| `npm run preview` | Preview the production build locally      |
| `npm run check`   | Run `svelte-check` for TypeScript errors  |
| `npm run lint`    | Lint Svelte and TypeScript with ESLint    |
| `npm run test`    | Run the unit tests with Vitest            |

Every push and pull request runs the same checks in GitHub Actions — lint, type
checking, unit tests, and a production build (see `.github/workflows/ci.yml`).

## How data is stored

The build decides where wheels are stored, through the `SYNC_API_URL` variable (see `src/env.ts`).

### Shared database (`SYNC_API_URL` set)

The mini-pc deployment builds with `SYNC_API_URL=/api`. Every browser that opens it reads and
writes one shared copy:

```text
browser ──HTTP──▶ serve.py :8080 ──/api/*──▶ PostgREST (127.0.0.1:3000) ──▶ Postgres (Docker network only)
```

- The stack is defined in `server/compose.yaml`. The table `api.app_state` holds the wheels as one
  JSON document under key `wheels`.
- The server copy wins on load. A copy is cached in IndexedDB, so the app keeps working if the
  server is down. Edits made while it's down are pushed once it's back.
- The first browser to open an empty database uploads its existing wheels.
- Saves replace the whole document (last write wins). Switching back to the tab pulls the latest
  version.
- There's no login. Anyone who can reach the site can edit, so keep it on a trusted network.

Database passwords are generated on the server into `server/.env` and are never committed. Copy
`server/.env.example` to run the stack yourself. Agent and contributor rules for the database are in
[`AGENTS.md`](AGENTS.md).

### Browser only (`SYNC_API_URL` unset)

This is the default for `npm run dev`, a plain `npm run build`, and GitHub Pages:

1. **IndexedDB** (database `spindle`, object store `state`, key `wheels`) is used first.
2. **localStorage** (`spindle.data.v1`) is used automatically if IndexedDB is unavailable, for
   example in some private-browsing modes.
3. If both are blocked, the app still works for the session but shows a warning in Settings.

Theme preference is stored separately at `spindle.theme`.

### Export and import

Open **Settings → Your data**:

- **Export backup** downloads `spindle-wheels-YYYY-MM-DD.json`.
- **Import backup** accepts that file (or a bare array of categories), validates and sanitizes it,
  shows a summary, and asks before replacing your current wheels.

Import files are limited to 2 MB, 40 wheels, and 30 options per wheel.

### Backup format

```json
{
  "app": "spindle",
  "version": 1,
  "exportedAt": "2026-01-01T12:00:00.000Z",
  "categories": [
    {
      "id": "movies",
      "name": "Movies",
      "prompt": "What should we watch?",
      "emoji": "🎬",
      "color": "#7c3aed",
      "options": [{ "id": "movies-1", "label": "Inception" }]
    }
  ]
}
```

## Deploying

`npm run build` produces a static site in `build/`. Upload that folder to any static host
(Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3, nginx…). Set `SYNC_API_URL` at build time to
connect it to the shared database.

The adapter is configured with `fallback: 'index.html'`, so client-side routes such as `/settings`
work on hosts that serve `index.html` for unknown paths. The build prints an
`adapter_fallback_overwrites` warning because the fallback replaces the prerendered shell; this is
expected.

### mini-pc (home LAN, shared database)

```sh
.claude/skills/deploy-mini-pc/scripts/deploy.sh
```

Builds with `SYNC_API_URL=/api`, starts the Docker database stack (installing Docker on first run),
and serves the site at `http://192.168.68.139:8080/`. Details, backups and troubleshooting are in
`.claude/skills/deploy-mini-pc/SKILL.md`.

## Project layout

```text
src/
  app.css                       Design tokens, layout, buttons, responsive rules
  app.html                      Theme pre-paint script and document metadata
  lib/
    components/
      CategoryEditor.svelte     Expandable wheel editor
      Logo.svelte               Spindle mark
      ResultModal.svelte        Winner dialog and confetti
      TabBar.svelte             Scrollable category tabs
      Wheel.svelte              Canvas wheel and spin physics
    palette.ts                  Wheel color palette helpers
    randomizer.svelte.ts        Data model, validation, store, import/export
    remote.ts                   Shared-database (PostgREST) client
    storage.ts                  Local cache and sync rules
    theme.svelte.ts             Theme preference handling
  env.ts                        Build-time env vars (SYNC_API_URL)
  routes/
    +layout.svelte              App shell, header, boot state
    +page.svelte                Wheel page
    settings/+page.svelte       Appearance, data, and wheel management
server/
  compose.yaml                  Postgres + PostgREST (Docker Compose)
  db/01-schema.sh               Schema and roles, run on first start
  .env.example                  Placeholder secrets (real .env is never committed)
```

## Live demo

**[https://itssumitrai.github.io/random-picker/](https://itssumitrai.github.io/random-picker/)**

### GitHub Pages deployment

The app is published to GitHub Pages at the URL above. Because GitHub Pages project sites live
under a sub-path (`/random-picker`), the production build sets `paths.base` via the `BASE_PATH`
environment variable:

```sh
BASE_PATH=/random-picker npm run build
```

Local development (`npm run dev`) and plain `npm run build` leave `BASE_PATH` unset, so the app
continues to work at the root path `/`.

The deploy workflow (`.github/workflows/deploy.yml`) runs on every push to `main` and can also be
triggered manually. It builds with the base path, copies `build/index.html` → `build/404.html` so
direct deep-link loads (e.g. `/random-picker/settings`) are handled by the SPA shell on GitHub
Pages, then publishes via the official `actions/deploy-pages` action.

The Pages copy doesn't use the shared database. The database lives on the home LAN, and an HTTPS
page can't call a plain-HTTP LAN address, so wheels on the Pages site stay in your browser. Use
Settings → Export / Import to move them.
