import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { openDb } from '../src/db/connection.js';
import { init } from '../src/db/init.js';
import { reset } from '../src/db/reset.js';
import { DRAWS_EXIST_MESSAGE, SeedError, seed } from '../src/db/seed.js';
import { TEST_BCRYPT_COST, createTestDb, testConfig } from './helpers.js';

const opts = { bcryptCost: TEST_BCRYPT_COST };
const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const idOf = (db, login) => db.prepare('SELECT id FROM users WHERE login = ?').pluck().get(login);

/** Insère un tirage complet valide pour Thibault (giver) à la main. */
function insertSomeDraws(db) {
  const insert = db.prepare('INSERT INTO draws (giver_id, receiver_id) VALUES (?, ?)');
  insert.run(idOf(db, 'thibault'), idOf(db, 'hugues'));
  insert.run(idOf(db, 'thibault'), idOf(db, 'oceane'));
}

describe('seed', () => {
  it('F1 — seed sur base vide : 7 utilisateurs, 1 exclusion', () => {
    const db = createTestDb();
    assert.equal(count(db, 'users'), 7);
    assert.equal(count(db, 'exclusions'), 1);
    const admin = db.prepare("SELECT * FROM users WHERE login = 'admin'").get();
    assert.equal(admin.is_admin, 1);
    assert.equal(admin.is_participant, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_participant = 1').get().n, 6);
    const oceane = db.prepare("SELECT * FROM users WHERE login = 'oceane'").get();
    assert.equal(oceane.name, 'Océane');
    assert.ok(bcrypt.compareSync('test-3', oceane.password_hash));
  });

  it('F2 — seed relancé : aucun doublon', () => {
    const db = createTestDb();
    seed(db, testConfig(), opts);
    seed(db, testConfig(), opts);
    assert.equal(count(db, 'users'), 7);
    assert.equal(count(db, 'exclusions'), 1);
  });

  it('F3 — mot de passe modifié avec tirages existants : hash mis à jour, tirages intacts', () => {
    const db = createTestDb();
    insertSomeDraws(db);
    db.prepare('INSERT INTO letters (user_id, content) VALUES (?, ?)').run(idOf(db, 'romane'), 'Un livre');
    const cfg = testConfig();
    cfg.participants[2].password = 'nouveau-mdp';
    seed(db, cfg, opts);
    const hash = db.prepare("SELECT password_hash FROM users WHERE login = 'oceane'").pluck().get();
    assert.ok(bcrypt.compareSync('nouveau-mdp', hash));
    assert.equal(count(db, 'draws'), 2);
    assert.equal(count(db, 'letters'), 1);
  });

  it('F4 — participant ajouté avec tirages existants : refus', () => {
    const db = createTestDb();
    insertSomeDraws(db);
    const cfg = testConfig();
    cfg.participants.push({ name: 'Gaston', password: 'x' });
    assert.throws(() => seed(db, cfg, opts), { name: 'SeedError', message: DRAWS_EXIST_MESSAGE });
    assert.equal(count(db, 'users'), 7);

    const cfg2 = testConfig();
    cfg2.exclusions.push(['Thibault', 'Romane']);
    assert.throws(() => seed(db, cfg2, opts), { message: DRAWS_EXIST_MESSAGE });

    // Après réinitialisation, l'ajout est accepté.
    reset(db);
    seed(db, cfg, opts);
    assert.equal(count(db, 'users'), 8);
  });

  it('F5 — configuration sans solution : refus avec message clair', () => {
    const db = openDb(':memory:');
    init(db);
    const cfg = {
      settings: { drawsPerPerson: 2, maxTimesDrawn: 2 },
      participants: [
        { name: 'A', password: 'a' },
        { name: 'B', password: 'b' },
        { name: 'C', password: 'c' },
      ],
      admin: { name: 'Admin', password: 'x' },
      exclusions: [['A', 'B']],
    };
    assert.throws(() => seed(db, cfg, opts), (err) => err instanceof SeedError && /impossible/i.test(err.message));
    assert.equal(count(db, 'users'), 0);
  });

  it('F6 — noms en double après normalisation : refus', () => {
    const db = openDb(':memory:');
    init(db);
    const cfg = testConfig();
    cfg.participants.push({ name: ' OCEANE ', password: 'x' });
    assert.throws(() => seed(db, cfg, opts), (err) => err instanceof SeedError && /double/.test(err.message));

    const cfg2 = testConfig();
    cfg2.admin.name = 'Thibault';
    assert.throws(() => seed(db, cfg2, opts), SeedError);
  });

  it('utilisateur retiré du fichier supprimé quand aucun tirage n’existe', () => {
    const db = createTestDb();
    const cfg = testConfig();
    cfg.participants = cfg.participants.filter((p) => p.name !== 'Romane');
    seed(db, cfg, opts);
    assert.equal(count(db, 'users'), 6);
    assert.equal(idOf(db, 'romane'), undefined);
  });

  it('reset : vide les tirages, conserve les lettres sauf option', () => {
    const db = createTestDb();
    insertSomeDraws(db);
    db.prepare('INSERT INTO letters (user_id, content) VALUES (?, ?)').run(idOf(db, 'romane'), 'Un livre');
    reset(db);
    assert.equal(count(db, 'draws'), 0);
    assert.equal(count(db, 'letters'), 1);
    reset(db, { letters: true });
    assert.equal(count(db, 'letters'), 0);
  });
});
