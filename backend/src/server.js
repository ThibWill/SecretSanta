import { config } from './config.js';
import { openDb } from './db/connection.js';
import { init } from './db/init.js';
import { SeedError, formatSeedSummary, loadParticipantsFile, seed } from './db/seed.js';
import { createApp } from './app.js';

const DEV_JWT_SECRET = 'dev-secret-a-ne-pas-utiliser-en-production';

function main() {
  if (!config.jwtSecret) {
    if (config.isProduction) {
      console.error('Erreur : JWT_SECRET est obligatoire en production.');
      process.exit(1);
    }
    console.warn('Avertissement : JWT_SECRET non défini, utilisation d’un secret de développement.');
    config.jwtSecret = DEV_JWT_SECRET;
  }

  let db;
  let summary;
  try {
    db = openDb(config.dbPath);
    init(db);
    summary = seed(db, loadParticipantsFile(config.participantsFile));
    console.log(formatSeedSummary(summary));
  } catch (err) {
    console.error('Erreur au démarrage :', err instanceof SeedError ? err.message : err);
    process.exit(1);
  }

  const app = createApp({ db, settings: summary.settings, appConfig: config });
  const server = app.listen(config.port, () => {
    console.log(`Serveur à l'écoute sur le port ${config.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
