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

**Discovery and categories.** `category` is the story type, by one question, "Could this really have
happened?": `true_tale` (it happened: documented events, customs, memories), `legend` (it might have:
told as true, never proven), `wonder_tale` (it couldn't have: giants, dragons, miracles). The first
categories (`local_legend`, `place`, `folktale`) are retired: `legacyCategory` keeps them valid on saved
stories, which show them without a search link and get a neutral map dot, and the edit form asks the
author to choose again (never mapped by guess). New stories and edits require `category`, `ageRange`, and `source`, and
can have up to 3 `themes` (19 topics such as Dragons & serpents, Saints & miracles, Funny). All four are listed in `convex/taxonomy.ts`, which the frontend imports too. The first theme list (sea, forest, adventure, mystery, family) is retired: `legacyTheme` keeps it valid on saved stories, where it still shows and filters, but new stories and edits can't choose it, and the edit form asks the author to pick current topics instead of mapping old ones.
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
- `storyPlaceStyle` restyles it to look like Felt (felt.com) (`storyPlaceColors`, `CALM`, `HIDDEN`,
  `LABEL_COLORS`): neutral pale land, blue-grey water, a faint green for large forests, thin grey
  country borders (dashed region borders from Leaflet zoom 8), soft pink roads (motorways, trunk and main
  roads together from Leaflet zoom 6, none further out, as on Felt), grey country and region names, dark city names (more
  as you zoom in; towns from Leaflet zoom 8, villages from 12), and blue sea names. Close in it follows Felt
  too (sampled at Felt zoom 14 and 17): from Leaflet zoom 10 roads turn white except motorways, smaller
  roads join (local streets faint at first), woods and meadows aren't tinted, only parks, nature
  reserves, and sports grounds are green, streams are fine and pale, street names from zoom 14, pale buildings
  with a slightly darker edge from zoom 15 (fading in just before), and dotted footpaths from zoom 16.
  River and stream names run along the water in blue italic (`StoryPlace river names`, from the
  `waterway` data: rivers from Leaflet zoom 9, canals from 11, streams from 14), and lake names show too. Rail and small labels stay hidden, and river areas and
  streams wait until zoomed in. No drop shadows.
  `/map2` embeds the Felt map itself for comparison (`FeltMapPage`, `VITE_FELT_MAP_URL`).
- There is no legend panel on the map.
- Stories on maps are small coloured dots (`StoryPin`, styled by `.sp-dot` in `index.css`) in Felt's point
  style at 130%: 10.4px with a 1px stroke in a darker shade of the fill and 90% opacity; 14.3px on hover
  and 18.2px while their popup is open (`large` keeps a single story's dot at 18.2px). Each dot sits in
  an invisible 24px hit area. There are no pin shapes or icons yet. The category colours live in
  `src/mapStories.ts` (`MAP_CATEGORIES`). The Map tab filters by `status === "published"` first, then by its
  type tabs, which are UI state kept separate from the stories. It shows the app's
  published stories, which include the curated legends (`VITE_MAP_DATA=legends` shows the file
  directly). Card covers without a picture use the same colour as the story's map dot (`coverColor`).
  There is no Personal Stories category.
- No satellite photos and, like Felt, no contour lines: the drawn map stays at every zoom.
- Furthest zoom out, as on Felt: `OneWorld` sets the minimum zoom so the whole world (Arctic to
  Antarctica) fills the map's height (`zoomSnap` 0.1, recalculated on resize). `maxBounds` stops panning
  north and south; east–west the world repeats (`worldCopyJump`), and the Map tab draws each story in
  all three copies (`worldCopies` in `src/location.ts`).
- MapLibre runs one zoom level below Leaflet, so the style converts with `z()`.
- MapLibre's worker is pointed at the bundled file with `setWorkerUrl`.
- Until MapLibre loads, or without WebGL, raster tiles show.
- In dev builds the MapLibre map is available as `window.storyplaceMap` for debugging.
- `VITE_MAPTILER_MAP_STYLE` swaps in a custom MapTiler map, with no recolouring. Without a key the app
  falls back to OpenStreetMap.
- The Map tab opens on `START_VIEW` (50.424, 6.762 at zoom 7.4, the same view as our Felt map) unless an
  area is chosen (`/map?lat=…`); the dots appear as the stories load.
- Pins and other map furniture have no drop shadows.

**Map search.** A row along the top of the map holds the place search and Locate Me (the zoom
buttons sit just below it), and on phones (below `md`) the map's +/– buttons are hidden (`.sp-map-tab`
in `index.css`; pinch and double-tap still zoom). `MapSearch` is a field with a map-pin icon that finds
places only (MapTiler geocoding, ranked near the map's centre via `proximity`; stories are found on the
Search tab), with the matched part in bold. Choosing a place flies to it (see Zoom rules) and points a
small card at it (name and region), as Felt does. Towns are centred on their Wikidata coordinates
(`placeCentre`), because MapTiler gives the middle of the whole area; it falls back to MapTiler's point.
Arrow keys, Enter, and Escape work. `stories.mapped` returns an `excerpt` (the first 280 characters) for
the story sheet. `BaseMap`'s `onMap` hands the Leaflet map to the page. The place card has "+ Add a
story", which opens `/write?place=…&lat=…&lng=…&spot=0|1` (`writeHerePath`, read by `draftFromParams`) so
the form starts at that place; signed out, `RequireAuth` sends people to Sign In first and back. In the
story sheet, each part of the place line is a link (`PlaceTrail`): the first zooms to the story's pin,
wider parts (town, country) are looked up by name near the pin and framed, falling back to zooming out
around the pin; clicking one closes the sheet.

**Zoom rules.** Whenever the map zooms to a place (map search, the popup place links, the place card),
`src/placeZoom.ts` picks the zoom by MapTiler's place type (`PlaceResult.types`): countries framed up to
zoom 7, regions up to 9, counties and districts up to 11, towns centred at 14 (Felt's zoom; big cities
wider than 0.2° are framed up to 13), neighbourhoods 15, specific places (castles, peaks) 16, streets
and addresses 17. A story goes to 16 if exact, 14 for an area, 13 if uncertain (`storyZoom`).

**Map tab layout.** The map design itself is settled; refine only the UI around it. On `/map`, `AppShell`
uses little padding, the map fills the rest of the screen (on phones it runs under the floating tab
bar), the phone tab bar is slim and drops its Search circle (the map has its own search), and the header
is 56px. No instructions text. The story types are text tabs above the map (`CategoryTabs`: All · True ·
Legends · Wonder, one at a time, underlined when shown). Tapping a dot opens `StorySheet` (not a popup): a
compact card at the bottom (above the phone tab bar; bottom left from `md`), with the type as a serif-
italic phrase in its colour ("A wonder tale", `phrase`/`ink` in `MAP_CATEGORIES`), serif title,
clickable place line, a three-line excerpt, topics, Open story, and Google Maps. It pans the map so the
dot sits centred in the uncovered area, enlarges the selected dot (`large`), and closes on ×, Escape, a
tap on the map, or a place-line click. `/map2` (Felt)
is no longer linked from the Map tab.

**Locate me.** Beside the place search, `MapLocate` ("Locate Me", icon only below `sm`) asks for the position only
when tapped (`useHere().request()`, rounded to about 1 km, never stored), flies there at zoom 13, and
marks it with a blue dot and a faint 1 km circle. Browsers only allow location on https or localhost.

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

**Story codes and links.** Every story has a permanent public `code` like `SP-7K3QX9`
(`convex/storyCodes.ts`: 6 characters without 0/O/1/I/L, unique via the `by_code` index, set by `submit`
and never changed; `storyCodes:backfill` gives older stories one). Links are `/story/<code>/<title-slug>`
(`src/storyLinks.ts`: `storyPath`, `readPath`, `editPath`); only the code matters. `stories.get` and
`editable` take a code (any letter case) or, for old links, a database id (`storyFromLink`), and the
story page replaces the address with the current one. Always build story links with `storyPath`, never
from `_id`. A story's `source` can have a `url` (http/https only), shown as "Read the source".

**Curated legends.** `src/data/europeanLegends.ts` holds 117 real place-bound legends. Each has a
`source` record (title, URL, author or institution, date, source type, the place as the source names
it, and confidence), up to 3 `themes`, and an `ageRange`. Prefer archives and published collections
over Wikipedia, which is for discovery only; the file's header lists the order. Coordinates come from
the site's Wikipedia or Wikidata entry. Every story must be place-bound: tied to a real, identifiable
place that matters to the story, named in `place`. Don't add famous myths without a specific anchor.
`node scripts/import-legends.ts [--prod]` turns them into published stories (`legends:importLegends`,
owned by a "StoryPlace" account with no sign-in, matched by `importId`, so re-running updates them and
keeps their codes). `node scripts/felt-export.ts <site URL> [--prod]` writes a GeoJSON file for Felt
with a `link` to each story. Hosting: Vercel builds with `npx convex deploy --cmd 'npm run build'`
(`vercel.json`); README section 11 has the production setup.

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
