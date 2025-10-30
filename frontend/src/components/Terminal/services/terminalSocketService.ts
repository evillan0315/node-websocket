import { createSocketClient, ISocketClient } from '@/services/socketClientFactory';
import { projectRootDirectoryStore } from '@/stores/fileTreeStore';
// No longer directly importing getToken here, it's handled by socketClientFactory or inferred to be anonymous
import { ExecDto, ResizePayload, SSHConnectPayload } from '@/components/Terminal/types/terminal';

const TERMINAL_NAMESPACE = '/terminal';
const terminalSocketClient: ISocketClient = createSocketClient(TERMINAL_NAMESPACE);

/**
 * Service for managing the specific WebSocket communication for the terminal.
 * It encapsulates all terminal-related socket logic and uses an isolated
 * socket instance provided by `createSocketClient`.
 */
export const terminalSocketService = {
  /**
   * Connects to the terminal WebSocket server for this specific client.
   * This service only manages the raw socket connection. Event listeners
   * (output, error, prompt, info) should be registered by the consuming component (e.g., Terminal).
   *
   * @param overrideInitialCwd Optional: Initial current working directory for the connection query.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(overrideInitialCwd?: string): Promise<void> {
    // Resolve initialCwd from store or override, then connect the underlying client.
    const projectRoot = overrideInitialCwd || projectRootDirectoryStore.get();
    return terminalSocketClient.connect(projectRoot);
  },

  /**
   * Disconnects from the terminal WebSocket server.
   */
  disconnect(): void {
    terminalSocketClient.disconnect();
  },

  /**
   * Executes a command in the terminal session.
   * @param command The command string to execute.
   * @param newCwd Optional: New current working directory for the command.
   */
  execCommand(command: string, newCwd?: string): void {
    const payload: ExecDto = { command };
    if (newCwd) {
      payload.newCwd = newCwd;
    }
    terminalSocketClient.emit('exec_terminal', payload);
  },

  /**
   * Sets the current working directory of the terminal session.
   * @param cwd The new current working directory.
   */
  setCwd(cwd: string): void {
    terminalSocketClient.emit('set_cwd', { cwd });
  },

  /**
   * Resizes the terminal session (columns and rows).
   * @param cols Number of columns.
   * @param rows Number of rows.
   */
  resize(cols: number, rows: number): void {
    terminalSocketClient.emit('resize', { cols, rows } as ResizePayload);
  },

  /**
   * Initiates an SSH connection through the terminal backend.
   * @param config SSH connection configuration details.
   */
  sshConnect(config: SSHConnectPayload): void {
    terminalSocketClient.emit('ssh-connect', config);
  },

  /**
   * Sends input (e.g., keyboard input) to the terminal session.
   * @param input The input string.
   */
  sendInput(input: string): void {
    terminalSocketClient.emit('input', { input });
  },

  /**
   * Closes the active terminal session.
   */
  closeSession(): void {
    terminalSocketClient.emit('close');
  },

  /**
   * Checks if the terminal socket is currently connected.
   * @returns True if connected, false otherwise.
   */
  isConnected(): boolean {
    return terminalSocketClient.isConnected();
  },

  /**
   * Registers an event listener for terminal-specific socket events.
   * @param event The event name (e.g., 'output', 'error', 'prompt').
   * @param callback The callback function to execute when the event occurs.
   */
  on(event: string, callback: (...args: any[]) => void): void {
    terminalSocketClient.on(event, callback);
  },

  /**
   * Unregisters an event listener from terminal-specific socket events.
   * @param event The event name to remove the listener from.
   * @param callback The specific callback function to remove. If not provided, all listeners for the event will be removed.
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      terminalSocketClient.off(event, callback);
    } else {
      // Socket.IO's 'off' with only event name removes all listeners for that event
      terminalSocketClient.off(event);
    }
  },
};