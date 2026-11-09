import fs from 'node:fs';
import { openDb } from './connection.js';
import { isMainModule } from './runAsScript.js';

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Crée le schéma. Idempotent. */
export function init(db) {
  db.exec(schema);
}

if (isMainModule(import.meta.url)) {
  const db = openDb();
  init(db);
  db.close();
  console.log('Schéma de la base initialisé.');
}
