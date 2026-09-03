import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  role: string;
  isSuperAdmin?: boolean;
}

export function signToken(payload: JwtPayload): string {
  // env.jwtExpiresIn is a plain string (from .env), but newer @types/jsonwebtoken
  // narrows `expiresIn` to a branded `StringValue` template type - this cast is
  // safe since jsonwebtoken itself parses any valid "5d" / "7d" / "1h"-style string at runtime.
  const options: jwt.SignOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
