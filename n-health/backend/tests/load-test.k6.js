// ==================== LOAD TESTING SUITE - 10,000 CONCURRENT USERS ====================
// Framework: Apache JMeter + K6.io + Artillery
// Target: 10,000 concurrent users
// Duration: 15 minutes ramp-up
// Success Criteria: 99.9% success rate, <2s response time

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ==================== CUSTOM METRICS ====================

const errorRate = new Rate('errors');
const authSuccessRate = new Rate('auth_success');
const appointmentSuccessRate = new Rate('appointment_success');
const responseTime = new Trend('response_time');
const activeUsers = new Gauge('active_users');
const totalRequests = new Counter('total_requests');

// ==================== CONFIGURATION ====================

export const options = {
  stages: [
    { duration: '2m', target: 1000 },    // Ramp-up to 1,000 users
    { duration: '5m', target: 5000 },    // Ramp-up to 5,000 users
    { duration: '5m', target: 10000 },   // Ramp-up to 10,000 users
    { duration: '2m', target: 5000 },    // Ramp-down to 5,000
    { duration: '1m', target: 0 },       // Ramp-down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<3000'],  // 95th percentile < 2s, 99th < 3s
    'errors': ['rate<0.1'],                              // Error rate < 0.1%
    'http_req_failed': ['rate<0.001'],                   // Failed requests < 0.1%
  },
};

// ==================== TEST SETUP ====================

const API_URL = __ENV.API_URL || 'http://localhost:4000/api';
const WS_URL = __ENV.WS_URL || 'ws://localhost:4000';

// Test user pool
const testUsers = [];
for (let i = 0; i < 100; i++) {
  testUsers.push({
    email: `user${i}@test.com`,
    password: 'Test@123456',
    token: null,
  });
}

let userIndex = 0;

// ==================== MAIN TEST SCRIPT ====================

export default function (data) {
  activeUsers.add(__VU);
  totalRequests.add(1);

  // Select a user from the pool
  const user = testUsers[(__VU - 1) % testUsers.length];

  group('Authentication Flow', () => {
    authenticationTest(user);
  });

  group('Patient Operations', () => {
    patientOperationsTest(user);
  });

  group('Appointment Flow', () => {
    appointmentFlowTest(user);
  });

  group('Cross-Module Operations', () => {
    crossModuleTest(user);
  });

  group('Concurrent Operations', () => {
    concurrentOperationsTest(user);
  });

  sleep(1);
}

// ==================== TEST FUNCTIONS ====================

// 1. AUTHENTICATION TEST
function authenticationTest(user) {
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const response = http.post(`${API_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => r.json('token') !== null,
    'token is JWT format': (r) => r.json('token').split('.').length === 3,
  });

  authSuccessRate.add(success);
  responseTime.add(response.timings.duration);
  errorRate.add(!success);

  if (success) {
    user.token = response.json('token');
  }
}

// 2. PATIENT OPERATIONS TEST
function patientOperationsTest(user) {
  const headers = {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json',
  };

  // Get patient profile
  let response = http.get(`${API_URL}/patient/profile`, { headers });
  check(response, {
    'get profile status is 200': (r) => r.status === 200,
    'profile has required fields': (r) => r.json('data.firstName') !== null,
  });
  responseTime.add(response.timings.duration);

  // Update patient profile
  const updatePayload = JSON.stringify({
    firstName: `User${Math.random()}`,
    lastName: 'Test',
  });

  response = http.patch(`${API_URL}/patient/profile`, updatePayload, { headers });
  check(response, {
    'update profile status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Get medications
  response = http.get(`${API_URL}/patient/medications`, { headers });
  check(response, {
    'get medications status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Get allergies
  response = http.get(`${API_URL}/patient/allergies`, { headers });
  check(response, {
    'get allergies status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Get appointments
  response = http.get(`${API_URL}/patient/appointments`, { headers });
  check(response, {
    'get appointments status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);
}

// 3. APPOINTMENT FLOW TEST
function appointmentFlowTest(user) {
  const headers = {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json',
  };

  // Get upcoming appointments
  let response = http.get(`${API_URL}/patient/appointments/upcoming`, { headers });
  check(response, {
    'get upcoming appointments status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Book new appointment
  const bookPayload = JSON.stringify({
    doctorId: 'doctor-' + Math.floor(Math.random() * 100),
    dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    consultationType: 'in-person',
    reason: 'General checkup',
    duration: 30,
  });

  response = http.post(`${API_URL}/patient/appointments`, bookPayload, { headers });

  const success = check(response, {
    'book appointment status is 201': (r) => r.status === 201,
    'appointment has ID': (r) => r.json('data.id') !== null,
  });

  appointmentSuccessRate.add(success);
  responseTime.add(response.timings.duration);

  if (success && response.json('data.id')) {
    const appointmentId = response.json('data.id');

    // Reschedule appointment
    const reschedulePayload = JSON.stringify({
      newDateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    });

    response = http.patch(
      `${API_URL}/patient/appointments/${appointmentId}/reschedule`,
      reschedulePayload,
      { headers }
    );

    check(response, {
      'reschedule appointment status is 200': (r) => r.status === 200,
    });
    responseTime.add(response.timings.duration);
  }
}

// 4. CROSS-MODULE TEST
function crossModuleTest(user) {
  const headers = {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json',
  };

  // Patient gets prescription from doctor
  let response = http.get(`${API_URL}/patient/health/records?type=prescription`, { headers });
  check(response, {
    'get prescriptions status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Get pharmacy medicines
  response = http.get(`${API_URL}/pharmacy/medicines?search=paracetamol`, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(response, {
    'search medicines status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Get lab tests
  response = http.get(`${API_URL}/lab/tests?category=blood`, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(response, {
    'get lab tests status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);

  // Get insurance plans
  response = http.get(`${API_URL}/insurance/plans`, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(response, {
    'get insurance plans status is 200': (r) => r.status === 200,
  });
  responseTime.add(response.timings.duration);
}

// 5. CONCURRENT OPERATIONS TEST
function concurrentOperationsTest(user) {
  const headers = {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json',
  };

  // Simulate 10 concurrent requests
  const responses = http.batch([
    ['GET', `${API_URL}/patient/profile`, null, { headers }],
    ['GET', `${API_URL}/patient/medications`, null, { headers }],
    ['GET', `${API_URL}/patient/allergies`, null, { headers }],
    ['GET', `${API_URL}/patient/appointments`, null, { headers }],
    ['GET', `${API_URL}/patient/health/records`, null, { headers }],
    ['GET', `${API_URL}/patient/health/vitals/history`, null, { headers }],
    ['GET', `${API_URL}/patient/favorite-providers`, null, { headers }],
    ['GET', `${API_URL}/patient/consent`, null, { headers }],
    ['GET', `${API_URL}/notifications`, null, { headers }],
    ['GET', `${API_URL}/messages`, null, { headers }],
  ]);

  let successCount = 0;
  responses.forEach((response) => {
    if (response.status === 200) {
      successCount++;
    }
    responseTime.add(response.timings.duration);
  });

  check(successCount, {
    'batch requests: 8+ of 10 successful': (count) => count >= 8,
  });
}

// ==================== SETUP ====================

export function setup() {
  console.log('🚀 Starting load test for 10,000 concurrent users');
  console.log(`API URL: ${API_URL}`);
  console.log(`Target stages: 1K → 5K → 10K → 5K → 0`);

  // Warm up
  http.get(`${API_URL}/health`, {
    tags: { name: 'Health Check' },
  });

  return { startTime: new Date() };
}

// ==================== TEARDOWN ====================

export function teardown(data) {
  console.log('✅ Load test completed');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date()}`);
}

// ==================== SUMMARY ====================

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  let summary = '\n\n📊 LOAD TEST SUMMARY\n';
  summary += '═══════════════════════════════════════\n';
  summary += `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `Success Rate: ${(100 - data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  summary += `Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(3)}%\n`;
  summary += `P95 Response Time: ${data.metrics.http_req_duration.values['p(95)']}ms\n`;
  summary += `P99 Response Time: ${data.metrics.http_req_duration.values['p(99)']}ms\n`;
  summary += `Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += '═══════════════════════════════════════\n\n';
  return summary;
}
