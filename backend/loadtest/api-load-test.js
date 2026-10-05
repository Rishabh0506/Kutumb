// Simulates realistic mixed read/write authenticated traffic against
// already-seeded users (see seed.js) — isolates steady-state API
// performance from auth-endpoint cost (bcrypt, rate limiting), which is
// tested separately in auth-load-test.js.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/api';

const users = new SharedArray('seeded users', function () {
  return JSON.parse(open('./seed-data.json'));
});

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '20s', target: 20 },
    { duration: '15s', target: 50 },
    { duration: '20s', target: 50 },
    { duration: '15s', target: 100 },
    { duration: '20s', target: 100 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  const headers = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` } };

  const familiesRes = http.get(`${BASE_URL}/families`, headers);
  check(familiesRes, { 'GET /families 200': (r) => r.status === 200 });

  const treeRes = http.get(`${BASE_URL}/family-tree/${user.familyId}`, headers);
  check(treeRes, { 'GET /family-tree/:id 200': (r) => r.status === 200 });

  const remindersRes = http.get(`${BASE_URL}/reminders/${user.familyId}`, headers);
  check(remindersRes, { 'GET /reminders/:id 200': (r) => r.status === 200 });

  const searchRes = http.get(`${BASE_URL}/persons/search?q=Person`, headers);
  check(searchRes, { 'GET /persons/search 200': (r) => r.status === 200 });

  // ~20% of iterations also write, mirroring a mixed real-world load
  if (Math.random() < 0.2) {
    const memRes = http.post(
      `${BASE_URL}/memories`,
      JSON.stringify({ family_id: user.familyId, person_id: user.personId, title: 'Concurrent load memory', description: 'x' }),
      headers
    );
    check(memRes, { 'POST /memories 201': (r) => r.status === 201 });
  }

  sleep(1); // think time between a real user's actions
}
