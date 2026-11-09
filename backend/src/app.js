import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { makeRequireAuth } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { drawRouter } from './routes/draw.js';
import { lettersRouter } from './routes/letters.js';
import { adminRouter } from './routes/admin.js';

/** Une ligne par requête (méthode, chemin, statut, durée). Jamais de corps. */
function requestLogger(req, res, next) {
  // Le healthcheck Docker appelle /api/health toutes les 30 s : inutile de le journaliser.
  if (req.originalUrl === '/api/health') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)} ms`);
  });
  next();
}

/**
 * Crée l'application Express.
 * @param {object} p
 * @param {import('better-sqlite3').Database} p.db
 * @param {{drawsPerPerson:number, maxTimesDrawn:number}} p.settings  paramètres du tirage
 * @param {object} [p.appConfig]  surcharge de la configuration (tests)
 * @param {boolean} [p.log]  journalisation des requêtes
 */
export function createApp({ db, settings, appConfig = config, log = true }) {
  if (!appConfig.jwtSecret) throw new Error('JWT_SECRET manquant.');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  if (log) app.use(requestLogger);
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  const requireAuth = makeRequireAuth(db, appConfig.jwtSecret);
  const deps = { db, settings, requireAuth, appConfig };

  const api = express.Router();
  api.get('/health', (req, res) => res.json({ status: 'ok' }));
  api.use('/auth', authRouter(deps));
  api.use('/users', usersRouter(deps));
  api.use('/draw', drawRouter(deps));
  api.use('/letters', lettersRouter(deps));
  api.use('/admin', adminRouter(deps));
  api.use(apiNotFound);
  app.use('/api', api);

  if (appConfig.staticDir) {
    const staticDir = path.resolve(appConfig.staticDir);
    const indexHtml = path.join(staticDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.warn(`Avertissement : ${indexHtml} introuvable, le front ne sera pas servi.`);
    }
    app.use(express.static(staticDir));
    app.get('/{*splat}', (req, res) => res.sendFile(indexHtml));
  }

  app.use(errorHandler);
  return app;
}
