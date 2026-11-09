// Transaction BDD autour de l'algorithme de tirage. Voir specs/03-tirage-au-sort.md §5.
// CONFIDENTIALITÉ : ne jamais journaliser les receveurs.
import crypto from 'node:crypto';
import { AlreadyDrawnError, DrawImpossibleError, pickReceivers } from './drawAlgorithm.js';
import { alreadyDrawn, drawImpossible } from '../middleware/errors.js';

/** Receveurs de `userId` (id + nom), dans l'ordre d'insertion. */
export function getReceivers(db, userId) {
  return db
    .prepare(
      `SELECT u.id, u.name FROM draws d
       JOIN users u ON u.id = d.receiver_id
       WHERE d.giver_id = ?
       ORDER BY d.id`,
    )
    .all(userId);
}

/**
 * Effectue le tirage de `userId` dans une transaction IMMEDIATE.
 * @returns {{id:number, name:string}[]}
 */
export function performDraw(db, settings, userId, randomInt = crypto.randomInt) {
  const run = db.transaction(() => {
    const participantIds = db.prepare('SELECT id FROM users WHERE is_participant = 1').pluck().all();
    const exclusions = db.prepare('SELECT user_a_id, user_b_id FROM exclusions').raw().all();
    const draws = db.prepare('SELECT giver_id AS giverId, receiver_id AS receiverId FROM draws').all();

    if (draws.some((d) => d.giverId === userId)) throw alreadyDrawn();

    let receiverIds;
    try {
      receiverIds = pickReceivers({ participantIds, exclusions, draws, settings }, userId, randomInt);
    } catch (err) {
      if (err instanceof AlreadyDrawnError) throw alreadyDrawn();
      if (err instanceof DrawImpossibleError) throw drawImpossible();
      throw err;
    }

    const insert = db.prepare('INSERT INTO draws (giver_id, receiver_id) VALUES (?, ?)');
    for (const r of receiverIds) insert.run(userId, r);
    return getReceivers(db, userId);
  });
  return run.immediate();
}
