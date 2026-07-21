import { useCallback, useEffect, useState } from 'react';
import {
  getDisplayCreditsSync,
  refreshDisplayCredits,
  type DisplayCreditsState,
} from '../services/displayCredits';
import { useCreditsUpdated } from './useCreditsUpdated';

export function useDisplayCredits(options?: { refreshOnMount?: boolean }): DisplayCreditsState & {
  refresh: () => Promise<DisplayCreditsState>;
} {
  const refreshOnMount = options?.refreshOnMount ?? true;
  const [state, setState] = useState<DisplayCreditsState>(getDisplayCreditsSync);

  const refresh = useCallback(async () => {
    const next = await refreshDisplayCredits();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    if (!refreshOnMount) return;
    void refresh();
  }, [refresh, refreshOnMount]);

  useCreditsUpdated(() => {
    void refresh();
  });

  return { ...state, refresh };
}
