import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://49.12.189.108:3000';

export const options = {
  scenarios: {
    health_check: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      startTime: '0s',
      exec: 'healthCheck',
    },
    destinations_cached: {
      executor: 'constant-vus',
      vus: 30,
      duration: '60s',
      startTime: '60s',
      exec: 'destinationsList',
    },
    restaurants_list: {
      executor: 'constant-vus',
      vus: 30,
      duration: '60s',
      startTime: '120s',
      exec: 'restaurantsList',
    },
    ai_search: {
      executor: 'constant-vus',
      vus: 20,
      duration: '90s',
      startTime: '180s',
      exec: 'aiSearch',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.05'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'daniyehudai@gmail.com', password: 'daniel2109' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login 200': (r) => r.status === 201 || r.status === 200 });
  const token = res.json('access_token');
  if (!token) throw new Error(`Login failed: ${res.status} ${res.body}`);
  return { token };
}

export function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health 200': (r) => r.status === 200 });
  sleep(1);
}

export function destinationsList(data) {
  const res = http.get(`${BASE_URL}/destinations`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(res, { 'destinations 200': (r) => r.status === 200 });
  sleep(1);
}

export function restaurantsList(data) {
  const res = http.get(`${BASE_URL}/restaurants?destinationId=355&offset=0`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(res, { 'restaurants 200': (r) => r.status === 200 });
  sleep(1);
}

export function aiSearch(data) {
  const res = http.get(
    `${BASE_URL}/restaurants/search?destinationId=355&q=${encodeURIComponent('מסעדה כשרה')}`,
    {
      headers: { Authorization: `Bearer ${data.token}` },
    },
  );
  check(res, { 'search 200': (r) => r.status === 200 });
  sleep(1);
}
