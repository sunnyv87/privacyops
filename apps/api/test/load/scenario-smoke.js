import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, defaultHeaders } from './k6-config.js';

/**
 * Smoke test — one VU, one iteration per endpoint group.
 *
 * Purpose: verify that all load-test target endpoints are reachable and
 * respond without 5xx errors. Run this in CI before full load tests to
 * catch deployment regressions early.
 *
 *   k6 run test/load/scenario-smoke.js
 */
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
};

export default function () {
  // Scan endpoints
  const scansRes = http.get(`${BASE_URL}/scans?page=1&page_size=1`, {
    headers: defaultHeaders,
    tags: { name: 'GET /scans' },
  });
  check(scansRes, {
    'scans reachable': (r) => r.status === 200,
  });

  // DSAR endpoints
  const dsarRes = http.get(`${BASE_URL}/dsar/requests?page=1&page_size=1`, {
    headers: defaultHeaders,
    tags: { name: 'GET /dsar/requests' },
  });
  check(dsarRes, {
    'dsar reachable': (r) => r.status === 200,
  });

  // Consent endpoints
  const consentRes = http.get(`${BASE_URL}/consent/records?page=1&page_size=1`, {
    headers: defaultHeaders,
    tags: { name: 'GET /consent/records' },
  });
  check(consentRes, {
    'consent reachable': (r) => r.status === 200,
  });

  // Dashboard endpoints
  const dashRes = http.get(`${BASE_URL}/dashboard/stats`, {
    headers: defaultHeaders,
    tags: { name: 'GET /dashboard/stats' },
  });
  check(dashRes, {
    'dashboard reachable': (r) => r.status === 200,
  });

  // Remediation endpoints
  const remRes = http.get(`${BASE_URL}/remediation?page=1&page_size=1`, {
    headers: defaultHeaders,
    tags: { name: 'GET /remediation' },
  });
  check(remRes, {
    'remediation reachable': (r) => r.status === 200,
  });

  // Incidents endpoints
  const incRes = http.get(`${BASE_URL}/incidents?page=1&page_size=1`, {
    headers: defaultHeaders,
    tags: { name: 'GET /incidents' },
  });
  check(incRes, {
    'incidents reachable': (r) => r.status === 200,
  });

  // Health check
  const healthRes = http.get(`${BASE_URL.replace('/api/v1', '')}/health`, {
    tags: { name: 'GET /health' },
  });
  check(healthRes, {
    'health reachable': (r) => r.status === 200 || r.status === 404,
  });
}
