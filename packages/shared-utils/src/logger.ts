import pino, { Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
};

if (!isProduction) {
  baseConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  };
}

// Default logger
export const logger = pino(baseConfig);

// Factory function used by services
export function createLogger(name?: string): Logger {
  return pino({ ...baseConfig, name: name || 'n-health' });
}

// Backend logger (used by server)
export const backendLogger = createLogger('n-health-backend');

// Named export for compatibility
export default logger;