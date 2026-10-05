# Kutumb — Scalability Report

> What breaks first as this product grows from 10 users to 1,000,000, and what the redesign looks like at each stage. This report assumes the security fixes in `SECURITY_AUDIT.md` are applied first — an app that leaks cross-tenant data doesn't get to "scale," it gets shut down. Scalability here means "handles load and data volume gracefully," a separate concern from correctness/security.

---

## Starting point: what scales well already

Worth stating up front, because it's easy to miss in a findings-heavy audit: **the backend's core auth design is stateless JWT with no server-side session store.** This is exactly the right foundation for horizontal scaling — there is no sticky-session requirement, no in-memory session map, nothing that ties a request to a specific backend instance. Almost everything else in this report is about the parts of the system that *don't* share that property yet.

---

## 10 users

**Current architecture handles this without changes.** A single Docker Compose stack (1 Postgres + 1 backend + 1 frontend container) or a single Vercel/Railway deployment is more than sufficient. The default `pg.Pool` (max 10 connections) comfortably covers this load. This is roughly the current de facto testing scale of the app.

**What to fix anyway at this stage** (cheap now, expensive later): add the missing foreign-key indexes (`SECURITY_AUDIT.md`/`PERFORMANCE_REPORT.md` — one migration, zero risk) and add the ownership checks from `SECURITY_AUDIT.md` §2. Neither is a scalability fix per se, but both get dramatically more expensive to retrofit once there's real user data and concurrent traffic to work around.

---

## 100 users

**First real cracks appear, but nothing catastrophic yet.**

- **Local-disk file uploads start to matter.** At 100 users with profile photos, `backend/uploads/` is now a meaningfully sized, ungrowable, unbacked-up directory living on a single container's ephemeral or semi-persistent disk. If the container restarts without a persistent volume, uploaded photos vanish. This is the point to move to S3/R2/GCS — not because of load, but because of durability.
- **The N+1 patterns become visible in latency**, not just in theory: `eventController.getFamilyEvents`'s 1+N query loop (`PERFORMANCE_REPORT.md` §1.3) and `PersonProfile.js`'s per-relationship fetch loop (§1.4) start adding real, measurable milliseconds for any family with a few dozen members.
- **No pagination is still fine** at this scale (families are small, lists are short) but should be added now while it's a small, low-risk change, not later under time pressure.

**Redesign needed**: move uploads to object storage; fix the two N+1 patterns; add basic request-timing logging so the team has visibility before the next stage.

---

## 1,000 users

**This is where architectural assumptions start actively costing money and correctness.**

- **`node-cron`'s lack of a distributed lock becomes a real (if still contained) problem** the moment the backend needs more than one instance for availability/throughput reasons, or the moment real email sending replaces the current `console.log` placeholder (`PERFORMANCE_REPORT.md`/`TECHNICAL_DEBT.md` H4). At 1,000 users with even 2 backend replicas for basic redundancy, every user with an upcoming birthday gets 2 reminder emails, not 1 — this is a correctness bug that only manifests once you scale past 1 replica, which is exactly the point where you need to scale past 1 replica for other reasons.
- **The default connection pool (max 10) becomes a real constraint.** At 1,000 users with realistic concurrent usage, plus the GEDCOM import path holding a dedicated connection for the full duration of a sequential per-row import loop (`PERFORMANCE_REPORT.md` §2.2), pool exhaustion under any concurrent-import load becomes plausible, not theoretical.
- **The full-refetch-after-every-mutation frontend pattern** starts generating meaningfully more backend load than necessary — at 1,000 active users each performing normal edit activity, this is now real, avoidable server load, not just a client-side UX issue.
- **No caching layer anywhere** (no Redis, no CDN in front of the API, no HTTP caching headers) means every read is a live database hit.

**Redesign needed**:
- Move the cron job to a coordinated scheduler (a dedicated worker process with a Postgres advisory lock, or an external scheduler like a managed cron service that calls a single endpoint) so it's safe to run multiple backend replicas.
- Batch the GEDCOM import inserts and release the pool connection between batches rather than holding it for the whole import.
- Tune pool sizing (`max`) based on actual replica count and expected concurrency; consider PgBouncer in front of Postgres if replica count grows.
- Add response caching (even simple in-memory TTL caching for read-heavy, rarely-changing data like a family's structure) or start introducing a proper cache layer (Redis) for the highest-traffic read paths.
- Fix the frontend re-fetch pattern (see `PERFORMANCE_REPORT.md` §1.1) — this now matters for backend cost, not just frontend UX.

---

## 10,000 users

**Single-instance-anything stops being viable. This is the "you need a real platform team conversation" stage.**

- **Local-disk uploads (if not already fixed) are now a hard blocker**, not just a durability risk — you cannot run multiple backend instances behind a load balancer with per-instance local storage and have uploads work correctly for users routed to a different instance than the one that received their upload. This must be fixed before this stage, not at it.
- **The Vercel serverless deployment target becomes untenable as configured** — `vercel.json` deploys `server.js` as a single serverless function; serverless cold starts, per-invocation ephemeral filesystems, and the cron-job-inside-a-function-body pattern (`server.js:107`) are fundamentally mismatched with sustained, high-concurrency traffic and any stateful background job. At this scale, the team needs to commit to either (a) a traditional long-lived container platform (Railway, Render, ECS, etc.) with real horizontal scaling, or (b) a genuinely serverless-native redesign (uploads via presigned S3 URLs, reminders via a managed cron/queue service, no in-process `node-cron`).
- **No pagination becomes a genuine performance and cost problem**: `getFamilies`, `getPersonsByFamily`, `getMemoriesByFamily`, etc. returning unbounded result sets means a single popular/large family's data transfer size grows without bound, and there's no way to cap worst-case response size or memory usage per request.
- **The database itself needs attention**: connection pooling at the application layer (`pg.Pool`) is not enough at this scale — introduce PgBouncer (or your cloud provider's managed pooler) between the app and Postgres, and start monitoring for slow queries (the missing-index problem, if still unaddressed, becomes a genuine production incident risk here — sequential scans on tables with tens of thousands of rows are slow, not just "a bit slower").
- **The custom graph-layout algorithm's worst-case complexity (`PERFORMANCE_REPORT.md` §1.2) starts mattering for real users**, not just hypothetically — at this user count, it's statistically likely that some families have grown to hundreds of members (multi-generational trees, extended family imports via GEDCOM), which is exactly the regime where the O(n log n)-run-300-times worst case produces visible main-thread jank.

**Redesign needed**:
- Object storage for all uploads (hard requirement now).
- Commit to one deployment architecture; if serverless, redesign uploads and cron accordingly.
- Add pagination everywhere reads return unbounded lists.
- Introduce a connection pooler (PgBouncer or managed equivalent) between the app and Postgres.
- Move the graph-layout computation off the main thread (Web Worker) for large trees, and/or introduce incremental layout so a single-node add doesn't force a full tree recompute.
- Start treating database migrations as a first-class concern — adopt a real migration framework (`node-pg-migrate`, Prisma Migrate, Flyway) if not done already; hand-run `schema.sql` changes are not viable to coordinate across a team and multiple environments at this scale.

---

## 100,000 users

**Multi-region/read-replica territory. The single-Postgres-instance model needs active management, and application-level tenant isolation needs to be airtight (this assumes the security fixes are long since shipped — an IDOR at this scale is a much bigger incident).**

- **Read/write splitting becomes worth evaluating**: introduce a read replica for read-heavy endpoints (family-tree fetches, person lookups, search) to take load off the primary, especially since none of these endpoints currently have any caching layer.
- **The event/reminder computation model (compute-on-every-request, no persisted `events`/`reminders` table) stops being viable.** At this scale, computing "upcoming reminders" by scanning `persons`/`memories` on every request (even with indexes) is wasteful compared to a materialized/precomputed approach — this is the point to introduce an actual `reminders` table populated by a background job, queried cheaply on read.
- **The GEDCOM import path needs to become fully asynchronous** (upload → queue a background job → notify on completion) rather than a synchronous request that holds a DB connection and blocks the HTTP response for the full import duration — a large GEDCOM file at this point could genuinely time out a synchronous request.
- **CDN in front of the frontend** (if not already, e.g. via Vercel/Cloudflare) for static asset delivery; API responses that are cacheable (e.g., a public family tree, if that ever becomes a feature) should get proper `Cache-Control` headers.
- **Rate limiting needs to move from per-IP, single-instance, in-memory (`express-rate-limit`'s default store) to a shared, distributed store** (Redis-backed) — the current per-instance in-memory rate limiter doesn't coordinate across replicas, so effective rate limits become N× more permissive than configured once there are N backend instances.

**Redesign needed**:
- Read replicas + read/write query routing.
- Materialize reminders/events into real tables with a background-job writer instead of compute-on-read.
- Async job queue (e.g. BullMQ/Redis, or a managed queue service) for GEDCOM import and any future long-running operation.
- Redis-backed distributed rate limiting.
- CDN + cache headers for cacheable content.

---

## 1,000,000 users

**This is a fundamentally different system than what exists today — not a tuning exercise, a redesign.**

- **Sharding or a managed multi-tenant database strategy becomes necessary** if a single Postgres primary (even with read replicas) can't keep up with write volume — this depends heavily on actual usage patterns (how write-heavy family-tree editing really is at this scale) and would need real production telemetry (which, per `PERFORMANCE_REPORT.md` §6, the app currently has none of — this is the reason to start collecting metrics *now*, long before this stage, so the team has real data to make this decision with instead of guessing).
- **The monolithic Express backend likely needs to split** into at least a few independently-scalable services — e.g., the GEDCOM import/parsing path (CPU/IO-bound, bursty) has very different scaling characteristics from the CRUD API (latency-sensitive, steady) and from the reminder/notification system (batch, time-driven) — running them as one process means they compete for the same resources and can't be scaled independently.
- **The graph-rendering/layout problem may need to move server-side or to a dedicated layout service** for very large trees, with the client receiving pre-computed positions rather than computing a potentially thousands-of-nodes layout in the browser on every load.
- **Multi-region deployment** becomes a real consideration for latency if the user base is geographically distributed — this has significant implications for data residency, replication lag, and session/auth token validation latency that the current single-region, single-Postgres design doesn't need to consider today.
- **Observability becomes non-negotiable**, not a nice-to-have: distributed tracing, structured logging with correlation IDs, real APM — none of which exist today (`PERFORMANCE_REPORT.md` §6) — are required just to operate a system at this scale, let alone optimize it.

**Redesign needed**: this stage is genuinely a "hire/build a platform team and do a proper systems-design exercise with real production data" stage, not a checklist. The most useful thing this audit can say about it is: **none of the fixes recommended for the 10–100,000 user stages above are wasted effort that would need to be undone here** — indexes, object storage, async job queues, materialized reminders, and read replicas are all still the right foundation at 1M users, just operated at a different scale and likely combined with sharding/service-splitting on top.

---

## Summary table

| Users | Primary bottleneck | Must-fix before this stage |
|---|---|---|
| 10 | none | (fix security issues regardless of scale) |
| 100 | Local-disk uploads (durability), N+1 queries | Object storage, fix N+1s |
| 1,000 | Cron coordination, connection pool sizing, no caching | Distributed cron lock, batch GEDCOM inserts, basic caching |
| 10,000 | Single-instance-anything, no pagination, serverless/upload mismatch | Commit to deployment architecture, pagination everywhere, PgBouncer, real migration framework |
| 100,000 | Single-Postgres-primary, compute-on-read reminders, per-instance rate limiting | Read replicas, materialized reminders/events, async job queue, distributed rate limiting |
| 1,000,000 | Monolith scaling limits, no observability | Service decomposition, distributed tracing/APM, possible sharding — needs real production telemetry to design correctly |
