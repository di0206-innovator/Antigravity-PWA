import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';

export interface LiveResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

/** Subscribes to a Dexie liveQuery; re-runs when `deps` change. `data` is undefined until first load. */
export function useLive<T>(querier: () => Promise<T> | T, deps: readonly unknown[] = []): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: undefined, loading: true, error: undefined });
  const ref = useRef(querier);
  useEffect(() => {
    ref.current = querier;
  });
  useEffect(() => {
    const sub = liveQuery(() => ref.current()).subscribe({
      next: (data) => setState({ data, loading: false, error: undefined }),
      error: (e) => setState({ data: undefined, loading: false, error: e instanceof Error ? e : new Error(String(e)) }),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
