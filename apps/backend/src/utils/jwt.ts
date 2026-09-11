/**
 * JWT utilities - thin wrapper around shared utilities.
 * Re-exported for backward compatibility within the backend.
 */

export { signToken, verifyToken, extractBearerToken } from '@nhealth/shared-utils';
export type { JwtPayload } from '@nhealth/shared-types';
