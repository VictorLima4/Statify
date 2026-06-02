# Statify

A personal Spotify analytics dashboard that goes deeper than Wrapped — top artists/tracks/genres, now playing, activity charts, insights, and detailed artist/album/track pages.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/spotify-dashboard run dev` — run the frontend (port 18662)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + Recharts + Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Spotify OAuth via express-session (SESSION_SECRET)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/` — generated hooks (api.ts) and schemas (api.schemas.ts)
- `lib/db/src/schema/index.ts` — Drizzle DB schema (users, listening_history)
- `artifacts/api-server/src/` — Express backend
  - `routes/auth.ts` — Spotify OAuth routes
  - `routes/spotify.ts` — all Spotify data proxy routes
  - `lib/spotify.ts` — Spotify API client with token refresh
- `artifacts/spotify-dashboard/src/` — React frontend
  - `pages/` — all page components
  - `contexts/AuthContext.tsx` — auth state
  - `components/layout/Layout.tsx` — sidebar + now playing

## Architecture decisions

- All Spotify API calls proxied through the Express backend — frontend never calls Spotify directly
- Session-based auth (express-session + PostgreSQL) rather than JWT
- Orval codegen from OpenAPI spec keeps frontend hooks in sync with backend contracts
- `customFetch` in api-client-react always sends `credentials: "include"` for session cookie support
- Redirect URI is dynamic: `https://${REPLIT_DEV_DOMAIN}/api/auth/callback` in dev, localhost fallback

## Product

Login with Spotify OAuth. Dashboard shows now-playing (live, 10s polling), stats overview, and top artists/tracks previews. Full pages for: Top Artists, Top Tracks, Genres (pie + bar charts), Activity (hourly/daily/monthly/timeline charts), Insights (personality cards), My Wrapped, Library (saved tracks/albums/followed artists/playlists), Recently Played. Detail pages for individual artists, albums, and tracks with audio features visualization.

## Required Environment Variables

- `SPOTIFY_CLIENT_ID` — from Spotify Developer Dashboard
- `SPOTIFY_CLIENT_SECRET` — from Spotify Developer Dashboard
- `SESSION_SECRET` — random secret for express-session
- `DATABASE_URL` — Postgres connection string

## Gotchas

- **Must add redirect URI to Spotify app**: `https://<REPLIT_DEV_DOMAIN>/api/auth/callback`
  - For production: also add `https://<your-app>.replit.app/api/auth/callback`
- Run `pnpm --filter @workspace/db run push` after schema changes before starting the server
- After any OpenAPI spec change, run codegen before typechecking

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
