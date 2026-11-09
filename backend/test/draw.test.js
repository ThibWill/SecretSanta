import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { NAMES, createTestApp, loginAs, seededRandomInt, userId } from './helpers.js';
import { performDraw } from '../src/services/drawService.js';

describe('tirage (API)', () => {
  it('C1 — GET /api/draw avant tirage', async () => {
    const { app } = await createTestApp();
    const agent = await loginAs(app, 'Thibault');
    const res = await agent.get('/api/draw');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { hasDrawn: false, receivers: [] });
  });

  it('C2/C3/C4 — tirage, second tirage refusé, consultation', async () => {
    const { app, db } = await createTestApp();
    const agent = await loginAs(app, 'Thibault');
    const me = userId(db, 'Thibault');

    const first = await agent.post('/api/draw');
    assert.equal(first.status, 201);
    assert.equal(first.body.hasDrawn, true);
    const ids = first.body.receivers.map((r) => r.id);
    assert.equal(ids.length, 2);
    assert.equal(new Set(ids).size, 2);
    assert.ok(!ids.includes(me));
    for (const r of first.body.receivers) {
      assert.equal(r.name, db.prepare('SELECT name FROM users WHERE id = ?').pluck().get(r.id));
    }

    const second = await agent.post('/api/draw');
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'ALREADY_DRAWN');
    assert.equal(db.prepare('SELECT COUNT(*) FROM draws').pluck().get(), 2);

    const again = await agent.get('/api/draw');
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, first.body);
  });

  it('C5 — les 6 participants tirent : chacun tiré 2 fois, exclusion respectée', async () => {
    for (let round = 0; round < 10; round++) {
      const { app, db } = await createTestApp();
      // Ordre de passage différent à chaque tour (Fisher-Yates déterministe).
      const rnd = seededRandomInt(round + 1);
      const order = [...NAMES];
      for (let i = order.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const name of order) {
        const res = await (await loginAs(app, name)).post('/api/draw');
        assert.equal(res.status, 201, `${name} (tour ${round})`);
      }
      const times = db
        .prepare(
          `SELECT u.id, COUNT(d.id) AS n FROM users u LEFT JOIN draws d ON d.receiver_id = u.id
           WHERE u.is_participant = 1 GROUP BY u.id`,
        )
        .all();
      assert.equal(times.length, 6);
      for (const { n } of times) assert.equal(n, 2);
      const given = db.prepare('SELECT giver_id, COUNT(*) AS n FROM draws GROUP BY giver_id').all();
      assert.equal(given.length, 6);
      for (const { n } of given) assert.equal(n, 2);
      const h = userId(db, 'Hugues');
      const c = userId(db, 'Coralie');
      const forbidden = db
        .prepare('SELECT COUNT(*) FROM draws WHERE (giver_id = ? AND receiver_id = ?) OR (giver_id = ? AND receiver_id = ?)')
        .pluck()
        .get(h, c, c, h);
      assert.equal(forbidden, 0);
    }
  });

  it('C6 — la lettre du receveur est incluse, sinon null', async () => {
    const { app } = await createTestApp();
    const agent = await loginAs(app, 'Thibault');
    const drawn = await agent.post('/api/draw');
    for (const r of drawn.body.receivers) assert.equal(r.letter, null);

    const [withLetter, withoutLetter] = drawn.body.receivers;
    const writer = await loginAs(app, withLetter.name);
    await writer.put('/api/letters/me').send({ content: 'Des chaussettes\nchaudes' });

    const res = await agent.get('/api/draw');
    const byId = new Map(res.body.receivers.map((r) => [r.id, r]));
    assert.equal(byId.get(withLetter.id).letter.content, 'Des chaussettes\nchaudes');
    assert.match(byId.get(withLetter.id).letter.updatedAt, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    assert.equal(byId.get(withoutLetter.id).letter, null);
  });

  it('C7 — admin sur /api/draw : 403', async () => {
    const { app } = await createTestApp();
    const admin = await loginAs(app, 'Admin');
    for (const res of [await admin.get('/api/draw'), await admin.post('/api/draw')]) {
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }
  });

  it('C8 — sans session : 401', async () => {
    const { app } = await createTestApp();
    assert.equal((await request(app).get('/api/draw')).status, 401);
    assert.equal((await request(app).post('/api/draw')).status, 401);
  });

  it('C9 — confidentialité : la réponse ne parle que des tirages de l’utilisateur', async () => {
    const { app, db } = await createTestApp();
    for (const name of ['Hugues', 'Océane', 'Bérénice']) await (await loginAs(app, name)).post('/api/draw');
    const agent = await loginAs(app, 'Thibault');
    for (const res of [await agent.post('/api/draw'), await agent.get('/api/draw')]) {
      assert.deepEqual(Object.keys(res.body).sort(), ['hasDrawn', 'receivers']);
      assert.equal(res.body.receivers.length, 2);
      for (const r of res.body.receivers) {
        assert.deepEqual(Object.keys(r).sort(), ['id', 'letter', 'name']);
      }
      const mine = db
        .prepare('SELECT receiver_id FROM draws WHERE giver_id = ? ORDER BY id')
        .pluck()
        .all(userId(db, 'Thibault'));
      assert.deepEqual(res.body.receivers.map((r) => r.id), mine);
    }
    // Un utilisateur n'ayant pas tiré ne voit rien des autres.
    const romane = await (await loginAs(app, 'Romane')).get('/api/draw');
    assert.deepEqual(romane.body, { hasDrawn: false, receivers: [] });
  });

  it('performDraw : ALREADY_DRAWN si déjà tiré, transaction annulée en cas d’échec', async () => {
    const { db } = await createTestApp();
    const settings = { drawsPerPerson: 2, maxTimesDrawn: 2 };
    const t = userId(db, 'Thibault');
    const receivers = performDraw(db, settings, t);
    assert.equal(receivers.length, 2);
    assert.throws(() => performDraw(db, settings, t), (err) => err.code === 'ALREADY_DRAWN' && err.status === 409);
    // État corrompu (base modifiée à la main) : seule Océane reste disponible pour Thibault.
    db.prepare('DELETE FROM draws').run();
    const ins = db.prepare('INSERT INTO draws (giver_id, receiver_id) VALUES (?, ?)');
    const id = (n) => userId(db, n);
    for (const r of ['Hugues', 'Romane', 'Bérénice', 'Coralie']) ins.run(id('Océane'), id(r));
    for (const r of ['Hugues', 'Bérénice', 'Coralie']) ins.run(id('Romane'), id(r));
    ins.run(id('Bérénice'), id('Romane'));
    const before = db.prepare('SELECT COUNT(*) FROM draws').pluck().get();
    assert.throws(() => performDraw(db, settings, t), (err) => err.code === 'DRAW_IMPOSSIBLE' && err.status === 500);
    assert.equal(db.prepare('SELECT COUNT(*) FROM draws').pluck().get(), before);
  });
});
