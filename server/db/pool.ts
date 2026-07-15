import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool: mysql.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(config.db.host && config.db.user && config.db.database);
}

export function getPool(): mysql.Pool {
  if (!isDatabaseConfigured()) {
    throw new Error('Database chưa cấu hình (DB_HOST / DB_USER / DB_NAME)');
  }
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }
  return pool;
}
