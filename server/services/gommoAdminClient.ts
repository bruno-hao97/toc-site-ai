import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { flattenFormFields } from './gommoEnvelope.js';

function readFromPhpConfig(key: string): string {
  try {
    const filePath = path.join(process.cwd(), 'server', 'php-bridge', 'config.local.php');
    const text = fs.readFileSync(filePath, 'utf8');
    const re = new RegExp(`'${key}'\\s*=>\\s*'([^']*)'`);
    return text.match(re)?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

export function getGommoAdminToken(): string {
  return config.gommo.accessToken || readFromPhpConfig('gommo_access_token');
}

export function getGommoProjectId(): string {
  return readFromPhpConfig('gommo_project_id') || 'default';
}

function parseGommoError(text: string, status: number): string {
  if (text.trimStart().startsWith('<!')) {
    return `Gommo upstream HTTP ${status} (HTML error page)`;
  }
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // fall through
  }
  return text.slice(0, 200) || `HTTP ${status}`;
}

/** POST form tới Gommo (giống gommo_post_form trong PHP bridge). */
export async function gommoAdminPostForm(
  apiPath: string,
  fields: Record<string, unknown> = {},
  baseUrl = config.gommo.baseUrl,
): Promise<Record<string, unknown>> {
  const token = getGommoAdminToken();
  if (!token) {
    throw new Error('Chưa cấu hình gommo_access_token (GOMMO_ACCESS_TOKEN hoặc config.local.php)');
  }

  const flat = flattenFormFields(fields);
  flat.domain = flat.domain || config.gommo.apiDomain;
  flat.access_token = token;
  if (!flat.project_id) flat.project_id = getGommoProjectId();

  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(flat),
  });

  const text = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(parseGommoError(text, res.status));
  }
  if (!res.ok || parsed.success === false) {
    throw new Error(String(parsed.message || parseGommoError(text, res.status)));
  }
  return parsed;
}
