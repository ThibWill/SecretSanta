import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { validateConfiguration } from '../services/drawAlgorithm.js';
import { openDb } from './connection.js';
import { init } from './init.js';
import { isMainModule } from './runAsScript.js';

export const DRAWS_EXIST_MESSAGE =
  'Des tirages existent déjà. Réinitialise le tirage (npm run db:reset) avant de modifier les participants ou les exclusions.';

export class SeedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SeedError';
  }
}

export const normalizeLogin = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Lit le fichier de configuration des participants. */
export function loadParticipantsFile(filePath = config.participantsFile) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new SeedError(`Impossible de lire le fichier de configuration « ${filePath} » : ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new SeedError(`Le fichier « ${filePath} » n'est pas un JSON valide : ${err.message}`);
  }
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isPositiveInt = (v) => Number.isInteger(v) && v >= 1;

/** Valide la configuration et renvoie une version normalisée. Lève SeedError. */
export function validateParticipantsConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') throw new SeedError('Configuration absente ou invalide.');

  const settings = cfg.settings ?? {};
  if (!isPositiveInt(settings.drawsPerPerson) || !isPositiveInt(settings.maxTimesDrawn)) {
    throw new SeedError('settings.drawsPerPerson et settings.maxTimesDrawn doivent être des entiers ≥ 1.');
  }
  if (!Array.isArray(cfg.participants) || cfg.participants.length === 0) {
    throw new SeedError('La liste « participants » doit contenir au moins un participant.');
  }
  if (!cfg.admin || typeof cfg.admin !== 'object') {
    throw new SeedError('Le compte « admin » est obligatoire.');
  }

  const people = [
    ...cfg.participants.map((p) => ({ ...p, isAdmin: false })),
    { ...cfg.admin, isAdmin: true },
  ];
  const seen = new Set();
  const users = people.map((p) => {
    if (!isNonEmptyString(p?.name)) throw new SeedError('Chaque utilisateur doit avoir un nom non vide.');
    const name = p.name.trim();
    if (!isNonEmptyString(p.password)) throw new SeedError(`Le mot de passe de « ${name} » est vide.`);
    const login = normalizeLogin(name);
    if (seen.has(login)) throw new SeedError(`Nom en double (après normalisation) : « ${name} ».`);
    seen.add(login);
    return { name, login, password: p.password, isAdmin: p.isAdmin };
  });

  const participantLogins = new Set(users.filter((u) => !u.isAdmin).map((u) => u.login));
  const exclusions = (cfg.exclusions ?? []).map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(isNonEmptyString)) {
      throw new SeedError(`Exclusion invalide : ${JSON.stringify(pair)}. Format attendu : ["Nom1", "Nom2"].`);
    }
    const [a, b] = pair.map(normalizeLogin);
    for (const [orig, login] of [[pair[0], a], [pair[1], b]]) {
      if (!participantLogins.has(login)) {
        throw new SeedError(`L'exclusion mentionne « ${orig} », qui n'est pas un participant.`);
      }
    }
    if (a === b) throw new SeedError(`Exclusion invalide : « ${pair[0]} » avec lui-même.`);
    return a < b ? [a, b] : [b, a];
  });
  const uniqueExclusions = [...new Map(exclusions.map((e) => [e.join('|'), e])).values()];

  return {
    settings: { drawsPerPerson: settings.drawsPerPerson, maxTimesDrawn: settings.maxTimesDrawn },
    participants: users.filter((u) => !u.isAdmin),
    admin: users.find((u) => u.isAdmin),
    exclusions: uniqueExclusions,
  };
}

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * Insère ou met à jour utilisateurs et exclusions. Ne touche jamais aux tirages
 * ni aux lettres (hors cascade lors de la suppression d'un utilisateur).
 * @returns {{participants:number, exclusions:number, admin:string, settings:object}}
 */
export function seed(db, rawConfig, { bcryptCost = 10 } = {}) {
  const cfg = validateParticipantsConfig(rawConfig);

  // Configuration réalisable ?
  const index = new Map(cfg.participants.map((p, i) => [p.login, i]));
  const feasible = validateConfiguration(
    cfg.participants.map((_, i) => i),
    cfg.exclusions.map(([a, b]) => [index.get(a), index.get(b)]),
    cfg.settings,
  );
  if (!feasible) {
    throw new SeedError(
      'Configuration impossible : aucun tirage complet ne respecte les règles (trop d’exclusions ou paramètres incompatibles avec le nombre de participants).',
    );
  }

  // Hachage hors transaction (lent).
  const hashed = [...cfg.participants, cfg.admin].map((u) => ({
    ...u,
    hash: bcrypt.hashSync(u.password, bcryptCost),
  }));

  db.transaction(() => {
    // Garde-fou : pas de changement de participants/exclusions si des tirages existent.
    const drawCount = db.prepare('SELECT COUNT(*) AS n FROM draws').get().n;
    if (drawCount > 0) {
      const dbParticipants = new Set(
        db.prepare('SELECT login FROM users WHERE is_participant = 1').pluck().all(),
      );
      const dbExclusions = new Set(
        db
          .prepare(
            `SELECT a.login AS a, b.login AS b FROM exclusions e
             JOIN users a ON a.id = e.user_a_id JOIN users b ON b.id = e.user_b_id`,
          )
          .all()
          .map(({ a, b }) => (a < b ? `${a}|${b}` : `${b}|${a}`)),
      );
      const fileParticipants = new Set(cfg.participants.map((p) => p.login));
      const fileExclusions = new Set(cfg.exclusions.map((e) => e.join('|')));
      if (!sameSet(dbParticipants, fileParticipants) || !sameSet(dbExclusions, fileExclusions)) {
        throw new SeedError(DRAWS_EXIST_MESSAGE);
      }
    }

    // Suppression des utilisateurs absents du fichier.
    const keep = new Set(hashed.map((u) => u.login));
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    for (const { id, login } of db.prepare('SELECT id, login FROM users').all()) {
      if (!keep.has(login)) deleteUser.run(id);
    }

    const upsert = db.prepare(`
      INSERT INTO users (name, login, password_hash, is_admin, is_participant)
      VALUES (@name, @login, @hash, @isAdmin, @isParticipant)
      ON CONFLICT(login) DO UPDATE SET
        name = excluded.name,
        password_hash = excluded.password_hash,
        is_admin = excluded.is_admin,
        is_participant = excluded.is_participant
    `);
    for (const u of hashed) {
      upsert.run({
        name: u.name,
        login: u.login,
        hash: u.hash,
        isAdmin: u.isAdmin ? 1 : 0,
        isParticipant: u.isAdmin ? 0 : 1,
      });
    }

    db.prepare('DELETE FROM exclusions').run();
    const idOf = db.prepare('SELECT id FROM users WHERE login = ?').pluck();
    const insertExclusion = db.prepare('INSERT INTO exclusions (user_a_id, user_b_id) VALUES (?, ?)');
    for (const [a, b] of cfg.exclusions) {
      const [ida, idb] = [idOf.get(a), idOf.get(b)].sort((x, y) => x - y);
      insertExclusion.run(ida, idb);
    }
  }).immediate();

  return {
    participants: cfg.participants.length,
    exclusions: cfg.exclusions.length,
    admin: cfg.admin.name,
    settings: cfg.settings,
  };
}

/** Message de résumé (sans aucun mot de passe). */
export function formatSeedSummary(summary) {
  return `Seed terminé : ${summary.participants} participants, ${summary.exclusions} exclusion(s), compte admin « ${summary.admin} ».`;
}

if (isMainModule(import.meta.url)) {
  try {
    const db = openDb();
    init(db);
    const summary = seed(db, loadParticipantsFile());
    db.close();
    console.log(formatSeedSummary(summary));
  } catch (err) {
    console.error(err instanceof SeedError ? `Erreur : ${err.message}` : err);
    process.exit(1);
  }
}
