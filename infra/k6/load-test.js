import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 100 },  // Spike to 100 requests/sec
    { duration: '30s', target: 0 }    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'], // 95% of requests must complete below 1.5s
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  }
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  // 1. Check Public Transparency Stats
  const statsRes = http.get(`${BASE_URL}/api/v1/public/stats`);
  check(statsRes, {
    'stats status is 200': (r) => r.status === 200,
    'has resolution metrics': (r) => r.body.includes('metrics')
  });

  // 2. Check Health Probe
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'service is healthy': (r) => r.body.includes('healthy')
  });

  sleep(1);
}
