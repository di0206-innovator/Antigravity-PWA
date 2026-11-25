import { useSyncExternalStore } from 'react';
import { useAppStore } from '../stores/useAppStore';

function subscribeOnlineStatus(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => {
    const nextOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    useAppStore.getState().setOnlineStatus(nextOnline);
    callback();
  };

  window.addEventListener('online', handleChange);
  window.addEventListener('offline', handleChange);

  return () => {
    window.removeEventListener('online', handleChange);
    window.removeEventListener('offline', handleChange);
  };
}

function getClientOnlineSnapshot(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): boolean {
  const browserOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getClientOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const storeOnline = useAppStore((s) => s.isOnline);
  return browserOnline && storeOnline;
}
