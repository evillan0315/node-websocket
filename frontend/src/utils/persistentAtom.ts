import { atom } from 'nanostores';

/**
 * Creates a nanostore atom that persists its state to localStorage.
 * @template T - The type of the store's value.
 * @param key - The key to use for localStorage.
 * @param initialValue - The initial value if nothing is found in localStorage.
 * @returns A nanostore atom with persistent capabilities.
 */
export function persistentAtom<T>(key: string, initialValue: T) {
  const storedValue = localStorage.getItem(key);
  const initial = storedValue ? JSON.parse(storedValue) : initialValue;
  const store = atom<T>(initial);

  store.listen((value) => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  return store;
}
