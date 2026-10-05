# Kutumb — Technical Debt Register

> Every issue found across both research passes, ranked by priority. "Impact" describes what breaks/leaks if left unaddressed; "Effort" is a rough sizing (S = hours, M = 1–3 days, L = a week+) for a single engineer familiar with the codebase. File:line citations are relative to `backend/` or `frontend/`.

---

## 🔴 Critical (fix before any real user data touches this app)

| # | Issue | File:line | Impact | Effort |
|---|---|---|---|---|
| C1 | `legacy_messages` routes have **no auth middleware at all** | `backend/routes/legacyRoutes.js:5-6` | Anyone on the internet, no login required, can create/read legacy messages for any person ID | S |
| C2 | **Pervasive IDOR**: every resource except `families` never checks the requesting user owns the family/person/relationship/memory being accessed | `backend/controllers/personController.js`, `relationshipController.js`, `memoryController.js`, `eventController.js`, `reminderController.js`, `gedcomController.js`, `routes/familyTreeRoutes.js` (all missing ownership checks) | Any authenticated user can read/write/delete any other user's family data, photos, relationships, memories | M–L (needs a consistent middleware/pattern, not just per-file patches) |
| C3 | **Cross-tenant data leak** via person search | `backend/models/personModel.js:122-136` | `GET /api/persons/search` returns matches from *every* family on the platform, not just the caller's | S |
| C4 | **SQL injection via dynamic column names** in `updatePerson` | `backend/models/personModel.js:75-100` | Client-supplied JSON keys are interpolated directly into SQL as column identifiers, unwhitelisted — a real, reachable injection surface (CWE-89 identifier-injection variant) | S |
| C5 | Centralized error handler leaks raw internal error text in production | `backend/middleware/errorHandler.js:11-15` | Postgres/driver error strings (schema details, constraint names) exposed to any client hitting a route that uses `next(error)` | S |
| C6 | Frontend test suite is **100% broken** — both files fail to even load | `frontend/src/App.test.js`, `frontend/src/tests/components.test.js` | Zero real coverage exists today despite tests appearing to exist on a source read; nothing catches regressions | S (fix resolution) + M (rewrite stale assertions) |
| C7 | DB password never rotated from a 4-digit default | `backend/.env:6` (`DB_PASSWORD=2306`) | Trivially guessable DB credential, flagged in the prior audit and still open | S |

---

## 🟠 High

| # | Issue | File:line | Impact | Effort |
|---|---|---|---|---|
| H1 | Uploaded user photos already committed to git history | `backend/uploads/persons/*.jpg` (confirmed via `git ls-files`) | Real user PII permanently in git history even though `.gitignore` now excludes the folder going forward | M (history rewrite + process fix) |
| H2 | GEDCOM upload filename built from unsanitized `file.originalname` | `backend/routes/gedcomRoutes.js:9-17` | Path-traversal / arbitrary-file-write risk via multer's raw `path.join` | S |
| H3 | Local-disk file storage is incompatible with horizontal scaling and the Vercel deployment target | `backend/server.js:65`, `routes/personRoutes.js:23`, `routes/gedcomRoutes.js:11`, `vercel.json` | Photos uploaded to one instance are invisible on another; uploads likely fail outright on Vercel's ephemeral FS | L (move to S3/R2 + migration) |
| H4 | `node-cron` reminder job has no distributed lock | `backend/cron/reminderCron.js:5-59`, `server.js:107` | Harmless today (logs only); becomes N duplicate real emails per replica the moment email sending is implemented | M |
| H5 | No indexes on any foreign key across the entire schema | `backend/schema.sql` (persons.family_id, relationships.person1_id/person2_id, memories.family_id/person_id, legacy_messages.person_id, families.created_by) | Every list/lookup query degrades to a sequential scan as data grows | S (add indexes) |
| H6 | Two God components | `frontend/src/pages/PersonProfile.js` (1,147 lines / 19 inline components), `FamilyTreePage.js` (502 lines) | High change risk, no independent testability, slow onboarding for new engineers | L |
| H7 | No client-side route guard | `frontend/src/App.js` (no `ProtectedRoute` anywhere) | Protected pages render their shell before a reactive 401 redirect kicks in; any future page section without an API call would never redirect at all | S |
| H8 | JWT stored in `localStorage`, not an httpOnly cookie | `frontend/src/pages/Login.js:33`, `api/api.js:10` | Any future XSS-capable bug (including a supply-chain-compromised dependency) can read the token directly with no additional exploit needed | M (requires backend cookie-auth support) |
| H9 | Full data re-fetch after every mutation, on both the family-tree page and person profile | `frontend/src/pages/FamilyTreePage.js` (fetchTree after every handler), `PersonProfile.js:888-889,895-896` | Compounds a network round-trip with a full O(n log n)-class graph re-layout after every single add/edit | M (needs optimistic updates or a cache library) |
| H10 | No migration framework — schema changes require hand-written SQL run manually | `backend/schema.sql` + 4 ad hoc scripts | No versioning, no rollback, no safe path for future schema evolution | M (adopt node-pg-migrate or similar) |
| H11 | README advertises a feature that doesn't exist | `README.md:10` ("Granular Role-Based Access controls") vs. no RBAC/collaborators table anywhere in the schema | Sets false stakeholder/user expectations | S (fix docs) or L (build the feature) |
| H12 | Mass-assignable `photo_url` field with no URL validation | `backend/models/personModel.js:19,32`, no validator in `routes/personRoutes.js:70-105` | A malicious `photo_url` (e.g. `javascript:`/tracking-pixel URL) is stored and rendered verbatim as an `<img src>` | S |

---

## 🟡 Medium

| # | Issue | File:line | Impact | Effort |
|---|---|---|---|---|
| M1 | `dagre` and `elkjs` are dead dependencies | `frontend/package.json` | Bloats `node_modules`/install time for no benefit; misleads anyone reading `package.json` about how layout works | S (remove) |
| M2 | `@heroicons/react` likely unused | `frontend/package.json` | Same as above, smaller impact | S (verify + remove) |
| M3 | Dead component files, visually stale | `frontend/src/components/FamilyInvite.js`, `FamilyTimeline.js` | Confusing to navigate; light-theme styling that would look broken if ever re-enabled by mistake | S (delete) |
| M4 | Live light-theme styling bug against the dark app shell | `frontend/src/components/UpcomingReminders.js`, `SearchBar.js:89-91` | User-visible visual inconsistency in a mounted, real component | S |
| M5 | Non-functional UI presented as real | `CollaborationPanel.js:25-27,46-52` (mock collaborator list, unpersisted role/remove), `FamilyInsightsPanel.js:161-204` (dead buttons), `FamilyTreePage.js:297-302` (hardcoded fake activity feed) | Demo looks more complete than the product actually is — risk of overselling to stakeholders/users | M |
| M6 | Three independent hand-rolled modal implementations | `Dashboard.js:462-531`, `PersonProfile.js` `StoryModeModal`, `FamilyTree.js` `QuickAddForm` | Duplicated chrome/animation code; inconsistent UX (some use `window.confirm`/`window.prompt` instead) | M (extract shared `<Modal>`) |
| M7 | Duplicated "upcoming reminders" SQL | `backend/controllers/reminderController.js:14-31` vs `cron/reminderCron.js:10-36` | Two near-identical queries to keep in sync by hand | S |
| M8 | Env var name mismatch between docs and code | `frontend/.env.example:1` (`REACT_APP_API_BASE_URL`) vs actual `api/api.js:4` (`REACT_APP_API_URL`); same mismatch in root `README.md` | A new developer following the docs literally gets silent fallback to `localhost:5001`, not an error | S |
| M9 | `express-validator` used on only 3 of 11 backend route files | `backend/routes/relationshipRoutes.js`, `memoryRoutes.js`, `eventRoutes.js`, `aiRoutes.js`, `gedcomRoutes.js`, `familyTreeRoutes.js`, `reminderRoutes.js`, `legacyRoutes.js` | Inconsistent input-quality guarantees across the API; `relationship_type` accepts arbitrary strings | M |
| M10 | Inconsistent response/error envelope shapes across endpoints | `familyController.js` (`{success,data}`) vs. `personController.js`/others (bare object) | Frontend has to special-case per-resource shape; already produces an ad hoc unwrap-if-present hack in `familyService.js:9,17` | M (standardize) |
| M11 | N+1 query pattern, backend | `backend/controllers/eventController.js:22-64` (own code comment acknowledges the better approach was skipped) | 1 + N queries where 1 batched query already exists and could be reused | S |
| M12 | N+1 fetch pattern, frontend | `frontend/src/pages/PersonProfile.js:834-839` | One extra HTTP round-trip per relationship on every profile view | M |
| M13 | Un-throttled `mousemove` state updates on first-impression pages | `frontend/src/pages/Login.js:18-23`, `Register.js:19-24`, `Dashboard.js:188-189` | Full page re-render at native mouse-event frequency; `FamilyTreePage.js` shows the correct (throttled) pattern already exists in the codebase, just not applied everywhere | S |
| M14 | No `React.memo` on the majority of components | `PersonProfile.js`'s 19 inline components, `Dashboard.js`'s `LineageCard`, most feature components | Unnecessary re-renders on unrelated parent state changes | M |
| M15 | Two redundant, inconsistent demo-seed scripts | `backend/migrate_demo.js` vs `setup_demo_user.js` (the latter inserts a non-bcrypt literal `'demo_hash'`, producing a login-broken account) | Foot-gun for whoever runs the "wrong" script | S (delete one, document the other) |
| M16 | Relationship model allows cycles and duplicates | `backend/schema.sql:35-42`, no app-level check in `relationshipService`/`relationshipModel` | Data integrity risk; a cyclic graph handed to the frontend layout is only mitigated client-side by a visit cap, not prevented at the source | M |
| M17 | GEDCOM parser doesn't extract death dates; fails entire import on approximate/uncertain GEDCOM dates | `backend/utils/gedcomParser.js:17-49`, `gedcomController.js:58` | Common, realistic genealogical data (`ABT 1900`-style dates) will abort the whole import, not just the affected record | M |
| M18 | `xss-clean` dependency is unmaintained | `backend/package.json` | Common source of `npm audit`/Snyk flags; a maintained, targeted alternative (e.g. `express-validator`'s `.escape()`, already used elsewhere) exists | S |
| M19 | No `.dockerignore` anywhere in the repo | (confirmed via `find`) | `.env`, already-committed `uploads/` photos, and `node_modules` risk being baked into Docker image layers | S |
| M20 | Accessibility is essentially absent | Confirmed zero `aria-*` attributes anywhere in `frontend/src` | Screen-reader users cannot use modals, toasts, or the search dropdown; no focus trapping | L (systematic pass needed) |

---

## 🟢 Low

| # | Issue | File:line | Impact | Effort |
|---|---|---|---|---|
| L1 | Stale/incorrect code comment (says "next 30 days," filters 45) | `backend/controllers/reminderController.js:11,58` | Minor confusion for future maintainers | S |
| L2 | Fragile string-matching error classification, duplicated 3x | `personController.js:14`, `relationshipController.js:15`, `memoryController.js:14` | Breaks silently if a message is reworded; a typed error class would be more robust | S |
| L3 | Dead/vestigial code | `frontend/src/pages/PersonProfile.js:740-741` (`const _api = api;`) | No functional impact, just noise | S |
| L4 | Stale speculative comment left in shipped code | `frontend/src/services/familyService.js:38-42` | Signals unresolved integration uncertainty that was never revisited | S |
| L5 | Per-node-instance duplicate `<style>` injection | `frontend/src/components/PersonNode.js:75-77` | Minor DOM bloat; should be a single global stylesheet rule | S |
| L6 | Color-consistency drift between Tailwind's `rose-500` and hand-written `rgba(225,29,72,...)` glow values | Scattered across ~50 locations | Subtle visual inconsistency; no functional impact | M (consolidate into design tokens) |
| L7 | `web-vitals` imported but never actually invoked with a callback | `frontend/src/index.js:25`, `reportWebVitals.js:2` | Unconfigured CRA boilerplate; zero performance telemetry is actually collected | S |
| L8 | Global, unscoped `ResizeObserver` error suppressor | `frontend/src/index.js:8-12` | Could mask unrelated bugs that happen to throw a similarly worded error | S |
| L9 | Swagger docs cover under half the real API surface | `backend/swagger.yaml` (missing memories, events, ai, reminders, legacy) | Low impact since Swagger UI is dev-only, but signals docs aren't kept in sync | M |
| L10 | Inconsistent resource addressing style (`query param` vs `path param` for `family_id`) | `GET /api/events?family_id=` vs `GET /api/persons/family/:family_id` | Minor REST-consistency nit | S |

---

## Summary counts

| Priority | Count |
|---|---|
| 🔴 Critical | 7 |
| 🟠 High | 12 |
| 🟡 Medium | 20 |
| 🟢 Low | 10 |
| **Total** | **49** |

See `IMPROVEMENT_ROADMAP.md` for how these map onto a phased execution plan.
