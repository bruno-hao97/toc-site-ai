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
    throw new PlatformAuthError(text || `HTTP ${res.status}`, res.status);
  }
}

export async function platformLogin(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
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
  const res = await fetch('/api/auth/register', {
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
