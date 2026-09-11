# N-Health 🏥

[![CI](https://github.com/your-username/n-health/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/n-health/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933.svg?logo=node.js)](https://nodejs.org/)

> **Complete Healthcare Ecosystem** — A professional, production-ready monorepo featuring a cross-platform mobile app, web admin dashboard, and robust backend API serving six healthcare roles: **Patient, Doctor, Pharmacy, Lab, Ambulance, and Nurse**.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

N-Health is a complete healthcare platform connecting patients with healthcare providers in real-time. The system includes:

- **6 Mobile Apps** — One per healthcare role (Patient, Doctor, Pharmacy, Lab, Ambulance, Nurse)
- **Admin Dashboard** — Real-time analytics, user management, audit logs
- **RESTful Backend API** — Express + Prisma + PostgreSQL with WebSocket support
- **Real-time Updates** — Socket.io for live messaging, GPS tracking, payment confirmations
- **Payment Integration** — Multi-method payment system (USSD, Bank Transfer, Card, Wallet)
- **Geolocation Services** — Proximity-based provider search and emergency ambulance dispatch

### Key Features

✅ **Multi-role Authentication** — JWT-based auth with role-based access control (RBAC)  
✅ **Patient Services** — Appointments, prescriptions, lab tests, emergency ambulance, insurance, donations  
✅ **Provider Workflows** — Appointment/request fulfillment, inventory management, payment confirmation  
✅ **Real-time Messaging** — Cross-role chat system with Socket.io  
✅ **Digital Prescriptions** — Doctor-issued prescriptions with PDF export  
✅ **Payment Management** — Shared payment system across all modules with multiple payment methods  
✅ **Admin Oversight** — User management, audit logging, system analytics  
✅ **Offline Support** — Mobile app shows offline indicator (full sync pending)  

## 🏗️ Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      Frontend Layer                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Mobile App      │  │ Mobile App       │  │ Admin Dashboard  │ │
│  │ (React Native)  │  │ (React Native)   │  │ (React + Vite)   │ │
│  │ 6x Field Roles  │  │ Patient Focus    │  │ Web-based        │ │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘ │
└───────────┼────────────────────┼────────────────────┼─────────────┘
            │                    │                    │
            └────────────────────┴────────────────────┘
                       HTTP + WebSocket
                                │
┌───────────────────────────────┼───────────────────────────────────┐
│                   API Gateway / Backend                            │
├───────────────────────────────┼───────────────────────────────────┤
│                               │                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Express.js Server (TypeScript)                              │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Routes:                                                │ │ │
│  │  │ • Auth (register, login, refresh)                    │ │ │
│  │  │ • Users (profile, avatar upload)                     │ │ │
│  │  │ • Appointments & Prescriptions                        │ │ │
│  │  │ • Pharmacy (orders, inventory)                        │ │ │
│  │  │ • Lab (tests, results, PDF)                           │ │ │
│  │  │ • Ambulance (emergency dispatch, GPS tracking)        │ │ │
│  │  │ • Nurse (requests, scheduling)                        │ │ │
│  │  │ • Payments (multi-method confirmation)                │ │ │
│  │  │ • Messaging (conversations, threads)                  │ │ │
│  │  │ • Admin (users, audit log, analytics)                 │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ WebSocket Events (Socket.io):                         │ │ │
│  │  │ • message:new (real-time chat)                        │ │ │
│  │  │ • ambulance:location (GPS broadcast to patient)       │ │ │
│  │  │ • appointment:updated (live status changes)           │ │ │
│  │  │ • payment:confirmed (instant UI updates)              │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                    SQL + Transaction Management
                                │
┌───────────────────────────────┼───────────────────────────────────┐
│                      Data Layer                                    │
├───────────────────────────────┼───────────────────────────────────┤
│                               │                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database (Prisma ORM)                            │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Tables:                                                │ │ │
│  │  │ • Users (7 roles: PATIENT, DOCTOR, PHARMACY, etc.)    │ │ │
│  │  │ • Role Profiles (Patient, Doctor, Pharmacy, Lab, etc.)│ │ │
│  │  │ • Appointments, Prescriptions, Orders                │ │ │
│  │  │ • Lab Tests, Results, Payments                         │ │ │
│  │  │ • Emergency Requests, Nurse Requests                  │ │ │
│  │  │ • Donations, Insurance Policies                        │ │ │
│  │  │ • Messages, Admin Audit Log                            │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Database Schema Highlights

- **21 tables** covering all healthcare workflows
- **Role-based access control** enforced at API and database levels
- **Atomic transactions** for race conditions (ambulance claim, nurse claim, stock decrement)
- **Soft deletes** and audit logging for compliance
- **Polymorphic relationships** for shared payment and audit systems

## 🛠️ Tech Stack

### Backend
- **Runtime** — Node.js 20+
- **Framework** — Express.js
- **Language** — TypeScript (strict mode)
- **Database** — PostgreSQL 16 + Prisma ORM
- **Authentication** — JWT (7-day expiration)
- **Real-time** — Socket.io
- **Validation** — Zod schemas
- **Logging** — Pino (structured JSON logs)
- **File Upload** — Multer + local disk storage (S3-ready)

### Frontend (Admin)
- **Framework** — React 18
- **Build Tool** — Vite
- **Language** — TypeScript (strict mode)
- **Routing** — React Router v6
- **HTTP Client** — Axios

### Mobile
- **Framework** — React Native (Expo)
- **Language** — TypeScript
- **Navigation** — React Navigation (bottom-tab + native-stack)
- **State** — AsyncStorage + hooks
- **Location** — Expo Location
- **File Sharing** — Expo Sharing + File System

### DevOps & Tools
- **Monorepo** — pnpm workspaces
- **Build Orchestration** — Turbo
- **Linting** — ESLint + TypeScript rules
- **Formatting** — Prettier
- **Containerization** — Docker multi-stage builds
- **CI/CD** — GitHub Actions
- **Deployment** — Render Blueprint, Railway, Docker Compose

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+ ([install](https://pnpm.io/installation))
- **Docker** (optional, for local Postgres)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/n-health.git
cd n-health

# Install dependencies (all workspaces)
pnpm install
```

### 2. Setup Environment

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — set DATABASE_URL if using local Postgres

# Admin Web
cp apps/admin-web/.env.example apps/admin-web/.env

# Mobile
cp apps/mobile/.env.example apps/mobile/.env
```

### 3. Start Database

**Option A: Docker Compose (recommended)**
```bash
# Postgres + Backend + Adminer in one command
pnpm run docker:up

# Seed demo data
docker compose -f infrastructure/docker/docker-compose.yml exec backend npm run prisma:seed

# View logs
pnpm run docker:logs
```

**Option B: Local Postgres**
```bash
# Install Postgres locally, then:
cd apps/backend
npx prisma migrate deploy
npm run prisma:seed
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend
pnpm run backend:dev
# → http://localhost:4000

# Terminal 2: Admin Web
pnpm run admin:dev
# → http://localhost:5173

# Terminal 3: Mobile (Expo)
pnpm run mobile:dev
# Scan QR code with Expo Go app
```

### 5. Demo Logins

All demo accounts use password: `password123`

| Email                | Role      | Features                          |
|----------------------|-----------|-----------------------------------|
| patient@demo.com     | Patient   | Browse providers, book, request   |
| doctor@demo.com      | Doctor    | Accept appointments, prescribe    |
| pharmacy@demo.com    | Pharmacy  | Manage inventory, fulfill orders  |
| lab@demo.com         | Lab       | Accept tests, upload results      |
| ambulance@demo.com   | Ambulance | Accept emergencies, track GPS     |
| nurse@demo.com       | Nurse     | Accept requests, schedule visits  |
| superadmin@demo.com  | Admin     | User management, audit log        |

## 📁 Project Structure

```
n-health/
├── apps/
│   ├── backend/                # Express API (TypeScript)
│   │   ├── src/
│   │   │   ├── config/         # Env validation, database config
│   │   │   ├── controllers/    # Route handlers (7 per role + auth/admin)
│   │   │   ├── middleware/     # Auth, error handling, logging
│   │   │   ├── routes/         # Express route definitions
│   │   │   ├── sockets/        # Socket.io event handlers
│   │   │   ├── utils/          # JWT, errors, validators, PDF generation
│   │   │   └── server.ts       # Express app + server bootstrap
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema (21 tables)
│   │   │   ├── migrations/     # SQL migrations
│   │   │   └── seed.ts         # Demo data seeding
│   │   ├── dist/               # Compiled JavaScript (build output)
│   │   ├── Dockerfile          # Multi-stage production build
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── admin-web/              # React Dashboard (Vite)
│   │   ├── src/
│   │   │   ├── pages/          # Dashboard, user management, audit log
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── api/            # API client (axios)
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── types/          # TypeScript interfaces
│   │   │   └── App.tsx         # Root component
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                 # React Native App (Expo)
│       ├── src/
│       │   ├── navigation/     # React Navigation config (6 role tabs)
│       │   ├── screens/        # All role-specific screens
│       │   ├── components/     # Shared UI components
│       │   ├── api/            # API client (axios)
│       │   ├── hooks/          # Custom hooks (location, socket, storage)
│       │   ├── types/          # TypeScript interfaces
│       │   └── utils/          # Helpers (formatting, validation)
│       ├── App.tsx
│       ├── app.json            # Expo config
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/           # TypeScript types + Zod schemas (all apps)
│   │   ├── src/
│   │   │   └── index.ts        # Enums, interfaces, Zod validators
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-utils/           # Utility functions (JWT, logging, errors)
│   │   ├── src/
│   │   │   ├── jwt.ts          # Token signing/verification
│   │   │   ├── logger.ts       # Pino logger factory
│   │   │   ├── errors.ts       # API error handling
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── eslint-config/          # Shared ESLint rules
│       ├── index.js            # Base config
│       ├── typescript.js       # TypeScript-specific
│       ├── react.js            # React + hooks
│       └── package.json
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile          # Multi-stage backend build
│   │   └── docker-compose.yml  # Local dev stack (Postgres + backend)
│   └── kubernetes/             # (Optional) K8s manifests
│
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI/CD pipeline
│
├── .editorconfig               # Editor settings (all files)
├── .gitattributes              # Git line ending normalization
├── .nvmrc                       # Node.js version (20.14.0)
├── .prettierrc                  # Code formatting rules
├── pnpm-workspace.yaml         # Monorepo workspace config
├── turbo.json                  # Turbo build orchestration
├── package.json                # Root workspace config
├── README.md                   # This file
└── LICENSE

```

## 💻 Development

### Useful Commands

```bash
# Monorepo
pnpm install                       # Install all dependencies
pnpm build                         # Build all packages
pnpm run typecheck                 # TypeScript check (all projects)
pnpm run lint                      # ESLint (all projects)
pnpm run format                    # Prettier format (all files)
pnpm run format:check              # Check if code is formatted

# Backend
pnpm run backend:dev               # Start backend dev server
pnpm run -F @nhealth/backend build # Build backend only
cd apps/backend && npm run prisma:studio  # Open Prisma Studio

# Admin Web
pnpm run admin:dev                 # Start admin dev server
pnpm run -F @nhealth/admin-web build      # Build admin-web

# Mobile
pnpm run mobile:dev                # Start Expo dev server

# Docker
pnpm run docker:up                 # Start local Postgres + backend
pnpm run docker:down               # Stop containers
pnpm run docker:logs               # View logs
```

### Database Migrations

```bash
# Create new migration after schema change
cd apps/backend
npx prisma migrate dev --name your_migration_name

# View Prisma Studio
npm run prisma:studio

# Reset database (development only)
npx prisma migrate reset
```

### Adding a New Package

1. Create directory: `packages/my-package`
2. Add `package.json` with workspace reference: `"@nhealth/my-package": "workspace:*"`
3. Create `src/index.ts` and `tsconfig.json`
4. Update root `pnpm-workspace.yaml` (automatically detected)
5. Use in other packages: `import { foo } from '@nhealth/my-package'`

## 🌐 Deployment

### Option 1: Render (One-Click Blueprint) — Recommended

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint** → connect your repo
3. Render auto-detects `render.yaml` and provisions:
   - Backend web service
   - PostgreSQL database
   - Admin web static site
4. Environment variables auto-wired; runs migrations on deploy

```bash
# Check render.yaml for full config
cat render.yaml
```

### Option 2: Railway

1. Connect GitHub repo to [railway.app](https://railway.app)
2. Add PostgreSQL database service
3. Deploy backend: set **Root Directory** to `apps/backend`
4. Deploy admin-web: set **Root Directory** to `apps/admin-web`
5. Set environment variables (JWT_SECRET, CORS_ORIGIN, etc.)

### Option 3: Docker (Self-Hosted)

```bash
# Build image
docker build -f infrastructure/docker/Dockerfile -t n-health-backend .

# Run container
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  n-health-backend
```

### Mobile Deployment (Expo)

```bash
# Build for Android
eas build --platform android --auto-submit

# Build for iOS
eas build --platform ios

# Submit to App Store / Google Play
eas submit --platform ios
eas submit --platform android
```

## 🧪 Testing

```bash
# Run all tests
pnpm run test

# Run tests with coverage
pnpm run test -- --coverage

# Run specific package tests
pnpm run -F @nhealth/backend test
```

### Load Testing

```bash
cd load-test
node simulate.js
# Simulates 100 concurrent users across all roles + stress tests race conditions
```

## 🔒 Security

- ✅ **Strict TypeScript** — No implicit `any`; all types explicit
- ✅ **Environment Validation** — Zod schemas at startup
- ✅ **Helmet.js** — HTTP security headers
- ✅ **CORS** — Configurable origin whitelist
- ✅ **JWT Expiration** — 7-day tokens with refresh flow
- ✅ **Password Hashing** — bcryptjs with salt rounds
- ✅ **SQL Injection Prevention** — Prisma parameterized queries
- ✅ **RBAC** — Role-based access control at API + DB layer
- ✅ **Audit Logging** — All admin actions tracked
- ✅ **Atomic Transactions** — Race condition prevention

## 📚 API Documentation

### Health Check

```bash
GET /health
```

Response:
```json
{ "status": "ok", "timestamp": "2024-12-20T10:30:00Z" }
```

### Authentication

```bash
# Register
POST /auth/register
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe",
  "role": "PATIENT"
}

# Login
POST /auth/login
{ "email": "user@example.com", "password": "secure-password" }

Response:
{
  "token": "eyJhbGc...",
  "user": { "id": "...", "email": "...", "role": "..." }
}
```

### User Profile

```bash
# Get current user
GET /api/account
Authorization: Bearer <token>

# Update profile (role-specific)
PATCH /api/patient/profile
PATCH /api/doctor/profile
# ... etc

# Upload avatar
POST /api/account/avatar
Content-Type: multipart/form-data
```

### Full API Reference

See `apps/backend/src/routes/` for complete endpoint documentation.

## 🤝 Contributing

1. **Fork** the repository
2. **Create feature branch** — `git checkout -b feature/my-feature`
3. **Make changes** — update code, maintain TypeScript strict mode
4. **Run linter & type-checker** — `pnpm run lint && pnpm run typecheck`
5. **Commit** — `git commit -m "feat: add my feature"`
6. **Push** — `git push origin feature/my-feature`
7. **Create Pull Request** — wait for CI to pass, request review

### Code Standards

- **TypeScript** — Strict mode, no `any` types
- **Formatting** — Prettier (run `pnpm run format`)
- **Linting** — ESLint with @typescript-eslint rules
- **Documentation** — JSDoc on all public functions
- **Testing** — Add tests for new features
- **Commits** — Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)

## 📄 License

This project is licensed under the **MIT License** — see `LICENSE` file for details.

---

## 📞 Support

- **Issues** — GitHub Issues for bug reports and feature requests
- **Discussions** — GitHub Discussions for Q&A and ideas
- **Email** — Contact team via [support@n-health.com](mailto:support@n-health.com)

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Thanks to all contributors and the open-source community

---

**Version:** 2.0.0 | **Last Updated:** December 2024
