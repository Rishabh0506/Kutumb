// One-off local script: seeds N test users (each owning a small family with
// people/relationships/a memory) directly via SQL, and mints a real JWT for
// each (same shape/secret as a real login) so k6 can hit authenticated
// endpoints without going through /auth/login and tripping its rate limit.
// Writes backend/loadtest/seed-data.json for k6 to read.
//
// Run: node loadtest/seed.js
// Clean up afterward: node loadtest/cleanup.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const NUM_USERS = Number(process.env.LOADTEST_USERS || 60);
const PREFIX = 'loadtest';

async function main() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not set — source backend/.env first');
  }

  const seeded = [];
  const passwordHash = await bcrypt.hash('LoadTest123!', 10);

  for (let i = 0; i < NUM_USERS; i++) {
    const email = `${PREFIX}_${Date.now()}_${i}@example.com`;

    const { rows: [user] } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id',
      [`Load Test ${i}`, email, passwordHash]
    );

    const { rows: [family] } = await pool.query(
      'INSERT INTO families (family_name, created_by) VALUES ($1,$2) RETURNING id',
      [`Load Test Family ${i}`, user.id]
    );

    let lastPersonId = null;
    for (let p = 0; p < 4; p++) {
      const { rows: [person] } = await pool.query(
        'INSERT INTO persons (family_id, first_name, last_name) VALUES ($1,$2,$3) RETURNING id',
        [family.id, `Person${p}`, `LT${i}`]
      );
      if (lastPersonId) {
        await pool.query(
          'INSERT INTO relationships (person1_id, person2_id, relationship_type) VALUES ($1,$2,$3)',
          [lastPersonId, person.id, 'sibling']
        );
      }
      lastPersonId = person.id;
    }

    await pool.query(
      'INSERT INTO memories (family_id, person_id, title, description) VALUES ($1,$2,$3,$4)',
      [family.id, lastPersonId, 'Load test memory', 'seeded for load testing']
    );

    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '24h' });

    seeded.push({ userId: user.id, email, token, familyId: family.id, personId: lastPersonId });
  }

  fs.writeFileSync(
    path.join(__dirname, 'seed-data.json'),
    JSON.stringify(seeded, null, 2)
  );

  console.log(`Seeded ${seeded.length} users/families -> loadtest/seed-data.json`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
