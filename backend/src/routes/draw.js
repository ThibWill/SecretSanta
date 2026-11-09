// CONFIDENTIALITÉ : ces routes ne renvoient que les tirages de req.user,
// et ne journalisent jamais les receveurs.
import { Router } from 'express';
import { requireParticipant } from '../middleware/auth.js';
import { getReceivers, performDraw } from '../services/drawService.js';

export function drawRouter({ db, settings, requireAuth }) {
  const router = Router();
  const letterOf = db.prepare('SELECT content, updated_at FROM letters WHERE user_id = ?');

  const toResponse = (receivers) => ({
    hasDrawn: receivers.length > 0,
    receivers: receivers.map(({ id, name }) => {
      const letter = letterOf.get(id);
      return {
        id,
        name,
        letter: letter ? { content: letter.content, updatedAt: letter.updated_at } : null,
      };
    }),
  });

  router.use(requireAuth, requireParticipant);

  router.get('/', (req, res) => {
    res.json(toResponse(getReceivers(db, req.user.id)));
  });

  router.post('/', (req, res) => {
    const receivers = performDraw(db, settings, req.user.id);
    console.log(`Tirage effectué par l'utilisateur ${req.user.id}`);
    res.status(201).json(toResponse(receivers));
  });

  return router;
}
