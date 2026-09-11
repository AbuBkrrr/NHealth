"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendLogger = void 0;
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
function createLogger(options) {
    const isDev = options.isDevelopment ?? (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');
    return (0, pino_1.default)({
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
exports.backendLogger = createLogger({
    name: 'n-health-backend',
    isDevelopment: typeof process !== 'undefined' && process.env.NODE_ENV === 'development',
});
