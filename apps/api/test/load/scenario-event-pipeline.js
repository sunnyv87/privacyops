import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

/**
 * Scenario: Event Pipeline Stress
 *
 * Tests the NATS JetStream event bus under sustained event production.
 * Exercises webhook-triggering endpoints that produce internal events:
 * consent grants, findings, incident reports.
 *
 * Target: 200 events/min sustained for 3 minutes, p95 < 1s
 */
export const options = {
  scenarios: {
    event_burst: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1m',
      duration: '3m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    ...thresholds,
    'http_req_duration{name:POST /consent/records}': ['p(95)<1000'],
    'http_req_duration{name:POST /incidents}': ['p(95)<2000'],
  },
};

const EVENT_TYPES = ['consent', 'finding', 'incident'];

function postConsent() {
  return http.post(
    `${BASE_URL}/consent/records`,
    JSON.stringify({
      subject_identifier: `user-${Date.now()}@example.com`,
      notice_id: '00000000-0000-0000-0000-000000000001',
      purposes: [
        { purpose_id: '00000000-0000-0000-0000-000000000010', granted: true },
        { purpose_id: '00000000-0000-0000-0000-000000000020', granted: false },
      ],
      channel: 'web',
    }),
    { headers: defaultHeaders, tags: { name: 'POST /consent/records' } },
  );
}

function postFindingQuery() {
  return http.get(
    `${BASE_URL}/findings?severity=critical,high&status=open&page=1&page_size=10`,
    { headers: defaultHeaders, tags: { name: 'GET /findings' } },
  );
}

function postIncident() {
  return http.post(
    `${BASE_URL}/incidents`,
    JSON.stringify({
      title: `Load test incident ${Date.now()}`,
      severity: 'low',
      detected_at: new Date().toISOString(),
      description: 'Automated load test event',
      initial_assessment: {
        personal_data_involved: false,
        data_types: [],
        estimated_records: 0,
      },
    }),
    { headers: defaultHeaders, tags: { name: 'POST /incidents' } },
  );
}

export default function () {
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];

  let res;
  switch (type) {
    case 'consent':
      res = postConsent();
      check(res, { 'consent ok': (r) => r.status < 400 });
      break;
    case 'finding':
      res = postFindingQuery();
      check(res, { 'findings ok': (r) => r.status === 200 });
      break;
    case 'incident':
      res = postIncident();
      check(res, { 'incident ok': (r) => r.status < 400 });
      break;
  }

  sleep(0.1);
}
