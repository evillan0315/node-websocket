// This file is not directly used by the Terminal.tsx component as it primarily uses WebSockets.
// It's included as a placeholder based on the original project structure, but its functions
// are for REST API calls which the current frontend setup does not make for terminal interactions.

import { API_BASE_URL, ApiError, handleResponse, fetchWithAuth } from '@/api/fetch';
import { TerminalCommandResponse, ProjectScriptsResponse } from '../types/terminal';
import { addLog } from '@/stores/logStore';

/**
 * Executes a terminal command on the backend (via REST).
 * @param command The shell command string to execute.
 * @param cwd The current working directory for the command execution.
 * @returns A promise that resolves to the command's stdout, stderr, and exit code.
 */
export const runTerminalCommand = async (
  command: string,
  cwd: string,
): Promise<TerminalCommandResponse> => {
  addLog('Terminal API', `Executing command: `${command}` in `${cwd}``, 'info');
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/terminal/run`, {
      method: 'POST',
      body: JSON.stringify({ command, cwd }),
    });
    const result = await handleResponse<TerminalCommandResponse>(response);
    const formattedStdout =
      result.stdout.length > 0
        ? JSON.stringify(result.stdout, null, 2)
        : '(no stdout)';
    const formattedStderr =
      result.stderr.length > 0
        ? JSON.stringify(result.stderr, null, 2)
        : '(no stderr)';
    addLog(
      'Terminal API',
      `Command executed successfully: `${command}``,
      'success',
      `Stdout: ${formattedStdout}\nStderr: ${formattedStderr}\nExit Code: ${result.exitCode}`,
      result,
    );
    return result;
  } catch (error) {
    const errorMessage = `Failed to execute command: `${command}`\nError: ${
      error instanceof Error ? error.message : String(error)
    }`;
    addLog('Terminal API', errorMessage, 'error');
    throw error;
  }
};

/**
 * Fetches package.json scripts and detects the package manager from the project root (via REST).
 * @param projectRoot The root directory of the project.
 * @returns A promise that resolves to an object containing package scripts and the detected package manager.
 */
export const fetchProjectScripts = async (
  projectRoot: string,
): Promise<ProjectScriptsResponse> => {
  addLog(
    'Terminal API',
    `Fetching package scripts for project root: `${projectRoot}``,
    'info',
  );
  try {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/terminal/package-scripts`,
      {
        method: 'POST',
        body: JSON.stringify({ projectRoot }),
      },
    );
    const result = await handleResponse<ProjectScriptsResponse>(response);
    addLog(
      'Terminal API',
      `Successfully fetched package scripts for `${projectRoot}``,
      'success',
      `Manager: ${result.packageManager}, Scripts found: ${result.scripts.length}`,
    );
    return result;
  } catch (error) {
    const errorMessage = `Failed to fetch package scripts for `${projectRoot}`\nError: ${
      error instanceof Error ? error.message : String(error)
    }`;
    addLog('Terminal API', errorMessage, 'error');
    throw error;
  }
};
