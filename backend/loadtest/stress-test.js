// Pushes past the earlier clean 100-VU result to find the actual breaking
// point — no think-time, so each VU hammers as fast as it can, putting
// real pressure on the pg connection pool (default max: 10).
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/api';

const users = new SharedArray('seeded users', function () {
  return JSON.parse(open('./seed-data.json'));
});

export const options = {
  stages: [
    { duration: '15s', target: 150 },
    { duration: '20s', target: 150 },
    { duration: '15s', target: 300 },
    { duration: '20s', target: 300 },
    { duration: '15s', target: 500 },
    { duration: '20s', target: 500 },
    { duration: '15s', target: 0 },
  ],
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  const headers = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` } };
  const treeRes = http.get(`${BASE_URL}/family-tree/${user.familyId}`, headers);
  check(treeRes, { 'GET /family-tree/:id 200': (r) => r.status === 200 });
}
