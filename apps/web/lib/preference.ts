'use client';

import { useSyncExternalStore } from 'react';

/**
 * A per-viewer UI preference kept in localStorage — which demo role, whether
 * the sidebar is folded. Never application data. The server renders the
 * fallback, and a blocked or empty storage simply keeps it.
 */
export function createPreference<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const listeners = new Set<() => void>();

  function read(): T {
    try {
      const stored = localStorage.getItem(key);
      return allowed.includes(stored as T) ? (stored as T) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(value: T): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private windows and blocked site data keep the choice for this page only.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return function usePreference(): [T, (value: T) => void] {
    return [useSyncExternalStore(subscribe, read, () => fallback), write];
  };
}
