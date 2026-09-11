import pino, { Logger } from 'pino';

interface LoggerOptions {
  name: string;
  level?: string;
  isDevelopment?: boolean;
}

/**
 * Creates a configured Pino logger instance.
 * @param options - Logger configuration options
 * @returns Configured logger instance
 */
export function createLogger(options: LoggerOptions): Logger {
  const isDev = options.isDevelopment ?? (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');

  return pino({
    name: options.name,
    level: options.level ?? (isDev ? 'debug' : 'info'),
    transport: isDev && typeof process !== 'undefined'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

/**
 * Logger for backend services.
 */
export const backendLogger = createLogger({
  name: 'n-health-backend',
  isDevelopment: typeof process !== 'undefined' && process.env.NODE_ENV === 'development',
});
