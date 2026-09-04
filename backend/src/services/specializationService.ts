import { ProviderType } from '@prisma/client';
import { prisma } from '../utils/prisma';

export async function findOrCreateSpecialization(name: string, type: ProviderType) {
  const normalized = name?.trim();
  if (!normalized) return null;

  // Try case-insensitive lookup first
  const existing = await prisma.specialization.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' }, type },
  });
  if (existing) return existing;

  // Use upsert to avoid race conditions if name has unique constraint
  try {
    const upserted = await prisma.specialization.upsert({
      where: { name: normalized },
      update: {},
      create: { name: normalized, type },
    });
    return upserted;
  } catch (err) {
    // If another request created it concurrently, fetch the existing one
    const fallback = await prisma.specialization.findFirst({
      where: { name: { equals: normalized, mode: 'insensitive' }, type },
    });
    return fallback;
  }
}

export async function validateSpecializationId(id: string, expectedType: ProviderType) {
  if (!id) return false;
  const spec = await prisma.specialization.findUnique({ where: { id } });
  return !!spec && spec.type === expectedType;
}
