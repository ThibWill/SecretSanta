import { Router } from 'express';

const byName = (a, b) => a.name.localeCompare(b.name, 'fr');

export function usersRouter({ db }) {
  const router = Router();
  router.get('/names', (req, res) => {
    const rows = db.prepare('SELECT name, is_participant FROM users').all();
    const participants = rows.filter((r) => r.is_participant === 1).sort(byName);
    const others = rows.filter((r) => r.is_participant !== 1).sort(byName);
    res.json({ users: [...participants, ...others].map((r) => ({ name: r.name })) });
  });
  return router;
}
