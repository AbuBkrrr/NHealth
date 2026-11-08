import { prisma } from '../config/prisma';
import * as didit from './didit';
import { notify } from './notify';
import { invalidateUserState } from '../middleware/auth';

/** Pulls the useful, non-sensitive identity fields out of a Didit decision. */
function summarise(decision: any) {
  const id = decision?.id_verification || decision?.id_verifications?.[0] || decision?.kyc || {};
  const num = String(id.document_number || id.personal_number || '');
  return {
    documentType: id.document_type || null,
    documentCountry: id.issuing_state || id.issuing_state_name || id.nationality || null,
    documentLast4: num ? num.slice(-4) : null,
    fullName: id.full_name || [id.first_name, id.last_name].filter(Boolean).join(' ') || null,
    dateOfBirth: id.date_of_birth || null,
  };
}

/** Applies a Didit status/decision to our records (webhook and polling both call this). */
export async function onKycDecision(sessionId: string, status: string, decision?: any, vendorData?: string) {
  const rec = await prisma.kycVerification.findUnique({ where: { sessionId } });
  if (!rec) {
    console.warn('[kyc] unknown session', sessionId, vendorData);
    return null;
  }
  const mapped = didit.mapStatus(status);
  const info = decision ? summarise(decision) : {};
  await prisma.kycVerification.update({ where: { id: rec.id }, data: { status, decision: decision ?? undefined, ...info } });

  const user = await prisma.user.findUnique({ where: { id: rec.userId } });
  if (!user) return null;
  const data: any = { kycStatus: mapped };
  // A verified identity is a prerequisite for provider verification; admins still review licences.
  if (mapped === 'APPROVED' && rec.purpose !== 'identity' && user.verificationStatus === 'UNVERIFIED') data.verificationStatus = 'PENDING';
  await prisma.user.update({ where: { id: user.id }, data });
  invalidateUserState(user.id);

  if (mapped === 'APPROVED') await notify(user.id, 'kyc', 'Identity verified ✅', 'Your identity has been verified. All services are unlocked.', { email: true });
  if (mapped === 'DECLINED') await notify(user.id, 'kyc', 'Identity verification declined', 'We could not verify your identity. Please retry with a valid government-issued ID in good lighting.', { email: true });
  if (mapped === 'IN_REVIEW') await notify(user.id, 'kyc', 'Verification in review', 'Your documents are being reviewed. We will notify you shortly.');
  return mapped;
}
