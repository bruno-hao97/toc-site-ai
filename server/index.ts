import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gommoProxyRoutes from './routes/gommoProxy.js';
import payosRoutes from './routes/payos.js';
import authRoutes from './routes/auth.js';
import creditsRoutes from './routes/credits.js';
import jobsRoutes from './routes/jobs.js';
import platformBridgeRoutes from './routes/platformBridge.js';
import { config } from './config.js';
import { migrateDatabase } from './db/migrate.js';
import { isDatabaseConfigured } from './db/pool.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));

// Gommo pass-through proxy (che URL upstream) — mount TRƯỚC express.json vì cần raw body.
app.use(gommoProxyRoutes);

app.use(express.json({ limit: '25mb' }));

// Local dev: job-create/job-poll qua Node (tránh PHP bridge cũ trên VPS)
app.use('/api/platform', platformBridgeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      ok: true,
      mode: 'platform-auth-payos',
      database: isDatabaseConfigured(),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/payos', payosRoutes);

const isProduction = process.env.NODE_ENV === 'production';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (isProduction) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api(?:\/|$)|\/ai(?:\/|$)|\/v2(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Internal error' });
});

async function start() {
  try {
    await migrateDatabase();
  } catch (err) {
    console.error('[db] migrate on boot failed — auth API có thể không chạy', err);
  }

  app.listen(config.port, () => {
    console.log(
      `API server http://localhost:${config.port} (platform auth + Gommo proxy + PayOS${isProduction ? ' + static dist' : ''})`,
    );
  });
}

void start();
