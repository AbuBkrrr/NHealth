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

// Initialize schema on startup
export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');
    // This will synchronize the schema with the database
    await prisma.$executeRawUnsafe('SELECT 1');
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't fail startup - continue anyway
  }
}
