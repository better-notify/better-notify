import { useCallback, useEffect, useMemo, useState } from 'react';

const ROOT_KEY = 'bn:store';
const CHANGE_EVENT = 'bn:store:change';

type StoreShape = Record<string, unknown>;

type StoredEntry<T> = { v: T; e?: number };

export type UseLocalStorageOptions = {
  ttl?: number;
};

export type UseLocalStorageResult<T> = {
  value: T | null;
  setValue: (next: T | null) => void;
  isHydrated: boolean;
};

const isBrowser = () => typeof window !== 'undefined';

const readRoot = (): StoreShape => {
  if (!isBrowser()) return {};
  const raw = window.localStorage.getItem(ROOT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as StoreShape) : {};
  } catch {
    return {};
  }
};

const writeRoot = (root: StoreShape) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ROOT_KEY, JSON.stringify(root));
  } catch {
    return;
  }
};

const getAtPath = (root: StoreShape, path: readonly string[]): unknown => {
  let cursor: unknown = root;
  for (const segment of path) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

const setAtPath = (root: StoreShape, path: readonly string[], value: unknown): StoreShape => {
  if (path.length === 0) return root;
  const clone: StoreShape = { ...root };
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (segment === undefined) continue;
    const existing = cursor[segment];
    const next =
      existing && typeof existing === 'object' ? { ...(existing as Record<string, unknown>) } : {};
    cursor[segment] = next;
    cursor = next;
  }
  const last = path[path.length - 1];
  if (last === undefined) return clone;
  if (value === undefined) {
    delete cursor[last];
  } else {
    cursor[last] = value;
  }
  return clone;
};

const unwrap = <T>(raw: unknown): T | null => {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as StoredEntry<T>;
  if (entry.e != null && entry.e <= Date.now()) return null;
  return entry.v ?? null;
};

const notify = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const useLocalStorage = <T>(
  path: readonly string[],
  options?: UseLocalStorageOptions,
): UseLocalStorageResult<T> => {
  const ttl = options?.ttl;
  const pathKey = useMemo(() => JSON.stringify(path), [path]);
  const segments = useMemo(() => JSON.parse(pathKey) as string[], [pathKey]);

  const [value, setStateValue] = useState<T | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const read = (): T | null => {
      const root = readRoot();
      return unwrap<T>(getAtPath(root, segments));
    };

    setStateValue(read());
    setIsHydrated(true);

    const handler = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== ROOT_KEY) {
        return;
      }
      setStateValue(read());
    };

    window.addEventListener('storage', handler);
    window.addEventListener(CHANGE_EVENT, handler);

    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(CHANGE_EVENT, handler);
    };
  }, [segments]);

  const setValue = useCallback(
    (next: T | null) => {
      const root = readRoot();
      const payload =
        next === null
          ? undefined
          : ttl != null
            ? ({ v: next, e: Date.now() + ttl } satisfies StoredEntry<T>)
            : ({ v: next } satisfies StoredEntry<T>);
      writeRoot(setAtPath(root, segments, payload));
      setStateValue(next);
      notify();
    },
    [segments, ttl],
  );

  return { value, setValue, isHydrated };
};
