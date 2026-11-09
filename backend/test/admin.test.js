import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { NAMES, createTestApp, loginAs } from './helpers.js';

const count = (db, table) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();

/** Hugues et Océane tirent ; Océane et Romane écrivent une lettre. */
async function someActivity(app) {
  const hugues = await loginAs(app, 'Hugues');
  const oceane = await loginAs(app, 'Océane');
  const romane = await loginAs(app, 'Romane');
  const draws = [(await hugues.post('/api/draw')).body, (await oceane.post('/api/draw')).body];
  await oceane.put('/api/letters/me').send({ content: 'Du thé' });
  await romane.put('/api/letters/me').send({ content: 'Un jeu' });
  return { draws };
}

describe('administration', () => {
  it('E1 — participant sur /api/admin/* : 403 ; sans session : 401', async () => {
    const { app } = await createTestApp();
    const agent = await loginAs(app, 'Thibault');
    for (const res of [await agent.get('/api/admin/status'), await agent.post('/api/admin/reset').send({})]) {
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }
    assert.equal((await request(app).get('/api/admin/status')).status, 401);
    assert.equal((await request(app).post('/api/admin/reset')).status, 401);
  });

  it('E2 — status : booléens corrects, aucun nom de receveur', async () => {
    const { app } = await createTestApp();
    await someActivity(app);
    const res = await (await loginAs(app, 'Admin')).get('/api/admin/status');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      participants: [
        { name: 'Bérénice', hasDrawn: false, hasLetter: false },
        { name: 'Coralie', hasDrawn: false, hasLetter: false },
        { name: 'Hugues', hasDrawn: true, hasLetter: false },
        { name: 'Océane', hasDrawn: true, hasLetter: true },
        { name: 'Romane', hasDrawn: false, hasLetter: true },
        { name: 'Thibault', hasDrawn: false, hasLetter: false },
      ],
      drawnCount: 2,
      total: 6,
    });
    // La réponse ne contient que des noms (en clé "name") et des booléens.
    for (const p of res.body.participants) {
      assert.deepEqual(Object.keys(p).sort(), ['hasDrawn', 'hasLetter', 'name']);
    }
  });

  it('E3 — reset sans lettres : draws vide, lettres intactes', async () => {
    const { app, db } = await createTestApp();
    await someActivity(app);
    const res = await (await loginAs(app, 'Admin')).post('/api/admin/reset').send({ resetLetters: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.drawnCount, 0);
    assert.equal(count(db, 'draws'), 0);
    assert.equal(count(db, 'letters'), 2);
    // Corps absent : resetLetters vaut false par défaut.
    await (await loginAs(app, 'Thibault')).post('/api/draw');
    await (await loginAs(app, 'Admin')).post('/api/admin/reset');
    assert.equal(count(db, 'draws'), 0);
    assert.equal(count(db, 'letters'), 2);
  });

  it('E4 — reset avec resetLetters : les deux tables vides', async () => {
    const { app, db } = await createTestApp();
    await someActivity(app);
    const res = await (await loginAs(app, 'Admin')).post('/api/admin/reset').send({ resetLetters: true });
    assert.equal(res.status, 200);
    assert.ok(res.body.participants.every((p) => !p.hasDrawn && !p.hasLetter));
    assert.equal(count(db, 'draws'), 0);
    assert.equal(count(db, 'letters'), 0);
  });

  it('reset : resetLetters non booléen → 400, rien supprimé', async () => {
    const { app, db } = await createTestApp();
    await someActivity(app);
    const res = await (await loginAs(app, 'Admin')).post('/api/admin/reset').send({ resetLetters: 'oui' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(count(db, 'draws'), 4);
  });

  it('E5 — après reset, tout le monde peut tirer de nouveau', async () => {
    const { app } = await createTestApp();
    await someActivity(app);
    await (await loginAs(app, 'Admin')).post('/api/admin/reset').send({ resetLetters: false });
    for (const name of NAMES) {
      const agent = await loginAs(app, name);
      assert.deepEqual((await agent.get('/api/draw')).body, { hasDrawn: false, receivers: [] });
    }
    for (const name of NAMES) {
      assert.equal((await (await loginAs(app, name)).post('/api/draw')).status, 201, name);
    }
  });
});
