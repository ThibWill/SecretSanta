import { Router } from 'express';
import { requireParticipant } from '../middleware/auth.js';
import { validationError } from '../middleware/errors.js';

export const MAX_LETTER_LENGTH = 5000;
const byName = (a, b) => a.name.localeCompare(b.name, 'fr');

export function lettersRouter({ db, requireAuth }) {
  const router = Router();
  const getMine = db.prepare('SELECT content, updated_at FROM letters WHERE user_id = ?');
  const upsert = db.prepare(`
    INSERT INTO letters (user_id, content, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `);
  const remove = db.prepare('DELETE FROM letters WHERE user_id = ?');

  const myLetter = (userId) => {
    const row = getMine.get(userId);
    return row ? { content: row.content, updatedAt: row.updated_at } : { content: '', updatedAt: null };
  };

  router.use(requireAuth);

  router.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, l.content, l.updated_at FROM users u
         LEFT JOIN letters l ON l.user_id = u.id
         WHERE u.is_participant = 1`,
      )
      .all()
      .sort(byName);
    res.json({
      letters: rows.map((r) => ({
        userId: r.id,
        name: r.name,
        content: r.content ?? null,
        updatedAt: r.updated_at ?? null,
      })),
    });
  });

  router.get('/me', requireParticipant, (req, res) => {
    res.json(myLetter(req.user.id));
  });

  router.put('/me', requireParticipant, (req, res) => {
    const content = req.body?.content;
    if (typeof content !== 'string') throw validationError('La lettre doit être un texte.');
    if (content.length > MAX_LETTER_LENGTH) {
      throw validationError(`La lettre ne doit pas dépasser ${MAX_LETTER_LENGTH} caractères.`);
    }
    if (content.trim() === '') remove.run(req.user.id);
    else upsert.run(req.user.id, content);
    res.json(myLetter(req.user.id));
  });

  return router;
}
