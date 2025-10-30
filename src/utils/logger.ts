export const consoleLogger = {
  log: (...args: any[]) => console.log(`[LOG] ${new Date().toISOString()}`, ...args),
  warn: (...args: any[]) => console.warn(`[WARN] ${new Date().toISOString()}`, ...args),
  error: (...args: any[]) => console.error(`[ERROR] ${new Date().toISOString()}`, ...args),
  debug: (...args: any[]) => console.debug(`[DEBUG] ${new Date().toISOString()}`, ...args),
};
