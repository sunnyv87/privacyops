/**
 * Shared k6 configuration and helpers for PrivacyOps load tests.
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run:        k6 run test/load/<scenario>.js
 */

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
