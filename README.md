# Oriz Roam — Journal

> Privacy-first, Day-One-class PWA journal — Tiptap editor, mood + tags + photos, calendar heatmap, memories, search, streaks, goals, optional E2EE, full export/import. Works offline.

**Live at**: https://journal.oriz.in · **Status**: production

## What this is

A free, private, PWA journal in the oriz family. Ten built-in journal types, rich-text entries with photos, full taxonomy and discovery surfaces (calendar, memories, search, tags, favorites, pinned), stats and goals, and opt-in client-side encryption.

## Per-feature inventory

| Feature | Status |
|---|---|
| `/` marketing landing | ✅ live |
| `/about`, `/contact`, `/legal/*` | ✅ live |
| `/account` sign-in + `/account/finish-sign-in` | ✅ live |
| `/dashboard` today + streak + recent | ✅ live |
| `/entries`, `/entries/new`, `/entries/{id}`, `/entries/{id}/edit` | ✅ live |
| Tiptap editor (StarterKit + Image + Link + TaskList + Placeholder) | ✅ live |
| `/calendar` heatmap | ✅ live |
| `/memories` (on-this-day) | ✅ live |
| `/search` (Fuse.js client-side) | ✅ live |
| `/tags`, `/tags/{tag}` | ✅ live |
| `/favorites`, `/pinned` | ✅ live |
| `/stats` (Recharts) | ✅ live |
| `/goals` | ✅ live |
| `/templates` (built-ins + user overrides) | ✅ live |
| `/settings`, `/settings/export`, `/settings/import`, `/settings/account` | ✅ live |
| PWA install + offline + `/offline` fallback | ✅ live |
| Opt-in entry-body E2EE (libsodium) | 🚧 WIP — MVP, not production-grade |
| Slash-commands in editor | 📜 planned |
| Service-worker offline write queue | 📜 planned |
| Bulk entry actions (multi-select) | 📜 planned |
| Share-target manifests (iOS / Android) | 📜 planned |
| Migration script for `bookatlas-13392` legacy export | 📜 planned |

## App-specific env vars

None beyond the family-wide set at `templates/.env.example`. (Auth + Firestore + Storage use the shared `oriz-app` project.)

## Local dev

```bash
# from the workspace root (c:/D/oriz)
pnpm -F @chirag127/oriz-journal dev
```

## Knowledge

See [`./knowledge/`](./knowledge/) for app-specific decisions, runbooks, and services. Family rules / decisions / architecture live at the master repo's [`knowledge/`](../../../../knowledge/).

## License

Source-available, all rights reserved. See master [`LICENSE`](../../../../LICENSE) — same terms across the family.
