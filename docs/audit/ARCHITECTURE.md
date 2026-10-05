# Kutumb — Architecture Document

> Staff-engineer technical audit. Scope: full monorepo at `backend/` (Node/Express/PostgreSQL API) and `frontend/` (React 18/19 SPA). This document explains what the system *is* and *how it works*, end to end. Companion documents: `CODEBASE_OVERVIEW.md`, `TECHNICAL_DEBT.md`, `PERFORMANCE_REPORT.md`, `SECURITY_AUDIT.md`, `SCALABILITY_REPORT.md`, `IMPROVEMENT_ROADMAP.md`.
>
> All `file:line` citations are relative to `backend/` or `frontend/` as indicated.

---

## 1. Project Structure

### 1.1 Folder structure

```
Family Tree/
├── backend/                     Node.js + Express REST API
│   ├── config/db.js             pg.Pool connection
│   ├── controllers/             9 controllers (HTTP layer)
│   ├── services/                5 services (business logic — only 3 of 9 features have one)
│   ├── models/                  5 models (parameterized SQL)
│   ├── routes/                  10 route files
│   ├── middleware/               auth, validation, error handler
│   ├── utils/                   gedcomParser.js, treeBuilder.js
│   ├── cron/reminderCron.js     daily node-cron job
│   ├── uploads/                 local-disk file storage (photos, GEDCOM)
│   ├── schema.sql               single static DDL file (no migration framework)
│   ├── init_db.js, init_cloud_db.js, migrate_demo.js, setup_demo_user.js  ad hoc provisioning scripts
│   ├── tests/integration.test.js  the only test file
│   └── server.js                app bootstrap
├── frontend/                    React 18/19 CRA SPA
│   └── src/
│       ├── api/api.js           shared Axios instance
│       ├── services/familyService.js   partial service layer (11 of ~20+ endpoints)
│       ├── context/ToastContext.js     the only global React Context
│       ├── components/          17 components (2 confirmed dead/unimported)
│       ├── pages/                7 route-level pages
│       └── App.js / index.js    bootstrap + routing
├── docker-compose.yml            postgres 15 + backend + frontend
├── README.md
└── security_audit.md             prior audit (Mar 2026), largely addressed — see SECURITY_AUDIT.md
```

### 1.2 Architecture pattern

**Backend**: classic layered REST — `routes → controllers → services → models → pg.Pool`. Applied consistently for families/persons/relationships/memories; **skipped** (controller talks to `pool` directly) for `legacyController.js` and `reminderController.js`; **bypassed** (raw pooled client, no model reuse) for the transactional GEDCOM bulk-import path.

**Frontend**: component-per-page SPA, no container/presentational split, no global state library. Pages fetch their own data on mount via `useEffect` + Axios; there is a thin, partially-adopted service module (`familyService.js`) sitting alongside pervasive direct `api.get/post` calls from components.

**Deployment**: three independent targets are configured simultaneously — Docker Compose (full local stack, 3 containers), a standalone backend `Dockerfile` + frontend `Dockerfile` (multi-stage, Nginx-served), and `vercel.json` (serverless function deployment of `server.js`). These targets have **materially different runtime guarantees** (see §7 Deployment topology) that the codebase does not account for uniformly — most importantly, local-disk file uploads and `node-cron` are incompatible with the Vercel serverless target.

### 1.3 Technologies, libraries, frameworks

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Backend runtime | Node.js + Express | Express 4.19.2 | Standard, current major |
| Database | PostgreSQL | 15 (docker-compose) | Single static schema, no ORM |
| DB driver | `pg` | — | Raw parameterized SQL, no query builder/ORM |
| Auth | `jsonwebtoken` + `bcryptjs` | — | Stateless JWT, 24h expiry, no refresh flow |
| Validation | `express-validator` | — | Used on only 3 of 11 route files |
| Security middleware | `helmet`, `cors`, `express-rate-limit`, `express-mongo-sanitize`, `xss-clean` | — | `xss-clean` is unmaintained (see TECHNICAL_DEBT) |
| File uploads | `multer` | v2.1.1 | Local disk, not object storage |
| Scheduling | `node-cron` | — | In-process, no distributed lock |
| GEDCOM parsing | `gedcom` | v3.0.9 | Thin, lightly-maintained |
| API docs | `swagger-ui-express` + `yamljs` | — | Dev-only; incomplete (5 of ~11 feature areas documented) |
| Frontend framework | React | 19.2.4 | Paired with an unmaintained build tool, see below |
| Build tooling | Create React App (`react-scripts`) | 5.0.1 | **CRA is in maintenance mode**, last major release Feb 2022 |
| Routing | `react-router-dom` | 7.13.1 | ESM-only; incompatible with the bundled Jest without extra config (confirmed root cause of 100% test-suite failure) |
| Graph rendering | `reactflow` | 11.11.4 | Node/edge canvas; layout is **hand-built**, not via a library |
| Graph layout (declared, unused) | `dagre`, `elkjs` | — | Zero usages in source — dead dependencies |
| Styling | Tailwind CSS | v3.4.19 | Unmodified default theme, no design tokens |
| HTTP client | Axios | 1.13.6 | Single shared instance with interceptors |
| Export | `html-to-image` | 1.11.13 | PNG export of the graph canvas |

### 1.4 Design patterns observed

- **Layered architecture** (backend) — consistently applied to 4 of 6 feature domains.
- **Repository-ish model layer** — each model file wraps one table's CRUD in parameterized SQL functions; no true Repository interface/abstraction, no ORM.
- **Interceptor pattern** (frontend) — Axios request/response interceptors centralize token attachment and 401 handling.
- **Memoized layout + separate styling effect** (frontend, `FamilyTree.js`) — a genuinely well-designed two-stage `useMemo`/`useEffect` split that avoids recomputing an expensive graph layout on hover/selection changes. One of the strongest pieces of engineering in the codebase.
- **God Component anti-pattern** — `PersonProfile.js` (1,147 lines, 19 inline sub-components) and, to a lesser degree, `FamilyTreePage.js` (502 lines) and `Dashboard.js` (536 lines) mix data-fetching, business logic, and presentation in single files with no extraction.
- **No formal state-management pattern** — no Flux/Redux/Context-per-domain; a single global Context (toasts) plus scattered `localStorage` reads/writes functioning as ad hoc global state (`token`, `selectedFamily`).
- **No repository/migration pattern for the database** — schema changes require hand-written SQL run manually; no versioned migrations.

### 1.5 Project organization assessment

The backend's structure is conventional and easy to navigate for the 4 "core" resources. Two feature areas (`legacy`, `reminders`) skip the service layer, which is a minor but real inconsistency for anyone building a mental model of "where does logic live." The frontend has a service module that only covers half the API surface, so "where does this API call live" has two possible answers (`familyService.js` or inline in the component) with no rule for which.

---

## 2. Application Flow

### 2.1 How the application starts

```
Backend:
  server.js
    → dotenv.config()
    → require('./config/db')            (Pool created at import time)
    → helmet / trust-proxy / CORS / json-limit / mongo-sanitize / xss-clean
    → mount /uploads static
    → construct apiLimiter, authLimiter
    → mount Swagger UI (dev only)
    → require + mount all 10 route files under /api/*
    → require('./cron/reminderCron')    (schedules daily job as a side effect of import)
    → mount errorHandler (must be last)
    → app.listen(PORT)

Frontend:
  index.js
    → install global 'error' listener (suppresses ResizeObserver noise)
    → ReactDOM.createRoot(...).render(<StrictMode><App/></StrictMode>)
  App.js
    → <ToastProvider> wraps everything (only global Context)
    → <NetworkListener> (online/offline toast side effects)
    → <BrowserRouter><Routes>...</Routes></BrowserRouter>
    → each page is React.lazy()-loaded, wrapped in one <Suspense fallback={<PageLoader/>}>
```

### 2.2 How routing works

React Router v7, client-side only. Route table (`App.js:49-58`):

| Path | Page | Auth guard |
|---|---|---|
| `/register`, `/login` | `Register`, `Login` | none needed |
| `/story-transition` | `StoryTransition` | none |
| `/dashboard` | `Dashboard` | **none — see below** |
| `/family-tree` | `FamilyTreePage` | **none** |
| `/person/:id` | `PersonProfile` | **none** |
| `*` | redirect → `/login` | n/a |

**There is no client-side route guard.** No `ProtectedRoute`/`RequireAuth` component exists anywhere in the frontend. Protection happens *reactively*: every page mounts and begins rendering its shell; only once a page's first API call returns HTTP 401 does the shared Axios response interceptor (`api.js:40-47`) clear `localStorage` and hard-redirect to `/login`. A page section with no API call on mount (e.g. `CollaborationPanel`'s mock list) never triggers this at all. This is a genuine architecture gap — see SECURITY_AUDIT.md.

### 2.3 How pages are loaded

Each page is `React.lazy(() => import('./pages/X'))`, so route-level code-splitting is real (contrary to a common assumption for CRA apps that don't explicitly opt in — this one does, `App.js:8-13`). Webpack merges some chunks with overlapping dependencies, so the split is coarse rather than one-chunk-per-route, but it is present and functioning.

### 2.4 How components communicate

- **Parent → child**: props, as usual. `FamilyTree.js` uses ReactFlow's `data` bag pattern to pass `person`/callbacks into `PersonNode` — idiomatic for ReactFlow, but callback identities are recreated on every render inside the node-formatting `useEffect`, which defeats `PersonNode`'s `memo()` wrap whenever hover/selection state changes anywhere in the graph (see PERFORMANCE_REPORT.md).
- **Child → parent**: callback props (`onSelect`, `onAddRelative`, `onNodeClick`, etc.).
- **Cross-cutting**: `ToastContext` (the only global Context) for toast notifications; `localStorage` functions as an ad hoc, out-of-React-tree global store for `token` and `selectedFamily` — meaning two browser tabs on different families will clobber each other's `selectedFamily` value, and React DevTools cannot see this piece of "state" at all.
- **No event bus, no pub/sub.**

### 2.5 How data moves (request lifecycle)

```
User action (e.g. "Add Person" click)
  → Page component calls familyService.createPerson(...) OR api.post(...) directly
  → Axios request interceptor attaches Authorization: Bearer <token> from localStorage
  → HTTP request → Express → apiLimiter (300/15min) → route-specific middleware
       (verifyToken → [express-validator, where present] → controller)
  → Controller → (service, where one exists) → model → pg.Pool → PostgreSQL
  → Response bubbles back up; on error, either a local try/catch (most controllers)
    or next(error) → centralized errorHandler (some controllers) — two coexisting conventions
  → Axios response interceptor normalizes the error shape, or (on 401) clears
    localStorage and hard-redirects to /login
  → Page's success/catch handler updates local component state
  → **Full data re-fetch pattern**: after almost every mutation, the page re-calls
    its fetch-everything function (fetchTree(), fetchProfileData()) rather than
    patching local state optimistically — see PERFORMANCE_REPORT.md
```

### 2.6 How state is managed

See §4 below (State Management) for the full inventory. In one line: **100% local component `useState`, one global Context for toasts, and two pieces of ad hoc global state living directly in `localStorage`** (`token`, `selectedFamily`). No Redux/Zustand/Context-per-domain, no server-state cache (React Query/SWR).

### 2.7 How APIs are called

Two coexisting patterns:
1. **Through `familyService.js`** — 11 functions covering families/persons/relationships CRUD, used consistently by `Dashboard.js`, `FamilyTreePage.js`, `PersonProfile.js` for those specific operations.
2. **Directly via the shared `api` Axios instance** — every other endpoint (memories, legacy messages, GEDCOM import, person search, reminders, AI biography, invites) is called ad hoc from within the component that needs it (`Login.js`, `Register.js`, `PersonProfile.js`, `CollaborationPanel.js`, `GedcomImport.js`, `LegacySection.js`, `SearchBar.js`, `UpcomingReminders.js`).

One code path (`PersonProfile.js`'s photo upload) bypasses `api` entirely and uses a raw `fetch()`, manually re-deriving the token and base URL — this is unnecessary (Axios supports `FormData` natively, as `GedcomImport.js` correctly demonstrates) and means that specific call misses the global 401-handling behavior.

### 2.8 How the graph is rendered

Full deep-dive in §6 below. Summary: `FamilyTreePage` fetches `{nodes, edges}` from `GET /api/family-tree/:family_id` (built server-side by `utils/treeBuilder.js` from the `persons`/`relationships` tables), passes them into `<FamilyTree>`, which runs a **hand-built layout algorithm** (BFS generation assignment + iterative barycenter relaxation + collision resolution) to compute `(x, y)` positions before handing formatted nodes/edges to ReactFlow for actual rendering, pan/zoom, and interaction.

### 2.9 How updates propagate

There is no live/websocket update channel. All "updates" are pull-based: a mutation completes, the page re-fetches its data, React re-renders. `FamilyTreePage`'s custom layout is fully recomputed (not incrementally patched) on every such re-fetch, because the memoized `layout` in `FamilyTree.js` is keyed on the *array identity* of `incomingNodes`/`incomingEdges`, and a full re-fetch always produces new array identities — see PERFORMANCE_REPORT.md for the compounding cost of this pattern.

### 2.10 Sequence diagram — "Add a family member"

```
User (FamilyTreePage) → SmartMemberForm.submit
   → FamilyTreePage.handleCreatePerson(data)
       → familyService.createPerson(data)          [POST /api/persons]
           → api.js request interceptor: attach JWT
           → Express: apiLimiter → verifyToken → express-validator → personController.addPerson
               → personService.addPerson (light validation)
               → personModel.createPerson            [parameterized INSERT]
               → 201 response
       → FamilyTreePage.pushActivity(...)             [local, non-persisted log entry]
       → FamilyTreePage.fetchTree(selectedFamily)      [GET /api/family-tree/:id — FULL refetch]
           → treeBuilder.buildFamilyTreeData            [2 flat SELECTs, O(n) map to nodes/edges]
       → new {nodes, edges} arrays → <FamilyTree> re-renders
           → useMemo([nodes, edges]) → computeLayout() runs AGAIN for the WHOLE tree
           → ReactFlow re-renders with new positions
```

---

## 3. Component Analysis

Full per-file findings live in the backend/frontend research appendices; this section summarizes the components that matter most for a new engineer's mental model.

### 3.1 Backend — controllers/services/models (representative)

| Component | Purpose | Notable |
|---|---|---|
| `authController` / `authService` | register, login, JWT issuance | Clean, correctly hashes with bcrypt(10), no fallback secret |
| `familyController` / `familyService` (backend) / `familyModel` | family CRUD | **Only resource with ownership (`created_by`) checks** |
| `personController` / `personService` / `personModel` | person CRUD + search + photo upload | `updatePerson` has a SQL-injection-class defect (dynamic column names, unwhitelisted); `searchPersons` has zero tenant scoping |
| `relationshipController/Service/Model` | relationship CRUD | No enum constraint on `relationship_type`; no cycle prevention |
| `memoryController/Service/Model` | memories CRUD | No update endpoint; no auth ownership check |
| `legacyController` | legacy messages | **No auth middleware applied at all**; talks to `pool` directly, skips service/model layers |
| `reminderController` | computed reminders | Talks to `pool` directly; logic duplicated in `cron/reminderCron.js` |
| `eventController` | family timeline | N+1 query pattern (1 + N person-scoped memory fetches instead of 1 family-scoped fetch) |
| `aiController` | "AI" biography | **Template-string stub, not an LLM call** — no LLM SDK dependency exists |
| `gedcomController` / `utils/gedcomParser.js` / `utils/treeBuilder.js` | GEDCOM import, tree building | Only multi-step write in the app using a real transaction; parser doesn't extract death dates; sequential per-row DB round-trips inside the held transaction |

### 3.2 Frontend — pages & components

| Component | Purpose | Inputs | Outputs | Improvement needed |
|---|---|---|---|---|
| `PersonProfile.js` (1,147 lines) | Full person detail/edit view | route param `:id` | mutations via mixed `familyService`/raw `api` calls | **Split into ≥8 files.** Confirmed God component: 19 inline sub-components, a client-side N+1 fetch loop, two different HTTP-calling conventions, an unscoped raw-`fetch` upload path |
| `FamilyTreePage.js` (502 lines) | Tree workspace, orchestrates the graph + side panels | `selectedFamily` from `localStorage` | person/relationship mutations | Extract `SmartMemberForm`/`RelationshipBuilder`/`WorkspaceSummary` into their own files; hardcoded fake activity-feed seed data should be removed or clearly flagged as placeholder |
| `Dashboard.js` (536 lines) | Family list, create/rename/delete | none | family CRUD | Reasonably self-contained; two hand-rolled modals duplicate chrome found elsewhere |
| `FamilyTree.js` (718 lines) | Graph canvas — the product's centerpiece | `nodes`, `edges`, callbacks | positioned ReactFlow graph, PNG export | Best-engineered file in the frontend (memoization is correct); layout constants are hardcoded, not configurable; no incremental layout |
| `PersonNode.js` | Custom ReactFlow node | `data.person`, styling flags | rendered card | Correctly `memo()`'d; injects a duplicate `<style>` tag *per node instance* (should be one global rule) |
| `CollaborationPanel.js` | "Invite collaborators" UI | none | invite POST (only) | Role-change/remove actions are **mock-only, never persisted** — false confidence |
| `FamilyInsightsPanel.js` | Tree analytics + "Auto-Fix" suggestions | tree nodes/edges | none | Several buttons ("Fix Now", "Generate", "Magic Bio Generator") have **no `onClick` handler at all** |
| `FamilyInvite.js`, `FamilyTimeline.js` | — | — | — | **Dead code** — never imported anywhere; also visually stale (light theme vs. the app's dark theme) |
| `UpcomingReminders.js` | Reminders widget | `family_id` | — | **Live bug**: renders light-theme classes (`bg-blue-50`) against the app's dark shell — this one *is* mounted in production |

### 3.3 Large components that should be split

1. `PersonProfile.js` — split into: `Avatar/UploadableAvatar`, `MiniTreePreview`, `FamilySection/FamilyMemberCard`, `MemoryForm`, `BiographySection/StoryModeModal`, `ProfileStrengthBar`, and a slim `PersonProfile` container that only orchestrates data-fetching + composition.
2. `FamilyTreePage.js` — extract `SmartMemberForm`, `RelationshipBuilder`, `WorkspaceSummary` to their own files.
3. `Dashboard.js` — extract the delete/rename modals into a shared `<Modal>` primitive (also fixes the "3 independent hand-rolled modals" smell).

### 3.4 Unused / duplicate / overly coupled components

- **Unused**: `FamilyInvite.js`, `FamilyTimeline.js` (frontend, confirmed dead via grep); `@heroicons/react`, `dagre`, `elkjs` (declared dependencies, zero usages).
- **Duplicate**: three independent modal implementations (`Dashboard.js`, `PersonProfile.js`'s `StoryModeModal`, `FamilyTree.js`'s `QuickAddForm`); duplicated "upcoming reminders" SQL (backend `reminderController.js` vs `cron/reminderCron.js`); duplicated mouse-spotlight `useEffect` logic across `Login.js`/`Register.js`/`Dashboard.js` (only `FamilyTreePage.js`'s version is throttled correctly).
- **Overly coupled**: `PersonProfile.js` couples data-fetching, business logic (age calc, profile-completeness scoring), and 19 presentational sub-components into one file with no seams for independent testing or reuse.

---

## 4. State Management

| Category | Mechanism | Where |
|---|---|---|
| Global state | React Context | `ToastContext.js` only |
| Global-ish state | `localStorage` (outside React) | `token` (auth), `selectedFamily` (active tenant) |
| Local UI state | `useState` | Everywhere — the overwhelming majority of all state in the app |
| Derived/computed | `useMemo` | Graph layout (`FamilyTree.js`), search filtering, workspace stats |
| Server state / cache | **none** | No React Query/SWR/RTK Query — every fetch is a bespoke `useEffect` |

**Why this approach was (presumably) chosen**: it's the fastest path to a working MVP — no store boilerplate, no cache-invalidation design needed up front. For a small app with few concurrent editors, this is a defensible starting point.

**Weaknesses**:
- `localStorage` as ad hoc global state means auth/tenant state is invisible to React DevTools, not reactive (a `localStorage` write doesn't trigger a re-render anywhere unless a subsequent fetch happens to run), and multi-tab-unsafe (`selectedFamily` is a single shared key, not scoped per tab/session).
- No server-state cache means **every mutation triggers a full data re-fetch** rather than an optimistic local patch — this is the single biggest lever for both perceived performance and reducing backend load (see PERFORMANCE_REPORT.md).
- No `AuthContext`/`useAuth()` — "is the user logged in" is answered implicitly and only reactively (via a 401), never proactively.

**Recommended improvements** (details/effort in `IMPROVEMENT_ROADMAP.md`):
1. Introduce a lightweight `AuthContext` wrapping the `localStorage` token, exposing `isAuthenticated`/`user`/`logout()`, and use it to build a real `<ProtectedRoute>`.
2. Adopt a server-state library (React Query or SWR) for at least the family-tree and person-profile data — this alone would remove most of the full-refetch-after-mutation pattern via automatic cache invalidation + optimistic updates.
3. Keep `ToastContext` as-is; it's small and fit for purpose.

---

## 5. Backend Architecture

### 5.1 API structure

29 endpoints across 10 route files, mounted under `/api/*`. See `SECURITY_AUDIT.md` for the full endpoint-by-endpoint auth/validation/ownership matrix — it is the single most important table in this audit.

### 5.2 Authentication

JWT, stateless, 24h expiry, `bcrypt(10)` password hashing, no refresh-token flow, no server-side revocation. `verifyToken` middleware (`authMiddleware.js:6-27`) attaches `req.user = {id, email, iat, exp}` — no roles/tenant claims, which is structurally why per-resource authorization has to be implemented manually per controller (and mostly isn't — see §5.3 and SECURITY_AUDIT.md).

### 5.3 Authorization

**Only the `families` resource checks ownership** (`WHERE created_by = $user_id`). Every other resource — persons, relationships, memories, events, reminders, GEDCOM import, family-tree, and legacy messages — accepts any valid JWT and never verifies the requested resource belongs to the caller. `legacy_messages` additionally has **no authentication at all**. This is the single most consequential architectural gap in the codebase; full detail in `SECURITY_AUDIT.md` §2.

### 5.4 Validation

`express-validator` is used on only 3 of 11 route files (auth, families-create, persons). The remaining 8 route files rely on ad hoc manual presence checks or nothing at all.

### 5.5 Database communication

Single `pg.Pool` (default sizing, `max: 10`), parameterized queries throughout except one dynamic-column-name defect in `personModel.updatePerson`. Only one code path (GEDCOM import) uses an explicit transaction; it's implemented correctly (proper checkout/commit/rollback/release).

### 5.6 Error handling

Two coexisting conventions: some controllers `next(error)` to a centralized `errorHandler` (which unconditionally leaks `err.message` to the client, gating only `.stack`), others hand-roll try/catch with per-branch generic messages. No structured logging (pure `console.log`/`console.error`), no request IDs, no APM/error-tracking integration, no DB-connectivity health check.

### 5.7 Logging

None beyond `console.*`. No log levels, no correlation IDs, no external aggregation (Sentry/Datadog/etc. confirmed absent).

---

## 6. Graph Rendering — Deep Dive

This is the product's centerpiece, so it gets its own section (per the audit brief).

### 6.1 Library reality check

The app declares `dagre` and `elkjs` as dependencies but **uses neither** (zero references in `frontend/src`, confirmed by grep). `reactflow` is used purely as the rendering/interaction canvas (nodes, edges, pan, zoom, minimap, custom node/edge types) — **not** for automatic layout. All layout math is hand-written in `frontend/src/components/FamilyTree.js:32-255`.

### 6.2 The layout pipeline, step by step

```
computeLayout(nodes, edges)
  1. buildAdjacency        → parentOf[], childOf[], sameGen[] maps from edge relationship_type
  2. assignGenerations     → BFS from root nodes (no-parent nodes); cycle-safe via a
                              per-node visit cap of 50; disconnected/orphan nodes fall
                              back to generation 0
  3. groupByGeneration     → bucket node IDs by computed generation
  4. initialXPositions     → naive equidistant placement per row
  5. pre-sort pass         → re-order each generation by its members' parents' average
                              x-position (untangles "DB insertion order" before physics runs)
  6. iterativeLayout       → 10 passes × (top-down pull-to-parent-midpoint,
                              bottom-up pull-to-child-midpoint) × resolveCollisions
  7. resolveCollisions     → up to 15 passes of symmetric pairwise push-apart per row
  8. final collision sweep → one more pass across all generations
  9. → {x, y} = {xPos - NODE_W/2, generation * V_SPACING}
```

This is a legitimate **Sugiyama-style layered/barycenter layout with a custom collision solver** — a real algorithm, competently implemented, not a toy. `PersonNode` rendering, edge hover tooltips, focus mode, search-and-center, and PNG export are all built on top of it inside the same file.

### 6.3 Node & edge generation

Nodes/edges originate server-side from `GET /api/family-tree/:family_id` → `utils/treeBuilder.js`, which does two flat `SELECT`s (persons, relationships for the family) and maps them to `{id, data: {person}}` nodes and `{source, target, data: {relationship_type}}` edges — normalizing `'child'`-type edges so `source` is always the semantic parent (an invariant the frontend layout code depends on but which is not enforced by any shared type/contract).

### 6.4 Positioning, zoom, pan, animations

Positioning is 100% custom (§6.2). Zoom/pan/minimap/fit-view are all native ReactFlow features, configured but not customized beyond min/max zoom bounds and a generation-colored minimap. Animations: edge "flow" animation on parent/child edges (CSS-based, ReactFlow built-in), a `slideInRight` panel entrance, `fadeInUp`/`nodeIn` keyframes injected per-component (and in `PersonNode.js`'s case, **redundantly re-injected per node instance** — a real, if minor, DOM-bloat smell).

### 6.5 Complexity and scaling limits

Worst case: **O(300 · g · m log m)** where *g* = generation count, *m* = largest single-generation size. Degrades toward O(n log n) run ~300 times when nodes collapse into few generations (exactly what happens with many disconnected/orphan nodes, common in real GEDCOM imports with data gaps). At n≈1,000 in a wide/shallow shape, this is millions of comparison operations run **synchronously on the main thread inside a `useMemo`**, with no Web Worker offload — likely to produce visible jank. See `PERFORMANCE_REPORT.md` and `SCALABILITY_REPORT.md` for concrete thresholds.

### 6.6 Known correctness gaps

- Orphan/disconnected nodes are dumped into generation 0 alongside true tree roots — visually confusing for large imperfect imports.
- No "family unit" (couple + their shared children) grouping constraint — multi-marriage/remarriage scenarios can produce tangled, crossing layouts since only pairwise collision-avoidance and midpoint-pulling exist, with no contiguity guarantee.
- Full re-layout on every mutation (no incremental layout), compounded by the app's full-refetch-per-mutation data pattern.

---

## 7. Deployment Topology

Three deployment targets exist in this repo simultaneously, with materially different runtime guarantees:

| Target | Config | Compatible with local-disk uploads? | Compatible with `node-cron`? |
|---|---|---|---|
| Docker Compose (local/single-host) | `docker-compose.yml` | Yes (single container, but not if scaled to N replicas) | Yes (but duplicates fire if scaled to N replicas, no distributed lock) |
| Standalone Docker (backend + frontend images) | `backend/Dockerfile`, `frontend/Dockerfile` | Yes, single instance only | Yes, single instance only |
| Vercel serverless | `vercel.json` | **No** — ephemeral, largely read-only FS; uploads will fail or vanish | **No** — no long-lived process to keep the schedule alive |

This mismatch is invisible from reading any single file in isolation; it only surfaces by cross-referencing `vercel.json` against the upload routes and the cron job. If Vercel is the intended production target (per `README.md`'s deployment guide, which recommends Render/Railway for backend rather than Vercel — a point of internal inconsistency, since `vercel.json` exists at all), uploads must move to object storage and the cron job must move to a Vercel Cron / external scheduler before that target is viable.

---

## 8. Production Readiness Score

| Category | Score /10 | Rationale |
|---|---|---|
| **Architecture** | 6 | Clean layered pattern where applied; inconsistent adoption (2 backend features skip the service layer, half the frontend API surface bypasses its service module); no formal state-management or migration strategy |
| **Frontend** | 5 | Strong graph-rendering engineering and real code-splitting; undermined by two God components, zero working tests, dead code/dependencies, and several live UI bugs shipped to users |
| **Backend** | 5 | Consistent structure and correct parameterized SQL almost everywhere; undermined by a severe authorization gap across most resources and one confirmed SQL-injection-class defect |
| **Database** | 4 | Sound normalization for an MVP; no indexes on any foreign key, no migration framework, no `updated_at`/audit trail, relationship model allows cycles/duplicates |
| **Performance** | 5 | The core algorithm (graph layout) is well-memoized; undermined by full-refetch-after-every-mutation, N+1 patterns on both tiers, and un-throttled mousemove state on the first-impression Login/Register screens |
| **Maintainability** | 5 | Reasonably readable code with consistent naming; two God components, inconsistent error-handling conventions, and duplicated logic (modals, reminder queries, mouse-spotlight effects) raise the cost of future changes |
| **Security** | **3** | Prior audit's fixes are real and verified, but this pass found a pervasive IDOR pattern across nearly every resource, one unauthenticated route family, and a genuine SQL-injection vector — these are launch-blocking |
| **UI** | 6 | Distinctive, cohesive dark glassmorphic visual identity, consistently responsive breakpoints; let down by zero accessibility attributes, style-system drift (raw hex vs Tailwind tokens), and light-themed components rendering inside the dark shell |
| **Developer Experience** | 4 | No CI, no working tests, no `npm test` script, no migration tooling, two redundant/inconsistent demo-seed scripts, a stale `.env.example` variable name |
| **Scalability** | 3 | Stateless JWT auth is the one genuine scaling strength; local-disk uploads, an uncoordinated cron job, and zero pagination anywhere are hard blockers past a small user base — see `SCALABILITY_REPORT.md` |
| **Documentation** | 5 | A thorough, well-written README — but it advertises a "Granular RBAC collaboration" feature that does not exist in the schema or code, and the Swagger spec covers under half the real API surface |
| **Testing** | **1** | Backend: one environment-coupled, happy-path-only integration test file with no `npm test` script or CI. Frontend: both test files fail to even execute (confirmed by running them), and their assertions target a superseded UI design even where they would otherwise pass |
| **Overall** | **4.3** | A well-styled, functionally impressive demo/MVP with one genuinely strong subsystem (the graph engine) sitting on top of a database and API layer that is **not production-ready from a security or data-integrity standpoint** — the authorization gaps and SQL-injection defect are must-fix-before-launch items, not polish items |

---

## Appendix — Sources

This document synthesizes two independent deep-research passes (backend and frontend), each produced by reading every source file in its respective tree and verifying non-trivial claims empirically (running the test suite, grepping for dependency usage, spot-checking `node_modules` internals, and inspecting `git ls-files`) rather than inferring from file names alone. See `TECHNICAL_DEBT.md`, `PERFORMANCE_REPORT.md`, `SECURITY_AUDIT.md`, and `SCALABILITY_REPORT.md` for the full itemized findings this document summarizes.
