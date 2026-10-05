// Small, deliberately restrained test of register+login latency (the
// bcrypt-heavy path) — kept under authLimiter's real 15-req/15min-per-IP
// ceiling on purpose, since that's the actual constraint production traffic
// would hit too. Not meant to find a breaking point, just to measure real
// per-request cost of the auth path in isolation.
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/api';

export const options = {
  vus: 5,
  iterations: 5, // 5 register + 5 login = 10 auth requests, under the 15/15min cap
};

export default function () {
  const email = `loadtest_auth_${Date.now()}_${__VU}@example.com`;
  const password = 'LoadTest123!';

  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ name: 'Auth Load Test', email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(registerRes, { 'register 201': (r) => r.status === 201 });

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(loginRes, { 'login 200': (r) => r.status === 200 });
}
