// Lecture centralisée des variables d'environnement.

const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  dbPath: env.DB_PATH || './data/secret-santa.db',
  participantsFile: env.PARTICIPANTS_FILE || './config/participants.json',
  jwtSecret: env.JWT_SECRET || '',
  cookieSecure: env.COOKIE_SECURE === 'true',
  staticDir: env.STATIC_DIR || '',
  isProduction: env.NODE_ENV === 'production',
};
