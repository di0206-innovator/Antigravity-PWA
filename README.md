# AG Pocket — Antigravity Mobile Command Center

An installable, offline-capable, mobile-first PWA that acts as a **personal companion and launcher** for Google Antigravity's official Remote Control. Keep your projects, prompts, skills, workflows and task notes on your phone, then jump into the official interface with one tap.

All data lives in your browser's IndexedDB. There is no backend, no account, no telemetry.

## Official integration boundary

AG Pocket **only**:

- opens the official site (`https://antigravity.google.com`) on an explicit tap, and opens official session URLs you saved (validated to the official host, `https`, no credentials);
- lets you write/copy prompts (the button says *Copy*, never *Send* — you paste and submit in Google's UI);
- stores a local catalogue of projects, skills, workflows, tasks and notes;
- explains official Remote Control / CLI / Remote Agents setup (commands are display-only).

AG Pocket **never**: handles Google OAuth tokens or cookies, calls private Antigravity endpoints, scrapes the DOM, embeds Antigravity in an iframe, wraps the CLI, submits prompts or approves actions automatically, polls for agent activity, or shows simulated live status. Connection state shown in the app is derived only from your local setup checklist and is labelled *not verified*. A future adapter interface exists (`src/services/officialAdapter.ts`) but is permanently disabled until Google ships a documented public API.

Needs Google's official Remote Control: seeing live agents, approvals, conversation content, and notifications. Official docs: [Remote Control](https://antigravity.google/docs/remote-control) · [Remote Agents](https://antigravity.google/docs/remote-agents) · [FAQ](https://antigravity.google/docs/faq).

## Features / routes

| Route | Feature |
|---|---|
| `/` | Home command center: Antigravity launcher card, readiness state, remote-access info, quick actions, pinned projects, local task overview |
| `/projects`, `/projects/:id` | Project CRUD, pin, search, category filter, saved official URL, notes, related prompts/tasks |
| `/prompts` | Prompt Studio: autosaved drafts, `{{variables}}` fill + preview, 12 editable starter templates, copy → open Antigravity |
| `/skills` | Skill Deck: manual local skill reference, favourites, send to Prompt Studio |
| `/workflows` | Workflow Library: 19 editable starter workflows, steps, copyable prompts |
| `/tasks` | Task Board: list + Kanban, filters, priorities, due dates |
| `/activity` | Local activity timeline (AG Pocket actions only) |
| `/setup` | Connection Setup Center: desktop / mobile / CLI steps, Remote Agents, troubleshooting |
| `/settings`, `/privacy` | Theme, haptics, reduced motion, install help (Android/iOS), export/import/clear data, privacy statement |

## Prerequisites

Node.js 20+ and npm.

## Install & run

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # reach it from a phone on the same network (service worker/install need HTTPS or localhost)
```

## Quality gates

```bash
npm run typecheck
npm run lint
npm test               # Vitest + React Testing Library (fake-indexeddb)
npm run build          # type-check + production build + service worker
npx playwright install chromium   # first time only
npm run test:e2e       # builds, serves preview, runs browser journeys
```

## Install on a phone

Serve the production build over HTTPS (Vercel, or a tunnel to `npm run preview`).

- **Android (Chrome/Edge):** open the URL → menu → *Install app* / *Add to Home Screen* (or use the Install button in Settings).
- **iOS (Safari):** open the URL → Share → *Add to Home Screen*. iOS has no install prompt API; Settings shows these steps.

The app launches standalone, works offline for all locally stored data, and shows a banner when offline (opening Antigravity itself requires internet). Updates show an in-app "refresh" prompt.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework preset: Vite).
2. Build command `npm run build`, output directory `dist` (also set in `vercel.json`, which adds SPA rewrites and security headers).
3. Deploy; Vercel serves over HTTPS, which the PWA requires.

## Export and restore your data

*Settings → Data*: **Export** downloads a versioned JSON file (`ag-pocket` schema v1). **Import** validates every record with Zod, skips duplicates and reports errors; files over 5 MiB are rejected. **Clear all data** wipes IndexedDB (export first). Nothing is uploaded anywhere.

## Architecture

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Zustand (ephemeral UI state), Dexie/IndexedDB (versioned schema), Zod (validation), vite-plugin-pwa (Workbox precache, offline fallback, update prompt), Vitest, Playwright. Entry points: `src/db/repo.ts` (validated writes + activity logging), `src/services/security.ts` (URL validation, text sanitisation, template interpolation).
