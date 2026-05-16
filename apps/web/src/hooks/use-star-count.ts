import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from './use-local-storage';

const TTL_MS = 10 * 60 * 1000;

export type StarCountState = { count: number | null; isLoading: boolean };

export const useStarCount = (owner: string, repo: string): StarCountState => {
  const path = useMemo(() => ['starCount', `${owner}/${repo}`], [owner, repo]);
  const {
    value: cached,
    setValue: setCached,
    isHydrated,
  } = useLocalStorage<number>(path, {
    ttl: TTL_MS,
  });
  const [fetchResolved, setFetchResolved] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (cached != null) {
      setFetchResolved(true);
      return;
    }

    setFetchResolved(false);
    const controller = new AbortController();

    fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const value = data?.stargazers_count;
        if (typeof value === 'number') {
          setCached(value);
        }
        setFetchResolved(true);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setFetchResolved(true);
        }
      });

    return () => controller.abort();
  }, [owner, repo, isHydrated, cached, setCached]);

  return {
    count: cached,
    isLoading: !isHydrated || (cached == null && !fetchResolved),
  };
};

export const formatStarCount = (count: number): string => {
  if (count >= 1000) {
    const k = count / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(count);
};
