"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consoleLogger = void 0;
exports.consoleLogger = {
    log: (...args) => console.log(`[LOG] ${new Date().toISOString()}`, ...args),
    warn: (...args) => console.warn(`[WARN] ${new Date().toISOString()}`, ...args),
    error: (...args) => console.error(`[ERROR] ${new Date().toISOString()}`, ...args),
    debug: (...args) => console.debug(`[DEBUG] ${new Date().toISOString()}`, ...args),
};
