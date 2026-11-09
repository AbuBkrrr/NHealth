import { prisma } from '../config/prisma';

/** Records that `actorId` accessed `subjectId`'s medical data. Never throws. */
export async function logAccess(actorId: string, subjectId: string, resource: string, action = 'VIEW', ip?: string) {
  if (!actorId || !subjectId || actorId === subjectId) return;
  await prisma.accessLog.create({ data: { actorId, subjectId, resource, action, ip } }).catch(() => null);
}
