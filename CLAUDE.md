# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **bun** (see `bun.lock`). Node >= 22.12.0.

- `bun dev` — Astro dev server on `localhost:4321`
- `bun build` — production build to `dist/`
- `bun preview` — build then serve the production output locally
- `bun run cf-typegen` (alias `generate-types`) — regenerate `worker-configuration.d.ts` from `wrangler.jsonc` bindings via `wrangler types`. Run this after changing wrangler bindings.
- `bun deploy` — `astro build && wrangler deploy` to Cloudflare
- `bun astro check` — Astro + TypeScript diagnostics for `.astro` files
- `bun astro <command>` — passthrough to the Astro CLI

## Architecture

Astro 6 site deployed to **Cloudflare Workers** via `@astrojs/cloudflare`. The adapter compiles the server entrypoint to `@astrojs/cloudflare/entrypoints/server` (referenced as `main` in `wrangler.jsonc`); static assets in `dist/` are served through the `ASSETS` binding. There is no SSR route configuration yet — everything is static-plus-adapter.

`src/env.d.ts` wires the Cloudflare `Runtime<Env>` into `App.Locals` so Astro endpoints can access bindings via `Astro.locals.runtime.env.*`. `Env` types come from `worker-configuration.d.ts`, which is generated — never hand-edit it.

### Sveltia CMS

The admin UI lives at **`/admin/`** and is **not bundled** — `public/admin/index.html` loads `@sveltia/cms` from unpkg. The CMS config is `public/admin/config.yml`. Key facts that affect how code interacts with content:

- **Backend is `github`** against repo `yasi-artist/white-on-white` (branch `main`). Edits in the CMS commit directly to that GitHub repo, not to the local working copy. The local git identity (Kaveh Rafie) differs from the CMS target repo — don't assume local commits and CMS commits land in the same place.
- **Posts collection** writes to `/content/posts` (folder collection). This directory does not exist locally yet; content authored through the CMS appears there after sync/pull. Astro will need a content loader/glob to consume it — none is configured today.
- **Media**: `media_folder: /public/media` (committed to the repo, served at `/media`) plus a **Cloudinary** media library configured inline (cloud name + API key are in the YAML — they're public client-side values, but treat them as intentional, not secrets to strip).
- When changing the CMS schema in `config.yml`, the `# yaml-language-server` schema URL at the top points to the published Sveltia schema for validation.

Sveltia CMS is the de facto successor to Netlify/Decap CMS and the config schema is largely compatible — field widgets use the Decap vocabulary (`widget: string|datetime|richtext|...`).

## Conventions

- TypeScript is on `astro/tsconfigs/strict`. Keep types tight; run `bun astro check` after structural changes.
- The Cloudflare adapter requires the `global_fetch_strictly_public` compat flag (already set in `wrangler.jsonc`, dated `2026-06-15`). When bumping `compatibility_date`, follow Cloudflare's guidance — runtime behavior can shift.
- `.assetsignore` in `public/` excludes `_worker.js` and `_routes.json` from being treated as static assets by the adapter.
