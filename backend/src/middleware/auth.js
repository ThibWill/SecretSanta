import jwt from 'jsonwebtoken';
import { forbidden, unauthenticated } from './errors.js';

export const COOKIE_NAME = 'token';
export const SESSION_DAYS = 60;

/** Forme publique d'un utilisateur (ligne `users`). */
export const toPublicUser = (row) => ({
  id: row.id,
  name: row.name,
  isAdmin: row.is_admin === 1,
  isParticipant: row.is_participant === 1,
});

/** Lit le cookie, vérifie le JWT et recharge l'utilisateur en base. */
export function makeRequireAuth(db, jwtSecret) {
  const findUser = db.prepare('SELECT id, name, is_admin, is_participant FROM users WHERE id = ?');
  return function requireAuth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next(unauthenticated());
    let payload;
    try {
      payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return next(unauthenticated());
    }
    const row = Number.isInteger(payload?.sub) ? findUser.get(payload.sub) : undefined;
    if (!row) return next(unauthenticated());
    req.user = toPublicUser(row);
    next();
  };
}

export function requireParticipant(req, res, next) {
  next(req.user?.isParticipant ? undefined : forbidden());
}

export function requireAdmin(req, res, next) {
  next(req.user?.isAdmin ? undefined : forbidden());
}
