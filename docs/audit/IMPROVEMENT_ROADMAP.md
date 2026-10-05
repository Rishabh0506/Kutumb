# Kutumb — Improvement Roadmap

> A phased plan synthesizing `TECHNICAL_DEBT.md`, `PERFORMANCE_REPORT.md`, `SECURITY_AUDIT.md`, and `SCALABILITY_REPORT.md` into an execution order. Effort estimates assume one engineer familiar with the codebase (post-onboarding via `CODEBASE_OVERVIEW.md`/`ARCHITECTURE.md`); parallelize across a team accordingly. "Impact" is qualitative — see the source documents for detailed reasoning.

---

## How to read this roadmap

Phases 1–2 are **not optional** — they address launch-blocking security and correctness issues. Everything from Phase 3 onward is genuinely a roadmap (sequenced by value, adjustable to business priorities). Phase 6 (Production Readiness) should be revisited continuously, not treated as a final gate.

---

## Phase 1 — Quick Wins (est. 3–5 days total)

Low-effort, high- or medium-value fixes with minimal risk of introducing regressions. Good first week for a new engineer or a focused sprint before anything else.

| Item | Ref | Effort | Impact |
|---|---|---|---|
| Add `verifyToken` to `legacyRoutes.js` | SECURITY_AUDIT §2, TECH_DEBT C1 | S (< 1hr) | Closes the single most severe open vulnerability |
| Whitelist columns in `personModel.updatePerson` | SECURITY_AUDIT §10, TECH_DEBT C4 | S | Closes the SQL-injection defect |
| Fix `errorHandler.js` to gate `message` on `NODE_ENV` | SECURITY_AUDIT §5, TECH_DEBT C5 | S | Stops leaking internal error text in production |
| Rotate `DB_PASSWORD` | SECURITY_AUDIT §8, TECH_DEBT C7 | S | Closes a still-open item from the prior audit |
| Fix `personModel.searchPersons` to scope by family/owner | SECURITY_AUDIT §3, TECH_DEBT C3 | S | Closes the cross-tenant search leak |
| Add indexes on all 6 foreign-key columns | PERFORMANCE §2.1, TECH_DEBT H5 | S | Unblocks scale with near-zero risk |
| Sanitize upload filenames (`path.basename()`) | SECURITY_AUDIT §6, TECH_DEBT H2 | S | Closes the path-traversal risk |
| Remove `dagre`, `elkjs`, and (if confirmed) `@heroicons/react` from `package.json` | TECH_DEBT M1, M2 | S | `node_modules` hygiene, removes a misleading signal |
| Delete `FamilyInvite.js`, `FamilyTimeline.js` | TECH_DEBT M3 | S | Removes dead, visually-stale code |
| Fix `.env.example` variable name mismatch (frontend + README) | TECH_DEBT M8 | S | Prevents a real onboarding footgun |
| Add a `.dockerignore` | SECURITY_AUDIT §8, TECH_DEBT M19 | S | Prevents secrets/PII from landing in Docker image layers |
| Delete `setup_demo_user.js` (keep `migrate_demo.js`, which correctly bcrypt-hashes) | TECH_DEBT M15 | S | Removes a login-broken demo-account footgun |
| Fix `UpcomingReminders.js`/`SearchBar.js` light-theme styling bug | TECH_DEBT M4 | S | Fixes a live, user-visible visual bug |
| Fix backend `eventController` N+1 (reuse existing `getMemoriesByFamily`) | PERFORMANCE §1.3, TECH_DEBT M11 | S | Cheap fix, existing helper already available |
| Throttle `mousemove` on Login/Register/Dashboard (copy `FamilyTreePage`'s existing pattern) | PERFORMANCE §3.1, TECH_DEBT M13 | S | First-impression quality fix, pattern already exists in-repo |
| Fix stale comment (`reminderController.js` "30 days" vs. actual 45) | TECH_DEBT L1 | S | Trivial correctness/clarity fix |

**Phase 1 exit criteria**: the 6 launch-blocking security items from `SECURITY_AUDIT.md` §0 are closed except the broader IDOR pattern (that's Phase 2). Nothing in this phase requires a design discussion — all items are unambiguous fixes.

---

## Phase 2 — Architecture (est. 2–3 weeks)

The structural work that Phase 1's quick wins can't cover — mainly the authorization pattern, the state-management gap, and the God components.

| Item | Ref | Effort | Impact |
|---|---|---|---|
| **Add ownership checks to every non-family resource** (persons, relationships, memories, events, reminders, GEDCOM, family-tree) | SECURITY_AUDIT §2, TECH_DEBT C2 | L | Closes the core IDOR pattern — this is the biggest remaining security gap and should be designed once as reusable middleware, not patched file-by-file |
| Standardize error-handling convention (pick `next(error)` or local try/catch, apply consistently) | ARCHITECTURE §5.6, TECH_DEBT (implicit in C5 fix) | M | Removes a maintainability inconsistency while touching the same files as the error-handler fix |
| Add `express-validator` rules to the 8 currently-unvalidated route files | SECURITY_AUDIT §4, TECH_DEBT M9 | M | Closes a broad, still-open item from the prior audit's recommendation #8 |
| Split `PersonProfile.js` into ≥8 files | ARCHITECTURE §3.3, TECH_DEBT H6 | L | Unlocks testability, reduces change risk on the largest file in the app |
| Split `FamilyTreePage.js`'s inline sub-forms into their own files | ARCHITECTURE §3.3, TECH_DEBT H6 | M | Same rationale, smaller scope |
| Introduce `AuthContext` + a real `<ProtectedRoute>` component | ARCHITECTURE §4, TECH_DEBT H7 | M | Closes the client-side route-guard gap |
| Adopt a migration framework (`node-pg-migrate` or similar) for `schema.sql` | ARCHITECTURE §5.5, TECH_DEBT H10 | M | Required before any further schema changes are made safely |
| Standardize backend response/error envelope shape across all endpoints | TECH_DEBT M10 | M | Removes the ad hoc unwrap-if-present hack already living in `familyService.js` |
| Add cycle/duplicate prevention to the relationship model | TECH_DEBT M16 | M | Data-integrity fix; pairs naturally with the express-validator pass above |
| Fix mass-assignable `photo_url` (add URL validation) | SECURITY_AUDIT §11, TECH_DEBT H12 | S | Small but belongs in this phase alongside the validation pass |

**Phase 2 exit criteria**: `SECURITY_AUDIT.md` §0's headline findings are fully closed. The two God components are split. A migration framework exists and the next schema change goes through it, not a hand-run script.

---

## Phase 3 — Performance (est. 1.5–2 weeks)

Should follow Phase 2 because several performance fixes (optimistic updates, caching) are easier once the data-access layer is more consistent.

| Item | Ref | Effort | Impact |
|---|---|---|---|
| **Stop full-refetch-after-every-mutation** (adopt React Query/SWR, or hand-roll optimistic updates for the tree and profile pages) | PERFORMANCE §1.1, TECH_DEBT H9 | M | **Highest-leverage frontend fix in the whole audit** — compounds network + full graph re-layout cost on every write |
| Add a batch "get persons by ids" endpoint; use it in `PersonProfile.js`'s N+1 fetch loop | PERFORMANCE §1.4, TECH_DEBT M12 | M | Removes per-relationship round trips on every profile view |
| Add pagination to `getFamilies`, `getPersonsByFamily`, and other unbounded list endpoints | PERFORMANCE §2.3, SCALABILITY (100-user stage) | M | Cheap now, expensive to retrofit under load |
| Batch GEDCOM import inserts instead of sequential per-row queries | PERFORMANCE §2.2, SCALABILITY (1,000-user stage) | M | Prevents pool exhaustion under concurrent imports |
| Apply `React.memo` to `PersonProfile.js`'s extracted sub-components (pairs with the Phase 2 split) | PERFORMANCE §3.2, TECH_DEBT M14 | M | Reduces unnecessary re-renders |
| Fix `FamilyTreeInner`'s callback-identity churn that defeats `PersonNode`'s memoization | PERFORMANCE §3.4 | M | Restores the intended benefit of existing `memo()` wraps during hover/selection |
| Wire up `web-vitals` reporting to an actual endpoint/service | PERFORMANCE §6, TECH_DEBT L7 | S | Enables measuring the impact of every other performance fix |
| Add basic backend request-timing/structured logging | PERFORMANCE §6, ARCHITECTURE §5.7 | M | Same rationale, backend side — do this before Phase 4's scale work so there's real data to validate against |

**Phase 3 exit criteria**: adding a person to a mid-sized tree no longer triggers a full network refetch + full graph re-layout. Basic performance telemetry exists so future decisions are data-driven, not intuition-driven.

---

## Phase 4 — UI (est. 1.5–2 weeks)

Polish and consistency work — lower urgency than Phases 1–3, but compounds the product's credibility, especially anything demo-facing.

| Item | Ref | Effort | Impact |
|---|---|---|---|
| Extract a shared `<Modal>` component; replace all 3 hand-rolled implementations + `window.confirm`/`window.prompt` usages | TECH_DEBT M6 | M | Consistent UX, less duplicated code |
| Resolve mock/non-functional UI: either wire up `CollaborationPanel`'s role/remove actions, the dead `FamilyInsightsPanel` buttons, and the activity feed, or clearly label them as "coming soon" | TECH_DEBT M5 | M–L (depends on scope chosen) | Stops the product from looking more complete than it is |
| Consolidate ad hoc `rgba(...)` brand colors and `@keyframes` into `tailwind.config.js` theme tokens + a shared animation stylesheet | TECH_DEBT L6, L5 | M | Fixes the color-consistency drift; removes per-node-instance duplicate `<style>` injection |
| Accessibility pass: `aria-*` attributes, focus trapping in modals, keyboard navigation for search dropdowns | TECH_DEBT M20 | L | Currently zero `aria-*` attributes anywhere — this needs to be systematic, not spot fixes |
| Configurable layout density (compact/spacious toggle) for the graph, replacing hardcoded `NODE_W`/`H_SPACING`/etc. | ARCHITECTURE §6.6 (related) | M | Nice-to-have; also a natural place to address the fixed-height canvas on small screens |

**Phase 4 exit criteria**: no component in the app visually contradicts the app's own dark theme; every clickable-looking element does something (or is clearly marked as not yet implemented); a baseline accessibility pass is complete.

---

## Phase 5 — AI Features (est. varies — scope-dependent)

The current "AI biography" feature is a template stub with no LLM integration. This phase is about deciding whether/how to make it real.

| Item | Ref | Effort | Impact |
|---|---|---|---|
| Decide product scope: real LLM-backed biography generation, or keep as a lightweight template feature (and relabel it honestly in the UI) | ARCHITECTURE §5 (aiController), TECH_DEBT (implicit) | Decision, not code | Prevents shipping a feature that silently overwrites human-written bios with a fixed-format template |
| If building the real feature: add an LLM SDK dependency, API key config, a versioned/undo-able bio-write path (currently `generateBiography` **destructively overwrites** the existing `bio` field with no confirmation) | ARCHITECTURE §5 | L | Real feature value; also fixes a genuine data-loss risk in the current stub |
| If building the real feature: add rate limiting specific to LLM calls (cost control) | (new, LLM-specific) | S | Prevents runaway API cost |
| Extend the same "real vs. stub" decision to reminder emails (currently `console.log`-only) — wire up an actual email provider if this feature ships | ARCHITECTURE §5 (cron), SCALABILITY (100-user stage) | M | Currently a fully non-functional advertised feature |

**Phase 5 exit criteria**: every feature the UI presents as working actually works, or is clearly marked as a preview/placeholder. No feature silently destroys user data (the current bio-overwrite behavior must be fixed regardless of whether AI generation becomes "real").

---

## Phase 6 — Production Readiness (ongoing, revisit continuously)

Not a final gate — a checklist to revisit before and after each real launch milestone.

| Item | Ref | Effort | Impact |
|---|---|---|---|
| Fix the frontend test suite (module-resolution issue + rewrite stale assertions) | TECH_DEBT C6 | S (resolution) + M (rewrite) | Currently **zero working test coverage exists** — this should not wait for later phases; consider pulling into Phase 1 if bandwidth allows |
| Add `npm test` script + basic CI (GitHub Actions or equivalent) for both frontend and backend | ARCHITECTURE §8 (Testing: 1/10) | M | No CI exists at all today; this is the single change that would have caught the broken test suite automatically |
| Add authorization/ownership-boundary tests (log in as user A, confirm user A cannot touch user B's data) | SECURITY_AUDIT §2, ARCHITECTURE §8 | M | The most important test category given this audit's findings — nothing today would catch a regression in the Phase 2 ownership-check work |
| Scrub committed user photos from git history | SECURITY_AUDIT §7, TECH_DEBT H1 | M | Active PII-in-history issue, should be treated as urgent once the repo is shared beyond the immediate team |
| Move file uploads to object storage (S3/R2/GCS) | SECURITY_AUDIT §6, TECH_DEBT H3, SCALABILITY (100-user stage) | L | Required before horizontal scaling is possible at all |
| Commit to one deployment target (resolve the Vercel/Docker/traditional-host inconsistency) and redesign uploads/cron accordingly if serverless | ARCHITECTURE §7, SCALABILITY (10,000-user stage) | L | Currently three deployment configs exist with incompatible runtime assumptions |
| Add a distributed lock (or move to a managed scheduler) for the reminder cron job | SECURITY_AUDIT (cron), SCALABILITY (1,000-user stage) | M | Required before running more than one backend replica |
| Run `npm audit fix` on both `frontend/` and `backend/`; replace `xss-clean` | SECURITY_AUDIT §9, TECH_DEBT M18 | S | Still-open item from the prior audit |
| Add a real health-check endpoint that verifies DB connectivity | ARCHITECTURE §5.6 | S | Current `/` health check doesn't check anything |
| Wire up structured logging + basic APM/error tracking (Sentry or equivalent) | ARCHITECTURE §5.7, SCALABILITY (1M-user stage foundation) | M | Zero observability exists today; needed to validate every other fix in this roadmap and to operate the product at any real scale |
| Fix README to accurately reflect implemented features (remove the RBAC/collaboration claim or build it) | TECH_DEBT H11 | S or L | Sets accurate expectations for users/stakeholders |
| Move JWT storage from `localStorage` to an httpOnly cookie | SECURITY_AUDIT §12, TECH_DEBT H8 | M | Defense-in-depth against future XSS-class bugs; larger change (requires backend cookie-auth support), reasonable to schedule alongside other auth work |

---

## Suggested execution order (if resourcing is the constraint)

1. **Phase 1** — do this first, unconditionally, before anything else ships to real users.
2. **Phase 2's security items** (ownership checks) — do not defer past Phase 1; everything else in Phase 2 can be interleaved with Phase 3 if needed.
3. **Phase 6's testing items** (fix the test suite, add CI, add ownership-boundary tests) — pull forward alongside Phase 2 so the ownership-check work is covered by tests as it's built, not after.
4. **Phase 3** — once the data layer is stable post-Phase-2, this is the best return-on-effort for user-perceived quality.
5. **Phase 4, 5, 6 (remainder)** — sequence by business priority; none of these block a safe, correct launch the way Phases 1–2 do.

---

## Cross-reference: Production Readiness Score movement

See `ARCHITECTURE.md` §8 for the current baseline scores. Phases 1–2 primarily move **Security** (3→7+) and **Testing** (1→5+). Phase 3 primarily moves **Performance** (5→7+). Phase 4 moves **UI** (6→8+) and starts moving **Developer Experience**. Phase 6 moves **Developer Experience**, **Scalability**, and **Documentation** the most, and is the phase most worth repeating on a cadence (e.g., revisit quarterly) rather than treating as "done" once.
