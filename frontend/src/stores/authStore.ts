import { atom } from 'nanostores';
import { persistentAtom } from '@/utils/persistentAtom';

// For a standalone terminal, we'll simplify auth significantly.
// This token could be hardcoded for testing or fetched from a simple login form.
// In a real app, this would integrate with an actual authentication system.

const ACCESS_TOKEN_KEY = 'accessToken';

// Using persistentAtom for a real-world scenario where a token might be stored in localStorage
export const authStore = persistentAtom<string | null>(ACCESS_TOKEN_KEY, null);

// Set a dummy token for development if none exists
if (!authStore.get()) {
  // In a real app, this would be a dynamically obtained valid JWT
  // For this isolated frontend, a placeholder is sufficient.
  // Note: The backend has authentication removed for now, so the token itself doesn't validate.
  // This is just to satisfy the frontend's `getToken` check.
  const DUMMY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbm9ueW1vdXNfdXNlcl9pZCIsImlhdCI6MTUxNjIzOTAyMn0.tKxQ-pX_j-x-r-j-x-r-j-x-r-j-x-r-j-x-r-j-x-r-j-x'; // Example dummy JWT
  authStore.set(DUMMY_TOKEN);
  console.warn('No existing token found. Set a dummy token for development.');
}

export const getToken = (): string | null => {
  return authStore.get();
};

export const setToken = (token: string | null) => {
  authStore.set(token);
};
