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
the edit form asks the author instead. Home has two states. With no place chosen it shows only a centred "Discover Local Stories" heading,
a `PlaceFinder` search field, and Use My Location; there are no story cards, and signed-out visitors see
just the logo and Sign In (`useOpeningScreen` in `AppShell`). Choosing a place (search) or Use My
Location (device) sets the `SelectedPlace` (`src/selectedPlace.ts`, kept in `sessionStorage` for the tab so
it survives sign-in). Home then shows a large serif "Stories in X" (or "Stories near X" for the device, named by
`placeNameAt` reverse geocoding), a quiet "N stories · Change location · Show on map" line, the nearest
story featured with no heading above it, and up to 4 stories per category, with See all at
`/place/:category` (`PlaceAll`). Distances show only with a clear starting point (`distanceFrom`):
"… from you" after Use My Location, "… from Cagliari" for a searched town or landmark, and nothing for a
region (search radius over 60 km). All of this comes from `discover.nearby`
(`limit` up to 100, optional `category`). A searched place and the device location are separate, and
neither replaces the other. Guests can browse and read everything; Add a Story shows only when signed in,
and `RequireAuth` / Sign In send people back to where they were (`state.from`, including the query
string).

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

**Map style.** All maps use `BaseMap` (`src/components/StoryMap.tsx`). Its base map comes from
`src/mapStyle.ts`, where all zoom levels are Leaflet's, the same as the position strip shows.
- `CalmBase` draws MapTiler "Dataviz Light" from its vector style with MapLibre (via
  `@maplibre/maplibre-gl-leaflet`, lazy-loaded so only map pages download it).
- `storyPlaceStyle` turns it into a calm, editorial basemap (`storyPlaceColors`, `CALM`, `HIDDEN`). It
  has warm off-white land, one soft green for large forests, light blue-grey water, hairline motorways
  only (from Leaflet zoom 7), and only large city, region, country, and sea names. Small land uses,
  buildings, rail, paths, minor roads, borders, and small labels are hidden. So are river areas and
  stream lines until zoomed in. There are no drop shadows.
- There is no legend panel on the map.
- Stories on maps are small coloured dots (`StoryPin`, styled by `.sp-dot` in `index.css`): 7px, 10px on
  hover, and 14px while their popup is open (`large` keeps a single story's dot at 14px). Each dot sits in
  an invisible 24px hit area. There are no pin shapes or icons yet. The category colours live in
  `src/mapStories.ts` (`MAP_CATEGORIES`). The Map tab filters by `status === "published"` first, then by its
  category filter chips, which are UI state kept separate from the stories. In development it shows
  `EUROPEAN_LEGENDS` (`src/data/europeanLegends.ts`: 92 real legends). Each has a `source` record
  (title, URL, author or institution, date, source type, the place as the source names it, and
  confidence), shown in its popup. Prefer archives and published collections over Wikipedia, which is
  for discovery only; the file's header lists the order. Coordinates come from the site's Wikipedia
  article. Every story must be place-bound: tied to a real, identifiable
  place that matters to the story, named in `place`. Don't add famous myths without a specific anchor
  (see the file's header). Production shows the app's published stories.
  `VITE_MAP_DATA=legends|live` overrides this. Card covers without a picture use the same colour
  as the story's map dot (`coverColor`). There is no Personal Stories category.
- It also adds satellite photos from zoom `SATELLITE_FROM_ZOOM` (8, about a 20 km scale bar) and MapTiler
  contour lines (index lines, minor lines from zoom 11, height labels from zoom 12). These sit below the
  place names.
- MapLibre runs one zoom level below Leaflet, so the style converts with `z()`.
- MapLibre's worker is pointed at the bundled file with `setWorkerUrl`.
- Until MapLibre loads, or without WebGL, raster tiles show, and Leaflet switches in satellite photos
  (no contours).
- In dev builds the MapLibre map is available as `window.storyplaceMap` for debugging.
- `VITE_MAPTILER_MAP_STYLE` swaps in a custom MapTiler map, with no recolouring. Without a key the app
  falls back to OpenStreetMap.
- The Map tab waits for the stories and opens already framed around them (`startingView`), so it never
  starts on the world and then jumps.
- Pins and other map furniture have no drop shadows.

**Position strip.** `MapStatusBar` is a thin dark strip of map readouts at the top of the header (Felt-style):
LAT/LON, zoom, place, and a scale bar. Pages report into `MapStatusContext` (`src/mapStatus.ts`): the Map tab
sends its live centre, zoom, and scale. Story pages and Home with a chosen place use `usePlaceStatus`. Pages
that don't report, including the opening screen, show no strip.

**Story cards and covers.** Every story list (and Map popups and the review queue) uses `StoryCover` /
`StoryCard` from `src/components/StoryCard.tsx`. Picture covers sit in a white paper frame with a 9% margin,
fitted whole and then scaled and moved by `cover.scale` / `x` / `y`, which are display settings only.
Without a picture the card uses the category gradient. Never put text inside the cover, except the small story-type tag (`categoryOne`, e.g. "Local Legend")
on the large featured cover. `stories.cover` is
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
only when the reader taps Use My Location. It never asks on load or after sign-in, even if the browser
already allows it. `request()` returns the position or why it failed, and the position is rounded to about
1 km. `stories.remove` also deletes a story's rows in these tables and in `collectionEntries`.

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
