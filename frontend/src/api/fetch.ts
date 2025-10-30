import { getToken } from '@/stores/authStore';
import { addLog } from '@/stores/logStore';

// API_BASE_URL is not directly used by the XTerminal in this setup, as WebSocket handles communication.
// This is a placeholder for potential REST API calls if the terminal needed to fetch data via REST.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

export class ApiError extends Error {
  response: Response;
  data: any;

  constructor(message: string, response: Response, data: any) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const handleResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json();

  if (!response.ok) {
    const errorDetail = data.message || response.statusText;
    addLog('API Error', `Status: ${response.status}, Details: ${errorDetail}`, 'error');
    throw new ApiError(errorDetail, response, data);
  }
  return data as T;
};

export const fetchWithAuth = async (url: string, options?: RequestInit): Promise<Response> => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  return response;
};
