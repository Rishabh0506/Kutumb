# Kutumb — Performance Report

> Scope: backend (Node/Express/PostgreSQL) and frontend (React SPA). Findings are ranked by estimated real-world impact, not by where they live in the code. File:line citations are relative to `backend/` or `frontend/`.

---

## Executive summary

The single biggest lever in this codebase is the **full-refetch-after-every-mutation pattern** on the frontend: it compounds a network round trip with a full O(n log n)-class graph re-layout, on every add/edit/delete action, on both of the app's two main data-heavy screens. Fixing this one pattern (via optimistic updates or a proper cache library) would likely deliver more perceived-speed improvement than any other single change in this report. The second biggest lever is adding indexes to the database — currently every list/lookup query is a sequential scan waiting to happen at scale.

The graph layout algorithm itself, and its memoization, are well-engineered — this is not where the risk lives. The risk is in *how often* it's forced to re-run, and *what feeds it*.

---

## 1. Highest-impact issues

### 1.1 Full data re-fetch after every mutation (frontend)

**Where**: `frontend/src/pages/FamilyTreePage.js` — `handleCreatePerson`, `handleCreateRelationship`, `handleAddPersonFromGraph` (lines ~343-371) all end with a full `fetchTree(selectedFamily)` call. `frontend/src/pages/PersonProfile.js:888-889,895-896` does the same after every relationship edit/delete.

**Why it matters**: there is no server-state cache (no React Query/SWR) and no optimistic local state patching. Every single-node add re-fetches the *entire* tree from the network, which:
1. Costs a full HTTP round trip for data the client already mostly has.
2. Forces `FamilyTree.js`'s `useMemo([incomingNodes, incomingEdges])` to see new array identities (even if the actual data barely changed), which reruns `computeLayout()` — the full 10-pass × 15-pass layered layout algorithm — **from scratch, for the whole tree**, not just the new node.

**Estimated impact**: for a tree of a few hundred members, adding one person could visibly stall the UI for a non-trivial fraction of a second — entirely avoidable. This is the single highest-leverage fix available in the codebase.

**Fix direction**: adopt React Query or SWR for `getFamilyTree`, and either (a) let the library's cache + targeted invalidation avoid redundant fetches, or (b) optimistically append the new node/edge to local state immediately and reconcile with the server response in the background, rather than blocking on a full refetch.

### 1.2 Graph layout algorithm complexity at scale

**Where**: `frontend/src/components/FamilyTree.js:147-255` (`resolveCollisions`, `iterativeLayout`, `computeLayout`).

**Complexity**: worst case **O(300 · g · m log m)**, where *g* = generation count and *m* = the largest single generation's size (10 physics passes × 2 directions × up to 15 collision-resolution passes each). This is comfortably sub-second for a "typical" pedigree shape (g ≈ m ≈ √n). It degrades toward **O(n log n) run ~300 times** when nodes collapse into few generations with one large row — which is exactly what happens when a tree has many disconnected/orphan nodes (common after a real-world GEDCOM import with data gaps) or is naturally wide-and-shallow (many cousins at the same generation).

**Estimated impact**: at n≈1,000 nodes in that worst-case shape, this is roughly 3,000,000 comparison/swap operations, run **synchronously on the main thread inside a `useMemo`**, with no Web Worker offload. This is likely to produce a noticeable stall (tens to low hundreds of ms) on layout recompute; at n≈5,000+, this could run into full seconds of jank.

**Fix direction**: (a) cap or short-circuit the physics passes once the layout has visibly converged (the code already has an early-exit inside `resolveCollisions` when a pass makes no moves — extend the same idea to `iterativeLayout`'s outer loop); (b) for large trees, move `computeLayout` into a Web Worker so it doesn't block the main thread; (c) consider incremental layout (only re-position affected subtrees) instead of full recompute on every data change — this pairs naturally with fixing §1.1.

### 1.3 Backend N+1 query pattern — event timeline

**Where**: `backend/controllers/eventController.js:22-64`. Loops over every person in a family and issues a separate `memoryService.getMemoriesByPerson(person.id)` call per person (line 46), instead of one batched `WHERE family_id = $1` query — which already exists (`memoryModel.getMemoriesByFamily`, `memoryModel.js:42-50`) and could be reused directly. The code's own comment (lines 17-19) acknowledges the better approach was skipped.

**Estimated impact**: for a family with N persons, this is 1 + N queries where 2 would do. At N=50 this is 51 sequential round trips to Postgres for a single "get my family's timeline" request.

**Fix direction**: replace the per-person loop with the existing `getMemoriesByFamily` call, then group results in application code.

### 1.4 Client-side N+1 fetch pattern — person profile

**Where**: `frontend/src/pages/PersonProfile.js:834-839`. `fetchProfileData` does an initial `Promise.all` across 4 endpoints, then a **second wave** of parallel `Promise.allSettled` calls — one `api.get('/persons/:id')` per related person, to resolve names/photos for the family panel and mini-tree.

**Estimated impact**: a well-connected family member (e.g. a patriarch/matriarch with 10 relationships) triggers 10 additional HTTP round trips on every profile view — exactly the users most likely to be viewed.

**Fix direction**: add a batch "get persons by ids" endpoint (`GET /api/persons?ids=a,b,c`) and use it instead of N individual fetches.

---

## 2. Database performance

### 2.1 Zero indexes on foreign keys

**Where**: `backend/schema.sql` — every FK column is unindexed: `persons.family_id`, `relationships.person1_id`/`person2_id`, `memories.family_id`/`person_id`, `legacy_messages.person_id`, `families.created_by`.

**Impact**: every `WHERE family_id = $1` / `WHERE person1_id = $1 OR person2_id = $1` / `WHERE created_by = $1` query — used throughout every model in the app — will degrade from an index scan to a sequential scan as tables grow. Invisible at demo scale (dozens of rows), a certain bottleneck once any family has hundreds of members or the platform has more than a handful of active families.

**Fix**: add B-tree indexes on all 6 listed FK columns. This is a single migration, low risk, high payoff — should be one of the very first performance changes made regardless of current scale.

### 2.2 Connection pool held for the duration of sequential GEDCOM inserts

**Where**: `backend/controllers/gedcomController.js:13-106`. `pool.connect()` checks out a dedicated client for the entire import, then runs a **sequential** per-row loop of duplicate-check + insert queries inside it, with no batching.

**Impact**: for a GEDCOM file with hundreds/thousands of individuals, this holds one of only 10 default pool connections for the entire (potentially multi-second-to-minutes) duration. Several concurrent large imports could exhaust the pool and start blocking/timing out unrelated requests.

**Fix**: batch inserts (`INSERT ... VALUES (...),(...),...` or `UNNEST`-based bulk insert) instead of one row at a time.

### 2.3 No pagination anywhere

**Where**: `getPersonsByFamily`, `getMemoriesByFamily`, `getMemoriesByPerson`, `getRelationshipsByPerson`, `buildFamilyTreeData`, `getFamilies` all `SELECT *` with no `LIMIT`/`OFFSET`/cursor. Only `searchPersons` has a `LIMIT 20`.

**Impact**: every one of these endpoints returns its full result set regardless of size — fine today, a real problem once any family has hundreds of members or a user has dozens of families.

**Fix**: add `LIMIT`/`OFFSET` or cursor-based pagination to at minimum `getFamilies` and `getPersonsByFamily`.

---

## 3. Frontend rendering performance

### 3.1 Un-throttled `mousemove` state on Login/Register

**Where**: `frontend/src/pages/Login.js:18-23`, `Register.js:19-24`, `Dashboard.js:188-189` — all call `setMousePos` directly inside the native `mousemove` handler with no `requestAnimationFrame` gate or debounce.

**Impact**: these are the very first screens every user sees. Each one re-renders its entire page component tree at native mouse-event frequency (potentially 60-120+ Hz) while the mouse moves — first-impression jank on lower-powered devices.

**Fix**: the codebase already contains the correct pattern — `FamilyTreePage.js`'s `InteractiveBackground` (lines 266-279) is `requestAnimationFrame`-gated and isolated via `React.memo`. Apply the same pattern to the other three files.

### 3.2 Missing `React.memo` on the majority of components

**Where**: only `PersonNode`, `CustomEdge`, `NodeSidePanel`, `GraphControls`, `GraphSearch` (all in `FamilyTree.js`) and `InteractiveBackground` (`FamilyTreePage.js`) are memoized. All 19 inline components in `PersonProfile.js`, `Dashboard.js`'s `LineageCard`/`CardLineageCanvas`, and most smaller feature components are not.

**Impact**: any state change in a parent (a single keystroke in an edit field, a toast firing) re-renders the full subtree. Most noticeable in `PersonProfile.js` given its size and the number of inline components involved.

**Fix**: wrap presentational sub-components in `React.memo` once they're extracted to their own files (this pairs naturally with the God-component split recommended in `TECHNICAL_DEBT.md` H6).

### 3.3 Inline callback props without `useCallback`

**Where**: `frontend/src/pages/FamilyTreePage.js:469-476` (`onAddPerson`, `onAddRelationship` passed to `<FamilyTree>`) and `:425` (`onActivity` passed to `CollaborationPanel`) are recreated on every render, inconsistent with sibling handlers in the same file that *are* memoized.

**Impact**: minor on its own, but combined with §3.2's lack of `memo()` on receiving components, contributes to unnecessary re-render cascades.

**Fix**: wrap in `useCallback` for consistency with the rest of the file.

### 3.4 `FamilyTreeInner`'s per-render callback identities defeat `PersonNode`'s memoization

**Where**: `frontend/src/components/FamilyTree.js:541-542` — `onSelect`/`onAddRelative` are recreated inside the `useEffect` that formats nodes, on every relevant state change (hover, selection, focus mode).

**Impact**: this produces new `data` object references for **every** node on **any** hover/selection change anywhere in the graph — defeating `PersonNode`'s `React.memo` wrap for the whole node set exactly when it matters most (interactive hover feedback).

**Fix**: hoist the callback creation out of the per-render node-mapping loop, or use a stable ref-based dispatch pattern so `data.onSelect` doesn't change identity on every hover.

---

## 4. Bundle size

Contrary to a common assumption for CRA apps, **route-level code-splitting is present and working** — every page is `React.lazy()`-loaded (`frontend/src/App.js:8-13`), confirmed by inspecting the production `build/` output (a separate chunk exists alongside the main bundle). This significantly de-risks bundle-size concerns compared to a naive CRA setup.

Remaining bundle risk is low: `dagre`/`elkjs` (declared, unused) only bloat `node_modules`/install time, not the shipped bundle, since unused imports are never pulled into a chunk by webpack's tree-shaking. `reactflow` (a moderately large library) is appropriately isolated inside the lazy-loaded `FamilyTreePage` chunk.

**Fix**: remove `dagre`/`elkjs` from `package.json` for install-time and `node_modules` hygiene (see `TECHNICAL_DEBT.md` M1) — this does not meaningfully change the shipped bundle size, but it removes a misleading signal for future readers of `package.json`.

---

## 5. Images

`loading="lazy" decoding="async"` is used consistently on the app's `<img>` tags (`PersonNode.js:88`, `PersonProfile.js:43,102`, `MemoryTimeline.js:51`) — a deliberate, correct touch. There is no responsive `srcset`/size optimization and no client-side compression before upload (`UploadableAvatar.handleFile` uploads the raw `File` object as-is) — low priority today given the small number of images per profile, but worth revisiting once photo uploads are moved to object storage (`TECHNICAL_DEBT.md` H3), which is a natural point to add a resize/compress step.

---

## 6. Monitoring / observability gap

There is currently **no way to measure any of the above in production** — no APM, no Sentry/Datadog, no structured logging with timing data, and `web-vitals` is imported but never actually invoked with a reporting callback (`frontend/src/index.js:25`, `reportWebVitals.js:2` — confirmed dead wiring). Before optimizing further, wiring up basic web-vitals reporting and backend request-timing logs would let the team validate which of the above fixes actually move the needle, rather than optimizing by intuition alone.

---

## Summary — ranked by estimated payoff

| Rank | Fix | Effort | Payoff |
|---|---|---|---|
| 1 | Stop full-refetch-after-every-mutation (optimistic updates or React Query) | M | **Highest** — compounds network + layout cost, affects every write action |
| 2 | Add indexes on all FK columns | S | **High** — near-zero risk, unblocks all future scale |
| 3 | Fix backend N+1 in `eventController` | S | Medium — cheap fix, existing helper function already available |
| 4 | Throttle mousemove on Login/Register | S | Medium — first-impression quality, cheap fix, pattern already exists in-repo |
| 5 | Batch person-lookup endpoint for `PersonProfile`'s N+1 fetch | M | Medium — most visible on well-connected family members |
| 6 | Web Worker offload for large-tree layout | L | Medium — only matters once trees reach hundreds/thousands of nodes |
| 7 | Wire up `web-vitals` reporting | S | Enables measuring everything else |
