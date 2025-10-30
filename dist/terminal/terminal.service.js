"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalService = void 0;
const child_process_1 = require("child_process");
const pty = __importStar(require("node-pty"));
const ssh2_1 = require("ssh2");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma_1 = __importDefault(require("../prisma")); // Import direct Prisma client
const logger_1 = require("../utils/logger"); // Custom logger
const config_1 = require("../config");
// Service class (no NestJS decorators)
class TerminalService {
    defaultShell = config_1.SHELL_DEFAULT;
    sessions = new Map();
    logger = logger_1.consoleLogger; // Use custom logger
    constructor() { }
    async ensureUserExists(userId) {
        let userRecord = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!userRecord) {
            // Create a placeholder user if not found. This is crucial for FK constraints.
            userRecord = await prisma_1.default.user.create({
                data: {
                    id: userId,
                    username: `user_${userId.substring(0, 8)}`, // Placeholder username
                },
            });
            this.logger.debug(`Created placeholder user for ID: ${userId}`);
        }
        return userRecord;
    }
    async initializePtySession(sessionId, clientSocket, cwd, userId) {
        // If a session already exists, dispose of it first (e.g., on reconnect/re-init)
        if (this.sessions.has(sessionId)) {
            this.dispose(sessionId);
        }
        // Ensure the user exists in the database before creating session/history
        const userRecord = await this.ensureUserExists(userId);
        const shell = pty.spawn(this.defaultShell, [], {
            name: 'xterm-color',
            cols: 80, // Default cols
            rows: 30, // Default rows
            cwd,
            env: process.env,
        });
        // Create a new TerminalSession record in the database
        const dbSession = await prisma_1.default.terminalSession.create({
            data: {
                createdById: userRecord.id,
                ipAddress: clientSocket.handshake.address,
                userAgent: clientSocket.handshake.headers['user-agent'],
                clientInfo: {
                    connectionId: clientSocket.id,
                    cwd: cwd,
                },
                status: 'ACTIVE',
                name: `Session for User ${userRecord.username} (${sessionId})`,
            },
        });
        this.sessions.set(sessionId, {
            ptyProcess: shell,
            clientSocket: clientSocket, // Store client socket to emit data back
            dbSessionId: dbSession.id,
        });
        shell.onData((data) => {
            // Emit raw output to the client
            clientSocket.emit('output', data);
        });
        shell.onExit(({ exitCode, signal }) => {
            clientSocket.emit('close', `Process exited with code ${exitCode}, signal ${signal ?? 'none'}!`);
            this.dispose(sessionId); // Call dispose to update DB status
        });
        // Initial resize to default values
        shell.resize(80, 30);
        return dbSession.id; // Return the database session ID
    }
    write(sessionId, input) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.ptyProcess.write(input);
        }
        else {
            this.logger.warn(`No active PTY session found for ${sessionId} to write to.`);
        }
    }
    resize(sessionId, cols, rows) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.ptyProcess.resize(cols, rows);
        }
        else {
            this.logger.warn(`No active PTY session found for ${sessionId} to resize.`);
        }
    }
    async dispose(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.ptyProcess.kill();
            // Update database session status
            try {
                await prisma_1.default.terminalSession.update({
                    where: { id: session.dbSessionId },
                    data: {
                        endedAt: new Date(),
                        status: 'ENDED',
                    },
                });
            }
            catch (error) {
                this.logger.error('Failed to update terminal session status in DB:', error);
            }
            this.sessions.delete(sessionId);
        }
    }
    async saveCommandHistoryEntry(dbSessionId, userId, // userId is now explicitly passed by index.ts
    commandData) {
        try {
            // Ensure the user exists (though index.ts should ensure for session creation)
            await this.ensureUserExists(userId);
            await prisma_1.default.commandHistory.create({
                data: {
                    terminalSessionId: dbSessionId,
                    createdById: userId, // Link to the existing User ID
                    command: commandData.command,
                    workingDirectory: commandData.workingDirectory,
                    status: commandData.status,
                    exitCode: commandData.exitCode,
                    output: commandData.output,
                    errorOutput: commandData.errorOutput,
                    durationMs: commandData.durationMs,
                    shellType: commandData.shellType,
                },
            });
        }
        catch (error) {
            this.logger.error('Failed to save command history entry:', error);
        }
    }
    async runCommandOnce(command, cwd) {
        return new Promise((resolve, reject) => {
            const shell = (0, child_process_1.spawn)(command, {
                shell: config_1.SHELL_DEFAULT,
                cwd,
            });
            const stdoutChunks = [];
            const stderrChunks = [];
            const tryParseJson = (data) => {
                try {
                    return JSON.parse(data);
                }
                catch {
                    return { message: data.trim() };
                }
            };
            shell.stdout.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    text
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .forEach((line) => stdoutChunks.push(tryParseJson(line)));
                }
            });
            shell.stderr.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    text
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .forEach((line) => stderrChunks.push(tryParseJson(line)));
                }
            });
            shell.on('close', (code, signal) => {
                resolve({
                    stdout: stdoutChunks,
                    stderr: stderrChunks,
                    exitCode: code ?? 0,
                });
            });
            shell.on('error', (err) => {
                reject(err);
            });
        });
    }
    async runSshCommandOnce(options) {
        const { host, port = 22, username, password, privateKeyPath, command, } = options;
        const config = {
            host,
            port,
            username,
        };
        if (privateKeyPath) {
            config.privateKey = (0, fs_1.readFileSync)(privateKeyPath);
        }
        else if (password) {
            config.password = password;
        }
        else {
            throw new Error('SSH requires either a password or private key path');
        }
        return new Promise((resolve, reject) => {
            const conn = new ssh2_1.Client();
            let result = '';
            let errorOutput = '';
            conn
                .on('ready', () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end(); // Ensure connection is closed on exec error
                        return reject(err);
                    }
                    stream
                        .on('close', (code, signal) => {
                        conn.end();
                        if (code !== 0 && errorOutput) {
                            // If there was stderr and exit code is not 0, reject with stderr
                            reject(new Error(errorOutput.trim()));
                        }
                        else if (code !== 0 && !result) {
                            // If no stdout and non-zero exit, still might be an issue
                            reject(new Error(`Command exited with code ${code}`));
                        }
                        else {
                            resolve(result.trim());
                        }
                    })
                        .on('data', (data) => {
                        result += data.toString();
                    })
                        .stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                });
            })
                .on('error', (err) => {
                reject(err);
            })
                .connect(config);
        });
    }
    async getPackageScripts(projectRoot) {
        const packageJsonPath = (0, path_1.join)(projectRoot, 'package.json');
        if (!(0, fs_1.existsSync)(packageJsonPath)) {
            this.logger.warn(`package.json not found at ${packageJsonPath}`);
            throw new Error(`package.json not found at the specified project root.`);
        }
        try {
            const packageJsonContent = (0, fs_1.readFileSync)(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            const scripts = Object.entries(packageJson.scripts || {}).map(([name, script]) => ({
                name,
                script: script,
            }));
            const packageManager = this.detectPackageManager(projectRoot);
            return { scripts, packageManager };
        }
        catch (error) {
            this.logger.error(`Error reading or parsing package.json at ${packageJsonPath}: ${error.message}`, error.stack);
            throw new Error(`Failed to read or parse package.json: ${error.message}`);
        }
    }
    detectPackageManager(projectRoot) {
        const yarnLockPath = (0, path_1.join)(projectRoot, 'yarn.lock');
        const pnpmLockPath = (0, path_1.join)(projectRoot, 'pnpm-lock.yaml');
        const npmLockPath = (0, path_1.join)(projectRoot, 'package-lock.json');
        if ((0, fs_1.existsSync)(yarnLockPath)) {
            return 'yarn';
        }
        if ((0, fs_1.existsSync)(pnpmLockPath)) {
            return 'pnpm';
        } // Fixed missing closing brace
        if ((0, fs_1.existsSync)(npmLockPath)) {
            return 'npm';
        }
        return 'npm'; // Default to npm if no specific lock file found
    }
}
exports.TerminalService = TerminalService;
