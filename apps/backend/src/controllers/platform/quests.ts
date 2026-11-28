import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { questBoard, claimQuest, getQuestSettings, saveQuestSettings, QUESTS } from '../../services/quests';
import { COIN_VALUE_NGN } from '../../services/coins';
import { getDonationPartner } from '../../services/settings';
import { getOrCreateLedger, spendCredits } from '../../services/creditsService';
import { notify } from '../../services/notify';
import { uid } from './util';

const fail = (e: any) => new ApiError(e.status || 400, e.message);

/** GET /api/quests - my quest board, today's coins and check-in streak. */
export async function board(req: Request, res: Response) { res.json(await questBoard(uid(req))); }

/** POST /api/quests/:key/claim */
export async function claim(req: Request, res: Response) {
  try { res.json(await claimQuest(uid(req), req.params.key)); } catch (e: any) { throw fail(e); }
}

/**
 * POST /api/coins/donate { coins } - give coins to the partner NGO (like Muslim Pro's Crescents donations).
 * The coins are used up and N-Health donates their value to the NGO from its own funds (paid monthly).
 */
export async function donateCoins(req: Request, res: Response) {
  const ngo = await getDonationPartner();
  if (!ngo.enabled) throw ApiError.badRequest('Coin donations open when our NGO partner is set up');
  const coins = Math.floor(Number(req.body?.coins));
  if (!(coins >= 1)) throw ApiError.badRequest('Donate at least 1 coin');
  await getOrCreateLedger(uid(req));
  const ledger = await prisma.creditLedger.findUnique({ where: { userId: uid(req) } });
  if (!ledger || Number(ledger.balance) < coins * COIN_VALUE_NGN) throw ApiError.badRequest('You don\'t have that many coins');
  const reference = 'CD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  await spendCredits(uid(req), coins * COIN_VALUE_NGN, reference, `Donated to ${ngo.name}`, { coinDonation: true, ngo: ngo.name, coins });
  await notify(uid(req), 'donation', 'Thank you ❤️', `You donated ${coins} coin${coins === 1 ? '' : 's'} to ${ngo.name}. N-Health will pay the donation to them.`);
  res.status(201).json({ ok: true, coins, ngo: ngo.name, reference });
}

/** GET /api/admin-ops/coin-donations - what N-Health owes the NGO for donated coins, by month. */
export async function coinDonationReport(_req: Request, res: Response) {
  const rows = await prisma.creditTransaction.findMany({ where: { reference: { startsWith: 'CD-' }, status: 'completed' }, select: { amount: true, createdAt: true }, take: 100_000 });
  const by: Record<string, { month: string; donations: number; coins: number; naira: number }> = {};
  for (const r of rows) {
    const m = r.createdAt.toISOString().slice(0, 7);
    const naira = Math.abs(Number(r.amount));
    by[m] = by[m] || { month: m, donations: 0, coins: 0, naira: 0 };
    by[m].donations++; by[m].naira += naira; by[m].coins += naira / COIN_VALUE_NGN;
  }
  res.json({ ngo: (await getDonationPartner()).name || null, months: Object.values(by).sort((a, b) => b.month.localeCompare(a.month)) });
}

/** GET/PUT /api/admin-ops/quests - coins per quest, daily cap, on/off. */
export async function getSettings(_req: Request, res: Response) { res.json({ ...(await getQuestSettings()), quests: QUESTS, coinValue: COIN_VALUE_NGN }); }
export async function putSettings(req: Request, res: Response) { res.json(await saveQuestSettings(req.body || {}, uid(req))); }

/** POST /api/coins/pos-code - a one-time code the patient shows at a pharmacy counter to approve paying with coins. */
export async function posCode(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: uid(req) }, select: { email: true } });
  if (!u) throw ApiError.notFound('Account not found');
  const { issueOtp } = await import('../../services/otp');
  res.status(201).json({ code: await issueOtp(u.email, 'pos_pay', uid(req)), expiresInMinutes: 10 });
}

// ---- Help someone pay for care with your coins (coins never enter their balance) ----
/** GET /api/coins/help/find?q= - find a member by phone, email, N-Health ID or user ID and show a profile to confirm. */
export async function helpFind(req: Request, res: Response) {
  const { findRecipient } = await import('../../services/coinGifts');
  res.json(await findRecipient(uid(req), String(req.query.q || '')));
}
/** POST /api/coins/help { toUserId, coins, note } */
export async function helpOffer(req: Request, res: Response) {
  const { offerCoins } = await import('../../services/coinGifts');
  res.status(201).json(await offerCoins(uid(req), String(req.body?.toUserId || ''), Number(req.body?.coins), req.body?.note));
}
/** GET /api/coins/help - offers I sent and offers waiting for me */
export async function helpList(req: Request, res: Response) {
  const { myOffers } = await import('../../services/coinGifts');
  res.json(await myOffers(uid(req)));
}
/** GET /api/coins/help/:id/bills - my unpaid bills an offer can pay towards */
export async function helpBills(req: Request, res: Response) {
  const { billsForOffer } = await import('../../services/coinGifts');
  const s = await prisma.coinSponsorship.findUnique({ where: { id: req.params.id } });
  if (!s || s.toUserId !== uid(req)) throw ApiError.notFound('Offer not found');
  res.json(await billsForOffer(uid(req)));
}
/** POST /api/coins/help/:id/use { payableType, payableId } */
export async function helpUse(req: Request, res: Response) {
  const { useOffer } = await import('../../services/coinGifts');
  res.json(await useOffer(uid(req), req.params.id, String(req.body?.payableType || ''), String(req.body?.payableId || '')));
}
export async function helpDecline(req: Request, res: Response) {
  const { declineOffer } = await import('../../services/coinGifts');
  await declineOffer(uid(req), req.params.id); res.json({ ok: true });
}
export async function helpCancel(req: Request, res: Response) {
  const { cancelOffer } = await import('../../services/coinGifts');
  await cancelOffer(uid(req), req.params.id); res.json({ ok: true });
}
