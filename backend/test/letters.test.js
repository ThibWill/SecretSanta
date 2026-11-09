import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestApp, loginAs, userId } from './helpers.js';

const lettersOf = (db, name) =>
  db.prepare('SELECT COUNT(*) FROM letters WHERE user_id = ?').pluck().get(userId(db, name));

describe('lettres', () => {
  it('D1 — GET /api/letters/me sans lettre', async () => {
    const { app } = await createTestApp();
    const res = await (await loginAs(app, 'Coralie')).get('/api/letters/me');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { content: '', updatedAt: null });
  });

  it('D2 — PUT puis GET', async () => {
    const { app } = await createTestApp();
    const agent = await loginAs(app, 'Coralie');
    const put = await agent.put('/api/letters/me').send({ content: 'Un pull' });
    assert.equal(put.status, 200);
    assert.equal(put.body.content, 'Un pull');
    assert.match(put.body.updatedAt, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    const get = await agent.get('/api/letters/me');
    assert.deepEqual(get.body, put.body);
  });

  it('D3 — modification : contenu remplacé, une seule ligne', async () => {
    const { app, db } = await createTestApp();
    const agent = await loginAs(app, 'Coralie');
    await agent.put('/api/letters/me').send({ content: 'Un pull' });
    const res = await agent.put('/api/letters/me').send({ content: 'Finalement, un livre' });
    assert.equal(res.body.content, 'Finalement, un livre');
    assert.equal(lettersOf(db, 'Coralie'), 1);
    assert.equal((await agent.get('/api/letters/me')).body.content, 'Finalement, un livre');
  });

  it('D4 — contenu vide ou espaces : lettre supprimée', async () => {
    const { app, db } = await createTestApp();
    const agent = await loginAs(app, 'Coralie');
    for (const empty of ['', '   \n\t ']) {
      await agent.put('/api/letters/me').send({ content: 'Un pull' });
      assert.equal(lettersOf(db, 'Coralie'), 1);
      const res = await agent.put('/api/letters/me').send({ content: empty });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { content: '', updatedAt: null });
      assert.equal(lettersOf(db, 'Coralie'), 0);
    }
  });

  it('D5 — plus de 5000 caractères ou type incorrect : 400', async () => {
    const { app, db } = await createTestApp();
    const agent = await loginAs(app, 'Coralie');
    const ok = await agent.put('/api/letters/me').send({ content: 'a'.repeat(5000) });
    assert.equal(ok.status, 200);
    for (const body of [{ content: 'a'.repeat(5001) }, { content: 42 }, { content: null }, {}, { content: ['x'] }]) {
      const res = await agent.put('/api/letters/me').send(body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(db.prepare('SELECT length(content) FROM letters').pluck().get(), 5000);
  });

  it('D6 — GET /api/letters : 6 entrées triées, null sans lettre, admin absent', async () => {
    const { app, db } = await createTestApp();
    await (await loginAs(app, 'Romane')).put('/api/letters/me').send({ content: 'Un vélo' });
    const res = await (await loginAs(app, 'Hugues')).get('/api/letters');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.letters.map((l) => l.name),
      ['Bérénice', 'Coralie', 'Hugues', 'Océane', 'Romane', 'Thibault'],
    );
    for (const l of res.body.letters) {
      assert.deepEqual(Object.keys(l).sort(), ['content', 'name', 'updatedAt', 'userId']);
      assert.equal(l.userId, userId(db, l.name));
      if (l.name === 'Romane') {
        assert.equal(l.content, 'Un vélo');
        assert.ok(l.updatedAt);
      } else {
        assert.equal(l.content, null);
        assert.equal(l.updatedAt, null);
      }
    }
  });

  it('D7 — HTML et sauts de ligne stockés tels quels', async () => {
    const { app } = await createTestApp();
    const content = '<script>alert("x")</script>\n<b>gras</b>\r\n  Ligne 3 🎄 & "guillemets"';
    const agent = await loginAs(app, 'Bérénice');
    assert.equal((await agent.put('/api/letters/me').send({ content })).body.content, content);
    const all = await agent.get('/api/letters');
    assert.equal(all.body.letters.find((l) => l.name === 'Bérénice').content, content);
  });

  it('D8 — admin : 403 sur /me, 200 sur la liste', async () => {
    const { app } = await createTestApp();
    const admin = await loginAs(app, 'Admin');
    assert.equal((await admin.put('/api/letters/me').send({ content: 'x' })).status, 403);
    assert.equal((await admin.get('/api/letters/me')).status, 403);
    const list = await admin.get('/api/letters');
    assert.equal(list.status, 200);
    assert.equal(list.body.letters.length, 6);
  });

  it('sans session : 401', async () => {
    const { app } = await createTestApp();
    assert.equal((await request(app).get('/api/letters')).status, 401);
    assert.equal((await request(app).get('/api/letters/me')).status, 401);
    assert.equal((await request(app).put('/api/letters/me').send({ content: 'x' })).status, 401);
  });
});
