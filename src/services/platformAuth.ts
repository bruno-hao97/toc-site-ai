import { PLATFORM_BRIDGE } from './platformBridge';

export class PlatformAuthError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PlatformAuthError';
    this.status = status;
  }
}

interface AuthResponse {
  success?: boolean;
  message?: string;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      phone: string | null;
      name: string | null;
      credits: number;
      isAdmin?: boolean;
      createdAt?: string;
    };
  };
}

async function parseAuthJson(res: Response): Promise<AuthResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as AuthResponse;
  } catch {
    const isHtml = /^\s*</.test(text) || text.includes('<!doctype', 0);
    const friendly = isHtml
      ? 'API backend chưa sẵn sàng (404). Kiểm tra Node server và nginx proxy /api trên VPS.'
      : text.slice(0, 200) || `HTTP ${res.status}`;
    throw new PlatformAuthError(friendly, res.status);
  }
}

export async function platformLogin(email: string, password: string) {
  const res = await fetch(PLATFORM_BRIDGE.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const parsed = await parseAuthJson(res);
  if (!res.ok || !parsed.success || !parsed.data) {
    throw new PlatformAuthError(parsed.message || 'Đăng nhập thất bại', res.status);
  }
  return parsed.data;
}

export async function platformRegister(input: {
  email: string;
  password: string;
  phone?: string;
  name?: string;
}) {
  const res = await fetch(PLATFORM_BRIDGE.register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const parsed = await parseAuthJson(res);
  if (!res.ok || !parsed.success || !parsed.data) {
    throw new PlatformAuthError(parsed.message || 'Đăng ký thất bại', res.status);
  }
  return parsed.data;
}
