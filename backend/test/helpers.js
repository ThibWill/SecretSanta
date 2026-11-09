// Utilitaires partagés par les tests (ce fichier ne contient aucun test).
import { openDb } from '../src/db/connection.js';
import { init } from '../src/db/init.js';
import { seed } from '../src/db/seed.js';

export const NAMES = ['Thibault', 'Hugues', 'Océane', 'Romane', 'Bérénice', 'Coralie'];

/** Configuration de test : mêmes participants et exclusion que la réelle. */
export function testConfig() {
  return {
    settings: { drawsPerPerson: 2, maxTimesDrawn: 2 },
    participants: NAMES.map((name, i) => ({ name, password: `test-${i + 1}` })),
    admin: { name: 'Admin', password: 'test-admin' },
    exclusions: [['Hugues', 'Coralie']],
  };
}

/** Coût bcrypt réduit pour accélérer les tests. */
export const TEST_BCRYPT_COST = 4;

/** Base en mémoire, initialisée et seedée avec la configuration de test. */
export function createTestDb(config = testConfig()) {
  const db = openDb(':memory:');
  init(db);
  seed(db, config, { bcryptCost: TEST_BCRYPT_COST });
  return db;
}

/** Générateur déterministe (mulberry32) → randomInt(n) dans [0, n[. */
export function seededRandomInt(seedValue) {
  let a = seedValue >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (n) => Math.floor(next() * n);
}

/** Application de test sur une base en mémoire fraîche. */
export async function createTestApp(config = testConfig()) {
  const { createApp } = await import('../src/app.js');
  const db = createTestDb(config);
  const app = createApp({
    db,
    settings: config.settings,
    appConfig: { jwtSecret: 'test-secret', cookieSecure: false, staticDir: '' },
    log: false,
  });
  return { app, db };
}

/** Mot de passe de test d'un utilisateur de testConfig(). */
export function passwordOf(name) {
  if (name === 'Admin') return 'test-admin';
  return `test-${NAMES.indexOf(name) + 1}`;
}

/** Agent supertest connecté en tant que `name`. */
export async function loginAs(app, name) {
  const { default: request } = await import('supertest');
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ name, password: passwordOf(name) });
  if (res.status !== 200) throw new Error(`Connexion de ${name} impossible : ${res.status}`);
  return agent;
}

export const userId = (db, name) => db.prepare('SELECT id FROM users WHERE name = ?').pluck().get(name);
