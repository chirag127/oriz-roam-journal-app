# oriz-journal

[journal.oriz.in](https://journal.oriz.in) — a privacy-first, Day-One-class PWA journal in the [oriz family](https://oriz.in).

Tiptap editor, ten built-in journal types, mood + tags + photos, calendar heatmap, memories, full-text search, streaks + stats, goals, optional E2EE, full export/import. Works offline. Free. Yours.

## Stack

- **Astro 6** static output, **React 19** islands.
- **Tailwind v4** via `@tailwindcss/vite` + `@chirag127/oriz-ui` design system.
- **Tiptap v2** — rich-text editor (StarterKit + Image + Link + TaskList + Placeholder).
- **Fuse.js** — client-side full-text search.
- **Recharts** — stats charts.
- **vite-plugin-pwa** — manifest, service worker, Workbox runtime caches, install prompt.
- **libsodium-wrappers** — opt-in entry-body E2EE.
- **Firebase Web SDK v12** — auth + Firestore + Storage. Project: `oriz-app` (shared with the rest of the oriz family). Auth domain: `auth.oriz.in`.
- Hosting: **Firebase Hosting** at `journal.oriz.in` (the only Firebase-hosted site in the family).

## Routes

Marketing + legal (public, indexed):

- `/` — marketing landing
- `/about`, `/contact`
- `/legal/{index,privacy,terms,disclaimer,cookies,grievance}`

Auth flow:

- `/account` — sign-in (AccountPanel)
- `/account/finish-sign-in`

App (auth-gated, anonymous trial supported):

- `/dashboard` — today + streak + recent entries
- `/entries` — list with filters
- `/entries/new` — editor
- `/entries/{id}` — read view (rewritten by Hosting to `/entries/view`)
- `/entries/{id}/edit` — edit view (rewritten by Hosting to `/entries/edit`)
- `/calendar`, `/memories`, `/search`
- `/tags`, `/tags/{tag}` (rewritten to `/tags/view`)
- `/favorites`, `/pinned`
- `/stats`, `/goals`, `/templates`
- `/settings`, `/settings/export`, `/settings/import`, `/settings/account`
- `/offline` — service-worker fallback

## Develop

```bash
pnpm install
npx envpact-cli@0.2.0     # pulls .env.local from the shared envpact bundle
pnpm dev
```

Open http://localhost:4321.

`pnpm typecheck` runs `astro check`. `pnpm lint` runs Biome.

## Build

```bash
pnpm build                # builds to ./dist
pnpm preview              # serve the build locally
```

## Deploy

```bash
pnpm deploy               # firebase deploy --only hosting
pnpm deploy:rules         # firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --project oriz-app          # full deploy
```

`firebase.json` is set up with Hosting rewrites for the dynamic routes:

- `/entries/{id}/edit` → `/entries/edit.html`
- `/entries/{id}` → `/entries/view.html`
- `/tags/{tag}` → `/tags/view.html`

The React islands at those shells read `window.location.pathname` to extract the id/tag at runtime.

## Data model

All data is owner-rooted under `/users/{uid}/...`:

| Path | Shape |
|---|---|
| `users/{uid}` | `UserProfile` — displayName, defaultJournalType, weatherEnabled, e2eeEnabled, … |
| `users/{uid}/entries/{id}` | `Entry` — title, body (Markdown), bodyHtml, mood, moodIntensity, tags[], journalType, entryDate, favorite, pinned, photoUrls[], weather, … |
| `users/{uid}/templates/{id}` | `Template` — user-defined template overrides (built-ins ship in code) |
| `users/{uid}/tags/{slug}` | `Tag` — materialised count rollup |
| `users/{uid}/goals/{id}` | `Goal` — title, type (count/streak/words), target, period, dates |
| `users/{uid}/counters/streak` | `StreakCounter` — current, longest, totalEntries, totalWords |

Photos live in Firebase Storage at `journal/users/{uid}/photos/{entryId}/{file}`. Owner-only via `storage.rules`.

`firestore.rules` enforces owner-only access plus per-collection field allowlists. `storage.rules` does the same for photos. `firestore.indexes.json` covers the favorite/pinned/journalType/mood + entryDate combos.

## E2EE caveat

The opt-in encryption (Settings → Privacy) is a working MVP, **not** a production-grade scheme. Caveats:

- Only the `body` field is encrypted. Title, tags, mood, date, journalType remain plaintext on the server.
- The passphrase-derived key is held in memory; the user re-enters it on every reload.
- A malicious server could lie about ciphertext; integrity is not separately authenticated.
- Search (Fuse.js) only sees decrypted bodies in the current session — encrypted entries from other devices are skipped until you load them.

If you need real E2EE, treat this as a starting point — not a finished product.

## Migrating from the legacy app (`bookatlas-13392`)

The previous oriz-journal lived in a separate Firebase project (`bookatlas-13392`) with a similar but not identical schema. Entries are **not** auto-migrated. To move:

1. In the legacy app, export your entries as JSON.
2. In this app, sign in (or anonymous-trial), then go to `/settings/import`.
3. Drop the JSON file in. The import handles Day-One-style payloads (`{ entries: [{ text, creationDate, tags }, ...] }`).

If your legacy export is something else, normalise it to that shape first, or export as a `.csv` with columns `title, body, mood, tags, date, type`.

## Manual setup checklist (one-time)

- [ ] Enable Firebase Storage in the Firebase console for the `oriz-app` project (default bucket).
- [ ] Deploy `storage.rules` (`pnpm deploy:rules` covers it).
- [ ] Deploy the new `firestore.rules` and `firestore.indexes.json`.
- [ ] In the Firebase Hosting site config, ensure the custom domain `journal.oriz.in` is connected to the `oriz-app` project's `journal` site.
- [ ] (Optional) Provide a 1200×630 OG image at `/public/og.png` for social shares — currently the favicon is the only graphic asset.
- [ ] (Optional) Set `PUBLIC_GA4_ID` in envpact if analytics are desired.

## Known TODOs / deferred from MVP

- Slash-commands inside the editor.
- Service-worker offline write queue (currently entries written offline rely on Firestore's own offline persistence layer; no first-class merge UI).
- Migration script for `bookatlas-13392` exports — currently a manual export-then-import.
- Streaming weather updates / location reverse-geocoding (we stamp lat/lon, not city names).
- E2EE upgrade to authenticated encryption with rotating per-entry keys + searchable encryption.
- Bulk entry actions (multi-select delete, multi-tag, multi-favorite).
- iOS / Android share-target manifests (PWA share API).
