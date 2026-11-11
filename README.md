# Spindle

**Let chance decide.** A fast, friendly randomizer wheel that runs entirely in your browser.

Spindle gives every decision its own wheel. Spin for a movie, a meal, a weekend plan, or anything
else you can think of. All wheels live in your browser, and you can export a backup whenever you
want to move them somewhere else.

## Features

- **A wheel per category** — switch between tabs for Movies, Food, Weekend, Music, or your own.
- **Real spin physics** — the wheel eases out over a few turns and lands on a randomly chosen
  option in roughly three seconds.
- **Confetti results** — the winner appears in a modal with a burst of confetti.
- **Fully editable** — rename wheels, change prompts, emoji, accent colors, and options. Create and
  reorder as many wheels as you like.
- **Light, dark, or system theme** — follows your device by default, with a one-tap override.
- **Local-first data** — saved to IndexedDB, with a localStorage fallback when IndexedDB is blocked.
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

## How data is stored

Spindle keeps everything on your device:

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
(Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3, nginx…).

The adapter is configured with `fallback: 'index.html'`, so client-side routes such as `/settings`
work on hosts that serve `index.html` for unknown paths. The build prints an
`adapter_fallback_overwrites` warning because the fallback replaces the prerendered shell; this is
expected.

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
    storage.ts                  IndexedDB and localStorage persistence
    theme.svelte.ts             Theme preference handling
  routes/
    +layout.svelte              App shell, header, boot state
    +page.svelte                Wheel page
    settings/+page.svelte       Appearance, data, and wheel management
```
