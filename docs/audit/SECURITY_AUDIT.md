# Kutumb — Security Audit (Staff-Engineer Deep Pass)

> This document supersedes and extends the prior audit at `/security_audit.md` (root of the repo, dated prior to this pass). That audit fixed real critical/high issues (JWT fallback secret, wildcard CORS, leaking error messages *in authController*, missing xss-clean, oversized JSON bodies, exposed Swagger, permissive rate limits, weak Helmet config) and its fixes are verified as still in place below. This pass looked at **authorization end-to-end per resource** rather than security controls in isolation, and found several new, more severe issues as a result.
>
> **Read this document before `security_audit.md`.** The prior audit's remaining "Recommended (before production)" list is folded into this one, with status updates.

---

## 0. Headline: what's actually blocking a safe launch

1. **`legacy_messages` has no authentication at all.** Anyone, unauthenticated, can create/read legacy messages for any person.
2. **Pervasive IDOR (Insecure Direct Object Reference)** — every resource except `families` trusts a bare valid JWT and never checks the requested resource belongs to the caller. Any registered user can read/write/delete any other user's family data.
3. **Cross-tenant data leak** via person search — zero family scoping.
4. **A genuine SQL-injection-class defect** in `updatePerson` — client-supplied JSON keys are interpolated into SQL as column identifiers, unwhitelisted.
5. **The centralized error handler still leaks raw internal error text** in production for any route that uses the idiomatic `next(error)` pattern.

Items 1–4 are launch-blocking. Fix them before this application stores any real family's data.

---

## 1. Status of the prior audit's findings

| # | Prior finding | Status now |
|---|---|---|
| Critical 1 | JWT fallback secret hardcoded | ✅ Fixed — throws fatal error if `JWT_SECRET` unset (`backend/services/authService.js:53-55`) |
| Critical 2 | Wildcard CORS | ✅ Fixed — origin whitelist via `ALLOWED_ORIGINS` (`backend/server.js:44-57`) |
| Critical 3 | Internal error messages leaked | ⚠️ **Partially fixed** — fixed inside `authController.js`'s manual catch blocks only. The shared `errorHandler.js` (used by `aiController`, `gedcomController`, `eventController`, `familyTreeRoutes`) still leaks `err.message` unconditionally. See §5 below — **this is effectively still open**. |
| High 4 | No XSS input sanitization | ✅ Fixed — `xss-clean` registered (though see §9, the package itself is unmaintained) |
| High 5 | No JSON body size limit | ✅ Fixed — `express.json({limit:'10kb'})` |
| High 6 | Swagger UI exposed in production | ✅ Fixed — gated on `NODE_ENV !== 'production'` |
| High 7 | Auth rate limit too permissive | ✅ Fixed — tightened to 15/15min |
| High 8 | No 401 auto-logout on frontend | ✅ Fixed — Axios response interceptor (`frontend/src/api/api.js:40-47`) |
| Medium 9 | Permissive Helmet config | ✅ Fixed — full CSP/HSTS/X-Frame-Options/Referrer-Policy configured |
| Medium 10 | Missing `NODE_ENV`/`ALLOWED_ORIGINS` | ✅ Fixed — both present in `.env` |
| Recommended 1 | Rotate `JWT_SECRET` | ✅ Done — 128-char random hex in `.env:11` |
| Recommended 2 | Rotate DB password | ❌ **Still open** — `DB_PASSWORD=2306` in `.env:6` |
| Recommended 3 | Enable HTTPS/TLS | Not verifiable from source — depends on hosting config at deploy time |
| Recommended 4 | Set `NODE_ENV=production` | ✅ Done — present in `.env:2` |
| Recommended 5 | Set `ALLOWED_ORIGINS` to real domain | Not verifiable from source — depends on deployed env config |
| Recommended 6 | Add `REACT_APP_API_URL` to hosting env | Partially — but note the `.env.example` documents the **wrong variable name** (`REACT_APP_API_BASE_URL`), see §8 |
| Recommended 7 | `npm audit fix` | Not run as part of this pass — recommend running before launch |
| Recommended 8 | Input validation on all mutation routes | ⚠️ **Partially done** — persons/families got coverage since the prior audit; relationships, memories, events, ai, gedcom, reminders, legacy remain essentially unvalidated (§4) |
| Recommended 9 | Add ownership checks | ⚠️ **Partially done** — `families` only. This is now the single biggest open item; see §2. |
| Recommended 10 | Rate-limit uploads separately | ✅ Done — dedicated `uploadLimiter` on the photo route (though not on GEDCOM import, see §6) |
| Recommended 11 | Move uploads to object storage | ❌ **Still open**, and now confirmed **materialized as risk**, not just theoretical — real user photos are already committed to git (§7) |

---

## 2. Authorization — the core finding (full detail)

### 2.1 The pattern that works: `families`

`familyModel.getFamilyById`/`updateFamily`/`deleteFamily` (`backend/models/familyModel.js:43-85`) all take and filter on `user_id`: `WHERE id = $1 AND created_by = $2`. All four family CRUD operations correctly pass `req.user.id` through from the controller. **This is the model every other resource should follow and currently doesn't.**

### 2.2 The pattern that's missing everywhere else

| Resource | Endpoint(s) | Ownership check? |
|---|---|---|
| Persons | `GET/PUT/DELETE /api/persons/:id`, `GET /api/persons/family/:family_id`, `POST /api/persons/:id/photo` | ❌ None |
| Person search | `GET /api/persons/search` | ❌ None — also no family scoping at all, see §3 |
| Relationships | `POST /api/relationships`, `GET/PUT/DELETE /api/relationships/:id` | ❌ None |
| Memories | `POST /api/memories`, `GET /api/memories/family/:id`, `GET /api/memories/person/:id`, `DELETE /api/memories/:id` | ❌ None |
| Events | `GET /api/events?family_id=` | ❌ None |
| Reminders | `GET /api/reminders/:family_id` | ❌ None |
| GEDCOM import | `POST /api/gedcom/import` | ❌ None |
| Family tree | `GET /api/family-tree/:family_id` | ❌ None |
| Legacy messages | `POST/GET /api/legacy/:person_id` | ❌ None — **and no authentication at all** |

**Practical exploit path** (all steps confirmed reachable from the endpoint inventory in §3): register a throwaway account (registration is open, no invite gate) → call `GET /api/persons/search?q=a` (no tenant scoping, returns matches across every family) → take any returned `family_id`/`person_id` → call `GET /api/persons/family/:family_id`, `GET /api/family-tree/:family_id`, `GET /api/relationships/:person_id`, `GET /api/memories/person/:person_id`, `GET /api/reminders/:family_id` — all succeed with **zero ownership verification**, fully exposing another user's family tree, photos, relationships, memories, and upcoming reminders. The same lack of checks means these resources are also writable/deletable, not just readable.

### 2.3 Recommended fix

Add a `req.user.id`-scoped check at the model layer for every resource, mirroring `familyModel`'s pattern. Concretely:
- `personModel` functions should accept and filter on the owning family's `created_by`, or the controller should first verify `family_id` belongs to `req.user.id` before proceeding (one extra `SELECT` or a `JOIN`).
- Same for relationships (via either endpoint of the relationship), memories, events, reminders, GEDCOM import, and family-tree.
- Add `verifyToken` to `legacyRoutes.js` immediately — this is a one-line fix and the single highest-priority item in this entire audit.
- Consider centralizing this as reusable middleware (e.g. `requireFamilyOwnership(familyIdParam)`) rather than repeating the check in every controller — this reduces the chance of the same gap recurring as new features are added.

---

## 3. Full endpoint inventory (auth / validation / ownership matrix)

| Method | Path | Auth | Validation | Ownership | File:line |
|---|---|---|---|---|---|
| POST | /api/auth/register | N | Y | N/A | routes/authRoutes.js:8 |
| POST | /api/auth/login | N | Y | N/A | routes/authRoutes.js:19 |
| POST | /api/families | Y | Y | N/A (create) | routes/familyRoutes.js:9 |
| GET | /api/families | Y | N | ✅ Y | routes/familyRoutes.js:18 |
| GET | /api/families/:family_id | Y | N | ✅ Y | routes/familyRoutes.js:19 |
| PUT | /api/families/:family_id | Y | N (only manual) | ✅ Y | routes/familyRoutes.js:20 |
| DELETE | /api/families/:family_id | Y | N | ✅ Y | routes/familyRoutes.js:21 |
| POST | /api/families/invite | Y | N | N/A | routes/familyRoutes.js:24-26 (no-op stub, doesn't persist) |
| POST | /api/persons/:id/photo | Y | multer type/size only | ❌ N | routes/personRoutes.js:44-64 |
| POST | /api/persons | Y | Y | ❌ N (family_id unchecked) | routes/personRoutes.js:67-83 |
| GET | /api/persons/search | Y | manual | ❌ **N — cross-tenant leak** | routes/personRoutes.js:86 |
| GET | /api/persons/family/:family_id | Y | N | ❌ N | routes/personRoutes.js:87 |
| GET | /api/persons/:person_id | Y | N | ❌ N | routes/personRoutes.js:88 |
| PUT | /api/persons/:person_id | Y | Y (partial) | ❌ N + SQLi risk | routes/personRoutes.js:90-105 |
| DELETE | /api/persons/:person_id | Y | N | ❌ N | routes/personRoutes.js:107 |
| POST | /api/relationships | Y | ❌ N | ❌ N | routes/relationshipRoutes.js:7 |
| GET | /api/relationships/:person_id | Y | N | ❌ N | routes/relationshipRoutes.js:8 |
| DELETE | /api/relationships/:relationship_id | Y | N | ❌ N | routes/relationshipRoutes.js:9 |
| PUT | /api/relationships/:relationship_id | Y | N | ❌ N | routes/relationshipRoutes.js:10 |
| POST | /api/memories | Y | ❌ N | ❌ N | routes/memoryRoutes.js:7 |
| GET | /api/memories/family/:family_id | Y | N | ❌ N | routes/memoryRoutes.js:8 |
| GET | /api/memories/person/:person_id | Y | N | ❌ N | routes/memoryRoutes.js:9 |
| DELETE | /api/memories/:memory_id | Y | N | ❌ N | routes/memoryRoutes.js:10 |
| GET | /api/events?family_id= | Y | manual | ❌ N | routes/eventRoutes.js:7 |
| POST | /api/ai/generate-biography | Y | manual | ❌ N | routes/aiRoutes.js:7 |
| POST | /api/gedcom/import | Y | manual + multer | ❌ N | routes/gedcomRoutes.js:35-49 |
| GET | /api/family-tree/:family_id | Y | N | ❌ N | routes/familyTreeRoutes.js:6 |
| GET | /api/reminders/:family_id | Y | N | ❌ N | routes/reminderRoutes.js:6 |
| POST | /api/legacy/:person_id | ❌ **N — no auth at all** | N | ❌ N | routes/legacyRoutes.js:5 |
| GET | /api/legacy/:person_id | ❌ **N — no auth at all** | N | ❌ N | routes/legacyRoutes.js:6 |

---

## 4. Validation gaps

`express-validator` covers only 3 of 11 route files (auth, families-create, persons). Notable specific gaps:
- **`relationship_type` accepts any string** (`backend/services/relationshipService.js:11-17`, no enum/whitelist) — only lower-cased `'parent'`/`'child'` are special-cased by the tree builder; anything else falls through as an unlabeled/ambiguous edge.
- Memories, events, AI biography, GEDCOM import, family-tree, reminders, and legacy messages have no `express-validator` rules at all — only ad hoc presence checks in some cases, nothing in others (legacy has zero validation of `title`/`message`/`emotion_tag`, unbounded text).

---

## 5. Error handling leak (regression of a "fixed" finding)

`backend/middleware/errorHandler.js:11-15`:
```js
res.status(err.statusCode || 500).json({
  error: true,
  message: err.message || 'Something went wrong',
  ...(NODE_ENV === 'development' && { stack: err.stack }),
});
```
Only `stack` is gated on environment — `err.message` is always returned. Routes that correctly delegate to this centralized handler via `next(error)` (`aiController.js:41`, `gedcomController.js:104`, `eventController.js:71`, `familyTreeRoutes.js:11`) will leak raw Postgres/driver error text (e.g. `invalid input syntax for type uuid`, constraint-violation text) to clients in production. The prior audit's fix for this exact issue class was applied only inside `authController.js`'s manual catch blocks, not the shared handler — so the more idiomatic Express error-handling path reintroduces the leak. **Fix**: gate `message` the same way `stack` is gated, returning a generic message in production and logging the real one server-side only.

---

## 6. File upload security

- **GEDCOM upload path traversal**: `backend/routes/gedcomRoutes.js:9-17` builds the stored filename from unsanitized `file.originalname`. Multer's disk storage does a raw `path.join(destination, filename)` (verified in `node_modules/multer/storage/disk.js:33`), so a filename containing `../` sequences can escape the intended `uploads/` directory. The `.ged`-extension check in `fileFilter` checks the same attacker-controlled string and doesn't prevent this.
- **Person photo upload**: safer (server-templated filename), but `req.params.person_id` is still attacker-influenced via URL path decoding — a narrower, harder-to-exploit variant of the same class of issue.
- **GEDCOM import has no dedicated rate limiter** — only the generic 300/15min applies, despite it being the most expensive endpoint (file parse + N sequential DB round-trips inside a held transaction, see `PERFORMANCE_REPORT.md`).
- **Fix**: sanitize `file.originalname` with `path.basename()` before use in both upload paths; add a dedicated rate limiter to the GEDCOM import route.

---

## 7. Committed secrets and PII

- **Real user photos are committed to git history**: `git ls-files backend/uploads/` confirms two real photos are tracked despite `backend/.gitignore:3` listing `uploads/` — the ignore rule was added *after* files were already committed. Removing them from the working tree or `.gitignore` does **not** remove them from git history.
- **Fix**: scrub these files from git history (`git filter-repo` or BFG Repo-Cleaner), then verify `.gitignore` prevents recurrence. This should be treated as an active PII incident, not routine cleanup, if this repository or its history is or will be shared beyond the immediate team.

---

## 8. Configuration & secrets hygiene

- `backend/.env:6` — `DB_PASSWORD=2306` — still weak, not rotated (prior audit recommendation #2, still open).
- `docker-compose.yml:12-13,23` hardcodes `POSTGRES_PASSWORD: family_password` and `JWT_SECRET: your_super_secret_jwt_key` with no `.env`-driven override — anyone deploying via `docker compose up` as-is gets these weak literal values unless they remember to edit the YAML directly.
- **No `.dockerignore` file exists anywhere in the repo.** `Dockerfile:8` does `COPY . .` after `npm install --production` — without a `.dockerignore`, this risks copying `.env` (if present in the build context), the already-committed `uploads/` photos, and stray `node_modules` into every image layer, which could end up in a pushed registry image.
- `frontend/.env.example:1` documents `REACT_APP_API_BASE_URL`, but the real code (`frontend/src/api/api.js:4`) and the real `.env` (`frontend/.env:7`) both use `REACT_APP_API_URL` — a new developer following the example file verbatim silently gets the wrong variable name and a fallback to `localhost:5001` with no error.
- **Fix**: rotate the DB password; add a `.dockerignore` (at minimum: `.env`, `node_modules`, `uploads/`); parameterize `docker-compose.yml`'s secrets via a `.env` file it reads from; fix the `.env.example` variable name.

---

## 9. Dependency-level security notes

- `xss-clean` is unmaintained — no meaningful updates in years, commonly flagged by `npm audit`/Snyk as a supply-chain concern, and has had compatibility issues with newer Express/Node on other projects via its getter-based `req.query`/`req.params` mutation technique. A better-maintained, more targeted alternative (explicit `.escape()` calls via `express-validator`, already used elsewhere in this codebase) should replace it.
- `express-mongo-sanitize` is defense-in-depth against a NoSQL-injection pattern that doesn't directly apply to this Postgres-only backend — harmless to keep, but doesn't protect against the actual SQL-injection defect found in §10 below, which is a different vulnerability class entirely.
- No `openai`/`@anthropic-ai/sdk`/any LLM client library is present, confirming the "AI biography" feature cannot be making a real external API call (see `ARCHITECTURE.md` §5 / `TECHNICAL_DEBT.md`).
- **Recommendation**: run `npm audit fix` on both `backend/` and `frontend/` as part of the pre-launch checklist (not independently verified in this pass — flagged as still-open from the prior audit).

---

## 10. SQL injection — full detail

`backend/models/personModel.js:75-100` (`updatePerson`):
```js
for (const [key, value] of Object.entries(updatedData)) {
  if (value !== undefined) {
    fields.push(`${key} = $${paramIndex}`);   // key is NOT validated/whitelisted
    values.push(value);
    paramIndex++;
  }
}
...
const query = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
```
`updatedData` originates from `req.body` via `personController.updatePerson` → `personService.updatePerson`, which only strips `id` and `family_id` — every other key present in the client's JSON body is interpolated verbatim into the SQL text as a column identifier, not bound as a value. `express-validator`'s rules on this route validate the *values* of known fields but never restrict the *set of keys* present in the payload. This means an attacker can add arbitrary extra keys to the JSON body; those keys are placed directly into raw SQL rather than going through parameter binding.

This is a genuine SQL-injection-class defect (CWE-89, identifier-injection variant) — distinct from, and not caught by, the prior audit's "parameterized queries — no SQL injection risk" conclusion, which verified value binding but not identifier construction.

**Fix**: whitelist the exact set of updatable column names in `personService.updatePerson` (or `personModel.updatePerson`) before building the query — e.g. `const ALLOWED_FIELDS = ['first_name','last_name','gender','birth_date',...]` and filter `Object.entries(updatedData)` against it.

---

## 11. Mass assignment

- `personModel.createPerson`/`updatePerson` whitelist a fixed set of columns at the model layer for *creation* (not exploitable for arbitrary-column mass assignment there), but that whitelist includes `photo_url` with **no URL-format validation anywhere** — a client can set a person's `photo_url` to an arbitrary string (e.g. a `javascript:`/`data:` URI, or a tracking-pixel URL) via the create/update payload directly, not just the dedicated upload endpoint. This gets rendered verbatim as an `<img src>` on the frontend.
- **Fix**: add URL-format validation (and ideally a protocol whitelist — `https:` only) to the `photo_url` field in `express-validator` rules.

---

## 12. Frontend-specific security

- **No `dangerouslySetInnerHTML`, no `eval()`** anywhere in the frontend — confirmed via grep. React's default JSX escaping is intact everywhere; consistent with the prior audit's "no XSS vectors found in React" finding.
- **JWT stored in `localStorage`, not an httpOnly cookie** (`frontend/src/pages/Login.js:33`). This is a distinct risk the prior audit's React-XSS framing doesn't cover: the absence of a *React-level* injection vector today doesn't mean the token is safe from **any** future XSS-capable bug — a compromised third-party script, a browser extension with page access, a supply-chain-compromised dependency, or a future dev-introduced bug elsewhere could read `localStorage` directly and exfiltrate the token with no additional exploit needed. An httpOnly cookie would provide defense-in-depth against exactly this class of future bug. `localStorage` persistence also means the token survives browser restarts indefinitely with no visible expiry-driven UX.
- **`selectedFamily` is also stored in plain `localStorage`**, readable by any script with page access — lower sensitivity alone, but combined with JWT theft gives an attacker both "who" and "which family" needed for full session impersonation.
- **No CSRF concern** given Bearer-token (not cookie-based) auth — a reasonable trade-off, though it means localStorage-XSS-token-theft is the primary client-side risk instead.
- **No client-side route guard** (see `ARCHITECTURE.md` §2.2) — not itself a data-exposure bug (server-side auth still gates real data), but any future developer adding client-only-rendered content to a "protected" page would silently expose it with nothing to catch the mistake.
- **No CSP/security headers at the static-file serving layer**: the frontend's `Dockerfile`'s `nginx:alpine` serve stage uses bare `nginx -g daemon off` with no custom `nginx.conf` — no CSP, no `X-Frame-Options` set at the serving layer (the backend's Helmet config only protects API responses, not the served frontend HTML/JS itself).

---

## 13. Fix priority (cross-reference with `TECHNICAL_DEBT.md`)

| Priority | Item | TECHNICAL_DEBT.md ref |
|---|---|---|
| 🔴 Immediate | Add `verifyToken` to legacy routes | C1 |
| 🔴 Immediate | Add ownership checks to every non-family resource | C2 |
| 🔴 Immediate | Fix `personModel.searchPersons` tenant scoping | C3 |
| 🔴 Immediate | Whitelist columns in `personModel.updatePerson` | C4 |
| 🔴 Immediate | Fix `errorHandler.js` to gate `message` on environment | C5 |
| 🔴 Immediate | Rotate `DB_PASSWORD` | C7 |
| 🟠 Before launch | Scrub committed photos from git history | H1 |
| 🟠 Before launch | Sanitize upload filenames (`path.basename()`) | H2 |
| 🟠 Before launch | Move uploads to object storage | H3 |
| 🟠 Before launch | Validate/restrict `photo_url` | H12 |
| 🟡 Soon | Replace `xss-clean` with maintained alternative | M18 |
| 🟡 Soon | Add `.dockerignore` | M19 |
| 🟡 Soon | Fix `.env.example` variable name | M8 |
| 🟢 Planned | Move JWT to httpOnly cookie | H8 (larger backend change) |
| 🟢 Planned | Add client-side route guard | H7 |
