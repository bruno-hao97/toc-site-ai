import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, isDatabaseConfigured } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrateDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.warn('[db] skip migrate — DB chưa cấu hình');
    return;
  }

  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = await readFile(sqlPath, 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    for (const statement of statements) {
      await conn.query(statement);
    }
    console.log('[db] schema ready');
  } finally {
    conn.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  migrateDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db] migrate failed', err);
      process.exit(1);
    });
}
