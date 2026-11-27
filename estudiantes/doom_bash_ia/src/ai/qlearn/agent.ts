/**
 * M4: Q-learning tabular jerárquico (ver `macro.ts`). Entrena sobre el simulador (M0) y entrega un bot
 * que se puede medir contra los bots de referencia con las mismas semillas.
 *
 * Todo es determinista: la misma lista de semillas y los mismos hiperparámetros dan la misma tabla,
 * así que `resultados/qlearn-tabla.json` se regenera idéntico con `npm run bench:qlearn`.
 */
import type { RaycastDifficultyId, SimBot, SimBotFactory, SimObservation, PlayerAction } from '../types';
import { createSeededRng, type Rng } from '../sim/rng';
import { createSimWorld, observeSimWorld, SIM_DEFAULT_DT_MS, stepSimWorld } from '../sim/SimWorld';
import { runEpisode } from '../sim/runEpisode';
import { summarize } from '../sim/stats';
import { encodeState, MACRO_COUNT, MACRO_TICKS, MACROS, MacroController, STATE_COUNT, type Macro } from './macro';

export interface QHyperParams {
  alpha: number;
  gamma: number;
  epsilonStart: number;
  epsilonEnd: number;
  /** Recompensas. */
  killReward: number;
  bossDamageReward: number;
  damagePenaltyPerHp: number;
  stepPenalty: number;
  clearReward: number;
  deathPenalty: number;
}

export const DEFAULT_Q_HYPER: QHyperParams = {
  alpha: 0.1,
  gamma: 0.98,
  epsilonStart: 0.5,
  epsilonEnd: 0.05,
  killReward: 20,
  bossDamageReward: 40,
  damagePenaltyPerHp: 0.25,
  stepPenalty: 0.05,
  clearReward: 60,
  deathPenalty: 40
};

export class QTable {
  readonly values = new Float64Array(STATE_COUNT * MACRO_COUNT);
  readonly visits = new Uint32Array(STATE_COUNT * MACRO_COUNT);

  value(state: number, macroIndex: number): number {
    return this.values[state * MACRO_COUNT + macroIndex];
  }

  maxValue(state: number): number {
    let best = this.values[state * MACRO_COUNT];
    for (let a = 1; a < MACRO_COUNT; a += 1) best = Math.max(best, this.values[state * MACRO_COUNT + a]);
    return best;
  }

  /** Acción con mayor valor; en un empate gana la de menor índice (determinista). */
  greedy(state: number): number {
    let best = 0;
    let bestValue = this.values[state * MACRO_COUNT];
    for (let a = 1; a < MACRO_COUNT; a += 1) {
      const v = this.values[state * MACRO_COUNT + a];
      if (v > bestValue) {
        best = a;
        bestValue = v;
      }
    }
    return best;
  }

  /** Cuántos estados tienen al menos una acción probada. */
  visitedStates(): number {
    let count = 0;
    for (let s = 0; s < STATE_COUNT; s += 1) {
      for (let a = 0; a < MACRO_COUNT; a += 1) {
        if (this.visits[s * MACRO_COUNT + a] > 0) {
          count += 1;
          break;
        }
      }
    }
    return count;
  }
}

export interface QTableFile {
  version: 1;
  macros: readonly string[];
  stateCount: number;
  trainedOn: { levelId: string; difficulty: RaycastDifficultyId; episodes: number; seedStart: number };
  hyper: QHyperParams;
  /** Valores Q aplanados (estado * acciones + acción), redondeados a 4 decimales. */
  values: number[];
  visits: number[];
}

export function serializeQTable(table: QTable, meta: Pick<QTableFile, 'trainedOn' | 'hyper'>): QTableFile {
  return {
    version: 1,
    macros: MACROS,
    stateCount: STATE_COUNT,
    trainedOn: meta.trainedOn,
    hyper: meta.hyper,
    values: Array.from(table.values, (v) => Math.round(v * 1e4) / 1e4),
    visits: Array.from(table.visits)
  };
}

export function deserializeQTable(file: QTableFile): QTable {
  if (file.version !== 1 || file.stateCount !== STATE_COUNT || file.values.length !== STATE_COUNT * MACRO_COUNT) {
    throw new Error('Tabla Q incompatible con esta versión del discretizador');
  }
  const table = new QTable();
  table.values.set(file.values);
  table.visits.set(file.visits);
  return table;
}

/** Bot que juega con la política voraz de una tabla ya entrenada, sin explorar ni aprender. */
export function createQBotFactory(table: QTable, name = 'q-learning'): SimBotFactory {
  return (): SimBot => {
    const controller = new MacroController();
    let macro: Macro = 'sostener';
    let nextDecisionAtMs = 0;
    return {
      name,
      decide(observation: SimObservation): PlayerAction {
        if (observation.timeMs >= nextDecisionAtMs) {
          macro = MACROS[table.greedy(encodeState(observation))];
          nextDecisionAtMs = observation.timeMs + MACRO_TICKS * SIM_DEFAULT_DT_MS;
        }
        return controller.act(macro, observation);
      }
    };
  };
}

export interface TrainOptions {
  levelId: string;
  difficulty?: RaycastDifficultyId;
  episodes: number;
  /** Las semillas de entrenamiento son seedStart, seedStart + 1, ... */
  seedStart?: number;
  hyper?: Partial<QHyperParams>;
  maxMs?: number;
  /** Cada cuántos episodios se mide la política voraz en `validationSeeds`; 0 = nunca. */
  evaluateEvery?: number;
  validationSeeds?: readonly number[];
  onProgress?: (point: TrainingPoint) => void;
}

export interface TrainingPoint {
  episode: number;
  epsilon: number;
  /** Media del retorno de los episodios desde el punto anterior (con exploración). */
  meanReturn: number;
  /** Política voraz en las semillas de validación (no vistas en el entrenamiento). */
  validationClearRate: number | null;
  validationDamage: number | null;
  validationDurationS: number | null;
  visitedStates: number;
}

export function trainQLearning(options: TrainOptions): { table: QTable; curve: TrainingPoint[]; hyper: QHyperParams } {
  const hyper: QHyperParams = { ...DEFAULT_Q_HYPER, ...options.hyper };
  const difficulty = options.difficulty ?? 'standard';
  const seedStart = options.seedStart ?? 1;
  const maxMs = options.maxMs ?? 90_000;
  const table = new QTable();
  const curve: TrainingPoint[] = [];
  const evaluateEvery = options.evaluateEvery ?? 0;
  let returnSum = 0;
  let returnCount = 0;

  for (let episode = 0; episode < options.episodes; episode += 1) {
    const epsilon =
      options.episodes <= 1
        ? hyper.epsilonEnd
        : hyper.epsilonStart + ((hyper.epsilonEnd - hyper.epsilonStart) * episode) / (options.episodes - 1);
    const seed = seedStart + episode;
    returnSum += runTrainingEpisode(table, options.levelId, difficulty, seed, epsilon, hyper, maxMs);
    returnCount += 1;

    const done = episode + 1;
    if (evaluateEvery > 0 && (done % evaluateEvery === 0 || done === options.episodes)) {
      const point: TrainingPoint = {
        episode: done,
        epsilon,
        meanReturn: returnSum / returnCount,
        validationClearRate: null,
        validationDamage: null,
        validationDurationS: null,
        visitedStates: table.visitedStates()
      };
      if (options.validationSeeds && options.validationSeeds.length > 0) {
        const bot = createQBotFactory(table);
        const results = options.validationSeeds.map((s) =>
          runEpisode({ levelId: options.levelId, seed: s, bot, difficultyId: difficulty, maxMs })
        );
        point.validationClearRate = results.filter((r) => r.outcome === 'cleared').length / results.length;
        point.validationDamage = summarize(results.map((r) => r.damageTaken)).mean;
        point.validationDurationS = summarize(results.map((r) => r.durationMs / 1000)).mean;
      }
      curve.push(point);
      options.onProgress?.(point);
      returnSum = 0;
      returnCount = 0;
    }
  }
  return { table, curve, hyper };
}

function chooseMacro(table: QTable, state: number, epsilon: number, rng: Rng): number {
  if (rng() < epsilon) return Math.floor(rng() * MACRO_COUNT);
  return table.greedy(state);
}

/** Un episodio de entrenamiento con exploración ε-voraz. Devuelve el retorno total (sin descuento). */
function runTrainingEpisode(
  table: QTable,
  levelId: string,
  difficulty: RaycastDifficultyId,
  seed: number,
  epsilon: number,
  hyper: QHyperParams,
  maxMs: number
): number {
  const world = createSimWorld({ levelId, seed, difficultyId: difficulty });
  const rng = createSeededRng((seed ^ 0x51ed270b) >>> 0);
  const controller = new MacroController();
  const bossFraction = (): number => (world.bosses[0] ? world.bosses[0].health / world.bosses[0].maxHealth : 0);
  let elapsedMs = 0;
  let total = 0;
  let outcome: ReturnType<typeof stepSimWorld> = null;

  while (outcome === null && elapsedMs < maxMs) {
    const state = encodeState(observeSimWorld(world));
    const macroIndex = chooseMacro(table, state, epsilon, rng);
    const macro = MACROS[macroIndex];
    const killsBefore = world.stats.enemiesKilled;
    const damageBefore = world.stats.damageTaken;
    const bossBefore = bossFraction();

    for (let tick = 0; tick < MACRO_TICKS && outcome === null; tick += 1) {
      outcome = stepSimWorld(world, controller.act(macro, observeSimWorld(world)), SIM_DEFAULT_DT_MS);
      elapsedMs += SIM_DEFAULT_DT_MS;
    }

    let reward =
      (world.stats.enemiesKilled - killsBefore) * hyper.killReward +
      Math.max(0, bossBefore - bossFraction()) * hyper.bossDamageReward -
      (world.stats.damageTaken - damageBefore) * hyper.damagePenaltyPerHp -
      hyper.stepPenalty;
    if (outcome === 'cleared') reward += hyper.clearReward;
    if (outcome === 'death') reward -= hyper.deathPenalty;
    total += reward;

    const terminal = outcome !== null || elapsedMs >= maxMs;
    const next = terminal ? 0 : table.maxValue(encodeState(observeSimWorld(world)));
    const index = state * MACRO_COUNT + macroIndex;
    table.values[index] += hyper.alpha * (reward + hyper.gamma * next - table.values[index]);
    table.visits[index] += 1;
  }
  return total;
}
