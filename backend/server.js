require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const xssClean = require('xss-clean');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');

// Import database pool
const pool = require('./config/db');

// A crash from here on out is loud (structured, with a full stack) instead
// of a bare stderr dump — previously these had no handler at all, so
// whether the process even logged anything before dying depended on
// Node's default behavior rather than anything this app controlled.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — process exiting');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection — process exiting');
  process.exit(1);
});

const app = express();

// Structured, one-line-per-request logging (method, path, status, response
// time, request id) — placed first so even requests rejected by later
// middleware (helmet, CORS, rate limits) still get logged.
app.use(pinoHttp({ logger }));

// ── 1. Security headers via Helmet ────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:', '*'],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,           // 1 year
    includeSubDomains: true,
    preload: true,
  },
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hidePoweredBy: true,
}));

// Trust proxy (Vercel, Railway, nginx) so rate-limiter sees real IPs
app.set('trust proxy', 1);

// ── 2. CORS — whitelist only the frontend origin ──────────────
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
).split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman in dev)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin '${origin}' is not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── 3. Body size limit + input sanitization ───────────────────
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());   // Strip $ and . from keys (NoSQL-injection pattern)
app.use(xssClean());        // Strip HTML/script tags from req.body/query/params

// ── 5. Rate limiters ─────────────────────────────────────────
// General API cap. 300/15min (the original default) was load-tested and
// found to reject ~99% of requests under completely ordinary single-user
// browsing — a normal page's worth of API calls (families, tree, reminders,
// search) burns through it in well under a minute, and it's shared by every
// user behind the same IP (offices, campuses, mobile carrier NAT). Bumped to
// a level that comfortably covers real usage while still bounding abuse;
// tunable via env without a code change.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again in 15 minutes' }
});

// Deliberately much stricter — guards the bcrypt-heavy register/login path
// against credential stuffing. A real user authenticates once and reuses
// the JWT, so this doesn't bite normal usage the way apiLimiter's old
// value did.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later' }
});

// ── 6. Swagger UI (dev only) ──────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const yaml = require('yamljs');
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = yaml.load(path.join(__dirname, 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Import Routes
const authRoutes = require('./routes/authRoutes');
const familyRoutes = require('./routes/familyRoutes');
const personRoutes = require('./routes/personRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const memoryRoutes = require('./routes/memoryRoutes');
const eventRoutes = require('./routes/eventRoutes');
const aiRoutes = require('./routes/aiRoutes');
const gedcomRoutes = require('./routes/gedcomRoutes');
const familyTreeRoutes = require('./routes/familyTreeRoutes');
const reminderRoutes = require('./routes/reminderRoutes');

const legacyRoutes = require('./routes/legacyRoutes');

// Initialize Cron Jobs
require('./cron/reminderCron');
const errorHandler = require('./middleware/errorHandler');

// Mount Routes
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gedcom', gedcomRoutes);
app.use('/api/family-tree', familyTreeRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/legacy', legacyRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('Family Tree API running');
});

// Error Handling Middleware (must be registered after all routes)
app.use(errorHandler);

// Port configuration
const PORT = process.env.PORT || 5001;

// Start server defaults to local, exported for serverless — guarded so
// requiring this module in tests (via supertest) doesn't also bind a port.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
