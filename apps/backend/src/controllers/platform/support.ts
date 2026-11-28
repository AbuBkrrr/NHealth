// Help bubble live chat (signed-in users and visitors) and replies to enquiries (leads), by chat, email or WhatsApp.
import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { notify, getIo, escapeHtml } from '../../services/notify';
import { sendEmail } from '../../services/email';
import { sendWhatsApp } from '../../services/whatsapp';
import { str, uid } from './util';

type Ticket = Awaited<ReturnType<typeof prisma.supportTicket.findFirst>> & {};

/** The whole conversation: the first message, an old-style admin reply if any, then the chat messages. */
async function thread(t: NonNullable<Ticket>) {
  const msgs = await prisma.supportMessage.findMany({ where: { ticketId: t.id }, orderBy: { createdAt: 'asc' }, take: 500 });
  const out = [{ id: 'first', fromStaff: false, body: t.message, createdAt: t.createdAt }];
  if (t.adminReply && t.repliedAt) out.push({ id: 'legacy', fromStaff: true, body: t.adminReply, createdAt: t.repliedAt });
  out.push(...msgs.map((m) => ({ id: m.id, fromStaff: m.fromStaff, body: m.body, createdAt: m.createdAt })));
  return out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
const view = async (t: NonNullable<Ticket>) => ({ id: t.id, status: t.status, subject: t.subject, messages: await thread(t) });

async function tellStaff(t: NonNullable<Ticket>, body: string) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'support', `💬 ${t.userName}: ${t.subject}`, body.slice(0, 160), { data: { ticketId: t.id } }).catch(() => null)));
  getIo()?.to('role:ADMIN').emit('support:message', { ticketId: t.id });
}

/** GET /api/support/chat?token= - my current chat (signed in) or the visitor's chat (token kept in their browser). */
export async function getChat(req: Request, res: Response) {
  const me = (req as any).user?.userId as string | undefined;
  const token = str(req.query.token, 80);
  const t = me
    ? await prisma.supportTicket.findFirst({ where: { userId: me, channel: 'chat' }, orderBy: { createdAt: 'desc' } })
    : token ? await prisma.supportTicket.findUnique({ where: { guestToken: token } }) : null;
  res.json(t ? await view(t) : { id: null, messages: [] });
}

/** POST /api/support/chat { message, name?, email?, token? } - start or continue a chat with the support team. */
export async function postChat(req: Request, res: Response) {
  const me = (req as any).user?.userId as string | undefined;
  const message = str(req.body?.message, 3000);
  if (!message) throw ApiError.badRequest('Type a message');
  let t: Ticket | null = null;
  let token: string | undefined;
  if (me) {
    t = await prisma.supportTicket.findFirst({ where: { userId: me, channel: 'chat', status: { not: 'closed' } }, orderBy: { createdAt: 'desc' } });
    if (!t) {
      const u = await prisma.user.findUnique({ where: { id: me }, select: { name: true, email: true } });
      t = await prisma.supportTicket.create({ data: { userId: me, userName: u!.name, userEmail: u!.email, subject: 'Live chat', category: 'chat', channel: 'chat', message, lastMessageAt: new Date() } });
      await tellStaff(t, message);
      return res.status(201).json(await view(t));
    }
  } else {
    token = str(req.body?.token, 80);
    t = token ? await prisma.supportTicket.findUnique({ where: { guestToken: token } }) : null;
    if (!t || t.status === 'closed') {
      const name = str(req.body?.name, 120), email = str(req.body?.email, 160)?.toLowerCase();
      if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) throw ApiError.badRequest('Add your name and email so we can reply');
      token = crypto.randomBytes(24).toString('hex');
      t = await prisma.supportTicket.create({ data: { userName: name, userEmail: email, subject: 'Live chat (visitor)', category: 'chat', channel: 'chat', guestToken: token, message, lastMessageAt: new Date() } });
      await tellStaff(t, message);
      return res.status(201).json({ ...(await view(t)), token });
    }
  }
  await prisma.supportMessage.create({ data: { ticketId: t!.id, authorId: me, body: message } });
  t = await prisma.supportTicket.update({ where: { id: t!.id }, data: { status: 'open', lastMessageAt: new Date() } });
  await tellStaff(t, message);
  res.status(201).json({ ...(await view(t)), token });
}

/** GET /api/admin-ops/tickets/:id/messages */
export async function ticketThread(req: Request, res: Response) {
  const t = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!t) throw ApiError.notFound('Ticket not found');
  res.json({ ...t, guestToken: undefined, messages: await thread(t) });
}

/** POST /api/admin-ops/tickets/:id/reply { reply, close } - reply in the chat; the person also gets it by email (and in the app). */
export async function replyTicket(req: Request, res: Response) {
  const reply = str(req.body?.reply, 5000);
  const t0 = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!t0) throw ApiError.notFound('Ticket not found');
  if (reply) await prisma.supportMessage.create({ data: { ticketId: t0.id, authorId: uid(req), fromStaff: true, body: reply } });
  const t = await prisma.supportTicket.update({ where: { id: t0.id }, data: { repliedById: uid(req), repliedAt: new Date(), lastMessageAt: new Date(), status: req.body?.close ? 'closed' : 'answered', closedAt: req.body?.close ? new Date() : undefined } });
  if (reply) {
    if (t.userId) {
      await notify(t.userId, 'support', 'N-Health support replied', reply.slice(0, 160), { email: true, data: { ticketId: t.id } });
      getIo()?.to(`user:${t.userId}`).emit('support:message', { ticketId: t.id });
    } else {
      await sendEmail(t.userEmail, 'Re: your message to N-Health', 'N-Health support replied',
        `${escapeHtml(reply).replace(/\n/g, '<br>')}<br><br><a href="${env.appUrl}/?help=1">Open the chat on N-Health</a> to continue the conversation.`);
    }
  }
  res.json(t);
}

/** GET /api/admin-ops/marketing/leads/:id/messages */
export async function leadThread(req: Request, res: Response) {
  const lead = await prisma.marketingLead.findUnique({ where: { id: req.params.id } });
  if (!lead) throw ApiError.notFound('Enquiry not found');
  const msgs = await prisma.supportMessage.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: 'asc' } });
  res.json({ lead, messages: [{ id: 'first', fromStaff: false, channel: 'form', body: lead.message || '(no message)', createdAt: lead.createdAt, delivered: true }, ...msgs] });
}

/** POST /api/admin-ops/marketing/leads/:id/reply { body, channel: email|whatsapp } - answer an enquiry; marks it CONTACTED. */
export async function replyLead(req: Request, res: Response) {
  const lead = await prisma.marketingLead.findUnique({ where: { id: req.params.id } });
  if (!lead) throw ApiError.notFound('Enquiry not found');
  const body = str(req.body?.body, 5000);
  if (!body) throw ApiError.badRequest('Write your reply');
  const channel = req.body?.channel === 'whatsapp' ? 'whatsapp' : 'email';
  let delivered = false;
  if (channel === 'email') {
    if (!lead.email) throw ApiError.badRequest('This enquiry has no email address - reply on WhatsApp');
    delivered = await sendEmail(lead.email, 'Re: your enquiry to N-Health', `Hello ${lead.name.split(' ')[0]}`, escapeHtml(body).replace(/\n/g, '<br>'));
  } else {
    if (!lead.phone) throw ApiError.badRequest('This enquiry has no phone number - reply by email');
    delivered = await sendWhatsApp(lead.phone, body);
  }
  const m = await prisma.supportMessage.create({ data: { leadId: lead.id, authorId: uid(req), fromStaff: true, channel, body, delivered } });
  if (lead.status === 'NEW') await prisma.marketingLead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });
  res.status(201).json({ ...m, warning: delivered ? undefined : `Saved, but the ${channel === 'email' ? 'email' : 'WhatsApp message'} was not delivered (check ${channel === 'email' ? 'RESEND_API_KEY' : 'WhatsApp set-up'} in Integration status). You can also use the WhatsApp or email link.` });
}
