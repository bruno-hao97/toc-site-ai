import { fetchAdminVmediaBalance } from './adminVmediaBalance';
import { loadAuth, refreshSession } from './authStore';
import {
  clearAdminVmediaCreditsCache,
  getCachedAdminVmediaCredits,
  setCachedAdminVmediaCredits,
} from './creditsCache';

export interface DisplayCreditsState {
  credits: number;
  /** Admin đang xem số dư VMedia merchant (không phải credit nội bộ platform). */
  isAdminVmedia: boolean;
  platformCredits: number;
}

export function clearDisplayCreditsCache(): void {
  clearAdminVmediaCreditsCache();
}

/** Credit nội bộ platform (DB) — dùng cho chuyển/cấp credit, không phải số VMedia admin. */
export function getPlatformCreditsFromAuth(): number {
  const auth = loadAuth();
  if (typeof auth?.user?.credits === 'number') return auth.user.credits;
  return auth?.upstream_me?.balancesInfo?.credits_ai ?? 0;
}

/** Đọc nhanh số hiển thị (dùng cache VMedia nếu admin đã fetch trước đó). */
export function getDisplayCreditsSync(): DisplayCreditsState {
  const platformCredits = getPlatformCreditsFromAuth();
  const isAdmin = Boolean(loadAuth()?.user?.isAdmin);
  const cached = isAdmin ? getCachedAdminVmediaCredits() : null;
  if (isAdmin && cached != null) {
    return { credits: cached, isAdminVmedia: true, platformCredits };
  }
  return { credits: platformCredits, isAdminVmedia: false, platformCredits };
}

/** Refresh session + VMedia balance (admin) rồi cập nhật cache. */
export async function refreshDisplayCredits(): Promise<DisplayCreditsState> {
  const auth = loadAuth();
  if (!auth) {
    clearDisplayCreditsCache();
    return { credits: 0, isAdminVmedia: false, platformCredits: 0 };
  }

  let platformCredits = getPlatformCreditsFromAuth();
  if (auth.platform_token?.trim()) {
    try {
      const session = await refreshSession();
      platformCredits = session.user?.credits ?? platformCredits;
    } catch {
      /* giữ số platform hiện có */
    }
  }

  if (auth.user?.isAdmin && auth.platform_token?.trim()) {
    try {
      const data = await fetchAdminVmediaBalance();
      if (data?.credits_ai != null) {
        setCachedAdminVmediaCredits(data.credits_ai);
        return { credits: data.credits_ai, isAdminVmedia: true, platformCredits };
      }
    } catch {
      clearDisplayCreditsCache();
    }
  } else {
    clearDisplayCreditsCache();
  }

  return { credits: platformCredits, isAdminVmedia: false, platformCredits };
}
