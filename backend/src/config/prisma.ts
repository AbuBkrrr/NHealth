import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

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
    console.log('Checking database connection...');
    // Test connection
    await prisma.$executeRawUnsafe('SELECT 1');
    console.log('Database connected!');
    
    // Check if User table exists
    try {
      await prisma.user.findFirst({ take: 0 });
      console.log('User table exists - schema is initialized');
    } catch (err) {
      console.log('User table not found - initializing schema...');
      // Try to run migrations
      try {
        const { execSync } = await import('child_process');
        execSync('npx prisma db push --skip-generate', { 
          stdio: 'inherit',
          env: { ...process.env }
        });
        console.log('Migrations applied successfully');
      } catch (migrationErr) {
        console.warn('Migration failed (may already exist):', migrationErr);
      }
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't fail startup - Prisma will handle it
  }
}
