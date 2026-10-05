const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// Plain JSON to stdout in production (what a log aggregator — CloudWatch,
// Datadog, etc. — expects); human-readable in local dev; silent during the
// automated test suite so CI output isn't flooded with a log line per
// request. pino-pretty is a devDependency, so this transport must never
// load in production.
const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  ...(!isProduction && !isTest && {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  }),
});

module.exports = logger;
