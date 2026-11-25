# N-Health Monorepo Structure

This document maps out the professional structure of the N-Health monorepo.

## 🏗️ Core Directories

### `apps/` - Deployable Applications

Each app is independently deployable but shares types and utilities.

#### `apps/backend/` — Express API
- **Runtime**: Node.js 20+
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL (Prisma ORM)
- **Real-time**: Socket.io
- **Key Files**:
  - `src/server.ts` — Express app bootstrap
  - `src/app.ts` — App initialization
  - `src/config/env.ts` — Environment validation (Zod)
  - `src/config/prisma.ts` — Database client
  - `src/controllers/` — Route handlers (7 per role + auth/admin)
  - `src/routes/` — Express route definitions
  - `src/middleware/` — Auth, error handling, logging
  - `src/sockets/` — Socket.io event handlers
  - `src/utils/` — JWT, errors, validators, PDF, geolocation
  - `prisma/schema.prisma` — Database schema (21 tables)
  - `prisma/migrations/` — SQL migrations

#### `apps/admin-web/` — React Admin Dashboard
- **Runtime**: Browser (modern ES2020)
- **Framework**: React 18 + Vite + TypeScript
- **Key Files**:
  - `src/pages/` — Dashboard, user management, audit log
  - `src/components/` — Reusable UI components
  - `src/api/` — API client (axios)
  - `src/hooks/` — Custom React hooks
  - `src/types/` — TypeScript interfaces
  - `index.html` — Root HTML file

#### `apps/mobile/` — React Native Mobile App
- **Runtime**: iOS/Android via Expo
- **Framework**: React Native (Expo) + TypeScript
- **Key Files**:
  - `src/navigation/` — React Navigation setup (6 role tabs)
  - `src/screens/` — All role-specific screens
  - `src/components/` — Shared UI components
  - `src/api/` — API client (axios)
  - `src/hooks/` — Custom hooks (location, socket, storage)
  - `src/types/` — TypeScript interfaces
  - `src/utils/` — Helpers (formatting, validation)
  - `App.tsx` — Root component

---

### `packages/` - Shared Packages (Workspaces)

Imported by all apps via `@nhealth/*` path aliases.

#### `packages/shared-types/` — Types & Schemas
- **Exports**: TypeScript interfaces, Zod validators, enums
- **Consumers**: backend, admin-web, mobile
- **Key Exports**:
  - Enums: `Role`, `AppointmentStatus`, `OrderStatus`, `PaymentStatus`
  - Schemas: `JwtPayloadSchema`, `AuthSchema`, `RegisterSchema`
  - Types: `User`, `Payment`, `ApiResponse<T>`, `PaginatedResponse<T>`

#### `packages/shared-utils/` — Utilities
- **Exports**: JWT functions, logger factory, error handling
- **Consumers**: backend, admin-web (optional), mobile (optional)
- **Key Modules**:
  - `jwt.ts` — `signToken()`, `verifyToken()`, `extractBearerToken()`
  - `logger.ts` — `createLogger()`, `backendLogger`
  - `errors.ts` — `ApiError`, `isApiError()`, `toApiError()`

#### `packages/eslint-config/` — Linting Rules
- **Exports**: ESLint configurations (shareable)
- **Consumers**: backend, admin-web, mobile
- **Key Modules**:
  - `index.js` — Base JavaScript config
  - `typescript.js` — TypeScript + @typescript-eslint rules
  - `react.js` — React + react-hooks rules

---

### `infrastructure/` - Deployment & DevOps

#### `infrastructure/docker/`
- `Dockerfile` — Multi-stage build for backend
- `docker-compose.yml` — Local dev stack (Postgres + backend + Adminer)

#### `infrastructure/kubernetes/` (Optional)
- Kubernetes manifests for cloud deployment

---

### `.github/` - CI/CD & GitHub Config

#### `.github/workflows/`
- `ci.yml` — GitHub Actions workflow (lint → type-check → build → test)

---

## 📋 Configuration Files (Root)

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Monorepo workspace definitions |
| `turbo.json` | Turbo build orchestration |
| `package.json` | Root workspace config + scripts |
| `.prettierrc` | Code formatting rules |
| `.editorconfig` | IDE-agnostic editor settings |
| `.nvmrc` | Node.js version (20.14.0) |
| `.gitattributes` | Git line ending normalization |
| `.prettierignore` | Files/dirs to skip formatting |
| `.eslintignore` | Files/dirs to skip linting |
| `.gitignore` | Git ignore patterns |

---

## 🔗 Import Paths

All applications use path aliases defined in their `tsconfig.json`:

```typescript
// ✅ Import shared types
import { Role, User, ApiResponse } from '@nhealth/shared-types';

// ✅ Import shared utilities
import { signToken, ApiError, createLogger } from '@nhealth/shared-utils';

// ✅ Import local files
import { userController } from '@/controllers/userController';

// ❌ Avoid relative imports
import { userController } from '../../../controllers/userController';
```

---

## 📦 Publishing & Distribution

Each package has:
- `package.json` with `name` (scoped: `@nhealth/*`)
- `tsconfig.json` (strict TypeScript)
- `src/` directory with source code
- `dist/` directory (generated on build)

### Build Output

```
packages/shared-types/
├── dist/
│   ├── index.js       # CommonJS output
│   ├── index.d.ts     # Type definitions
│   └── index.d.ts.map # Source maps
└── src/
    └── index.ts       # Source
```

### Workspace Reference

In dependent packages:

```json
{
  "dependencies": {
    "@nhealth/shared-types": "workspace:*",
    "@nhealth/shared-utils": "workspace:*"
  }
}
```

This tells pnpm to link to the local workspace package instead of fetching from npm.

---

## 🔄 Build & Dependency Graph

```
packages/shared-types
        ↓
packages/shared-utils  (depends on shared-types)
        ↓
    All apps (depends on shared-types + shared-utils)
```

**Turbo optimizes this graph** by:
- Building only changed packages
- Caching build artifacts
- Running builds in parallel where safe
- Skipping unnecessary rebuilds

---

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| **Total Packages** | 6 (3 apps + 3 shared) |
| **Total Tables** | 21 (Postgres) |
| **Roles** | 7 (Patient, Doctor, Pharmacy, Lab, Ambulance, Nurse, Admin) |
| **Mobile Screens** | 37+ |
| **API Endpoints** | 50+ |
| **TypeScript Files** | 200+ |
| **Type Safety** | 100% (no `any` types) |

---

## 🚀 Getting Started

### 1. Install
```bash
pnpm install
```

### 2. Build All
```bash
pnpm run build
```

### 3. Run Locally
```bash
pnpm run dev                # All apps in parallel
pnpm run backend:dev        # Backend only
pnpm run admin:dev          # Admin-web only
pnpm run mobile:dev         # Mobile only
```

### 4. Deploy
```bash
pnpm run build              # Build for production
docker build -f infrastructure/docker/Dockerfile -t n-health .
```

---

## 📚 Additional Resources

- **README.md** — Project overview, architecture, quick start
- **CONTRIBUTING.md** — Contribution guidelines, code standards
- **CHANGELOG.md** — Version history and release notes
- **apps/backend/README.md** — Backend-specific setup
- **apps/admin-web/README.md** — Admin-web-specific setup
- **apps/mobile/README.md** — Mobile-specific setup

---

**Version**: 2.0.0 | **Last Updated**: December 2024
