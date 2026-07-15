import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { config } from '../config.js';
import { getPool } from '../db/pool.js';

export interface PlatformUser {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  credits: number;
  createdAt: string;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  password_hash: string;
  credits: number;
  created_at: Date;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function toUser(row: UserRow): PlatformUser {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    name: row.name,
    credits: row.credits,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function signPlatformToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyPlatformToken(token: string): string {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
    const userId = payload.sub;
    if (!userId) throw new AuthError('Token không hợp lệ', 401);
    return userId;
  } catch {
    throw new AuthError('Token không hợp lệ hoặc đã hết hạn', 401);
  }
}

export async function findUserById(id: string): Promise<PlatformUser | null> {
  const [rows] = await getPool().query<UserRow[]>(
    'SELECT id, email, phone, name, password_hash, credits, created_at FROM users WHERE id = :id LIMIT 1',
    { id },
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await getPool().query<UserRow[]>(
    'SELECT id, email, phone, name, password_hash, credits, created_at FROM users WHERE email = :email LIMIT 1',
    { email: email.trim().toLowerCase() },
  );
  return rows[0] ?? null;
}

export async function registerUser(input: {
  email: string;
  password: string;
  phone?: string;
  name?: string;
}): Promise<{ user: PlatformUser; token: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const phone = input.phone?.trim() || null;
  const name = input.name?.trim() || null;

  if (!email || !email.includes('@')) {
    throw new AuthError('Email không hợp lệ');
  }
  if (password.length < 6) {
    throw new AuthError('Mật khẩu cần ít nhất 6 ký tự');
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AuthError('Email đã được đăng ký', 409);
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const credits = config.auth.signupBonusCredits;

  try {
    await getPool().query<ResultSetHeader>(
      `INSERT INTO users (id, email, phone, name, password_hash, credits)
       VALUES (:id, :email, :phone, :name, :password_hash, :credits)`,
      {
        id,
        email,
        phone,
        name,
        password_hash: passwordHash,
        credits,
      },
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ER_DUP_ENTRY') {
      throw new AuthError('Email đã được đăng ký', 409);
    }
    throw err;
  }

  const user = await findUserById(id);
  if (!user) throw new AuthError('Không tạo được tài khoản', 500);
  return { user, token: signPlatformToken(id) };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: PlatformUser; token: string }> {
  const email = input.email.trim().toLowerCase();
  const row = await findUserByEmail(email);
  if (!row) {
    throw new AuthError('Email hoặc mật khẩu không đúng', 401);
  }

  const ok = await bcrypt.compare(input.password, row.password_hash);
  if (!ok) {
    throw new AuthError('Email hoặc mật khẩu không đúng', 401);
  }

  return { user: toUser(row), token: signPlatformToken(row.id) };
}

export async function getUserFromAuthHeader(authHeader?: string): Promise<PlatformUser> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Thiếu token đăng nhập', 401);
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new AuthError('Thiếu token đăng nhập', 401);
  const userId = verifyPlatformToken(token);
  const user = await findUserById(userId);
  if (!user) throw new AuthError('Tài khoản không tồn tại', 401);
  return user;
}
