export { env, getEnv } from './env';
export type { Env } from './env';
export { prisma, initializeDatabase } from './prisma';

import { env } from './env';
export const config = env;
export type AppConfig = typeof config;
