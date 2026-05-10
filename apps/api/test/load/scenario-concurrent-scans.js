import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

/**
 * Scenario: Concurrent Scan Throughput
 *
 * Validates that the platform can handle multiple simultaneous scan launches
 * and scan-status polling without degradation.
 *
 * Target: 20 concurrent scan launches, p95 < 2s, error rate < 1%
 */
export const options = {
  scenarios: {
    scan_launch: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds,
};

const DATA_SOURCE_IDS = (__ENV.DATA_SOURCE_IDS || 'ds-1,ds-2,ds-3').split(',');

export default function () {
  const dsId = DATA_SOURCE_IDS[Math.floor(Math.random() * DATA_SOURCE_IDS.length)];

  // Launch scan
  const launchRes = http.post(
    `${BASE_URL}/scans`,
    JSON.stringify({
      data_source_id: dsId,
      type: 'full',
      config: { sample_size: 100, include_content_sampling: false },
    }),
    { headers: defaultHeaders, tags: { name: 'POST /scans' } },
  );

  check(launchRes, {
    'scan launched (202)': (r) => r.status === 202 || r.status === 201,
    'response has scan id': (r) => {
      try { return !!JSON.parse(r.body).data.id; } catch { return false; }
    },
  });

  // Poll scan status
  if (launchRes.status === 202 || launchRes.status === 201) {
    let scanId;
    try { scanId = JSON.parse(launchRes.body).data.id; } catch { return; }

    for (let i = 0; i < 5; i++) {
      sleep(2);
      const statusRes = http.get(`${BASE_URL}/scans/${scanId}`, {
        headers: defaultHeaders,
        tags: { name: 'GET /scans/:id' },
      });
      check(statusRes, {
        'status check ok': (r) => r.status === 200,
      });
    }
  }

  sleep(1);
}
