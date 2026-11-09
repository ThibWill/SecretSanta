import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  AlreadyDrawnError,
  DrawImpossibleError,
  canComplete,
  computeCapacity,
  computePending,
  makeIsExcluded,
  pickReceivers,
  validateConfiguration,
} from '../src/services/drawAlgorithm.js';
import { seededRandomInt } from './helpers.js';

// Configuration réelle : ids 1..6 = Thibault, Hugues, Océane, Romane, Bérénice, Coralie.
const HUGUES = 2;
const CORALIE = 6;
const REAL = {
  participantIds: [1, 2, 3, 4, 5, 6],
  exclusions: [[HUGUES, CORALIE]],
  settings: { drawsPerPerson: 2, maxTimesDrawn: 2 },
};

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

function shuffled(array, randomInt) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function* permutations(items) {
  if (items.length <= 1) {
    yield [...items];
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) yield [items[i], ...p];
  }
}

/**
 * Tirage complet dans l'ordre `order`. Vérifie l'invariant intermédiaire (A3)
 * après chaque tirage. Renvoie la liste des tirages.
 */
function simulate(config, order, randomInt) {
  const state = { ...config, draws: [] };
  const isExcluded = makeIsExcluded(config.exclusions);
  for (const giverId of order) {
    const receivers = pickReceivers(state, giverId, randomInt);
    for (const receiverId of receivers) state.draws.push({ giverId, receiverId });
    assert.ok(
      canComplete(computePending(state), computeCapacity(state), isExcluded, config.settings.drawsPerPerson),
      'canComplete doit rester vrai après chaque tirage',
    );
  }
  return state.draws;
}

/** Vérifie les propriétés 1 à 4 de specs/03 §7. */
function assertFinalProperties(config, draws) {
  const { drawsPerPerson: K, maxTimesDrawn: M } = config.settings;
  const isExcluded = makeIsExcluded(config.exclusions);
  for (const id of config.participantIds) {
    const given = draws.filter((d) => d.giverId === id).map((d) => d.receiverId);
    assert.equal(given.length, K, `${id} doit tirer exactement ${K} personnes`);
    assert.equal(new Set(given).size, K, `${id} doit tirer des personnes distinctes`);
    assert.ok(!given.includes(id), `${id} ne doit pas se tirer lui-même`);
    const received = draws.filter((d) => d.receiverId === id).length;
    assert.equal(received, M, `${id} doit être tiré exactement ${M} fois`);
  }
  for (const { giverId, receiverId } of draws) {
    assert.ok(!isExcluded(giverId, receiverId), `exclusion violée : ${giverId} → ${receiverId}`);
  }
}

// Simulations partagées par A2, A3, A5, A6, A12.
const SIMULATIONS = 1000;
const allSimulations = [];

describe('drawAlgorithm', () => {
  it('A1 — la configuration réelle est réalisable', () => {
    assert.equal(validateConfiguration(REAL.participantIds, REAL.exclusions, REAL.settings), true);
  });

  it('A2/A3 — 1000 tirages complets avec ordre aléatoire (invariant vérifié à chaque étape)', () => {
    for (let i = 0; i < SIMULATIONS; i++) {
      const order = shuffled(REAL.participantIds, crypto.randomInt);
      // Une DrawImpossibleError ferait échouer le test (propriété 5).
      const draws = simulate(REAL, order, crypto.randomInt);
      assertFinalProperties(REAL, draws);
      allSimulations.push(draws);
    }
    assert.equal(allSimulations.length, SIMULATIONS);
  });

  it('A4 — les 720 ordres de passage aboutissent', () => {
    let count = 0;
    for (const order of permutations(REAL.participantIds)) {
      assertFinalProperties(REAL, simulate(REAL, order, crypto.randomInt));
      count++;
    }
    assert.equal(count, 720);
  });

  it('A5 — exclusion respectée dans les deux sens sur toutes les simulations', () => {
    assert.ok(allSimulations.length > 0);
    for (const draws of allSimulations) {
      for (const { giverId, receiverId } of draws) {
        assert.ok(!(giverId === HUGUES && receiverId === CORALIE), 'Hugues a tiré Coralie');
        assert.ok(!(giverId === CORALIE && receiverId === HUGUES), 'Coralie a tiré Hugues');
      }
    }
  });

  it('A6 — pas d’auto-tirage, receveurs distincts', () => {
    assert.ok(allSimulations.length > 0);
    for (const draws of allSimulations) {
      for (const id of REAL.participantIds) {
        const given = draws.filter((d) => d.giverId === id).map((d) => d.receiverId);
        assert.ok(!given.includes(id));
        assert.equal(new Set(given).size, given.length);
      }
    }
  });

  it('A7 — évite l’impasse qu’un choix naïf provoquerait', () => {
    // 3 participants, K = M = 1, 1 → 2 déjà tiré. Le donneur 2 peut choisir 1 ou 3.
    // S'il choisit 1, le donneur 3 ne peut plus tirer que lui-même : impasse.
    const state = {
      participantIds: [1, 2, 3],
      exclusions: [],
      settings: { drawsPerPerson: 1, maxTimesDrawn: 1 },
      draws: [{ giverId: 1, receiverId: 2 }],
    };
    const isExcluded = makeIsExcluded([]);
    const capacity = computeCapacity(state);
    // Le choix naïf « 1 » bloque bien la suite…
    const afterNaive = new Map(capacity).set(1, 0);
    assert.equal(canComplete([3], afterNaive, isExcluded, 1), false);
    // … et pickReceivers ne le choisit jamais.
    for (let seedValue = 0; seedValue < 200; seedValue++) {
      assert.deepEqual(pickReceivers(state, 2, seededRandomInt(seedValue)), [3]);
    }
  });

  it('A8 — un donneur ayant déjà tiré lève AlreadyDrawnError', () => {
    const state = {
      ...REAL,
      draws: [
        { giverId: 1, receiverId: 2 },
        { giverId: 1, receiverId: 3 },
      ],
    };
    assert.throws(() => pickReceivers(state, 1, crypto.randomInt), AlreadyDrawnError);
  });

  it('A9 — configuration impossible détectée', () => {
    assert.equal(validateConfiguration([1, 2, 3], [[1, 2]], { drawsPerPerson: 2, maxTimesDrawn: 2 }), false);
  });

  it('A10 — état corrompu : DrawImpossibleError', () => {
    // 3 participants, K = M = 1 ; 1 et 2 se sont tirés mutuellement : 3 n'a plus personne.
    const state = {
      participantIds: [1, 2, 3],
      exclusions: [],
      settings: { drawsPerPerson: 1, maxTimesDrawn: 1 },
      draws: [
        { giverId: 1, receiverId: 2 },
        { giverId: 2, receiverId: 1 },
      ],
    };
    assert.throws(() => pickReceivers(state, 3, crypto.randomInt), DrawImpossibleError);
  });

  it('A11 — paramètres génériques (K = M = 1 / 4 participants, K = M = 3 / 8 participants)', () => {
    const configs = [
      { participantIds: range(4), exclusions: [[1, 2]], settings: { drawsPerPerson: 1, maxTimesDrawn: 1 } },
      { participantIds: range(8), exclusions: [[1, 2], [3, 4]], settings: { drawsPerPerson: 3, maxTimesDrawn: 3 } },
    ];
    for (const config of configs) {
      assert.ok(validateConfiguration(config.participantIds, config.exclusions, config.settings));
      for (let i = 0; i < 200; i++) {
        const order = shuffled(config.participantIds, crypto.randomInt);
        assertFinalProperties(config, simulate(config, order, crypto.randomInt));
      }
    }
  });

  it('A12 — chaque paire autorisée apparaît au moins une fois sur 1000 simulations', () => {
    assert.equal(allSimulations.length, SIMULATIONS);
    const isExcluded = makeIsExcluded(REAL.exclusions);
    const seen = new Set(allSimulations.flat().map((d) => `${d.giverId}:${d.receiverId}`));
    for (const g of REAL.participantIds) {
      for (const r of REAL.participantIds) {
        if (g === r || isExcluded(g, r)) continue;
        assert.ok(seen.has(`${g}:${r}`), `la paire ${g} → ${r} n'est jamais apparue`);
      }
    }
  });

  it('A13 — générateur injecté : résultat reproductible', () => {
    const run = () => {
      const randomInt = seededRandomInt(42);
      return simulate(REAL, shuffled(REAL.participantIds, randomInt), randomInt);
    };
    assert.deepEqual(run(), run());
  });
});
