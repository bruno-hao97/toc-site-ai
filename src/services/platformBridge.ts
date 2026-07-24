/**
 * PHP bridge trên VPS (`/api/platform/*.php`).
 * Production gọi trực tiếp; local Vite proxy `/api/platform` → pro.agi.vn.
 */
export const PLATFORM_BRIDGE = {
  login: '/api/platform/login.php',
  register: '/api/platform/register.php',
  tokenMe: '/api/platform/token-me.php',
  me: '/api/platform/me.php',
  changePassword: '/api/platform/change-password.php',
  transfer: '/api/platform/transfer.php',
  grant: '/api/platform/grant.php',
  adminVmediaBalance: '/api/platform/admin-vmedia-balance.php',
  adminWalletStats: '/api/platform/admin-wallet-stats.php',
  adminSyncFund: '/api/platform/admin-sync-fund.php',
  creditsAdjust: '/api/platform/credits-adjust.php',
  jobModels: '/api/platform/job-models.php',
  jobCreate: '/api/platform/job-create.php',
  jobPoll: '/api/platform/job-poll.php',
  jobUpload: '/api/platform/job-upload.php',
  jobList: '/api/platform/job-list.php',
  jobRecord: '/api/platform/job-record.php',
  mineMedia: '/api/platform/mine-media.php',
  jobDelete: '/api/platform/job-delete.php',
  newfeeds: '/api/platform/newfeeds.php',
  publicVideos: '/api/platform/public-videos.php',
} as const;
