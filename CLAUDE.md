# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

StoryPlace, a story-sharing app: signed-in users submit stories, an admin approves them, and approved
stories appear in a public feed. React 19 + Vite 8 + TypeScript 6 + Tailwind 4 frontend (`src/`), Convex
backend (`convex/`), email/password auth via `@convex-dev/auth`. `README.md` is the human setup guide.

## Commands

```sh
npx convex dev                 # backend: watches convex/, pushes to the dev deployment, regenerates convex/_generated
npm run dev                    # frontend at http://localhost:5173 (both must run together)

npm run build                  # tsc -b (frontend) + vite build
npx tsc --noEmit -p convex     # typecheck the backend. Not covered by `npm run build`.
npm run lint                   # oxlint
npm test                       # vitest + convex-test, runs convex/*.test.ts against an in-memory backend

npx convex run users:setAdmin '{"email":"..."}'   # grant review rights ("isAdmin":false to revoke)
npx convex env list            # auth needs JWT_PRIVATE_KEY, JWKS, SITE_URL on each deployment
npx convex data <table>        # inspect a table
```

Tests live in `convex/*.test.ts`. `convex/test.setup.ts` lists the modules for convex-test. Convex skips
files with two dots when deploying, so neither reaches the deployment. Tests sign in with
`t.withIdentity({ subject: `${userId}|session` })`, the form `getAuthUserId` parses.

## Architecture

**Story lifecycle.** `stories.status` is `"pending" | "approved" | "rejected"`. `submit` always inserts
`pending`. `review` (admin only) sets the status and, on approval, `approvedAt`. The public feed
(`stories.list`) reads `approved` stories through the `by_status_and_approvedAt` index, so it is
ordered by publish time, not submission time. The review queue (`stories.pending`) uses the same index
with `status = "pending"`. Ties fall back to `_creationTime`, giving oldest-first.

**Editing and deleting.** Only the author can `update` or `remove` a story (`requireOwnStory`; anyone
else gets "Story not found."). An edit to a story that was never published overwrites it and puts it
back to `pending`. An edit to an `approved` story goes into `storyRevisions` (at most one per story;
editing again replaces it), so readers keep seeing the published fields. `reviewRevision` either copies
the revision onto the story (sets `editedAt`, deletes the revision) or marks it `rejected`. `remove`
deletes the story and its revision together. Revisions are a separate table so that `list` / `mapped` /
`get`, which return story documents, can never leak unapproved text. Tests in `convex/stories.test.ts`
cover this lifecycle.

**Discovery and categories.** New stories and edits require `category`, `ageRange`, and `source`, and
can have up to 3 `themes`. All four are listed in `convex/taxonomy.ts`, which the frontend imports too.
They're optional in the schema, and older stories keep `undefined`. Never fill them in with guesses:
the edit form asks the author instead. Home's heading is dynamic: "Discover local stories" until a place is known, then "Local stories around
<place>". The place is the first part of the chosen search result, or the town at the reader's position
after Find me, found by `placeNameAt` (MapTiler reverse geocoding) and falling back to "you". Below it is
`FindStoriesBanner`, a compact row with a white "Search a city, landmark, or place…" field (Enter, or the
arrow button that appears once there's text) and a round "Find me" location button. The reader types a place (suggestions come from
`discover.placeSuggestions`, which matches authors' saved place names, plus MapTiler) or taps Find me
(asks for location permission only then). Results come from `discover.nearby` with a radius sized to
the place, and link to `/map?lat&lng&r&label`, which focuses the Map tab. Text that isn't a place falls
back to `discover.search`. The rest of Home is built from `discover.home`
(Seasonal plus category shelves), `discover.nearby`, `discover.topPicks` (rule-based, each pick carries
its `reason`; empty with no signals, never random), and `library.*`. Search uses the `search_text`
index on `stories.searchText`, which `stories.ts` keeps in sync on every content write. After deploying
to a deployment with existing stories, run `npx convex run stories:backfillSearchText` once.

**Scenes, illustrations, and reading mode.** `stories.scenes` (and `storyRevisions.scenes`) is an
optional ordered list of `{ id, text, illustrations: [{ storageId, alt, credit? }] }`. `body` stays
required: `submit` / `update` take `scenes` and derive `body` from them (`bodyOf` in `convex/scenes.ts`),
so feeds, search, and review keep reading `body`. Stories without `scenes` (written before scenes) are
never migrated: `scenesOf` presents them as one scene `s1` built from `body`, and `get`, `editable`,
and the review queues always return scenes with picture URLs. `cleanScenes` checks that every picture
is an uploaded `image/*` file of 5 MB or less, with alt text. Pictures dropped by an approved edit, a
replaced pending edit, a direct edit, or a delete are removed from storage (`deleteUnusedFiles`); files
uploaded but never submitted are not cleaned up yet. Reading mode is `/story/:id/read`
(`src/components/ReadingView.tsx`): auto-scroll stops at each picture and on any manual scroll, there's
no auto-scroll under reduced motion, and the position is an anchor like `s2:3` saved to
`readingPositions` (signed in) and localStorage. Scenes have stable ids so an optional sound cue can be
added later as an optional field; there is no audio now.

**Story cards and covers.** Every story list (and Map popups and the review queue) uses `StoryCover` /
`StoryCard` from `src/components/StoryCard.tsx`. Picture covers sit in a white paper frame with a 9% margin,
fitted whole and then scaled and moved by `cover.scale` / `x` / `y`, which are display settings only.
Without a picture the card uses the category gradient. Never put text inside the cover. `stories.cover` is
`{ kind: "image", storageId, alt, credit?, scale, x, y }` or `{ kind: "colors" }`. Stories without `cover`
fall back to their first illustration (`cardCoverOf` in `convex/covers.ts`). `cleanCover` accepts a picture
only if it's one of the story's own illustrations, already its cover, or an upload the author claimed via
`covers.claimUpload` (`uploads` table). Cover files are counted by `filesOf`, so cleanup keeps them. Title, category and age, place, and optional
note each have a fixed height so rows align; the story page shows the full title and place.

**Home layout.** Top Picks shows one `FeaturedStoryCard`. Recently Played, Places You've Been, Seasonal,
and search results use `CardRow` / `Shelf` rows of small cards. Categories use `TwoCardGrid`. Rows sit
inside the page gutter with no negative margins, so snapping starts at the same left edge as the headings.
Under each cover: the title (two lines), the `AgeSymbol` (only "6+" / "8+" / "10+" is visible), and a short
one-line place. There's no category text, because the cover color already shows it.

**Reader history is private.** `savedStories` / `storyViews` / `placeVisits` are only read for
`getAuthUserId(ctx)`. "Places You've Been" comes only from Mark as visited, or from opening or saving a
story while the client sends a position within `atPlaceKm` of it. The position is sent with that action,
used, and dropped; there's no background tracking. `src/components/HereProvider.tsx` asks for location
only when the reader taps "Show stories near me" (or silently if already granted), and rounds it to
about 1 km. `stories.remove` also deletes a story's rows in these tables and in `collectionEntries`.

**Navigation.** `src/components/AppShell.tsx` holds the top bar (Add a Story, plus the initials avatar
that links to `/account`) and the phone bottom bar (Home / Map / Library, plus a separate Search
circle). The Map tab is `src/pages/MapPage.tsx` (pins from `stories.mapped`). `/new` lists newly published
stories and is linked from Home. Writing a story is `/write`.

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

**Story locations.** `stories.location` is optional: `{ lat, lng, place?, precision? }`. `precision`
is `"exact" | "area" | "uncertain"`. It's optional in the schema because older stories don't have it,
but `submit` requires it. A search result that is a town or region defaults to `"area"`. The form
rejects `"exact"` for such a result until the user moves the pin by hand (`locationProblem` in
`src/location.ts`), so a town's center is never presented as the exact site. Place search calls the
MapTiler Geocoding API from the browser (`src/geocoding.ts`) with `VITE_MAPTILER_KEY` from
`.env.local`. It sends every MapTiler place type including `poi`, because MapTiler leaves POIs out by
default; don't narrow it to `poi` only. "Can't find the place? Choose it on the map" lets the author place
a pin and type their own name (e.g. Su Sterru isn't in MapTiler's index). Hand-placed pins default to
`"area"`, and the name, pin, and precision all stay editable in the edit form. Map tiles are OpenStreetMap's
and need no key.

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

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
