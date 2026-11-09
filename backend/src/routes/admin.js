// CONFIDENTIALITÉ : uniquement des booléens, jamais de receveur ni de compteur par personne.
import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { validationError } from '../middleware/errors.js';
import { reset } from '../db/reset.js';

const byName = (a, b) => a.name.localeCompare(b.name, 'fr');

export function adminRouter({ db, requireAuth }) {
  const router = Router();

  const status = () => {
    const participants = db
      .prepare(
        `SELECT u.name,
           EXISTS (SELECT 1 FROM draws d WHERE d.giver_id = u.id) AS has_drawn,
           EXISTS (SELECT 1 FROM letters l WHERE l.user_id = u.id) AS has_letter
         FROM users u WHERE u.is_participant = 1`,
      )
      .all()
      .sort(byName)
      .map((r) => ({ name: r.name, hasDrawn: r.has_drawn === 1, hasLetter: r.has_letter === 1 }));
    return {
      participants,
      drawnCount: participants.filter((p) => p.hasDrawn).length,
      total: participants.length,
    };
  };

  router.use(requireAuth, requireAdmin);

  router.get('/status', (req, res) => {
    res.json(status());
  });

  router.post('/reset', (req, res) => {
    const resetLetters = req.body?.resetLetters ?? false;
    if (typeof resetLetters !== 'boolean') throw validationError('« resetLetters » doit être un booléen.');
    reset(db, { letters: resetLetters });
    console.log(resetLetters ? 'Tirage et lettres réinitialisés par l’admin.' : 'Tirage réinitialisé par l’admin.');
    res.json(status());
  });

  return router;
}
