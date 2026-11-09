import { pathToFileURL } from 'node:url';

/** Vrai si le module `importMetaUrl` est le point d'entrée lancé par `node`. */
export function isMainModule(importMetaUrl) {
  return Boolean(process.argv[1]) && importMetaUrl === pathToFileURL(process.argv[1]).href;
}
