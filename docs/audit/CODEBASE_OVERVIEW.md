# Kutumb — Codebase Overview (Beginner-Friendly)

> Written for someone who just joined the project and has never seen this code before. If you want the rigorous, citation-heavy version, read `ARCHITECTURE.md` instead. This is the "explain it to me like I'm new here" version.

---

## What is this app?

Kutumb is a web app for building and exploring an interactive family tree. You register an account, create a "family," add people to it, connect them with relationships (parent, child, spouse, sibling), and the app draws a visual tree you can pan, zoom, and click through. Each person has a profile page where you can add biographical details, upload a photo, write "memories" (a little timeline of moments), and leave "legacy messages." You can also import a GEDCOM file (a standard genealogy file format) to bulk-load a tree instead of adding people one at a time.

It's two separate applications that talk to each other over HTTP:

- **`backend/`** — a Node.js API server. It owns the database and all the business rules.
- **`frontend/`** — a React single-page app. It's what you see in the browser; it never talks to the database directly, only to the backend's API.

## How the pieces fit together

```
Your browser
   │
   │  loads the React app (frontend/)
   ▼
React app (runs in your browser)
   │
   │  makes HTTP requests, e.g. "GET /api/family-tree/abc123"
   ▼
Backend API server (backend/, runs on a server somewhere)
   │
   │  runs SQL queries
   ▼
PostgreSQL database (stores everything permanently)
```

When you click a button in the app — say, "Add Person" — the browser doesn't do anything with a database directly. It sends a request to the backend ("please create a person with this name"), the backend checks you're logged in, runs an `INSERT` SQL statement, and sends back the new person's data. The browser then updates what you see.

## The backend, in plain terms

The backend is organized in layers, like an assembly line for each HTTP request:

```
routes/        "which URL maps to which function?"
   ↓
controllers/   "read the HTTP request, decide what to do, send back a response"
   ↓
services/      "the business rules" (e.g. "you can't create a memory without a title")
   ↓
models/        "talk to the database" (SQL queries)
```

For example, when the frontend sends `POST /api/persons`:
1. `routes/personRoutes.js` says "this URL goes to `personController.addPerson`."
2. `personController.js` reads the request body, calls `personService.addPerson(...)`.
3. `personService.js` does light validation (e.g. checks required fields).
4. `personModel.js` runs the actual `INSERT INTO persons (...) VALUES (...)` query.
5. The new person's data flows back up and out as a JSON response.

This pattern is used consistently for families, persons, relationships, and memories. Two features (legacy messages and reminders) skip the "services" step and go straight from controller to database — not wrong, just a small inconsistency you'll notice if you compare files.

### Logging in

You register with an email/password. The password is never stored in plain text — it's hashed with a library called `bcrypt` before it touches the database. When you log in, the backend gives you back a **JWT** (a signed token, like a temporary ID card). Your browser stores this token and attaches it to every future request ("Authorization: Bearer <token>"). The backend checks that token on every protected route to confirm you're logged in.

**Important gap to know about**: the backend confirms *who* you are, but for almost every feature except "families," it does **not** confirm that the thing you're asking for actually belongs to you. See `SECURITY_AUDIT.md` — this is the most important thing to fix before this app handles real user data.

### The database

Six tables: `users`, `families`, `persons`, `relationships`, `memories`, `legacy_messages`. A `family` belongs to a `user`. A `person` belongs to a `family`. A `relationship` connects two `persons` (e.g. "person A is the parent of person B"). Simple, sensible design for an MVP — though it has no indexes beyond primary keys, which will matter once there's real data volume (see `SCALABILITY_REPORT.md`).

## The frontend, in plain terms

It's a normal React app: pages, components, some shared utilities. A few things worth knowing as you get oriented:

- **Pages** live in `src/pages/` — one file per screen (Login, Register, Dashboard, the family tree workspace, a person's profile page).
- **Components** live in `src/components/` — reusable pieces (a search bar, the graph itself, a memory timeline, etc).
- **No Redux, no global state library.** Almost everything is just `useState` inside whichever component needs it. The one exception is toast notifications (the little pop-up messages), which use a shared `ToastContext`.
- **Where's the "am I logged in" state?** There isn't a formal one. The app just checks `localStorage` for a token when making API calls. If a request comes back "401 Unauthorized," the app clears the token and bounces you to the login page. This works, but it means a logged-out visitor can briefly see a page's empty shell before being redirected — there's no upfront check.
- **How pages talk to the backend**: there's a shared `api.js` file that wraps Axios (an HTTP client library) and automatically attaches your login token to every request. Some pages call a `familyService.js` helper for common operations; others call the API directly. Both work, it's just not 100% consistent about which to use where.

### The star of the show: the family tree graph

This is the most interesting part of the codebase. The visual tree you see — boxes for people, lines connecting them — is rendered using a library called **ReactFlow**, but the *layout* (deciding where each box should go on screen) is entirely custom-built, not from a library. Here's the plain-English version of how it works:

1. Figure out who's a "root" (no parents listed) and start there.
2. Walk through the family tree level by level (parents above, children below) — this is a breadth-first search, a standard graph-traversal technique — assigning everyone a "generation number" (0, 1, 2, ...).
3. Place everyone in their generation's row, then run several passes of a "settle into place" algorithm — nudge each person toward the horizontal middle of their parents (or children), and if two people would overlap, push them apart. Repeat until it looks reasonably tidy.

This is a legitimate, well-thought-out algorithm (the kind of thing computer science calls a "layered graph layout"), and it's implemented well — the code is careful to only recompute this expensive step when the actual family data changes, not every time you hover over a node. The main risk is that it currently reruns the *entire* layout from scratch after every single add/edit, and it hasn't been tested against very large trees (hundreds or thousands of people) — see `PERFORMANCE_REPORT.md`.

## What's real vs. what's a placeholder

Worth knowing up front so you don't get surprised in a demo:

- **"AI-generated biography"** — this is not connected to any AI service. It fills in a text template using data already in the database (name, birth year, occupation, relationship count). No OpenAI/Anthropic API key exists anywhere in the config.
- **"Reminder emails"** — the backend computes who has an upcoming birthday/anniversary, but instead of sending an email, it just prints a message to the server log. No email service is wired up.
- **"Collaboration / invite family members"** — the invite button sends a request that always reports success but doesn't actually persist an invitation or send anything. The collaborator list on screen is fake, local-only data that resets on page refresh.
- **Some buttons genuinely do nothing** — a few "Fix Now" / "Generate" / "Magic Bio Generator" buttons in the insights panel aren't wired to any function yet.

None of this is unusual for an MVP/demo build — but it's the kind of thing a new engineer should know before promising a stakeholder that a feature "already works."

## Where to start reading the code

If you want to trace one feature end to end, "add a relationship between two people" is a good, small example:
1. Frontend: `frontend/src/pages/FamilyTreePage.js` — look for `RelationshipBuilder` and `handleCreateRelationship`.
2. Frontend → backend: `frontend/src/services/familyService.js` — `createRelationship`.
3. Backend: `backend/routes/relationshipRoutes.js` → `backend/controllers/relationshipController.js` → `backend/services/relationshipService.js` → `backend/models/relationshipModel.js`.
4. Database: the `relationships` table in `backend/schema.sql`.

Once you've traced that one path, every other CRUD feature in the app (persons, memories, etc.) follows the same shape.

## Where the real risk is (short version)

If you read one more document after this, make it `SECURITY_AUDIT.md`. The short version: almost every feature except "families" will let a logged-in user read or modify *another user's* data if they know (or guess) the right ID — that's the single most important thing standing between this app and being safe to put real family data into.
