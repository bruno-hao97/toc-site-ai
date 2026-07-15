import { gommoDeviceFields } from './gommoDevice';
import { GOMMO_AUTH_PATH } from './upstreamMe';

export class GommoAuthError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GommoAuthError';
    this.status = status;
  }
}

interface GommoAuthResponse {
  access_token?: string;
  success?: boolean;
  message?: string;
  error?: number;
  runtime?: number;
}

async function parseAuthResponse(res: Response): Promise<GommoAuthResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as GommoAuthResponse;
  } catch {
    throw new GommoAuthError(text || `HTTP ${res.status}`, res.status);
  }
}

/** Đăng nhập Gommo qua proxy — POST /api/apps/go-mmo/auth/login */
export async function gommoLoginWithPassword(
  email: string,
  password: string,
  domain: string,
): Promise<string> {
  const body = new URLSearchParams({
    email: email.trim(),
    password,
    domain: domain.trim(),
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_PATH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const parsed = await parseAuthResponse(res);
  if (!res.ok || parsed.error || !parsed.access_token) {
    throw new GommoAuthError(parsed.message || 'Đăng nhập thất bại', res.status);
  }
  return parsed.access_token;
}

export interface GommoRegisterInput {
  email: string;
  password: string;
  phone: string;
  domain: string;
  name?: string;
}

/** Đăng ký Gommo qua proxy — POST /api/apps/go-mmo/auth/register */
export async function gommoRegisterWithPassword(input: GommoRegisterInput): Promise<string> {
  const body = new URLSearchParams({
    name: input.name?.trim() || '',
    email: input.email.trim(),
    password: input.password,
    phone: input.phone.trim(),
    domain: input.domain.trim(),
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_PATH}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const parsed = await parseAuthResponse(res);
  if (!res.ok || parsed.error || !parsed.access_token) {
    const status = /tồn tại|exist/i.test(parsed.message || '') ? 409 : res.status;
    throw new GommoAuthError(parsed.message || 'Đăng ký thất bại', status);
  }
  return parsed.access_token;
}

export interface GommoChangePasswordInput {
  accessToken: string;
  domain: string;
  currentPassword: string;
  newPassword: string;
}

/** Đổi mật khẩu Gommo qua proxy — POST /api/apps/go-mmo/auth/change-password */
export async function gommoChangePassword(input: GommoChangePasswordInput): Promise<string> {
  const body = new URLSearchParams({
    access_token: input.accessToken.trim(),
    domain: input.domain.trim(),
    current_password: input.currentPassword,
    new_password: input.newPassword,
    language: 'vi',
    ...gommoDeviceFields(),
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_PATH}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const parsed = await parseAuthResponse(res);
  if (!res.ok || parsed.error || !parsed.success) {
    throw new GommoAuthError(parsed.message || 'Đổi mật khẩu thất bại', res.status);
  }
  return parsed.message || 'Đổi mật khẩu thành công.';
}

/** Quên mật khẩu — POST /api/apps/go-mmo/auth/reset-password */
export async function gommoResetPassword(
  email: string,
  domain: string,
  language = 'VI',
): Promise<string> {
  const body = new URLSearchParams({
    email: email.trim(),
    domain: domain.trim(),
    language,
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_PATH}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const parsed = await parseAuthResponse(res);
  if (!res.ok || parsed.error || !parsed.success) {
    throw new GommoAuthError(parsed.message || 'Gửi email reset thất bại', res.status);
  }
  return parsed.message || 'Chúng tôi đã gửi email reset mật khẩu.';
}
