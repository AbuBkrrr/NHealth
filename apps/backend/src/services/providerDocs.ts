/**
 * Documents every provider must upload before an admin can approve them.
 * A document counts while it is not rejected and not expired.
 */
export const REQUIRED_PROVIDER_DOCS: [string, string][] = [
  ['IDENTITY', 'Government-issued ID'],
  ['PROOF_OF_ADDRESS', 'Proof of address'],
  ['LICENSE', 'Health / practising licence'],
];
export const PROVIDER_DOC_TYPES = ['IDENTITY', 'PROOF_OF_ADDRESS', 'LICENSE', 'CERTIFICATE', 'CAC', 'PRACTICE_PERMIT', 'INSURANCE', 'VEHICLE', 'OTHER'];

export function missingProviderDocs(docs: { type: string; status: string; expiresAt?: Date | string | null }[]): string[] {
  const now = Date.now();
  return REQUIRED_PROVIDER_DOCS.filter(([type]) => !docs.some((d) => d.type === type && d.status !== 'REJECTED' && (!d.expiresAt || new Date(d.expiresAt).getTime() > now)))
    .map(([, label]) => label);
}
