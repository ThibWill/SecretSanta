// Algorithme de tirage au sort — fonctions pures, sans accès à la base.
// Voir specs/03-tirage-au-sort.md.
//
// CONFIDENTIALITÉ : ne jamais journaliser le résultat de pickReceivers.

/**
 * @typedef {Object} DrawState
 * @property {number[]} participantIds
 * @property {Array<[number, number]>} exclusions  Paires exclues (symétriques)
 * @property {Array<{giverId:number, receiverId:number}>} draws
 * @property {{drawsPerPerson:number, maxTimesDrawn:number}} settings
 */

export class AlreadyDrawnError extends Error {
  constructor() {
    super('Ce participant a déjà effectué son tirage.');
    this.name = 'AlreadyDrawnError';
    this.code = 'ALREADY_DRAWN';
  }
}

export class DrawImpossibleError extends Error {
  constructor() {
    super("Aucun tirage valide n'est possible dans l'état actuel.");
    this.name = 'DrawImpossibleError';
    this.code = 'DRAW_IMPOSSIBLE';
  }
}

/** Énumère les combinaisons de k éléments parmi `items` (ordre conservé). */
export function* combinations(items, k) {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of combinations(items.slice(i + 1), k - 1)) {
      yield [items[i], ...rest];
    }
  }
}

/** Construit le prédicat d'exclusion symétrique. */
export function makeIsExcluded(exclusions) {
  const keys = new Set();
  for (const [a, b] of exclusions) {
    keys.add(`${a}:${b}`);
    keys.add(`${b}:${a}`);
  }
  return (giver, receiver) => keys.has(`${giver}:${receiver}`);
}

/** Receveurs possibles pour `giver` : pas lui-même, pas exclu, capacité > 0. */
function allowed(giver, capacity, isExcluded) {
  const result = [];
  for (const [receiver, cap] of capacity) {
    if (receiver !== giver && cap > 0 && !isExcluded(giver, receiver)) result.push(receiver);
  }
  return result;
}

/** capacity[r] = M - nombre de fois où r a déjà été tiré. */
export function computeCapacity(state) {
  const capacity = new Map(state.participantIds.map((id) => [id, state.settings.maxTimesDrawn]));
  for (const { receiverId } of state.draws) {
    if (capacity.has(receiverId)) capacity.set(receiverId, capacity.get(receiverId) - 1);
  }
  return capacity;
}

/** Participants n'ayant encore aucun tirage en tant que donneur. */
export function computePending(state) {
  const givers = new Set(state.draws.map((d) => d.giverId));
  return state.participantIds.filter((id) => !givers.has(id));
}

/**
 * Indique s'il existe une affectation valide pour tous les donneurs restants.
 * `capacity` (Map id → capacité restante) n'est pas modifiée.
 */
export function canComplete(pendingGivers, capacity, isExcluded, K) {
  const cap = new Map(capacity);

  const search = (givers) => {
    if (givers.length === 0) return true;

    // Donneur le plus contraint d'abord.
    let best = null;
    let bestOptions = null;
    for (const g of givers) {
      const options = allowed(g, cap, isExcluded);
      if (bestOptions === null || options.length < bestOptions.length) {
        best = g;
        bestOptions = options;
      }
    }
    if (bestOptions.length < K) return false;

    const rest = givers.filter((g) => g !== best);
    for (const combo of combinations(bestOptions, K)) {
      for (const r of combo) cap.set(r, cap.get(r) - 1);
      const ok = search(rest);
      for (const r of combo) cap.set(r, cap.get(r) + 1);
      if (ok) return true;
    }
    return false;
  };

  return search([...pendingGivers]);
}

/** Mélange de Fisher-Yates en place, avec un générateur injecté. */
function shuffle(array, randomInt) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Choisit les K receveurs de `giverId`, en ne retenant qu'un choix
 * qui laisse une solution aux donneurs restants.
 * @param {DrawState} state
 * @param {number} giverId
 * @param {(n:number) => number} randomInt  entier uniforme dans [0, n[
 * @returns {number[]}
 */
export function pickReceivers(state, giverId, randomInt) {
  const K = state.settings.drawsPerPerson;
  if (!state.participantIds.includes(giverId)) {
    throw new Error(`L'utilisateur ${giverId} ne participe pas au tirage.`);
  }
  const capacity = computeCapacity(state);
  const pending = computePending(state);
  if (!pending.includes(giverId)) throw new AlreadyDrawnError();

  const isExcluded = makeIsExcluded(state.exclusions);
  const others = pending.filter((id) => id !== giverId);
  const candidates = shuffle([...combinations(allowed(giverId, capacity, isExcluded), K)], randomInt);

  for (const combo of candidates) {
    const next = new Map(capacity);
    for (const r of combo) next.set(r, next.get(r) - 1);
    if (canComplete(others, next, isExcluded, K)) {
      return shuffle([...combo], randomInt);
    }
  }
  throw new DrawImpossibleError();
}

/** Vrai si la configuration admet au moins un tirage complet. */
export function validateConfiguration(participantIds, exclusions, settings) {
  const { drawsPerPerson: K, maxTimesDrawn: M } = settings;
  const capacity = new Map(participantIds.map((id) => [id, M]));
  return canComplete(participantIds, capacity, makeIsExcluded(exclusions), K);
}
