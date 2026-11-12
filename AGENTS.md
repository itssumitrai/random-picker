# Spindle (random-picker)

A randomizer wheel. SvelteKit 3 + Svelte 5 runes, built to a fully static site with
`@sveltejs/adapter-static`. The site has no server code of its own. Data lives in one of two places:

- **Shared database** (when `SYNC_API_URL` is set at build time): Postgres behind PostgREST, run with
  Docker on the mini-pc (`server/`). Every browser that uses that build reads and writes the same
  data. The browser keeps a copy in IndexedDB as an offline cache.
- **Browser only** (when `SYNC_API_URL` is unset): IndexedDB, with a localStorage fallback.

## Commands

| Command           | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Dev server at <http://localhost:5173>     |
| `npm run build`   | Static build into `build/`                |
| `npm run check`   | `svelte-check` type checking              |
| `npm run lint`    | ESLint (Svelte + TypeScript)              |
| `npm run test`    | Vitest unit tests (`src/lib/*.test.ts`)   |

Before calling a change done, run `npm run lint && npm run check && npm run test && npm run build`.
CI runs the same steps (`.github/workflows/ci.yml`).

## Layout

- `src/routes/` — `+page.svelte` (wheel), `settings/+page.svelte`, and the `+layout.svelte` app shell
- `src/lib/components/` — UI components (`Wheel.svelte` draws the canvas wheel and runs the spin physics)
- `src/lib/randomizer.svelte.ts` — data model, validation, store, import/export
- `src/lib/storage.ts` — persistence: local cache plus sync rules for the shared database
- `src/lib/remote.ts` — PostgREST client (`api.app_state`, one row with key `wheels`)
- `src/env.ts` — env var definitions (`SYNC_API_URL`), read through `$app/env/public`
- `server/` — Docker Compose stack (`compose.yaml`) and the schema (`db/01-schema.sh`)
- `src/lib/theme.svelte.ts`, `src/lib/palette.ts` — theme and colors
- `src/app.css` — design tokens and shared styles
- Import from the lib folder with the `#lib` / `#lib/*` subpath imports defined in `package.json`

## Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); runes mode is forced in `vite.config.ts`.
- TypeScript everywhere; keep `svelte-check` clean.
- Phones first: layouts must work at phone width before scaling up.
- Keep the app static. Add no SvelteKit server routes, hooks or `+page.server.ts`, because every
  deploy target serves plain files. Shared data goes through the PostgREST API in `server/`, which
  runs as a separate service, never inside the SvelteKit app.
- Put unit tests next to the module they cover as `*.test.ts`.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `ci:`).
- Env vars are defined in `src/env.ts` with `defineEnvVars` and imported from `$app/env/public`.
  The `$env/*` modules are deprecated in SvelteKit 3.

## Secrets and the database

- **Never commit secrets.** No passwords, connection strings, JWT secrets or tokens go in the repo,
  in docs, or in build output. Real values live only in `server/.env` on the host that runs the
  database (mode 600, generated on the first deploy). `server/.env.example` holds placeholders only.
  `.env` and `.env.*` are gitignored. Keep it that way.
- **Only non-secret values may ship to the browser.** Everything in `$app/env/public` ends up in the
  JS bundle. `SYNC_API_URL` is a URL, not a credential. If you add database auth later (e.g.
  PostgREST JWTs), don't put the signing secret in a `public` variable.
- **The browser never talks to Postgres.** Postgres has no published ports. PostgREST binds to
  `127.0.0.1` on the host, and `serve.py` proxies `/api/*` to it, so the site and API share one
  origin and need no CORS.
- **Access model:** the API has no login. Anyone who can reach the site can read and edit the
  wheels, and `web_anon` can `select`/`insert`/`update` (not `delete`) `api.app_state`. That's fine
  on a home LAN. **Don't expose the mini-pc to the internet** without adding auth first.
- **Schema changes:** `server/db/01-schema.sh` runs only when the Postgres volume is first created.
  To change an existing database, add a new idempotent SQL step and apply it with
  `docker compose exec db psql`, and update `01-schema.sh` so fresh installs match. Keep the
  `data` payload format backward compatible: the client validates it with `parseWheelData`.
- **Sync rules** (in `storage.ts`, covered by `storage.test.ts`): the server copy wins on load.
  An empty server is seeded from the browser's local copy. If the server is unreachable the app runs
  from the local copy, flags unsynced edits (`spindle.unsynced` in localStorage) and pushes them
  when the server is back. Writes replace the whole document (last write wins). The app re-syncs
  when the tab becomes visible again.

## Deployment targets

- **mini-pc (home LAN)**: the primary deployment and home of the shared database. Run
  `.claude/skills/deploy-mini-pc/scripts/deploy.sh`. It builds with an empty `BASE_PATH` and
  `SYNC_API_URL=/api`, installs Docker in WSL if it's missing, starts the `server/` stack, and serves
  the site at `http://192.168.68.139:8080/`. See `.claude/skills/deploy-mini-pc/SKILL.md` for
  details, backups and troubleshooting.
- **GitHub Pages**: `.github/workflows/deploy.yml` runs on every push to `main` and builds with
  `BASE_PATH=/random-picker`. It sets no `SYNC_API_URL`, so that copy keeps data in the browser only.
  The shared database is LAN-only, and an HTTPS page can't call a plain-HTTP LAN address. To share
  data there, the API needs a public HTTPS endpoint (e.g. a Cloudflare Tunnel or Tailscale Funnel),
  CORS for the Pages origin, and auth. Set `SYNC_API_URL` in the workflow only after all three exist.

To point a new deploy target at the shared database, build with `SYNC_API_URL` set to an API URL
that browsers can reach from that site, ideally a same-origin `/api` proxy.

`paths.base` comes from the `BASE_PATH` env var. Build internal links with `resolve()` from
`$app/paths` so both targets work.

## Local development with the database

```sh
cp server/.env.example server/.env        # then replace the placeholder passwords
docker compose --project-directory server up -d --wait
python3 .claude/skills/deploy-mini-pc/scripts/serve.py --dir build --port 8080 --api http://127.0.0.1:3000
```

Build first with `SYNC_API_URL=/api npm run build`. `npm run dev` without `SYNC_API_URL` keeps the
browser-only behavior. Tear down with `docker compose --project-directory server down`
(add `-v` to delete the data).
