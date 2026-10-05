// Deletes everything seed.js created. Run after every load test.
require('dotenv').config();
const pool = require('../config/db');

async function main() {
  const fams = await pool.query("DELETE FROM families WHERE family_name LIKE 'Load Test Family%' RETURNING id");
  const users = await pool.query("DELETE FROM users WHERE email LIKE 'loadtest_%@example.com' RETURNING id");
  console.log(`Deleted ${fams.rowCount} load-test families, ${users.rowCount} load-test users.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
