import 'dotenv/config'; // Load environment variables
import express from 'express';
import http from 'http';
import { Server, Socket, Namespace } from 'socket.io'; // Removed AugmentedSocket
import * as os from 'os';
import * as process from 'process';
import { resolve } from 'path';
import { existsSync, statSync, readFileSync } from 'fs';
import { Client as SSHClient } from 'ssh2';

import { PORT, BASE_DIR, SHELL_DEFAULT } from './config';
import { TerminalService } from './terminal/terminal.service';
// Removed AuthService, authMiddleware, rolesMiddleware, authSocketMiddleware, UserRole imports
import { consoleLogger } from './utils/logger';
import {
  SshCommandDto,
  TerminalCommandDto,
  GetPackageScriptsDto,
  ExecDto,
  CreateCommandHistoryDto,
} from './terminal/terminal.types';

// --- Global Instances ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const terminalNamespace: Namespace = io.of('/terminal'); // Create a dedicated namespace

const terminalService = new TerminalService();
// Removed authService instance
const logger = consoleLogger;

// Placeholder for anonymous user ID now that auth is removed
const ANONYMOUS_USER_ID = 'anonymous_user_id';

// --- State Maps ---
const cwdMap = new Map<string, string>();
const sshClientMap = new Map<string, SSHClient>();
const sshStreamMap = new Map<string, any>(); // Using 'any' for SSH stream as it's not strongly typed by ssh2

// --- Express Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Removed Socket.IO Middleware: terminalNamespace.use(authSocketMiddleware);

// --- Helper to dispose SSH resources ---
const disposeSsh = (clientId: string) => {
  const sshClient = sshClientMap.get(clientId);
  if (sshClient) {
    sshClient.end();
    sshClientMap.delete(clientId);
  }
  sshStreamMap.delete(clientId);
};

// --- Socket.IO Connection Handling ---
terminalNamespace.on('connection', async (client: Socket) => { // Listen for connections on the specific namespace, client is now a regular Socket
  const clientId = client.id;
  // Removed userId and roles from connection parameters

  logger.log(`Client connected: ${clientId} (Anonymous User: ${ANONYMOUS_USER_ID})`);

  let initialCwd: string;
  const requestedCwdFromQuery = client.handshake.query.initialCwd as string | undefined;

  if (requestedCwdFromQuery && typeof requestedCwdFromQuery === 'string') {
    const resolvedRequestedCwd = resolve(requestedCwdFromQuery);
    if (existsSync(resolvedRequestedCwd) && statSync(resolvedRequestedCwd).isDirectory()) {
      initialCwd = resolvedRequestedCwd;
      logger.debug(`Client ${clientId} connected with requested CWD: ${initialCwd}`);
    } else {
      logger.warn(`Client ${clientId} requested invalid CWD: \"${requestedCwdFromQuery}\". Falling back to default.`);
      initialCwd = existsSync(BASE_DIR) && statSync(BASE_DIR).isDirectory() ? BASE_DIR : os.homedir();
    }
  } else {
    initialCwd = existsSync(BASE_DIR) && statSync(BASE_DIR).isDirectory() ? BASE_DIR : os.homedir();
    logger.debug(`Client ${clientId} connected with default CWD: ${initialCwd}`);
  }

  cwdMap.set(client.id, initialCwd);

  try {
    // Pass ANONYMOUS_USER_ID now that authentication is removed
    const dbSessionId = await terminalService.initializePtySession(
      clientId,
      client,
      initialCwd,
      ANONYMOUS_USER_ID,
    );
    (client as any).dbSessionId = dbSessionId; // Store db session ID on client (casted to any as it's a custom prop)

    client.emit('outputMessage', 'Welcome to the terminal!\n');
    client.emit('outputPath', cwdMap.get(clientId));
    client.emit('outputInfo', {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      uptime: os.uptime(),
      hostname: os.hostname(),
      cwd: cwdMap.get(clientId),
    });
    client.emit('prompt', { cwd: initialCwd, command: '' });
  } catch (err: any) {
    logger.error(`Failed to initialize PTY session for client ${clientId}: ${err.message}`, err.stack);
    client.emit('error', `Failed to initialize terminal: ${err.message}`);
    client.disconnect(true);
    return;
  }

  client.on('disconnect', () => {
    const clientId = client.id;
    const dbSessionId = (client as any).dbSessionId;
    if (dbSessionId) {
      terminalService.dispose(clientId);
    }
    cwdMap.delete(clientId);
    disposeSsh(clientId);
    logger.log(`Client disconnected: ${clientId}`);
  });

  client.on('set_cwd', async (payload: { cwd: string }) => {
    // Removed roles check
    const requestedCwd = payload.cwd;
    let currentCwd = cwdMap.get(clientId) || process.cwd();

    if (requestedCwd && existsSync(requestedCwd) && statSync(requestedCwd).isDirectory()) {
      const newCwd = resolve(currentCwd, requestedCwd);
      if (currentCwd !== newCwd) {
        cwdMap.set(clientId, newCwd);
        currentCwd = newCwd;
        terminalService.write(clientId, `cd '${newCwd}'\n`);
        logger.debug(`Client ${clientId} CWD set to: ${newCwd}`);
      }
      client.emit('prompt', { cwd: currentCwd, command: '' });
    } else {
      logger.warn(`Client ${clientId} requested invalid CWD: ${requestedCwd}`);
      terminalService.write(clientId, `Invalid directory: ${requestedCwd}\n`); // Emit error via PTY
      client.emit('prompt', { cwd: currentCwd, command: '' });
    }
  });

  client.on('exec_terminal', async (payload: ExecDto) => {
    // Removed roles check
    const dbSessionId = (client as any).dbSessionId;
    let currentCwd = cwdMap.get(clientId) || process.cwd();

    // Using ANONYMOUS_USER_ID
    if (!ANONYMOUS_USER_ID || !dbSessionId) {
      logger.warn(`Missing userId or dbSessionId for client ${clientId}`);
      client.emit('error', 'Terminal session not properly initialized.');
      return;
    }

    if (payload.newCwd !== undefined) {
      const targetCwd = payload.newCwd.trim();
      const resolvedCwd = resolve(currentCwd, targetCwd);

      if (existsSync(resolvedCwd) && statSync(resolvedCwd).isDirectory()) {
        cwdMap.set(clientId, resolvedCwd);
        currentCwd = resolvedCwd;
        logger.debug(`Client ${clientId} CWD changed to: ${resolvedCwd}`);
      } else {
        terminalService.write(clientId, `Invalid directory requested: ${targetCwd}\n`); // Emit via PTY
        logger.warn(`Client ${clientId} requested invalid CWD: ${targetCwd}`);
      }
      if (payload.command === undefined) {
        client.emit('prompt', { cwd: currentCwd, command: '' });
        return;
      }
    }

    if (payload.command === undefined) {
      return;
    }

    const command = payload.command.trim();

    const commandHistoryEntry: CreateCommandHistoryDto = {
      command: command.split('\n')[0],
      workingDirectory: currentCwd,
      shellType: SHELL_DEFAULT,
      status: 'EXECUTED',
    };
    terminalService.saveCommandHistoryEntry(dbSessionId, ANONYMOUS_USER_ID, commandHistoryEntry); // Pass ANONYMOUS_USER_ID

    if (sshStreamMap.has(clientId)) {
      const stream = sshStreamMap.get(clientId);
      stream.write(`${command}\n`);
      client.emit('prompt', { cwd: currentCwd, command });
      return;
    }

    if (command.startsWith('cd')) {
      const target = command.slice(3).trim();
      const newCwd = target === '' ? os.homedir() : resolve(currentCwd, target);

      if (existsSync(newCwd) && statSync(newCwd).isDirectory()) {
        cwdMap.set(clientId, newCwd);
        currentCwd = newCwd;
      } else {
        terminalService.write(clientId, `No such directory: ${newCwd}\n`);
      }
      client.emit('prompt', { cwd: currentCwd, command });
      return;
    }

    if (command === 'osinfo') {
      const info = {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        uptime: os.uptime(),
        hostname: os.hostname(),
        cwd: currentCwd,
        homedir: os.homedir(),
      };
      terminalService.write(
        clientId,
        Object.entries(info)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n') + '\n',
      );
      client.emit('prompt', { cwd: currentCwd, command });
      return;
    }

    try {
      client.emit('prompt', { cwd: currentCwd, command });
      terminalService.write(clientId, `${command}\n`);
    } catch (err: any) {
      logger.error(
        `Command failed for client ${clientId}: ${err.message}`,
        err.stack,
      );
      terminalService.write(clientId, `Command error: ${err.message}\n`);
      client.emit('prompt', { cwd: currentCwd, command: '' });
    }
  });

  // Old 'exec' handler is removed in favor of 'exec_terminal' and 'input'

  client.on('ssh-connect', async (payload: SshCommandDto) => {
    // Removed roles check

    if (sshClientMap.has(clientId)) {
      client.emit('error', 'SSH session already active');
      return;
    }

    const sshClient = new SSHClient();

    const config: any = { // ssh2.ConnectConfig type
      host: payload.host,
      port: payload.port || 22,
      username: payload.username,
    };

    if (payload.privateKeyPath) {
      try {
        readFileSync(payload.privateKeyPath); // Throws if file not found/readable
        config.privateKey = readFileSync(payload.privateKeyPath);
      } catch (err: any) {
        logger.warn(`Failed to read private key at ${payload.privateKeyPath}: ${err.message}`);
        client.emit('error', `SSH private key error: ${err.message}`);
        return;
      }
    } else if (payload.password) {
      config.password = payload.password;
    } else {
      client.emit('error', 'SSH requires either a password or private key path');
      return;
    }

    sshClient
      .on('ready', () => {
        logger.log(`SSH connected: ${clientId} to ${payload.host}`);
        client.emit('output', `Connected to ${payload.host}\n`);

        sshClient.shell((err, stream) => {
          if (err) {
            client.emit('error', `Shell error: ${err.message}`);
            disposeSsh(clientId);
            return;
          }
          sshStreamMap.set(clientId, stream);
          stream.on('data', (data: Buffer) => {
            client.emit('output', data.toString());
          });
          stream.on('close', () => {
            client.emit('output', 'SSH session closed\n');
            disposeSsh(clientId);
          });
          // Initial prompt for SSH
          client.emit('prompt', { cwd: '~', command: '' }); // CWD is remote, can't easily get it here
        });
      })
      .on('error', (err: any) => {
        client.emit('error', `SSH connection error: ${err.message}`);
        logger.error(`SSH connection error for ${clientId}: ${err.message}`);
        disposeSsh(clientId);
      })
      .on('end', () => {
        client.emit('output', 'SSH connection ended\n');
        disposeSsh(clientId);
      })
      .on('close', () => {
        client.emit('output', 'SSH connection closed\n');
        disposeSsh(clientId);
      })
      .connect(config);

    sshClientMap.set(clientId, sshClient);
  });

  client.on('input', async (data: { input: string }) => {
    // Removed roles check
    const dbSessionId = (client as any).dbSessionId;
    const currentCwd = cwdMap.get(clientId) || process.cwd();

    // Using ANONYMOUS_USER_ID
    if (!ANONYMOUS_USER_ID || !dbSessionId) {
      logger.warn(`Missing userId or dbSessionId for client ${clientId}`);
      client.emit('error', 'Terminal session not properly initialized.');
      return;
    }

    const command = data.input.trim();
    if (!command) {
      if (sshStreamMap.has(clientId)) {
        sshStreamMap.get(clientId).write(data.input);
        return;
      }
      terminalService.write(clientId, data.input);
      return;
    }

    const commandHistoryEntry: CreateCommandHistoryDto = {
      command: command.split('\n')[0],
      workingDirectory: currentCwd,
      shellType: SHELL_DEFAULT,
      status: 'EXECUTED',
    };

    terminalService.saveCommandHistoryEntry(dbSessionId, ANONYMOUS_USER_ID, commandHistoryEntry); // Pass ANONYMOUS_USER_ID

    if (sshStreamMap.has(clientId)) {
      sshStreamMap.get(clientId).write(data.input);
      return;
    }

    terminalService.write(clientId, data.input);
  });

  client.on('resize', (data: { cols: number; rows: number }) => {
    // Removed roles check
    terminalService.resize(clientId, data.cols, data.rows);
  });

  client.on('close', () => {
    terminalService.dispose(clientId);
    disposeSsh(clientId);
    logger.log(`Client ${clientId} explicitly closed session.`);
  });
});

// --- Express Routes ---
// Removed authMiddleware and rolesMiddleware from all routes
app.post('/api/terminal/ssh/run', async (req, res) => {
  const body: SshCommandDto = req.body;

  try {
    if (body.privateKeyPath) {
      readFileSync(body.privateKeyPath); // Throws if invalid path
    }

    const result = await terminalService.runSshCommandOnce({
      host: body.host,
      port: body.port || 22,
      username: body.username,
      password: body.password,
      privateKeyPath: body.privateKeyPath,
      command: body.command,
    });
    res.json(result);
  } catch (error: any) {
    logger.error('SSH command failed:', error.message, error.stack);
    res.status(400).json({
      message: 'SSH command failed',
      details: error.message,
    });
  }
});

app.post('/api/terminal/run', async (req, res) => {
  const body: TerminalCommandDto = req.body;
  const { command, cwd } = body;

  try {
    const result = await terminalService.runCommandOnce(command, cwd);
    res.json(result);
  } catch (error: any) {
    logger.error('Local command execution failed:', error.message, error.stack);
    res.status(400).json({
      message: 'Command execution failed',
      details: error.message,
    });
  }
});

app.post('/api/terminal/package-scripts', async (req, res) => {
  const body: GetPackageScriptsDto = req.body;

  try {
    const result = await terminalService.getPackageScripts(body.projectRoot);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to get package scripts:', error.message, error.stack);
    res.status(400).json({
      message: 'Failed to load package scripts',
      details: error.message,
    });
  }
});

// --- Start Server ---
server.listen(PORT, () => {
  logger.log(`Server listening on port ${PORT}`);
  logger.log(`WebSocket namespace: /terminal`);
});
