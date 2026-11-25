import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { notify } from '../services/notify';
import { storeFile, parseDataUri } from '../services/storage';

/** Returns the list of distinct people the current user has messaged with, most recent first. */
export async function listConversations(req: Request, res: Response) {
  const userId = req.user!.userId;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true, role: true } },
    },
  });

  const byPartner = new Map<string, (typeof messages)[number]>();
  for (const m of messages) {
    const partner = m.senderId === userId ? m.receiver : m.sender;
    if (!byPartner.has(partner.id)) byPartner.set(partner.id, m);
  }

  res.json(
    Array.from(byPartner.entries()).map(([partnerId, lastMessage]) => ({
      partnerId,
      partner: lastMessage.senderId === userId ? lastMessage.receiver : lastMessage.sender,
      lastMessage: lastMessage.content || ((lastMessage as any).attachments ? '📎 Attachment' : ''),
      lastMessageAt: lastMessage.createdAt,
      unread: lastMessage.receiverId === userId && !lastMessage.isRead,
    }))
  );
}

export async function getThread(req: Request, res: Response) {
  const userId = req.user!.userId;
  const partnerId = req.params.partnerId;
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.message.updateMany({
    where: { senderId: partnerId, receiverId: userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  req.app.get('io')?.to(`user:${partnerId}`).emit('message:read', { by: userId });

  res.json(messages);
}

const sendSchema = z.object({
  receiverId: z.string(),
  content: z.string().max(4000).default(''),
  // Images and short videos (base64 data URIs) or already-uploaded files. Max 4 per message.
  attachments: z.array(z.object({ dataUri: z.string().optional(), url: z.string().url().optional(), name: z.string().optional() })).max(4).optional(),
});

const PROVIDER_ROLES = ['DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE', 'INSTITUTION', 'ADMIN'];

export async function sendMessage(req: Request, res: Response) {
  const data = sendSchema.parse(req.body);
  const senderId = req.user!.userId;
  if (!data.content.trim() && !data.attachments?.length) throw ApiError.badRequest('Message is empty');
  if (data.receiverId === senderId) throw ApiError.badRequest('You cannot message yourself');
  const receiver = await prisma.user.findUnique({ where: { id: data.receiverId }, select: { id: true, role: true, isActive: true, deletedAt: true } });
  if (!receiver || !receiver.isActive || receiver.deletedAt) throw ApiError.notFound('Recipient not found');
  // Anti-spam: patient-to-patient messaging only within an existing thread.
  if (!PROVIDER_ROLES.includes(receiver.role) && !PROVIDER_ROLES.includes(req.user!.role)) {
    const prior = await prisma.message.count({ where: { senderId: data.receiverId, receiverId: senderId } });
    if (!prior) throw ApiError.forbidden('You can message healthcare providers, or reply to people who messaged you');
  }
  const attachments: any[] = [];
  for (const a of data.attachments || []) {
    if (a.dataUri) {
      const { buf, mime } = parseDataUri(a.dataUri);
      if (!/^(image|video)\//.test(mime)) throw ApiError.badRequest('Only images and short videos can be sent in chat');
      const f = await storeFile(buf, mime, 'chat', false);
      attachments.push({ url: f.url, type: mime, name: a.name || null, bytes: f.bytes });
    } else if (a.url) attachments.push({ url: a.url, type: 'link', name: a.name || null });
  }
  const message = await prisma.message.create({
    data: { senderId, receiverId: data.receiverId, content: data.content, attachments: attachments.length ? attachments : undefined },
  });

  // Push to the recipient's personal socket room for instant delivery.
  req.app.get('io')?.to(`user:${data.receiverId}`).emit('message:new', message);
  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
  await notify(data.receiverId, 'message', `💬 ${sender?.name || 'New message'}`, data.content ? data.content.slice(0, 120) : '📎 Sent an attachment', { data: { partnerId: senderId } });

  res.status(201).json(message);
}
