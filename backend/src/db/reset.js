import { openDb } from './connection.js';
import { init } from './init.js';
import { isMainModule } from './runAsScript.js';

/** Supprime tous les tirages, et les lettres si `letters` est vrai. */
export function reset(db, { letters = false } = {}) {
  return db.transaction(() => {
    const draws = db.prepare('DELETE FROM draws').run().changes;
    const deletedLetters = letters ? db.prepare('DELETE FROM letters').run().changes : 0;
    return { draws, letters: deletedLetters };
  })();
}

if (isMainModule(import.meta.url)) {
  const withLetters = process.argv.includes('--letters');
  const db = openDb();
  init(db);
  reset(db, { letters: withLetters });
  db.close();
  console.log(withLetters ? 'Tirages et lettres supprimés.' : 'Tirages supprimés (lettres conservées).');
}
