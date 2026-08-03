"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/**
 * src/utils/logger.ts
 * Simple structured logger. In production, swap with winston/pino if needed.
 */
const env_1 = require("../config/env");
function log(level, message, meta) {
    if (level === 'debug' && !env_1.env.isDev)
        return;
    const entry = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...(meta !== undefined && { meta }),
    };
    if (level === 'error') {
        console.error(JSON.stringify(entry));
    }
    else if (level === 'warn') {
        console.warn(JSON.stringify(entry));
    }
    else {
        console.log(JSON.stringify(entry));
    }
}
exports.logger = {
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
};
//# sourceMappingURL=logger.js.map