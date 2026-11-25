import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient instance across the app
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Startup check only. Schema changes are applied by `prisma migrate deploy` (scripts/migrate.cjs),
// never by `db push` at runtime, so production data can't be silently altered.
export async function initializeDatabase() {
  await prisma.$queryRawUnsafe('SELECT 1');
}
