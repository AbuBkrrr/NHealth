# Railway Build and Start Commands for N-Health Monorepo

## Current Issue
Railway is only building the backend, not the shared packages (@nhealth/shared-utils, @nhealth/shared-types). This causes MODULE_NOT_FOUND errors at runtime.

## Fix

### Build Command (for Railway Settings)
```
pnpm install --frozen-lockfile && pnpm run build && pnpm --filter @nhealth/backend build
```

**What this does:**
1. `pnpm install --frozen-lockfile` - Install all dependencies
2. `pnpm run build` - Build ALL packages in the monorepo (including shared-utils, shared-types)
3. `pnpm --filter @nhealth/backend build` - Build the backend specifically

### Start Command (for Railway Settings)
```
pnpm --filter @nhealth/backend start:migrate
```

Or if that doesn't work:
```
prisma migrate deploy && node apps/backend/dist/apps/backend/src/server.js
```

---

## Action Steps

1. Go to Railway → n-health-backend → Settings

2. Find "Build Command" and set to:
```
pnpm install --frozen-lockfile && pnpm run build && pnpm --filter @nhealth/backend build
```

3. Find "Start Command" and set to:
```
pnpm --filter @nhealth/backend start:migrate
```

4. Click Save

5. Go to Deployments tab and Redeploy

6. Wait for logs to show all packages building, then backend starting

---

## Expected Output

You should see:
```
> pnpm install --frozen-lockfile
...
> pnpm run build
@nhealth/shared-types: tsc
@nhealth/shared-utils: tsc
@nhealth/backend: [compile output]
> pnpm --filter @nhealth/backend build
...
> node apps/backend/dist/apps/backend/src/server.js
N-Health API listening on port 4000
```

