import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

/** Trimmed optional string from body, max length. */
export const str = (v: any, max = 500) => (v === undefined || v === null || v === '' ? undefined : String(v).trim().slice(0, max));
export const num = (v: any) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? undefined : Number(v));
export const date = (v: any) => { if (!v) return undefined; const d = new Date(v); return isNaN(d.getTime()) ? undefined : d; };
export const uid = (req: Request) => req.user!.userId;
export const page = (req: Request) => {
  const take = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const skip = Math.max(0, Number(req.query.offset) || 0);
  return { take, skip };
};
export async function patientOf(userId: string) {
  const p = await prisma.patientProfile.findUnique({ where: { userId } });
  if (!p) throw ApiError.notFound('Patient profile not found');
  return p;
}
export async function ensureOwner<T extends { userId?: string; ownerId?: string }>(rec: T | null, userId: string, what = 'Record'): Promise<T> {
  if (!rec || (rec.userId ?? rec.ownerId) !== userId) throw ApiError.notFound(what + ' not found');
  return rec;
}
