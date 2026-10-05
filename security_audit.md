# Kutumb.ai Security Audit Report

> Audited: Backend (Node.js/Express), Frontend (React), Config & Deployment layers.

---

## 🔴 Critical Findings (Fixed)

### 1. JWT Fallback Secret Hardcoded in Source Code
| | |
|---|---|
| **File** | `backend/services/authService.js:55` |
| **Vulnerability** | `jwt.sign(payload, process.env.JWT_SECRET \|\| 'fallback_secret')` — if the env var was ever missing, **every JWT would be signed with a known public string**. Any attacker could forge valid tokens for any user. |
| **Fix Applied** | Removed the fallback. Now throws a fatal error if `JWT_SECRET` is undefined — the server won't start without it. |

### 2. Wildcard CORS (`app.use(cors())`)
| | |
|---|---|
| **File** | `backend/server.js:35` |
| **Vulnerability** | `cors()` with no options allows **any origin** to make credentialed requests to the API. |
| **Fix Applied** | CORS now reads `ALLOWED_ORIGINS` from the environment and rejects all unlisted origins with a proper error. |

### 3. Internal Error Messages Leaked to Client
| | |
|---|---|
| **File** | `backend/controllers/authController.js:24` |
| **Vulnerability** | `res.status(500).json({ message: error.message })` — raw error strings (including DB driver messages) were sent to the client. |
| **Fix Applied** | 500 responses now return a generic user-safe message. Full error is still logged server-side only. |

---

## 🟠 High Severity Findings (Fixed)

### 4. No XSS Input Sanitization
| | |
|---|---|
| **File** | `backend/server.js` |
| **Vulnerability** | `xss-clean` was listed as a dependency but **never registered as middleware**. |
| **Fix Applied** | `app.use(xssClean())` added after body parsing. Strips HTML/script tags from `req.body`, `req.query`, and `req.params`. |

### 5. No JSON Body Size Limit
| | |
|---|---|
| **File** | `backend/server.js` |
| **Vulnerability** | `express.json()` with no limit accepts arbitrarily large payloads — a vector for DoS attacks. |
| **Fix Applied** | Changed to `express.json({ limit: '10kb' })`. |

### 6. Swagger UI Exposed in Production
| | |
|---|---|
| **File** | `backend/server.js` |
| **Vulnerability** | `/api-docs` was always mounted, giving attackers a full interactive map of every API endpoint in production. |
| **Fix Applied** | Swagger UI now only mounts when `NODE_ENV !== 'production'`. |

### 7. Auth Rate Limit Too Permissive
| | |
|---|---|
| **File** | `backend/server.js` |
| **Vulnerability** | 25 auth requests per 15 minutes is too high — a basic credential stuffing attack could test thousands of passwords per IP per hour. |
| **Fix Applied** | Tightened to **15 auth requests per 15 minutes**. |

### 8. No 401 Auto-Logout on Frontend
| | |
|---|---|
| **File** | `frontend/src/api/api.js` |
| **Vulnerability** | Expired tokens were silently rejected by the API but the frontend kept showing protected pages. Users could remain "stuck" in a broken authenticated state indefinitely. |
| **Fix Applied** | Added a response interceptor that clears `localStorage` and redirects to `/login` on any 401. |

---

## 🟡 Medium Severity Findings (Fixed)

### 9. Permissive Helmet Configuration
| | |
|---|---|
| **File** | `backend/server.js` |
| **Vulnerability** | `helmet({ crossOriginResourcePolicy: false })` disabled the CORP header entirely. No `Content-Security-Policy`, no `X-Frame-Options`, no `Referrer-Policy` was configured. |
| **Fix Applied** | Full Helmet config now sets: `CSP`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Powered-By` suppressed. |

### 10. Missing `NODE_ENV` & `ALLOWED_ORIGINS` in Environment
| | |
|---|---|
| **Files** | `backend/.env`, `backend/.env.example` |
| **Vulnerability** | `NODE_ENV` was never set (defaulted to `undefined`). `ALLOWED_ORIGINS` didn't exist. This caused security features that depend on environment mode to not function. |
| **Fix Applied** | Added both to `.env` and documented in `.env.example`. |

---

## ✅ Already Good — No Changes Needed

| Area | Status |
|---|---|
| **Password hashing** | ✅ bcrypt with `saltRounds=10`. No plaintext storage. |
| **Parameterized SQL queries** | ✅ All models use `$1, $2` parameterized pg queries — no SQL injection risk. |
| **Auth middleware on all routes** | ✅ Every route except `/auth/register` and `/auth/login` requires `verifyToken`. |
| **JWT expiry set** | ✅ Tokens expire in 24 hours. |
| **Input validation (express-validator)** | ✅ Auth routes validate email format and minimum password length. |
| **NoSQL sanitization (mongo-sanitize)** | ✅ Was already registered and active. |
| **Error handler hides stack in production** | ✅ `errorHandler.js` already guards `err.stack` behind `NODE_ENV === 'development'`. |
| **File upload restrictions** | ✅ Multer limits to 8MB and whitelists safe extensions. |
| **`.env` in `.gitignore`** | ✅ Confirmed present and effective. |
| **No `dangerouslySetInnerHTML` in React** | ✅ None found across all frontend files. |
| **No XSS vectors in React** | ✅ React escapes all JSX expressions by default. No raw HTML injection found. |

---

## 🔵 Recommended (Before Production Deployment)

These are not yet implemented but are important for a production launch:

| # | Action | Priority |
|---|---|---|
| 1 | **Rotate `JWT_SECRET`** — current value `mysecretkey` is trivially weak. Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | 🔴 Critical |
| 2 | **Rotate DB password** — `2306` is a 4-digit password. Use a strong random password in prod. | 🟠 High |
| 3 | **Enable HTTPS / TLS** — enforce HTTPS at hosting level (Vercel, Railway, nginx), set `HSTS` header. | 🟠 High |
| 4 | **Set `NODE_ENV=production`** on the hosting platform | 🟠 High |
| 5 | **Set `ALLOWED_ORIGINS`** to your real production domain (e.g. `https://kutumb.ai`) | 🟠 High |
| 6 | **Add `REACT_APP_API_URL`** to Vercel/frontend env vars pointing to your production backend URL | 🟠 High |
| 7 | **Run `npm audit fix`** on both `frontend/` and `backend/` to patch vulnerable transitive deps | 🟡 Medium |
| 8 | **Input validation on all mutation routes** — `PUT /persons/:id`, `PUT /families/:id`, etc. currently lack field-level validation | 🟡 Medium |
| 9 | **Add ownership checks** — a user with a valid JWT can currently GET any family by ID. Add `WHERE created_by = $user_id` guards. | 🟡 Medium |
| 10 | **Rate-limit file uploads** separately from the API limiter | 🟡 Medium |
| 11 | **Move uploads to object storage (S3/Cloudflare R2)** — serving user-uploaded files from the app server is both a security and scalability risk | 🟡 Medium |

---

## Summary

| Severity | Found | Fixed in this session |
|---|---|---|
| 🔴 Critical | 3 | 3 |
| 🟠 High | 5 | 5 |
| 🟡 Medium | 2 | 2 |
| 🔵 Recommended pre-prod | 11 | 0 (manual steps) |
