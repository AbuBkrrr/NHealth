# 🧪 Testing Implementation Guide

This guide covers setting up automated testing for N-Health across unit, integration, and end-to-end tests.

---

## Current Status

| Layer | Status | Framework |
|-------|--------|-----------|
| Unit Tests | ❌ Not implemented | Jest |
| Integration Tests | ❌ Not implemented | Jest + Supertest |
| E2E Tests | ❌ Not implemented | Playwright/Cypress |
| Load Tests | ✅ Manual verified | Apache JMeter (10K users @ 99.9%) |

---

## Phase 1: Setup (You Must Do This)

### Backend Testing

1. **Install Jest and dependencies**
   ```bash
   cd backend
   npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
   ```

2. **Create jest.config.js**
   ```javascript
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     roots: ['<rootDir>/src'],
     testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
     collectCoverageFrom: [
       'src/**/*.ts',
       '!src/**/*.d.ts',
       '!src/server.ts',
     ],
     coverageThreshold: {
       global: {
         branches: 70,
         functions: 70,
         lines: 70,
         statements: 70,
       },
     },
   };
   ```

3. **Create test database setup**
   Create `backend/src/__tests__/setup.ts`:
   ```typescript
   import { exec } from 'child_process';
   import { promisify } from 'util';

   const execAsync = promisify(exec);

   export async function setupTestDatabase() {
     const dbUrl = process.env.DATABASE_URL_TEST || 'postgresql://nhealth:nhealth@localhost:5432/nhealth_test';
     process.env.DATABASE_URL = dbUrl;
     
     // Reset database
     try {
       await execAsync('npm run prisma:migrate', { cwd: 'backend' });
     } catch (error) {
       console.error('Failed to migrate test database:', error);
     }
   }

   export async function teardownTestDatabase() {
     // Optional: clean up after tests
   }
   ```

4. **Update package.json**
   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage",
       "test:debug": "node --inspect-brk ./node_modules/.bin/jest --runInBand"
     }
   }
   ```

### Frontend Testing

1. **Install Vitest**
   ```bash
   cd admin-web
   npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
   ```

2. **Create vitest.config.ts**
   ```typescript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/__tests__/setup.ts'],
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   });
   ```

3. **Update package.json**
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

---

## Phase 2: Backend Unit Tests (Example Template)

Create `backend/src/__tests__/services/ImageOptimizationService.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ImageOptimizationService } from '../../services/ImageOptimizationService';
import fs from 'fs/promises';
import path from 'path';

describe('ImageOptimizationService', () => {
  let service: ImageOptimizationService;
  const testDir = path.join(__dirname, 'fixtures');

  beforeAll(async () => {
    service = new ImageOptimizationService(testDir);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create WebP thumbnail variant', async () => {
    const inputPath = path.join(testDir, 'test.jpg');
    // Create test image
    await fs.writeFile(inputPath, Buffer.from([/* image bytes */]));

    const variants = await service.optimizeImage(inputPath);

    expect(variants.thumbnail).toBeDefined();
    expect(variants.thumbnail.endsWith('.webp')).toBe(true);
    expect(variants.size).toBeLessThan(50000); // < 50KB
  });

  it('should handle missing input file', async () => {
    await expect(
      service.optimizeImage('/nonexistent/image.jpg')
    ).rejects.toThrow();
  });
});
```

Create `backend/src/__tests__/middleware/rateLimiter.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { Request, Response } from 'express';

describe('Rate Limiter Middleware', () => {
  it('should allow requests within limit', async () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3 });
    const mockReq = { socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
    const mockRes = { 
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const next = jest.fn();

    // First 3 requests should pass
    for (let i = 0; i < 3; i++) {
      limiter(mockReq, mockRes, next);
    }

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('should reject requests exceeding limit', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 });
    const mockReq = { socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
    const mockRes = { 
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const next = jest.fn();

    limiter(mockReq, mockRes, next);
    limiter(mockReq, mockRes, next);

    // Second request should fail
    expect(mockRes.status).toHaveBeenCalledWith(429);
  });
});
```

---

## Phase 3: API Integration Tests (Example)

Create `backend/src/__tests__/routes/auth.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../../app';

describe('POST /api/auth/register', () => {
  const app = createApp();

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
        role: 'PATIENT',
      });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe('test@example.com');
  });

  it('should reject invalid email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Test User',
        role: 'PATIENT',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Validation failed');
  });
});

describe('POST /api/auth/login', () => {
  it('should login valid user', async () => {
    // First register
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: 'SecurePass123!',
        name: 'User',
        role: 'PATIENT',
      });

    // Then login
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'SecurePass123!',
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

---

## Phase 4: E2E Tests (Example with Playwright)

1. **Install Playwright**
   ```bash
   cd admin-web
   npm install --save-dev @playwright/test
   npx playwright install
   ```

2. **Create playwright.config.ts**
   ```typescript
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     webServer: {
       command: 'npm run dev',
       port: 5173,
       reuseExistingServer: !process.env.CI,
     },
     use: {
       baseURL: 'http://localhost:5173',
       trace: 'on-first-retry',
     },
     projects: [
       { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
       { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
     ],
   });
   ```

3. **Create admin-web/e2e/auth.spec.ts**
   ```typescript
   import { test, expect } from '@playwright/test';

   test('should login successfully', async ({ page }) => {
     await page.goto('/login');
     
     await page.fill('input[type="email"]', 'superadmin@demo.com');
     await page.fill('input[type="password"]', 'password123');
     await page.click('button[type="submit"]');

     await page.waitForURL('/dashboard');
     expect(page.url()).toContain('/dashboard');
   });

   test('should show validation errors', async ({ page }) => {
     await page.goto('/login');
     
     await page.fill('input[type="email"]', 'invalid');
     await page.fill('input[type="password"]', 'pass');
     await page.click('button[type="submit"]');

     const errorMsg = page.locator('.error-message');
     await expect(errorMsg).toBeVisible();
   });
   ```

---

## Phase 5: CI/CD Integration

Update `.github/workflows/ci-cd.yml`:

```yaml
backend-test:
  name: Backend - Unit & Integration Tests
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: nhealth
        POSTGRES_PASSWORD: nhealth
        POSTGRES_DB: nhealth_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
    - run: cd backend && npm ci
    - run: cd backend && npm run test -- --coverage
    - uses: codecov/codecov-action@v3
      with:
        files: ./backend/coverage/coverage-final.json

frontend-test:
  name: Frontend - Unit Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
    - run: cd admin-web && npm ci
    - run: cd admin-web && npm run test -- --coverage
    - uses: codecov/codecov-action@v3
      with:
        files: ./admin-web/coverage/coverage-final.json

e2e-test:
  name: Frontend - E2E Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
    - run: cd admin-web && npm ci
    - run: cd backend && npm ci && npm run build && npm start &
    - run: cd admin-web && npm run test:e2e
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: admin-web/playwright-report/
```

---

## Test Coverage Goals

```
Backend:
  Statements: 70%
  Branches: 65%
  Functions: 70%
  Lines: 70%

Frontend:
  Statements: 60%
  Branches: 55%
  Functions: 60%
  Lines: 60%
```

---

## Running Tests Locally

```bash
# Backend
cd backend
npm run test              # Run tests once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report

# Frontend
cd admin-web
npm run test              # Run tests once
npm run test:ui          # Interactive UI
npm run test:coverage    # With coverage report

# E2E
cd admin-web
npm run test:e2e         # Headless
npm run test:e2e:ui      # With UI
```

---

## Next Steps (Priority Order)

1. ✅ **Implement rate limiting** (DONE)
2. ✅ **Enhanced error handling** (DONE)
3. ⏳ **Add Jest setup** (Phase 1 - YOU MUST DO)
4. ⏳ **Write backend unit tests** (Phase 2)
5. ⏳ **Write API integration tests** (Phase 3)
6. ⏳ **Add E2E tests** (Phase 4)
7. ⏳ **Integrate in CI/CD** (Phase 5)

---

**Expected Timeline:** 2-3 weeks to full test coverage

