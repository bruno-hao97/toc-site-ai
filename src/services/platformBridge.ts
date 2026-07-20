/**
 * PHP bridge trên VPS (`/api/platform/*.php`).
 * Production gọi trực tiếp; local Vite proxy `/api/platform` → pro.agi.vn.
 */
export const PLATFORM_BRIDGE = {
  login: '/api/platform/login.php',
  register: '/api/platform/register.php',
  me: '/api/platform/me.php',
  changePassword: '/api/platform/change-password.php',
  transfer: '/api/platform/transfer.php',
  grant: '/api/platform/grant.php',
  jobModels: '/api/platform/job-models.php',
  jobCreate: '/api/platform/job-create.php',
  jobPoll: '/api/platform/job-poll.php',
  jobUpload: '/api/platform/job-upload.php',
  jobList: '/api/platform/job-list.php',
  jobDelete: '/api/platform/job-delete.php',
  newfeeds: '/api/platform/newfeeds.php',
  publicVideos: '/api/platform/public-videos.php',
} as const;
