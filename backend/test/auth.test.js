import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestApp, loginAs } from './helpers.js';

describe('authentification', () => {
  it('B1 — login correct : 200 et cookie HttpOnly', async () => {
    const { app } = await createTestApp();
    const res = await request(app).post('/api/auth/login').send({ name: 'Océane', password: 'test-3' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user, { id: res.body.user.id, name: 'Océane', isAdmin: false, isParticipant: true });
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    assert.ok(cookie, 'cookie token posé');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
  });

  it('B2 — login insensible à la casse et aux accents', async () => {
    const { app } = await createTestApp();
    for (const name of ['oceane', 'Océane', 'OCEANE', '  océane ']) {
      const res = await request(app).post('/api/auth/login').send({ name, password: 'test-3' });
      assert.equal(res.status, 200, name);
      assert.equal(res.body.user.name, 'Océane');
    }
  });

  it('B3 — mauvais mot de passe / utilisateur inconnu : même 401', async () => {
    const { app } = await createTestApp();
    const bad = await request(app).post('/api/auth/login').send({ name: 'Océane', password: 'faux' });
    const unknown = await request(app).post('/api/auth/login').send({ name: 'Gaston', password: 'test-3' });
    for (const res of [bad, unknown]) {
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
      assert.equal(res.headers['set-cookie'], undefined);
    }
    assert.equal(bad.body.error.message, unknown.body.error.message);
    assert.equal(bad.body.error.message, 'Identifiant ou mot de passe incorrect.');
  });

  it('B4 — corps invalide : 400 VALIDATION_ERROR', async () => {
    const { app } = await createTestApp();
    const bodies = [{}, { name: 'Océane' }, { password: 'x' }, { name: 3, password: 'x' }, { name: 'Océane', password: 12 }];
    for (const body of bodies) {
      const res = await request(app).post('/api/auth/login').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{pas du json');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'VALIDATION_ERROR');
  });

  it('B5 — /api/auth/me sans cookie ou avec cookie invalide : 401', async () => {
    const { app } = await createTestApp();
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    const forged = await request(app).get('/api/auth/me').set('Cookie', 'token=abc.def.ghi');
    assert.equal(forged.status, 401);
  });

  it('B6 — logout : 204 puis me → 401', async () => {
    const { app } = await createTestApp();
    const agent = await loginAs(app, 'Romane');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.name, 'Romane');
    const out = await agent.post('/api/auth/logout');
    assert.equal(out.status, 204);
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });

  it('B7 — /api/users/names : 7 noms, participants triés puis admin, sans champ sensible', async () => {
    const { app } = await createTestApp();
    const res = await request(app).get('/api/users/names');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.users.map((u) => u.name),
      ['Bérénice', 'Coralie', 'Hugues', 'Océane', 'Romane', 'Thibault', 'Admin'],
    );
    for (const u of res.body.users) assert.deepEqual(Object.keys(u), ['name']);
  });

  it('santé et route API inconnue', async () => {
    const { app } = await createTestApp();
    assert.deepEqual((await request(app).get('/api/health')).body, { status: 'ok' });
    const res = await request(app).get('/api/nexiste-pas');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
