import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';

export interface LiveResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

function serializeDeps(deps: readonly unknown[]): string {
  try {
    return JSON.stringify(deps, (_, v) => (v === undefined ? '__undefined__' : v));
  } catch {
    return String(deps.length);
  }
}

interface InternalState<T> extends LiveResult<T> {
  depsKey: string;
}

/** Subscribes to a Dexie liveQuery; re-runs when `deps` change. `data` is undefined until first load. */
export function useLive<T>(querier: () => Promise<T> | T, deps: readonly unknown[] = []): LiveResult<T> {
  const depsKey = serializeDeps(deps);
  const [state, setState] = useState<InternalState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
    depsKey,
  });
  const ref = useRef(querier);
  useEffect(() => {
    ref.current = querier;
  });
  useEffect(() => {
    let active = true;
    const sub = liveQuery(() => ref.current()).subscribe({
      next: (data) => {
        if (!active) return;
        setState({ data, loading: false, error: undefined, depsKey });
      },
      error: (e) => {
        if (!active) return;
        setState({
          data: undefined,
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
          depsKey,
        });
      },
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [depsKey]);

  if (state.depsKey !== depsKey) {
    return { data: undefined, loading: true, error: undefined };
  }

  return { data: state.data, loading: state.loading, error: state.error };
}
