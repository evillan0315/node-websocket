import { spawn } from 'child_process';
import * as pty from 'node-pty';
import * as os from 'os';
import { Client as SSHClient, ConnectConfig } from 'ssh2';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import prisma from '../prisma'; // Import direct Prisma client
import { consoleLogger } from '../utils/logger'; // Custom logger
import { SHELL_DEFAULT } from '../config';

import {
  CreateCommandHistoryDto,
  TerminalSession,
  ProjectScriptsResponse,
  PackageScript,
  PackageManager,
  RunSshCommandOptions,
} from './terminal.types';

// Service class (no NestJS decorators)
export class TerminalService {
  private readonly defaultShell = SHELL_DEFAULT;
  private sessions = new Map<string, TerminalSession>();
  private readonly logger = consoleLogger; // Use custom logger

  constructor() {}

  async initializePtySession(
    sessionId: string,
    clientSocket: import('socket.io').Socket,
    cwd: string,
    userId: string = '1', // This is user.sub from JWT
  ): Promise<string> {
    // If a session already exists, dispose of it first (e.g., on reconnect/re-init)
    if (this.sessions.has(sessionId)) {
      this.dispose(sessionId);
    }

    const shell = pty.spawn(this.defaultShell, [], {
      name: 'xterm-color',
      cols: 80, // Default cols
      rows: 30, // Default rows
      cwd,
      env: process.env,
    });

    // Ensure the user exists in the database
    let userRecord = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userRecord) {
      // Assuming userId is the 'sub' from JWT. We create a placeholder username.
      // In a real app, the username would ideally come from the authentication context.
      userRecord = await prisma.user.create({
        data: {
          id: userId,
          username: `user_${userId.substring(0, 8)}`, // Placeholder username
        },
      });
    }

    // Create a new TerminalSession record in the database
    const dbSession = await prisma.terminalSession.create({
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

    shell.onData((data: string) => {
      // Emit raw output to the client
      clientSocket.emit('output', data);
    });

    shell.onExit(({ exitCode, signal }) => {
      clientSocket.emit(
        'close',
        `Process exited with code ${exitCode}, signal ${signal ?? 'none'}!`,
      );
      this.dispose(sessionId); // Call dispose to update DB status
    });

    // Initial resize to default values
    shell.resize(80, 30);
    return dbSession.id; // Return the database session ID
  }

  write(sessionId: string, input: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.write(input);
    } else {
      this.logger.warn(
        `No active PTY session found for ${sessionId} to write to.`,
      );
    }
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.resize(cols, rows);
    } else {
      this.logger.warn(
        `No active PTY session found for ${sessionId} to resize.`,
      );
    }
  }

  async dispose(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.kill();
      // Update database session status
      try {
        await prisma.terminalSession.update({
          where: { id: session.dbSessionId },
          data: {
            endedAt: new Date(),
            status: 'ENDED',
          },
        });
      } catch (error: any) {
        this.logger.error('Failed to update terminal session status in DB:', error);
      }
      this.sessions.delete(sessionId);
    }
  }

  async saveCommandHistoryEntry(
    dbSessionId: string,
    userId: string, // This is user.sub from JWT
    commandData: CreateCommandHistoryDto,
  ) {
    try {
      await prisma.commandHistory.create({
        data: {
          terminalSessionId: dbSessionId,
          createdById: userId, // Link to the existing or newly created User ID
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
    } catch (error: any) {
      this.logger.error('Failed to save command history entry:', error);
    }
  }

  async runCommandOnce(
    command: string,
    cwd: string,
  ): Promise<{ stdout: any[]; stderr: any[]; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const shell = spawn(command, { // Explicitly define the shell
        shell: SHELL_DEFAULT,
        cwd,
      });

      const stdoutChunks: any[] = [];
      const stderrChunks: any[] = [];

      const tryParseJson = (data: string): any => {
        try {
          return JSON.parse(data);
        } catch {
          return { message: data.trim() };
        }
      };

      shell.stdout.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          text
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
            .forEach((line: string) => stdoutChunks.push(tryParseJson(line)));
        }
      });

      shell.stderr.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          text
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
            .forEach((line: string) => stderrChunks.push(tryParseJson(line)));
        }
      });

      shell.on('close', (code: number, signal: string | null) => {
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

  async runSshCommandOnce(options: RunSshCommandOptions): Promise<string> {
    const {
      host,
      port = 22,
      username,
      password,
      privateKeyPath,
      command,
    } = options;

    const config: ConnectConfig = {
      host,
      port,
      username,
    };

    if (privateKeyPath) {
      config.privateKey = readFileSync(privateKeyPath);
    } else if (password) {
      config.password = password;
    } else {
      throw new Error('SSH requires either a password or private key path');
    }

    return new Promise((resolve, reject) => {
      const conn = new SSHClient();
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
              .on('close', (code: number, signal: string | null) => {
                conn.end();
                if (code !== 0 && errorOutput) {
                  // If there was stderr and exit code is not 0, reject with stderr
                  reject(new Error(errorOutput.trim()));
                } else if (code !== 0 && !result) {
                  // If no stdout and non-zero exit, still might be an issue
                  reject(new Error(`Command exited with code ${code}`));
                } else {
                  resolve(result.trim());
                }
              })
              .on('data', (data: Buffer) => {
                result += data.toString();
              })
              .stderr.on('data', (data: Buffer) => {
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

  async getPackageScripts(
    projectRoot: string,
  ): Promise<ProjectScriptsResponse> {
    const packageJsonPath = join(projectRoot, 'package.json');

    if (!existsSync(packageJsonPath)) {
      this.logger.warn(`package.json not found at ${packageJsonPath}`);
      throw new Error(`package.json not found at the specified project root.`);
    }

    try {
      const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      const scripts: PackageScript[] = Object.entries(
        packageJson.scripts || {},
      ).map(([name, script]) => ({
        name,
        script: script as string,
      }));

      const packageManager = this.detectPackageManager(projectRoot);

      return { scripts, packageManager };
    } catch (error: any) {
      this.logger.error(
        `Error reading or parsing package.json at ${packageJsonPath}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to read or parse package.json: ${error.message}`);
    }
  }

  private detectPackageManager(projectRoot: string): PackageManager {
    const yarnLockPath = join(projectRoot, 'yarn.lock');
    const pnpmLockPath = join(projectRoot, 'pnpm-lock.yaml');
    const npmLockPath = join(projectRoot, 'package-lock.json');

    if (existsSync(yarnLockPath)) {
      return 'yarn';
    }
    if (existsSync(pnpmLockPath)) {
      return 'pnpm';} // Fixed missing closing brace
    if (existsSync(npmLockPath)) {
      return 'npm';
    }
    return 'npm'; // Default to npm if no specific lock file found
  }
}
