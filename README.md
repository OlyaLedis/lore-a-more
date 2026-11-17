# Loramore

A place where people share stories for others to read. Writers sign in and submit a story; it stays
hidden until a moderator approves it, then it appears in the public feed. Writers can edit or
delete their own stories; edits to a published story are reviewed before they replace it.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS (`src/`)
- **Backend:** [Convex](https://convex.dev) — database, server functions, and auth (`convex/`)
- **Auth:** email + password via [Convex Auth](https://labs.convex.dev/auth)

This README walks you through everything needed to run the app on your own computer and work on it
with Claude Code. Set aside about 30 minutes the first time.

---

## Contents

1. [Before you start (Bakhtiar)](#1-before-you-start-bakhtiar)
2. [Install the tools](#2-install-the-tools)
3. [Get the code](#3-get-the-code)
4. [Set up Convex](#4-set-up-convex) (including the place-search key, 4c)
5. [Run the app](#5-run-the-app)
6. [Make yourself the reviewer](#6-make-yourself-the-reviewer)
7. [Set up Claude Code](#7-set-up-claude-code)
8. [Day-to-day workflow](#8-day-to-day-workflow)
9. [How the app works](#9-how-the-app-works)
10. [Troubleshooting](#10-troubleshooting)
11. [Put the app online](#11-put-the-app-online)
12. [Export the stories to Felt](#12-export-the-stories-to-felt)

---

## 1. Before you start (Bakhtiar)

Olga needs access to two things. Both are invitations Bakhtiar sends:

| Access | How | Status |
| --- | --- | --- |
| GitHub repo `OlyaLedis/lore-a-more` | Repo → Settings → Collaborators → invite Bakhtiar | ☐ To do |
| Convex project `olga` | [dashboard.convex.dev](https://dashboard.convex.dev) → team settings → **Members** → invite Olga's email | ☐ To do |

Joining the Convex team lets Olga use the same project. Convex gives every team member their **own
private development database**, so her test stories and accounts never mix with Bakhtiar's.

---

## 2. Install the tools

You need these once per computer. The commands below are for macOS and are typed into the
**Terminal** app (press ⌘ + Space, type "Terminal", press Enter).

### Node.js (version 22 or newer)

Check whether you already have it:

```sh
node --version
```

If that prints `v22.12.0` or higher, you're set. Otherwise, download the **LTS** installer from
[nodejs.org](https://nodejs.org) and run it. Close and reopen Terminal afterwards.

> Vite requires Node `20.19+` or `22.12+`. Older versions fail with confusing errors.

### Git

```sh
git --version
```

If macOS offers to install the "command line developer tools", click **Install** and wait for it
to finish.

### GitHub CLI (recommended)

The easiest way to sign Git in to GitHub:

```sh
brew install gh      # needs Homebrew: https://brew.sh
gh auth login        # choose GitHub.com → HTTPS → "Login with a web browser"
```

No Homebrew? Download GitHub Desktop from [desktop.github.com](https://desktop.github.com) instead
and sign in there. It sets up Git credentials for you.

---

## 3. Get the code

Pick a folder for your projects, then clone the repo and install its packages:

```sh
cd ~/Desktop
git clone https://github.com/OlyaLedis/lore-a-more.git olga
cd olga
npm install
```

`npm install` downloads everything listed in `package.json` into `node_modules/`. It takes a
minute. Run it again whenever `package.json` changes after a `git pull`.

---

## 4. Set up Convex

### 4a. Create your Convex account

1. Accept Bakhtiar's Convex team invitation from your email (see step 1). If you don't have a Convex
   account yet, it will ask you to create one. Signing up with GitHub is easiest.
2. In Terminal, inside the `olga` folder, run:

   ```sh
   npx convex dev
   ```

3. The first time, it opens a browser to log you in and then asks a few questions:
   - *"What would you like to configure?"* → **choose an existing project**
   - Pick the team Bakhtiar invited you to, then the project **olga**.

When it prints **`Convex functions ready!`**, it has created your personal dev deployment and
written its address to a file called `.env.local`. That file is private to your computer and is
never committed to Git.

Leave this command running. It watches the `convex/` folder and uploads changes as you save.
Open a **new Terminal tab** (⌘ + T) for the next steps, and `cd ~/Desktop/olga` in it.

### 4b. Set up the sign-in keys (once per deployment)

Sign-in needs a pair of secret keys stored on *your* Convex deployment. Run these commands one at a
time from the `olga` folder:

```sh
# 1. Generate a new key pair into a temporary file
node -e 'import("jose").then(async({generateKeyPair,exportPKCS8,exportJWK})=>{const k=await generateKeyPair("RS256",{extractable:true});const priv=await exportPKCS8(k.privateKey);const pub=await exportJWK(k.publicKey);process.stdout.write(JSON.stringify({JWT_PRIVATE_KEY:priv.trimEnd().replace(/\n/g," "),JWKS:JSON.stringify({keys:[{use:"sig",...pub}]})}))})' > .auth-keys.json

# 2. Upload them to your Convex deployment
npx convex env set "JWT_PRIVATE_KEY=$(node -p 'require("./.auth-keys.json").JWT_PRIVATE_KEY')"
npx convex env set "JWKS=$(node -p 'require("./.auth-keys.json").JWKS')"
npx convex env set SITE_URL=http://localhost:5173

# 3. Delete the temporary file. It contains a secret.
rm .auth-keys.json
```

Each `env set` should print `✔ Successfully set …`. Confirm with:

```sh
npx convex env list
```

You should see `JWKS`, `JWT_PRIVATE_KEY`, and `SITE_URL`.

> Keep the `NAME=value` form in quotes exactly as shown. Writing `env set JWT_PRIVATE_KEY "..."`
> fails, because the key starts with `-----BEGIN` and the CLI mistakes it for an option.

### 4c. Add the place-search key

The **Write a story** form lets writers search for the place their story is connected to. The search
uses [MapTiler](https://www.maptiler.com/) and needs a free API key. Without one the app still works,
but writers have to mark places by clicking a map.

1. Sign up at [cloud.maptiler.com](https://cloud.maptiler.com/) and open **API keys**. Copy the default
   key, or create a new one.
2. Under the key's **Allowed HTTP origins**, add `localhost:5173` and the address where the site is
   published. This key is sent from people's browsers, so it isn't secret. The origin list is what
   stops other websites from using it.
3. Add this line to `.env.local` in the `olga` folder, below the lines Convex wrote:

   ```sh
   VITE_MAPTILER_KEY=your-key-here
   ```

4. Restart `npm run dev`. Vite only reads `.env.local` when it starts.

For the published site, set `VITE_MAPTILER_KEY` in the hosting provider's build settings too, since
`.env.local` never leaves your computer.

The same key draws the maps: MapTiler's calm **Dataviz Light** style, with Loramore's own soft green
forests and grey-blue water (set in `src/mapStyle.ts`). To give Loramore its own map style,
open [cloud.maptiler.com](https://cloud.maptiler.com/) → **Maps**, choose Dataviz Light → **Customize**, adjust
colours and fonts, save, and copy the new map's ID into `.env.local`:

```sh
VITE_MAPTILER_MAP_STYLE=your-map-id
```

Restart `npm run dev` to see it. Without a key, the app falls back to OpenStreetMap's standard map.

---

## 5. Run the app

You need **two** Terminal tabs running at the same time, both in the `olga` folder:

| Tab | Command | What it does |
| --- | --- | --- |
| 1 | `npx convex dev` | Syncs the backend (`convex/`) to your Convex deployment |
| 2 | `npm run dev` | Serves the website at **http://localhost:5173** |

Open [http://localhost:5173](http://localhost:5173). The feed will be empty, since your development
database starts fresh. To fill it with the 118 place-bound legends (each with its own page, code,
and source), run once:

```sh
npx convex run storyCodes:backfill     # gives any older stories their permanent code
node scripts/import-legends.ts         # adds the legends; running it again updates them
```

Stop either one with **Ctrl + C**.

---

## 6. Make yourself the reviewer

The **Review** page, where stories are approved, is only shown to admin accounts.

1. In the app, click **Sign in** → **Sign up** and create an account with your email.
2. In Terminal (in the `olga` folder), run, using the email you just signed up with:

   ```sh
   npx convex run users:setAdmin '{"email":"you@example.com"}'
   ```

3. Refresh the page. A **Review** link appears in the header.

To test the whole flow, create a second account (e.g. in a private browser window), submit a story
from it, then approve it from your admin account and watch it appear in the feed.

Only people with access to the Convex project can run `setAdmin`, so nobody can make themselves a
reviewer from the website. To remove admin rights:
`npx convex run users:setAdmin '{"email":"you@example.com","isAdmin":false}'`.

---

## 7. Set up Claude Code

[Claude Code](https://claude.com/claude-code) is an AI coding assistant that runs in your
Terminal. It reads the project, makes changes, runs commands, and explains what it's doing.

### 7a. Install it

You need a Claude **Pro** or **Max** subscription (or an Anthropic Console account with API credit).

```sh
curl -fsSL https://claude.ai/install.sh | bash
```

Close and reopen Terminal, then check:

```sh
claude --version
```

> Alternative if the installer doesn't work: `npm install -g @anthropic-ai/claude-code`.

### 7b. Start it in the project

```sh
cd ~/Desktop/olga
claude
```

The first launch opens a browser to log in with your Claude account. After that you just type what
you want in plain English, for example:

- *"Walk me through how a story gets from the submit form to the feed."*
- *"Let me add a short note when I reject a story, and show it to the writer."*
- *"Start the dev servers and tell me if anything is broken."*

Claude asks for permission before running commands or editing files. Read what it proposes
and approve or decline.

### 7c. Add the Convex plugin (recommended)

The Convex plugin teaches Claude Convex's rules and gives it tools to inspect your deployment's
data and logs. Inside Claude Code, type:

```
/plugin
```

Find **convex** in the official plugin marketplace (`claude-plugins-official`) and install it. You
can also install it directly:

```
/plugin install convex@claude-plugins-official
```

Restart Claude Code afterwards (type `/exit`, then run `claude` again).

### 7d. Useful commands inside Claude Code

| Command | What it does |
| --- | --- |
| `/help` | Lists all commands |
| `/init` | Writes a `CLAUDE.md` file describing the project for future sessions |
| `/clear` | Starts a fresh conversation |
| `Esc` | Interrupts Claude mid-task |
| `Shift + Tab` | Switches permission modes (e.g. auto-accept edits) |

---

## 8. Day-to-day workflow

```sh
cd ~/Desktop/olga
git pull                 # get the latest changes
npm install              # only needed if package.json changed
npx convex dev           # tab 1
npm run dev              # tab 2
claude                   # tab 3, optional
```

Before sharing your work, check that it builds and passes lint:

```sh
npm run build            # type-checks the frontend and builds it
npx tsc --noEmit -p convex   # type-checks the backend
npm run lint
npm test                 # backend tests (convex/*.test.ts)
```

Then commit and push. Working on a branch and opening a pull request lets Bakhtiar review first:

```sh
git switch -c my-change
git add -A
git commit -m "Describe what you changed"
git push -u origin my-change
gh pr create --fill      # or open the link Git prints
```

Claude Code can do all of this for you. Just ask it to "commit this and open a pull request".

---

## 9. How the app works

### Pages (`src/pages/`)

| URL | Page | Who can see it |
| --- | --- | --- |
| `/` | **Home**: Stories Near You, Top Picks, Places You've Been, Recently Played, Seasonal Stories, and a shelf per category | Everyone (personal sections need sign-in) |
| `/new` | **New stories**: every published story, newest first (linked from Home) | Everyone |
| `/library` | **Library**: saved stories, Recently Played, Places You've Been | Signed-in users (private to each reader) |
| `/search` | **Search** by title, place, category, theme, or pen name, with category / age / theme filters | Everyone |
| `/story/:id/read` | **Reading mode**: full-screen large text with optional slow scrolling that stops at each picture; remembers your place | Same as the story |
| `/story/:id` | A single story, with Save, Mark as visited, and (for admins) Add to Seasonal Stories | Everyone if approved; otherwise only its writer and admins |
| `/map` | **Map** tab: approved stories that have a location, as pins; tap one to open the story | Everyone |
| `/signin` | Sign in / sign up | Everyone |
| `/account` | Opened from the initials button: reader's age for Top Picks, links, sign out | Signed-in users |
| `/write` | **Add a Story**: write in scenes, add pictures with descriptions and credits, and preview reading mode | Signed-in users |
| `/story/:id/edit` | Edit your story (the same form as writing one) | The story's writer |
| `/mine` | Your submissions, their status, and Edit / Delete | Signed-in users |
| `/review` | Approve or reject new stories and edits to published stories | Admins |

### Backend (`convex/`)

| File | Contents |
| --- | --- |
| `schema.ts` | Tables: `stories` (title, body, pen name, writer, status, optional location, category, age, themes, source) and `users` (with an `isAdmin` flag), plus Convex Auth's own tables. `storyRevisions` holds edits to published stories while they wait for review. `savedStories`, `storyViews`, `placeVisits` hold each reader's private library; `collectionEntries` holds Seasonal Stories |
| `scenes.ts` | Story scenes and pictures: validation, reading old one-text stories as one scene, picture URLs and cleanup |
| `taxonomy.ts` | The categories, ages, themes, and source kinds, shared with the frontend |
| `discover.ts` | Home sections (`home`, `nearby`, `topPicks`), `search`, and the Seasonal Stories collection |
| `library.ts` | A reader's saved stories, Recently Played, and Places You've Been |
| `stories.ts` | `list` (public feed), `mapped` (stories for the map), `get`, `mine`, `editable`, `submit`, `update`, `remove`, `pending` / `review` (new stories), `pendingRevisions` / `reviewRevision` (edits) |
| `users.ts` | `me` (current user), `setAgeRange`, `setAdmin` (command-line only), and the `requireUser` / `requireAdmin` checks |
| `auth.ts`, `auth.config.ts`, `http.ts` | Convex Auth wiring. Rarely needs changing. |
| `_generated/` | Created automatically by `npx convex dev`. Don't edit it. |

A story's `status` is `pending` when submitted, then `approved` or `rejected` by an admin.
Every permission check happens on the server in `convex/`. The frontend only hides buttons.

### Dashboard

[dashboard.convex.dev](https://dashboard.convex.dev) → project **olga** → your dev deployment lets
you browse the data, see function logs, and edit environment variables.

---

## 10. Troubleshooting

**Sign-in does nothing, or I'm signed out immediately after signing in.**
The auth keys are missing on your deployment. Run `npx convex env list` and redo step 4b if
`JWKS`, `JWT_PRIVATE_KEY`, or `SITE_URL` is missing.

**"Could not create the account" when signing up.**
That email already has an account, so switch to **Sign in** instead. Passwords must also be at
least 8 characters.

**The page is blank or says it can't connect.**
Make sure `npx convex dev` is running and that `.env.local` exists in the `olga` folder. If it's
missing, stop `npx convex dev` and start it again to reconnect to the project.

**The place search box is greyed out and says search isn't set up.**
`VITE_MAPTILER_KEY` is missing from `.env.local`, or `npm run dev` hasn't been restarted since you
added it. See step 4c.

**Place search says it isn't working right now.**
Open the browser console. A `403` error means MapTiler rejected the key, usually because the site's
address isn't in the key's allowed origins.

**`npx convex run users:setAdmin` says "No account with email …".**
Sign up in the app first, using exactly the same email address.

**`npm run dev` fails with a syntax or engine error.**
Your Node version is too old. See step 2.

**Port 5173 is already in use.**
Vite picks the next free port and prints it. Use that URL. Sign-in still works on another port, but
for consistency you can also run `npx convex env set SITE_URL=http://localhost:<port>`.

**Anything else:** start `claude` in the project folder and describe what you're seeing, including
any error text. It can read the logs and fix most setup problems.

---

## 11. Put the app online

The website runs on [Vercel](https://vercel.com) (free) and the backend on Convex's **production**
deployment, which is separate from your development one: it has its own database and its own keys.
`vercel.json` already tells Vercel how to build the app.

**1. Get a Convex deploy key.** In the [Convex dashboard](https://dashboard.convex.dev) open the
project → switch to **Production** (top left) → **Settings** → **Deploy keys** → **Generate a
production deploy key**. Copy it. It's a secret: don't paste it anywhere else.

**2. Create the Vercel project.** Sign in to Vercel with GitHub → **Add New… → Project** → import
the `lore-a-more` repository. Before clicking **Deploy**, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | the deploy key from step 1 |
| `VITE_MAPTILER_KEY` | the same MapTiler key as in your `.env.local` |

Click **Deploy**. When it finishes, Vercel shows the address, e.g. `https://olga-xyz.vercel.app`.
From now on every push to `main` updates the site, and the backend with it.

**3. Sign-in keys for production.** Repeat step 4b, adding `--prod` to each `npx convex env set`,
and set `SITE_URL` to the Vercel address instead of localhost:

```sh
npx convex env set --prod SITE_URL=https://olga-xyz.vercel.app
```

**4. Let MapTiler work on the new address.** In MapTiler → **API keys** → your key → **Allowed
HTTP origins**, add the Vercel address. Otherwise the map and place search are refused there.

**5. Fill the production database and make yourself the reviewer:**

```sh
node scripts/import-legends.ts --prod
npx convex run --prod storyCodes:backfill
```

Then sign up on the live site and run
`npx convex run --prod users:setAdmin '{"email":"you@example.com"}'`.

**6. Install it on a phone.** The app is installable (a PWA): it opens from the home screen in its
own window, and the app itself opens without a connection (stories and maps still need one).
On an iPhone: open the address in **Safari** → **Share** → **Add to Home Screen**. On Android: open
it in **Chrome** → **⋮** → **Install app** (or **Add to Home screen**). After a new version is
deployed, the installed app updates itself the next time it's opened.

---

## 12. Export the stories to Felt

To use the stories on a [Felt](https://felt.com) map, export them with links back to the live app:

```sh
node scripts/felt-export.ts https://olga-xyz.vercel.app --prod
```

This writes `loramore-stories.geojson` to your Downloads folder. Drag it onto a Felt map. Each
story has a `link` to its page (using its permanent code, so the link survives renames), plus
category, topics, age, place, and source. To match the app's colours, style the layer by
`category`: Local Legends `#889ADD`, Stories of a Place `#50957F`, Folktales & Myths `#EB9360`, each
size 4 with an automatic 1px stroke and 90% opacity.

