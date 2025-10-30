import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
export const BASE_DIR = process.env.BASE_DIR || ''; // Use empty string for root, or '/app' etc.
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const SHELL_DEFAULT = process.env.SHELL_DEFAULT || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
