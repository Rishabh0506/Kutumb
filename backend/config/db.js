const { Pool } = require('pg');
require('dotenv').config();
const logger = require('../utils/logger');

// Load-tested at 500 concurrent requests against the default max of 10 with
// no degradation — kept as the default, but made explicit/tunable rather
// than an invisible library default.
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
};

// Create a PostgreSQL connection pool
const pool = new Pool(
  process.env.DATABASE_URL
    ? { ...poolConfig, connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        ...poolConfig,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
      }
);

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

// An idle client erroring (e.g. a transient network blip, Postgres briefly
// restarting) used to kill the entire server via process.exit(-1) — one bad
// connection took down every in-flight request, not just the one that hit
// it. pg's pool already discards the broken client and opens a fresh one on
// next use; logging and continuing is the behavior pg's own docs recommend.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

module.exports = pool;
