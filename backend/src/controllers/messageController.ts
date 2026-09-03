import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

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
      lastMessage: lastMessage.content,
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
    data: { isRead: true },
  });

  res.json(messages);
}

const sendSchema = z.object({
  receiverId: z.string(),
  content: z.string().min(1),
});

export async function sendMessage(req: Request, res: Response) {
  const data = sendSchema.parse(req.body);
  const message = await prisma.message.create({
    data: { senderId: req.user!.userId, receiverId: data.receiverId, content: data.content },
  });

  // Push to the recipient's personal socket room for instant delivery.
  req.app.get('io')?.to(`user:${data.receiverId}`).emit('message:new', message);

  res.status(201).json(message);
}
