import { useEffect } from 'react';

export function useCreditsUpdated(onUpdate: () => void): void {
  useEffect(() => {
    const handler = () => onUpdate();
    document.addEventListener('credits:updated', handler);
    return () => document.removeEventListener('credits:updated', handler);
  }, [onUpdate]);
}
