import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.user!.userId}-${Date.now()}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('avatar');

/**
 * Local-disk avatar storage. Fine for development and small deployments; a
 * production deployment serving many users should swap this for S3/Cloudinary
 * (same shape - just change what populates `avatarUrl`).
 */
export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('No image file was uploaded');

  const avatarUrl = `${env.publicUrl}/uploads/avatars/${req.file.filename}`;

  // Best-effort cleanup of the previous avatar file, if any, so disk usage
  // doesn't grow unbounded as users update their photo repeatedly.
  const existing = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { avatarUrl: true } });
  if (existing?.avatarUrl?.startsWith(`${env.publicUrl}/uploads/avatars/`)) {
    const oldFilename = existing.avatarUrl.split('/').pop();
    if (oldFilename) {
      fs.unlink(path.join(UPLOAD_DIR, oldFilename), () => {
        /* ignore - not worth failing the request over */
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  });

  res.json(user);
}

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

/** Lets any authenticated role edit their own name/phone - the fields that
 * live on the shared User table rather than a role-specific profile. */
export async function updateAccount(req: Request, res: Response) {
  const data = updateAccountSchema.parse(req.body);

  if (data.phone) {
    const existing = await prisma.user.findFirst({ where: { phone: data.phone, id: { not: req.user!.userId } } });
    if (existing) {
      throw ApiError.conflict('That phone number is already in use by another account');
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data,
    select: { id: true, name: true, phone: true },
  });
  res.json(user);
}
