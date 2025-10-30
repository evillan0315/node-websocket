import { atom } from 'nanostores';
import { persistentAtom } from '@/utils/persistentAtom';

export type ThemeMode = 'light' | 'dark';

export const themeStore = persistentAtom<{
  mode: ThemeMode;
}>('themeMode', { mode: 'dark' });

export const toggleTheme = () => {
  themeStore.set({ mode: themeStore.get().mode === 'dark' ? 'light' : 'dark' });
};
