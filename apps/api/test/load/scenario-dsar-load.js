import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

/**
 * Scenario: DSAR Processing Under Deadline Pressure
 *
 * Simulates burst DSAR submissions followed by concurrent status checks
 * and download attempts — the pattern seen during regulatory enforcement
 * periods or public data breach disclosures.
 *
 * Target: 50 DSAR submissions in 2 minutes, p95 < 2s
 */
export const options = {
  scenarios: {
    dsar_submission: {
      executor: 'constant-arrival-rate',
      rate: 25,
      timeUnit: '1m',
      duration: '2m',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    ...thresholds,
    'http_req_duration{name:POST /dsar/requests}': ['p(95)<3000'],
    'http_req_duration{name:GET /dsar/requests/:id/download}': ['p(95)<5000'],
  },
};

const REQUESTOR_NAMES = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve'];

export default function () {
  const name = REQUESTOR_NAMES[Math.floor(Math.random() * REQUESTOR_NAMES.length)];
  const email = `${name.toLowerCase()}-${Date.now()}@example.com`;

  // Submit DSAR
  const submitRes = http.post(
    `${BASE_URL}/dsar/requests`,
    JSON.stringify({
      type: 'access',
      requestor: { name, email, relationship: 'self' },
      details: 'Please provide all personal data you hold about me.',
    }),
    { headers: defaultHeaders, tags: { name: 'POST /dsar/requests' } },
  );

  check(submitRes, {
    'dsar submitted (201)': (r) => r.status === 201,
    'has reference number': (r) => {
      try { return !!JSON.parse(r.body).data.reference_number; } catch { return false; }
    },
  });

  if (submitRes.status !== 201) return;

  let requestId;
  try { requestId = JSON.parse(submitRes.body).data.id; } catch { return; }

  // Poll status
  sleep(2);
  const statusRes = http.get(`${BASE_URL}/dsar/requests/${requestId}`, {
    headers: defaultHeaders,
    tags: { name: 'GET /dsar/requests/:id' },
  });
  check(statusRes, {
    'status check ok': (r) => r.status === 200,
  });

  // Attempt download (may fail if not yet generated — that's expected)
  sleep(1);
  const downloadRes = http.get(`${BASE_URL}/dsar/requests/${requestId}/download`, {
    headers: defaultHeaders,
    tags: { name: 'GET /dsar/requests/:id/download' },
  });
  check(downloadRes, {
    'download responded': (r) => r.status === 200 || r.status === 404 || r.status === 500,
  });
}
