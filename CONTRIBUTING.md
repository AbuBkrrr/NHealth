# Contributing to N-Health

Thank you for your interest in contributing to N-Health! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and professional. We're all here to build something meaningful.

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/your-username/n-health.git
cd n-health
pnpm install
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/my-amazing-feature
```

Branch naming conventions:
- `feature/add-xyz` — New feature
- `fix/resolve-xyz` — Bug fix
- `docs/update-xyz` — Documentation
- `refactor/improve-xyz` — Code improvement
- `perf/optimize-xyz` — Performance improvement
- `test/add-xyz-tests` — Tests

### 3. Make Your Changes

Follow these standards:

#### TypeScript

- ✅ **Strict Mode Always** — No `any` types
- ✅ **Explicit Return Types** — On public functions
- ✅ **JSDoc Comments** — On all exported functions/interfaces

```typescript
/**
 * Calculates the distance between two coordinates using the Haversine formula.
 * @param lat1 - Starting latitude
 * @param lng1 - Starting longitude
 * @param lat2 - Ending latitude
 * @param lng2 - Ending longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // implementation
}
```

#### Naming Conventions

- **Variables/Functions** — `camelCase`
- **Classes/Types/Interfaces** — `PascalCase`
- **Constants** — `UPPER_SNAKE_CASE` (only for constants, not config)
- **Private methods** — prefix with `_`
- **React Components** — `PascalCase` (same as filename)

```typescript
// ✅ Good
interface UserProfile {
  userId: string;
  displayName: string;
}

const MAX_RETRY_COUNT = 3;

function getUserById(id: string): User | null {
  // implementation
}

export const UserCard: React.FC<UserCardProps> = (props) => {
  // component
};

// ❌ Bad
interface user_profile { }
const maxRetryCount = 3;
function get_user_by_id(id: string) { }
```

#### Error Handling

Use typed errors and meaningful messages:

```typescript
import { ApiError } from '@nhealth/shared-utils';

// ✅ Good
if (!userId) {
  throw ApiError.badRequest('User ID is required');
}

// ❌ Bad
if (!userId) {
  throw new Error('error');
}
```

#### Validation

Use Zod schemas for input validation:

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']),
});

type CreateUserRequest = z.infer<typeof CreateUserSchema>;

export function createUser(data: unknown): User {
  const validated = CreateUserSchema.parse(data);
  // use validated data
}
```

#### Comments

Write clear, concise comments:

```typescript
// ✅ Good - Explains WHY, not what the code does
// Use a write-ahead log to ensure atomicity if the process crashes mid-operation
const writeAheadLog = [];

// ❌ Bad - States the obvious
// Create an array
const writeAheadLog = [];
```

### 4. Format & Lint

```bash
# Auto-format your code
pnpm run format

# Check for linting errors
pnpm run lint

# Type check
pnpm run typecheck

# Fix lint errors automatically
pnpm run lint -- --fix
```

### 5. Test Your Changes

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test -- --watch

# Run tests for a specific package
pnpm run -F @nhealth/backend test
```

If adding a new feature, include tests:

```typescript
// src/utils/distance.test.ts
import { calculateDistance } from './distance';

describe('calculateDistance', () => {
  it('should calculate distance between two points', () => {
    const distance = calculateDistance(6.5244, 3.3792, 6.5244, 3.3792);
    expect(distance).toBe(0);
  });

  it('should return positive distance for different coordinates', () => {
    const distance = calculateDistance(6.5244, 3.3792, 6.6245, 3.4792);
    expect(distance).toBeGreaterThan(0);
  });
});
```

### 6. Commit with Conventional Commits

Use this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Code style (formatting, missing semicolons, etc.)
- `refactor` — Code refactoring
- `perf` — Performance improvement
- `test` — Adding or updating tests
- `chore` — Dependency updates, build config, etc.

Examples:

```bash
git commit -m "feat(auth): add JWT token refresh endpoint"
git commit -m "fix(ambulance): prevent duplicate GPS location broadcasts"
git commit -m "docs: update API deployment instructions"
git commit -m "test(payment): add race condition test for concurrent confirmations"
```

### 7. Push & Create Pull Request

```bash
git push origin feature/my-amazing-feature
```

Then open a PR on GitHub with:
- Clear description of changes
- Link any related issues (`Closes #123`)
- Screenshots/videos if UI changes
- Database schema changes if applicable

PR Title Format:
```
[Backend|Admin|Mobile|Shared] Brief description
```

Example:
```
[Backend] Add GPS proximity filtering to provider search
```

## Pull Request Review Checklist

Before submitting, ensure:

- ✅ All tests pass (`pnpm run test`)
- ✅ Code is formatted (`pnpm run format`)
- ✅ No linting errors (`pnpm run lint`)
- ✅ Types check out (`pnpm run typecheck`)
- ✅ JSDoc comments on public APIs
- ✅ No `console.log` statements (use `logger` instead)
- ✅ No hardcoded secrets/tokens
- ✅ Commit messages follow conventions
- ✅ PR description is clear and complete
- ✅ Related issues are linked

## Project Structure Guidelines

### Adding a New Feature to Backend

```
apps/backend/src/
├── controllers/
│   ├── newFeatureController.ts      # ← Create your handler
├── routes/
│   └── newFeatureRoutes.ts          # ← Create your routes
├── sockets/
│   └── newFeatureEvents.ts          # ← If Socket.io events needed
└── middleware/
    └── newFeatureMiddleware.ts      # ← If middleware needed
```

Example:

```typescript
// apps/backend/src/controllers/invoiceController.ts
import { Request, Response } from 'express';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';

/**
 * Generates an invoice for a completed order.
 * @param req - Express request (user must be authenticated)
 * @param res - Express response
 */
export async function generateInvoice(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;

  if (!req.user) {
    throw ApiError.unauthorized();
  }

  // implementation
}

// apps/backend/src/routes/invoiceRoutes.ts
import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { generateInvoice } from '@/controllers/invoiceController';

const router = Router();

router.post('/:orderId/invoice', requireAuth, generateInvoice);

export default router;
```

### Adding a New Mobile Screen

```
apps/mobile/src/
├── screens/
│   ├── PatientRole/
│   │   ├── NewFeatureScreen.tsx     # ← Your new screen
│   │   ├── index.ts                 # ← Export here
├── navigation/
│   └── PatientNavigator.tsx         # ← Register screen in navigation
```

### Adding a Shared Type

```typescript
// packages/shared-types/src/index.ts
export interface NewType {
  id: string;
  name: string;
}

export const NewTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});
```

Then use in any package:

```typescript
import { NewType, NewTypeSchema } from '@nhealth/shared-types';
```

## Database Changes

### Adding a New Table

1. Update `apps/backend/prisma/schema.prisma`
2. Create migration:
   ```bash
   cd apps/backend
   npx prisma migrate dev --name add_new_table
   ```
3. Commit the migration file
4. Update types in `packages/shared-types` if needed

### Changing a Relationship

- Test migrations thoroughly (especially `onDelete` behavior)
- Ensure `requireAuth` covers all new endpoints
- Update API documentation in README

## Performance Considerations

- Use database indexes for frequently queried columns
- Cache expensive computations
- Paginate large result sets
- Use transactions for atomic operations (e.g., payment confirmation)

Example:

```typescript
// ✅ Good - paginated response
export async function listUsers(page: number, limit: number) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count(),
  ]);

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

## Documentation

- Update README if adding new features
- Add JSDoc comments on public APIs
- Document environment variables
- Link to related issues/PRs

## Troubleshooting

**"Type errors after changes"**
```bash
pnpm run typecheck
# If still issues, clean and rebuild:
pnpm run clean
pnpm install
pnpm run build
```

**"ESLint/Prettier conflicts"**
```bash
# ESLint should defer to Prettier on formatting
pnpm run format  # Let Prettier do its thing first
pnpm run lint    # Then lint
```

**"Database migration failed"**
```bash
cd apps/backend
npx prisma migrate resolve --rolled-back 20240101120000_migration_name
# Fix the migration file, then retry:
npx prisma migrate dev
```

## Need Help?

- **Questions?** Open a GitHub Discussion
- **Found a bug?** Open a GitHub Issue with a minimal reproduction
- **Feature idea?** Start a Discussion before opening an Issue

## Recognition

Contributors are recognized in:
- GitHub contributor graph
- `CONTRIBUTORS.md` (for significant contributions)
- Release notes (for major features)

Thank you for contributing to making N-Health better! 🙏
