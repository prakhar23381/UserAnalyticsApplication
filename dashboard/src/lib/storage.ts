'use client';

// The viewer's saved segments, default segment and watchlist, in localStorage
// (D3). Every access is guarded: in a private window or with site data blocked
// the calls can throw, and then values live in memory for this tab only, so the
// dashboard still works but nothing is kept. Other tabs follow through the
// `storage` event.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  parseDefaultSegment,
  parseSegments,
  parseWatchlist,
  type SavedSegment,
  STORAGE_KEYS,
  type WatchItem,
} from './segments';

const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

/** The stored text for a key, or null. Safe to call anywhere in the browser. */
export function readStored(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value); // storage is blocked: keep it for this tab
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** One stored value, parsed. The server render and the first browser render see nothing stored. */
function useStored<T>(key: string, parse: (raw: string | null) => T): [T, (next: T | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
  const value = useMemo(() => parse(raw), [raw, parse]);
  const set = useCallback((next: T | null) => writeStored(key, next === null ? null : JSON.stringify(next)), [key]);
  return [value, set];
}

export const useSavedSegments = () => useStored<SavedSegment[]>(STORAGE_KEYS.segments, parseSegments);
export const useDefaultSegment = () => useStored<string | null>(STORAGE_KEYS.defaultSegment, parseDefaultSegment);
export const useWatchlist = () => useStored<WatchItem[]>(STORAGE_KEYS.watchlist, parseWatchlist);
