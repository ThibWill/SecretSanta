import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { normalizeLogin } from '../db/seed.js';
import { COOKIE_NAME, SESSION_DAYS, toPublicUser } from '../middleware/auth.js';
import { invalidCredentials, validationError } from '../middleware/errors.js';

// Hash factice : le temps de réponse ne révèle pas si l'identifiant existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 4);

export function authRouter({ db, requireAuth, appConfig }) {
  const router = Router();
  const findByLogin = db.prepare('SELECT * FROM users WHERE login = ?');
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: appConfig.cookieSecure,
    path: '/',
  };

  router.post('/login', (req, res) => {
    const { name, password } = req.body ?? {};
    if (typeof name !== 'string' || typeof password !== 'string' || !name.trim() || !password) {
      throw validationError('Identifiant et mot de passe obligatoires.');
    }
    const row = findByLogin.get(normalizeLogin(name));
    const ok = bcrypt.compareSync(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) throw invalidCredentials();

    const token = jwt.sign({ sub: row.id }, appConfig.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: `${SESSION_DAYS}d`,
    });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 3600 * 1000 });
    res.json({ user: toPublicUser(row) });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
