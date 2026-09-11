/**
 * JWT utilities for signing and verifying tokens.
 */
import jwt from 'jsonwebtoken';

/**
 * JWT Payload interface - defines what's stored in a token.
 */
export interface JwtPayload {
  userId: string;
  role: string;
  isSuperAdmin?: boolean;
}

/**
 * Signs a JWT token with the given payload.
 * @param payload - JWT payload
 * @param secret - JWT secret key
 * @param expiresIn - Token expiration time (e.g., '7d', '24h')
 * @returns Signed JWT token
 */
export function signToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string | number,
): string {
  const options: jwt.SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, secret, options);
}

/**
 * Verifies and decodes a JWT token.
 * @param token - JWT token to verify
 * @param secret - JWT secret key
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

/**
 * Extracts the Bearer token from an Authorization header.
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns The token, or null if header is malformed
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length);
}
