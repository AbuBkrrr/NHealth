/* Creates (or promotes) a super admin.
 * Usage: ADMIN_EMAIL=you@org.com ADMIN_PASSWORD='long-strong-password' ADMIN_NAME='Your Name' node scripts/create-admin.cjs
 * Never run prisma/seed.ts in production - it creates demo accounts with a shared password. */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = process.env.ADMIN_NAME || 'N-Health Admin';
  if (!email || password.length < 12) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, role: 'ADMIN', isSuperAdmin: true, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
      update: { role: 'ADMIN', isSuperAdmin: true, passwordHash, isActive: true, tokenVersion: { increment: 1 } },
    });
    console.log('Super admin ready:', user.email);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
