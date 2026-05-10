import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

/**
 * Scenario: API Burst Traffic & Rate Limiting
 *
 * Validates that the platform correctly enforces rate limits under
 * burst conditions and returns 429 with proper headers rather than
 * dropping requests or returning 5xx errors.
 *
 * Target: burst to 200 req/s, verify 429 responses include rate limit
 *         headers, no 5xx errors.
 */
export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 200 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    ...thresholds,
    'checks{name:no_5xx}': ['rate>0.99'],
    'http_req_duration{name:GET /dashboard/summary}': ['p(95)<1000'],
  },
};

const READ_ENDPOINTS = [
  '/dashboard/summary',
  '/findings?page=1&page_size=10',
  '/connectors?page=1&page_size=10',
  '/consent/notices?page=1&page_size=10',
  '/retention/policies?page=1&page_size=10',
  '/ropa?page=1&page_size=10',
];

export default function () {
  const endpoint = READ_ENDPOINTS[Math.floor(Math.random() * READ_ENDPOINTS.length)];

  const res = http.get(`${BASE_URL}${endpoint}`, {
    headers: defaultHeaders,
    tags: { name: `GET ${endpoint.split('?')[0]}` },
  });

  check(res, {
    'no_5xx': (r) => r.status < 500,
    'has rate limit headers when throttled': (r) => {
      if (r.status === 429) {
        return r.headers['X-Ratelimit-Limit'] !== undefined;
      }
      return true;
    },
  });

  if (res.status === 429) {
    const resetMs = parseInt(res.headers['X-Ratelimit-Reset'] || '1000', 10);
    sleep(Math.min(resetMs / 1000, 5));
  }
}
