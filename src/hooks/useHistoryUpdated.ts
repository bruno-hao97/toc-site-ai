import { useEffect } from 'react';

export function useHistoryUpdated(onUpdate: () => void): void {
  useEffect(() => {
    const handler = () => onUpdate();
    document.addEventListener('history:updated', handler);
    return () => document.removeEventListener('history:updated', handler);
  }, [onUpdate]);
}
