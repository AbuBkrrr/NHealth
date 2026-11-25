import webpush from 'web-push';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { sendEmail } from './email';
import { sendSms } from './sms';

let io: any = null;
export function bindIo(server: any) { io = server; }
export function getIo() { return io; }

let vapidReady = false;
if (env.raw.VAPID_PUBLIC_KEY && env.raw.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:support@nhealth.com.ng', env.raw.VAPID_PUBLIC_KEY, env.raw.VAPID_PRIVATE_KEY);
  vapidReady = true;
}

export interface NotifyOpts { email?: boolean; sms?: boolean; push?: boolean; data?: any; }

/**
 * Single entry point for user notifications: stores an in-app notification, emits it live over
 * Socket.io, and optionally fans out to web push, email and SMS according to the user's preferences.
 */
export async function notify(userId: string, type: string, title: string, body: string, o: NotifyOpts = {}) {
  try {
    const n = await prisma.notification.create({ data: { userId, type, title, body, data: o.data ?? undefined } });
    io?.to(`user:${userId}`).emit('notification', n);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, notificationPrefs: true } });
    const prefs: any = user?.notificationPrefs || {};
    if (o.push !== false && vapidReady && prefs.push !== false) {
      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      await Promise.all(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, data: o.data, type })).catch(async (e: any) => {
        if (e?.statusCode === 404 || e?.statusCode === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
      })));
    }
    if (o.email && user?.email && prefs.email !== false) await sendEmail(user.email, title, title, escapeHtml(body));
    if (o.sms && user?.phone && prefs.sms !== false) await sendSms(user.phone, `N-Health: ${body}`);
    return n;
  } catch (e) {
    console.error('[notify] failed', e);
    return null;
  }
}

export function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export const vapidPublicKey = () => env.raw.VAPID_PUBLIC_KEY || null;
