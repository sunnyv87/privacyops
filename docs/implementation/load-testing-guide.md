# TechD PrivacyOps -- Load Testing Guide

## Overview

PrivacyOps uses k6 for load testing with 5 predefined scenarios. The shared configuration and helpers are in `apps/api/test/load/k6-config.js`. Tests exercise the API endpoints, event pipeline, and workflow execution under simulated production load.

---

## 1. Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker run --rm -i grafana/k6 run - < test/load/scenario.js
```

### Environment Setup

```bash
# Start the full local stack
pnpm docker:up

# Seed test data
pnpm db:seed

# Export credentials for k6
export BASE_URL=http://localhost:4000/api/v1
export JWT_TOKEN=$(curl -s "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.techd.com","password":"test-password"}' | jq -r '.accessToken')
export TENANT_ID="00000000-0000-0000-0000-000000000001"
export API_KEY="test-api-key"
```

---

## 2. Shared Configuration

`apps/api/test/load/k6-config.js`:

```javascript
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
export const API_KEY = __ENV.API_KEY || 'test-api-key';
export const TENANT_ID = __ENV.TENANT_ID || '00000000-0000-0000-0000-000000000001';

export const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${__ENV.JWT_TOKEN || 'test-jwt-token'}`,
  'X-Tenant-Id': TENANT_ID,
};

export const thresholds = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.01'],
};
```

---

## 3. Scenarios

### Scenario 1: Smoke Test

Validates that all critical endpoints respond correctly under minimal load.

```javascript
// apps/api/test/load/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds,
};

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health returns 200': (r) => r.status === 200,
    'health status is ok': (r) => JSON.parse(r.body).status === 'ok',
  });

  // Readiness check
  const readyRes = http.get(`${BASE_URL}/health/ready`);
  check(readyRes, {
    'ready returns 200': (r) => r.status === 200,
  });

  // Dashboard stats
  const dashRes = http.get(`${BASE_URL}/dashboard/stats`, { headers: defaultHeaders });
  check(dashRes, {
    'dashboard returns 200': (r) => r.status === 200,
  });

  // Data sources list
  const dsRes = http.get(`${BASE_URL}/connectors`, { headers: defaultHeaders });
  check(dsRes, {
    'connectors returns 200': (r) => r.status === 200,
  });

  // DSAR list
  const dsarRes = http.get(`${BASE_URL}/dsar`, { headers: defaultHeaders });
  check(dsarRes, {
    'dsar list returns 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### Scenario 2: Concurrent Scans

Simulates multiple tenants triggering data discovery scans simultaneously.

```javascript
// apps/api/test/load/concurrent-scans.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

const scansStarted = new Counter('scans_started');
const scansCompleted = new Counter('scans_completed');

export const options = {
  scenarios: {
    concurrent_scans: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '1m', target: 10 },   // Ramp to 10 concurrent scanners
        { duration: '3m', target: 10 },   // Sustain
        { duration: '1m', target: 20 },   // Spike to 20
        { duration: '2m', target: 20 },   // Sustain spike
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    ...thresholds,
    http_req_duration: ['p(95)<5000'],  // Scans are heavier
    scans_started: ['count>50'],
  },
};

export default function () {
  // List available data sources
  const dsRes = http.get(`${BASE_URL}/connectors`, { headers: defaultHeaders });
  if (dsRes.status !== 200) return;

  const dataSources = JSON.parse(dsRes.body).data || [];
  if (dataSources.length === 0) return;

  // Trigger scan on a random data source
  const ds = dataSources[Math.floor(Math.random() * dataSources.length)];
  const scanRes = http.post(
    `${BASE_URL}/discovery/scan`,
    JSON.stringify({ dataSourceId: ds.id }),
    { headers: defaultHeaders },
  );

  check(scanRes, {
    'scan trigger returns 201/202': (r) => r.status === 201 || r.status === 202,
  });

  if (scanRes.status === 201 || scanRes.status === 202) {
    scansStarted.add(1);
  }

  sleep(5);
}
```

### Scenario 3: DSAR Load

Tests the DSAR submission and processing pipeline under sustained load.

```javascript
// apps/api/test/load/dsar-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

export const options = {
  scenarios: {
    dsar_submissions: {
      executor: 'constant-arrival-rate',
      rate: 10,            // 10 DSARs per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    ...thresholds,
    'http_req_duration{name:submit_dsar}': ['p(95)<3000'],
    'http_req_duration{name:list_dsars}': ['p(95)<1000'],
  },
};

const DSAR_TYPES = ['access', 'deletion', 'portability', 'rectification'];

export default function () {
  const dsarType = DSAR_TYPES[Math.floor(Math.random() * DSAR_TYPES.length)];

  // Submit DSAR
  const submitRes = http.post(
    `${BASE_URL}/dsar`,
    JSON.stringify({
      type: dsarType,
      subjectEmail: `subject-${__VU}-${__ITER}@example.com`,
      subjectName: `Test Subject ${__VU}`,
      description: `Load test DSAR ${dsarType} request`,
    }),
    { headers: defaultHeaders, tags: { name: 'submit_dsar' } },
  );

  check(submitRes, {
    'DSAR submission returns 201': (r) => r.status === 201,
  });

  // List DSARs
  const listRes = http.get(
    `${BASE_URL}/dsar?page=1&pageSize=20`,
    { headers: defaultHeaders, tags: { name: 'list_dsars' } },
  );

  check(listRes, {
    'DSAR list returns 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### Scenario 4: Event Pipeline

Stress-tests the NATS event publishing and consumption path.

```javascript
// apps/api/test/load/event-pipeline.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

const eventLatency = new Trend('event_publish_latency');

export const options = {
  scenarios: {
    event_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '1m', target: 500 },  // Peak burst
        { duration: '1m', target: 50 },   // Cool down
      ],
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    ...thresholds,
    event_publish_latency: ['p(95)<500'],
  },
};

export default function () {
  // Trigger actions that publish events
  const actions = [
    { method: 'GET', url: `${BASE_URL}/dashboard/stats` },
    { method: 'GET', url: `${BASE_URL}/connectors` },
    { method: 'GET', url: `${BASE_URL}/compliance/status` },
    { method: 'GET', url: `${BASE_URL}/dspm/risk-summary` },
  ];

  const action = actions[Math.floor(Math.random() * actions.length)];
  const start = Date.now();
  const res = http.request(action.method, action.url, null, { headers: defaultHeaders });
  eventLatency.add(Date.now() - start);

  check(res, {
    'response is successful': (r) => r.status >= 200 && r.status < 300,
  });
}
```

### Scenario 5: API Burst

Simulates sudden traffic spikes to test rate limiting and auto-scaling.

```javascript
// apps/api/test/load/api-burst.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

export const options = {
  scenarios: {
    api_burst: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 50 },   // Ramp
        { duration: '30s', target: 200 },   // Burst
        { duration: '1m', target: 200 },    // Sustain burst
        { duration: '30s', target: 50 },    // Recover
        { duration: '30s', target: 0 },     // Cool down
      ],
    },
  },
  thresholds: {
    ...thresholds,
    http_req_duration: ['p(95)<3000'],       // Relaxed for burst
    http_req_failed: ['rate<0.05'],          // Allow 5% failures under burst
    'http_req_duration{name:health}': ['p(99)<500'],
  },
};

const ENDPOINTS = [
  { name: 'health', method: 'GET', url: '/health', auth: false },
  { name: 'dashboard', method: 'GET', url: '/dashboard/stats', auth: true },
  { name: 'connectors', method: 'GET', url: '/connectors', auth: true },
  { name: 'assets', method: 'GET', url: '/discovery/assets?page=1&pageSize=10', auth: true },
  { name: 'dsar_list', method: 'GET', url: '/dsar?page=1&pageSize=10', auth: true },
  { name: 'compliance', method: 'GET', url: '/compliance/status', auth: true },
  { name: 'incidents', method: 'GET', url: '/incidents?page=1&pageSize=10', auth: true },
  { name: 'vendors', method: 'GET', url: '/vendors?page=1&pageSize=10', auth: true },
];

export default function () {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const headers = endpoint.auth ? defaultHeaders : { 'Content-Type': 'application/json' };

  const res = http.request(
    endpoint.method,
    `${BASE_URL}${endpoint.url}`,
    null,
    { headers, tags: { name: endpoint.name } },
  );

  check(res, {
    [`${endpoint.name} responds`]: (r) => r.status < 500,
  });

  sleep(0.1);
}
```

---

## 4. Running Tests

```bash
# Run individual scenario
k6 run apps/api/test/load/smoke.js

# Run with custom environment
k6 run --env BASE_URL=https://staging.privacyops.techd.com/api/v1 \
       --env JWT_TOKEN=$STAGING_TOKEN \
       apps/api/test/load/concurrent-scans.js

# Run with output to Prometheus
k6 run --out experimental-prometheus-rw \
       --env K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
       apps/api/test/load/api-burst.js

# Run with HTML report
k6 run --out json=results.json apps/api/test/load/dsar-load.js
```

---

## 5. Threshold Definitions

### Default Thresholds (from k6-config.js)

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p(95) < 2000ms | 95th percentile under 2 seconds |
| `http_req_duration` | p(99) < 5000ms | 99th percentile under 5 seconds |
| `http_req_failed` | rate < 1% | Error rate under 1% |

### Per-Scenario Thresholds

| Scenario | Metric | Threshold |
|----------|--------|-----------|
| concurrent-scans | `http_req_duration` p(95) | < 5000ms |
| dsar-load | `submit_dsar` p(95) | < 3000ms |
| dsar-load | `list_dsars` p(95) | < 1000ms |
| event-pipeline | `event_publish_latency` p(95) | < 500ms |
| api-burst | `http_req_failed` rate | < 5% |
| api-burst | `health` p(99) | < 500ms |

---

## 6. CI Integration

### GitHub Actions

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: privacyops
          POSTGRES_PASSWORD: privacyops_dev
          POSTGRES_DB: privacyops
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
      nats:
        image: nats:2.10-alpine
        ports: ['4222:4222']

    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm db:migrate && pnpm db:seed
      - run: pnpm --filter @privacyops/api run build
      - run: node apps/api/dist/main.js &
      - run: sleep 5

      - name: Smoke test
        run: k6 run apps/api/test/load/smoke.js
      - name: DSAR load test
        run: k6 run apps/api/test/load/dsar-load.js

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: k6-results
          path: results.json
```

---

## 7. Baseline Results Interpretation

### Reading k6 Output

```
     scenarios: (100.00%) 1 scenario, 200 max VUs, 3m30s max duration
     ✓ health returns 200
     ✓ response is successful

     checks.........................: 99.8% ✓ 15,960  ✗ 32
     http_req_duration..............: avg=45ms  min=2ms  med=32ms  max=2.1s  p(90)=89ms  p(95)=142ms
     http_req_failed................: 0.20%  ✓ 32      ✗ 15,960
     http_reqs......................: 15,992  76.15/s
```

### Key Metrics to Watch

| Metric | Healthy Range | Action If Exceeded |
|--------|--------------|-------------------|
| p(95) latency | < 2s | Investigate slow queries, add caching |
| p(99) latency | < 5s | Check for connection pool exhaustion |
| Error rate | < 1% | Check logs for 5xx errors, OOM |
| RPS | > 100 req/s (3 pods) | Scale API replicas |
| VU iteration time | < 10s | Check for blocking operations |
