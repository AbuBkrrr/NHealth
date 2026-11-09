import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { http } from './http';

export interface StoredFile { url: string; fileId: string; mimeType: string; bytes: number; }

const ALLOWED = /^(image\/(jpeg|png|webp|gif|heic)|video\/(mp4|quicktime|webm)|application\/pdf|audio\/(mpeg|mp4|webm|ogg))$/;
export const MAX_BYTES: Record<string, number> = { image: 8 * 1024 * 1024, video: 25 * 1024 * 1024, application: 10 * 1024 * 1024, audio: 10 * 1024 * 1024 };

export function assertAllowed(mime: string, size: number) {
  if (!ALLOWED.test(mime)) throw Object.assign(new Error('Unsupported file type'), { status: 400 });
  const lim = MAX_BYTES[mime.split('/')[0]] || 5 * 1024 * 1024;
  if (size > lim) throw Object.assign(new Error(`File too large (max ${Math.round(lim / 1048576)}MB)`), { status: 400 });
}

function cloudinaryConfigured() {
  return !!(env.raw.CLOUDINARY_CLOUD_NAME && env.raw.CLOUDINARY_API_KEY && env.raw.CLOUDINARY_API_SECRET);
}

/**
 * Stores a file. Uses Cloudinary when configured (persistent, CDN-backed); otherwise local disk (dev only -
 * local disk is wiped on every redeploy of container hosts). `privateFile` keeps KYC/medical files out of public URLs.
 */
export async function storeFile(buf: Buffer, mime: string, folder: string, privateFile = false): Promise<StoredFile> {
  assertAllowed(mime, buf.length);
  if (cloudinaryConfigured()) {
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = { folder: `nhealth/${folder}`, timestamp: String(timestamp) };
    if (privateFile) params.type = 'authenticated';
    const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    const signature = crypto.createHash('sha1').update(toSign + env.raw.CLOUDINARY_API_SECRET).digest('hex');
    const form = new FormData();
    form.append('file', new Blob([buf], { type: mime }));
    Object.entries(params).forEach(([k, v]) => form.append(k, v));
    form.append('api_key', env.raw.CLOUDINARY_API_KEY!);
    form.append('signature', signature);
    const res = await http.post(`https://api.cloudinary.com/v1_1/${env.raw.CLOUDINARY_CLOUD_NAME}/auto/upload`, form, { timeout: 120000 });
    return { url: res.data.secure_url, fileId: res.data.public_id, mimeType: mime, bytes: buf.length };
  }
  const ext = (mime.split('/')[1] || 'bin').replace('quicktime', 'mov').replace('jpeg', 'jpg');
  const dir = path.join(process.cwd(), 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(dir, name), buf);
  return { url: `${env.publicUrl}/uploads/${folder}/${name}`, fileId: `${folder}/${name}`, mimeType: mime, bytes: buf.length };
}

/** Decodes a base64 data URI ("data:image/png;base64,....") into buffer + mime. */
export function parseDataUri(dataUri: string): { buf: Buffer; mime: string } {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUri || '');
  if (!m) throw Object.assign(new Error('Invalid file payload'), { status: 400 });
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}
