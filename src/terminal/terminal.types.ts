import { ConnectConfig } from 'ssh2';

// --- Interfaces for Terminal Service --- //
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | null;

export interface PackageScript {
  name: string;
  script: string;
}

export interface ProjectScriptsResponse {
  scripts: PackageScript[];
  packageManager: PackageManager;
}

export interface TerminalSession {
  ptyProcess: import('node-pty').IPty;
  clientSocket: import('socket.io').Socket; // Use raw Socket type here
  dbSessionId: string;
}

// --- DTOs (Data Transfer Objects) --- //

// Simplified CreateCommandHistoryDto without class-validator/swagger decorators
export interface CreateCommandHistoryDto {
  command: string;
  workingDirectory?: string;
  status?: string;
  exitCode?: number;
  output?: string;
  errorOutput?: string;
  durationMs?: number;
  shellType?: string;
}

// Simplified CreateTerminalSessionDto without class-validator/swagger decorators
export interface CreateTerminalSessionDto {
  name?: string;
  ipAddress?: string;
  userAgent?: string;
  clientInfo?: object;
}

// Simplified ExecDto without class-validator/swagger decorators
export interface ExecDto {
  command?: string;
  newCwd?: string;
}

// Simplified GetPackageScriptsDto without class-validator/swagger decorators
export interface GetPackageScriptsDto {
  projectRoot: string;
}

// Simplified SshCommandDto without class-validator/swagger decorators
export interface SshCommandDto {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  command: string;
}

// Simplified TerminalCommandDto without class-validator/swagger decorators
export interface TerminalCommandDto {
  command: string;
  cwd: string;
}

// SSH specific configuration
export interface SshConnectConfig extends ConnectConfig {
  privateKey?: string | Buffer; // Allow Buffer for direct key content
}

// For the 'runSshCommandOnce' options
export interface RunSshCommandOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string; // Path to private key file
  command: string;
}
