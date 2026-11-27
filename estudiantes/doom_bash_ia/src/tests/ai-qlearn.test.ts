import { describe, expect, it } from 'vitest';
import {
  createQBotFactory,
  deserializeQTable,
  QTable,
  serializeQTable,
  trainQLearning,
  DEFAULT_Q_HYPER
} from '../ai/qlearn/agent';
import { encodeState, MACRO_COUNT, MACROS, MacroController, STATE_COUNT } from '../ai/qlearn/macro';
import { scriptedBotFactory } from '../ai/sim/bots';
import { runEpisode } from '../ai/sim/runEpisode';
import { createSimWorld, observeSimWorld, stepSimWorld } from '../ai/sim/SimWorld';
import type { SimObservation } from '../ai/types';

/** Observaciones reales: se juega un rato con el bot guionado y se guarda lo que ve en cada paso. */
function sampleObservations(levelId: string, seed: number, ticks: number): SimObservation[] {
  const world = createSimWorld({ levelId, seed });
  const bot = scriptedBotFactory(seed);
  const out: SimObservation[] = [];
  for (let i = 0; i < ticks; i += 1) {
    const observation = observeSimWorld(world);
    if (i % 25 === 0) out.push(observation);
    if (stepSimWorld(world, bot.decide(observation)) !== null) break;
  }
  return out;
}

describe('M4: discretización y macros', () => {
  it('el índice de estado siempre cae dentro de la tabla', () => {
    const observations = [...sampleObservations('access-node', 3, 1500), ...sampleObservations('volt-archon-pit', 4, 1500)];
    expect(observations.length).toBeGreaterThan(40);
    for (const observation of observations) {
      const state = encodeState(observation);
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(0);
      expect(state).toBeLessThan(STATE_COUNT);
    }
  });

  it('estados distintos para situaciones distintas (no colapsa a unos pocos)', () => {
    const observations = [...sampleObservations('access-node', 5, 2500), ...sampleObservations('volt-archon-pit', 6, 2500)];
    const distinct = new Set(observations.map(encodeState));
    expect(distinct.size).toBeGreaterThan(8);
  });

  it('cada macro produce una acción válida en cada observación', () => {
    const observations = sampleObservations('volt-archon-pit', 7, 2000);
    for (const macro of MACROS) {
      const controller = new MacroController();
      for (const observation of observations) {
        const action = controller.act(macro, observation);
        for (const value of [action.forward, action.strafe, action.turn]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(Math.abs(value)).toBeLessThanOrEqual(1);
        }
        expect(typeof action.fire).toBe('boolean');
        expect(typeof action.reload).toBe('boolean');
      }
    }
  });

  it('"retroceder" con objetivo a la vista va hacia atrás', () => {
    const world = createSimWorld({ levelId: 'volt-archon-pit', seed: 9 });
    const observation = observeSimWorld(world);
    // En la arena del jefe se ve al jefe desde el inicio; si no hubiera línea de visión la prueba no aplica.
    if (observation.boss?.hasLineOfSight) {
      expect(new MacroController().act('retroceder', observation).forward).toBe(-1);
    }
  });
});

describe('M4: tabla Q y entrenamiento', () => {
  it('el voraz elige el mayor valor y en empate el de menor índice', () => {
    const table = new QTable();
    expect(table.greedy(0)).toBe(0);
    table.values[1 * MACRO_COUNT + 3] = 2;
    table.values[1 * MACRO_COUNT + 4] = 2;
    expect(table.greedy(1)).toBe(3);
    expect(table.maxValue(1)).toBe(2);
  });

  it('el entrenamiento es determinista: mismas semillas, misma tabla', () => {
    const a = trainQLearning({ levelId: 'access-node', episodes: 4 });
    const b = trainQLearning({ levelId: 'access-node', episodes: 4 });
    expect(Array.from(a.table.values)).toEqual(Array.from(b.table.values));
    expect(Array.from(a.table.visits)).toEqual(Array.from(b.table.visits));
    expect(a.table.visitedStates()).toBeGreaterThan(0);
  });

  it('el bot entrenado juega igual dos veces con la misma semilla (misma huella)', () => {
    const { table } = trainQLearning({ levelId: 'access-node', episodes: 4 });
    const first = runEpisode({ levelId: 'access-node', seed: 777, bot: createQBotFactory(table) });
    const second = runEpisode({ levelId: 'access-node', seed: 777, bot: createQBotFactory(table) });
    expect(first.digest).toBe(second.digest);
    expect(first.outcome).toBe(second.outcome);
  });

  it('entrenar mejora sobre la tabla en ceros, en semillas distintas a las de entrenamiento', () => {
    const { table } = trainQLearning({ levelId: 'access-node', episodes: 120 });
    const seeds = [7001, 7002, 7003, 7004, 7005, 7006];
    const cleared = (t: QTable): number =>
      seeds.filter((seed) => runEpisode({ levelId: 'access-node', seed, bot: createQBotFactory(t) }).outcome === 'cleared').length;
    expect(cleared(table)).toBeGreaterThan(cleared(new QTable()));
  });

  it('serializa y recupera la tabla; rechaza una incompatible', () => {
    const { table, hyper } = trainQLearning({ levelId: 'access-node', episodes: 3 });
    const file = serializeQTable(table, { trainedOn: { levelId: 'access-node', difficulty: 'standard', episodes: 3, seedStart: 1 }, hyper });
    const restored = deserializeQTable(JSON.parse(JSON.stringify(file)));
    for (let i = 0; i < table.values.length; i += 1) expect(restored.values[i]).toBeCloseTo(table.values[i], 3);
    expect(Array.from(restored.visits)).toEqual(Array.from(table.visits));
    expect(() => deserializeQTable({ ...file, stateCount: STATE_COUNT + 1 })).toThrow();
    expect(file.hyper).toEqual(DEFAULT_Q_HYPER);
  });
});
