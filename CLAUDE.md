# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Story-sharing app: signed-in users submit stories, an admin (Olga) approves them, and approved stories
appear in a public feed. React 19 + Vite 8 + TypeScript 6 + Tailwind 4 frontend (`src/`), Convex
backend (`convex/`), email/password auth via `@convex-dev/auth`. `README.md` is the human setup guide.

## Commands

```sh
npx convex dev                 # backend: watches convex/, pushes to the dev deployment, regenerates convex/_generated
npm run dev                    # frontend at http://localhost:5173 (both must run together)

npm run build                  # tsc -b (frontend) + vite build
npx tsc --noEmit -p convex     # typecheck the backend. Not covered by `npm run build`.
npm run lint                   # oxlint

npx convex run users:setAdmin '{"email":"..."}'   # grant review rights ("isAdmin":false to revoke)
npx convex env list            # auth needs JWT_PRIVATE_KEY, JWKS, SITE_URL on each deployment
npx convex data <table>        # inspect a table
```

There is no test suite.

## Architecture

**Story lifecycle.** `stories.status` is `"pending" | "approved" | "rejected"`. `submit` always inserts
`pending`. `review` (admin only) sets the status and, on approval, `approvedAt`. The public feed
(`stories.list`) reads `approved` stories through the `by_status_and_approvedAt` index, so it is
ordered by publish time, not submission time. The review queue (`stories.pending`) uses the same index
with `status = "pending"`. Ties fall back to `_creationTime`, giving oldest-first.

**Authorization lives only in `convex/`.** `requireUser` / `requireAdmin` in `convex/users.ts` guard
mutations and admin queries. `stories.get` returns non-approved stories only to their author or an
admin, and returns `null` otherwise. `stories.get` takes `v.string()` and uses `normalizeId`, so any bad
URL id gives `null` instead of a validator error. The frontend guards (`RequireAuth`, `RequireAdmin` in
`src/components/RequireAuth.tsx`) only affect what is shown.

**Admin role.** `users.isAdmin` is set only through the `setAdmin` **internal** mutation, which needs
deployment access. Don't make it public or derive admin status from an email match: sign-up doesn't
verify email ownership.

**Users table.** `convex/schema.ts` spreads `authTables` and then overrides `users` to add `isAdmin`.
The override must keep all of Convex Auth's `users` fields and the `email` / `phone` indexes. Check
`node_modules/@convex-dev/auth/dist/server/implementation/types.js` when upgrading `@convex-dev/auth`.

**Frontend.** `react-router-dom` routes are in `src/App.tsx`. `ConvexAuthProvider` wraps the app in
`src/main.tsx`. Server validation errors are thrown as `ConvexError(message)` and shown in the UI via
`err.data`. Keep that convention for user-facing errors.

## Gotchas

- `@convex-dev/auth@0.0.95` requires `@auth/core@^0.41.1`. Other versions fail npm peer resolution.
- TypeScript 6 no longer includes `@types/*` automatically. `convex/tsconfig.json` sets `"types": ["node"]`
  so `process.env` in `auth.config.ts` compiles. Without it the Convex push fails.
- Each Convex dev deployment (one per team member) needs its own `JWT_PRIVATE_KEY` / `JWKS` / `SITE_URL`.
  Missing keys make sign-in silently fail. Generate the keys with `jose` as shown in README step 4b, and
  set them in `NAME=value` form, because the key's leading `-` is otherwise read as a CLI flag. Don't use
  the interactive `npx @convex-dev/auth` wizard: it prompts for input and edits project files.
- Adding required fields to `stories` fails the push while existing documents lack them. Make the
  field optional or backfill it first.
- `convex/_generated/` is committed (Convex convention). `.env.local` holds the deployment URL and is
  gitignored.
