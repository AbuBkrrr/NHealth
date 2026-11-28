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
