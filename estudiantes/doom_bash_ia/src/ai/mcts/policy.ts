/**
 * Política del jefe con MCTS y UCT (cierra el hueco de M2). Implementa `RaycastBossPolicy`.
 *
 * Busca sobre el mismo modelo abstracto del duelo que expectimax (`../expectimax/model.ts`), con el mismo
 * modelo del jugador y el mismo objetivo, para que la comparación sea justa. Lo que cambia es cómo se busca:
 *
 * - Expectimax recorre TODO el árbol hasta la profundidad d: ataques × 5 respuestas, por nivel. El costo crece
 *   como (ataques · 5)^d, por eso se queda en d ≤ 3.
 * - MCTS hace un número fijo de iteraciones. Cada iteración baja por el árbol eligiendo ataques con UCT,
 *   SORTEA la respuesta del jugador con P(r | s) (en vez de promediar las cinco), agrega un ataque nuevo al
 *   árbol, completa el horizonte con ataques al azar (simulación) y sube el resultado. Gasta la búsqueda en
 *   las ramas prometedoras y puede mirar más lejos con el mismo presupuesto.
 *
 * Es MCTS de "lazo abierto" (open-loop): un nodo es la secuencia de ataques del jefe, no un estado, porque
 * con respuestas sorteadas el mismo camino de ataques lleva a estados distintos. El estado se recalcula en
 * cada iteración desde la raíz. Es la variante que se usa en juegos de tiempo real con azar.
 *
 * UCT:  elegir k que maximiza  Q̄(k) + c · sqrt( ln N / n(k) ),  con Q̄ normalizado a [0, 1] con el mínimo y
 * el máximo de retornos vistos en esta decisión (los puntajes de 'pacing' son negativos y no están acotados).
 * Al final se lanza el ataque más visitado (más robusto que el de mayor media).
 */
import type { BossVolleyKind, BossVolleyPickContext, RaycastBossPlayerContext } from '../../game/raycast/RaycastBossAI';
import { volleyCandidates } from '../../game/raycast/RaycastBossAI';
import type { RaycastBossState } from '../../game/raycast/RaycastBoss';
import type { RaycastBossPolicy } from '../../game/raycast/RaycastBossPolicy';
import type { RaycastMap } from '../../game/raycast/RaycastMap';
import { createSeededRng, type Rng } from '../sim/rng';
import { createDeficitTracker, persistenceProbabilities, scoreStep, type BossObjective } from '../expectimax/objective';
import {
  createModelContext,
  evaluateVolley,
  PLAYER_RESPONSES,
  type DuelParams,
  type DuelState,
  type ModelContext,
  type PlayerResponse
} from '../expectimax/model';
import { bossRepertoire, type CandidatePool, type ExpectimaxDecision } from '../expectimax/policy';

export interface MctsOptions {
  /** Iteraciones por decisión (el presupuesto de búsqueda). */
  iterations?: number;
  /** Cuántas salvas del jefe se miran hacia adelante. */
  horizon?: number;
  /** Constante de exploración c de UCT, sobre retornos normalizados a [0, 1]. */
  exploration?: number;
  /** Descuento por salva (el mismo 0.8 de expectimax). */
  discount?: number;
  pool?: CandidatePool;
  objective?: BossObjective;
  targetDamage?: number;
  params?: Partial<DuelParams>;
  /** Semilla del sorteo de respuestas y de las simulaciones. */
  seed?: number;
}

export interface MctsStats {
  decisions: number;
  iterations: number;
  /** Evaluaciones de (ataque, respuesta) acumuladas; misma unidad de costo que expectimax. */
  evaluations: number;
  wallMs: number;
}

export interface MctsBossPolicy extends RaycastBossPolicy {
  readonly stats: MctsStats;
  readonly options: Required<Omit<MctsOptions, 'params' | 'seed'>>;
  /** Última decisión: media de retorno y visitas por ataque de la raíz. */
  lastDecision(): ExpectimaxDecision | null;
}

interface TreeNode {
  visits: number;
  total: number;
  children: Map<BossVolleyKind, TreeNode>;
}

const newNode = (): TreeNode => ({ visits: 0, total: 0, children: new Map() });

function sampleResponse(probs: Record<PlayerResponse, number>, rng: Rng): PlayerResponse {
  let u = rng();
  for (const response of PLAYER_RESPONSES) {
    u -= probs[response];
    if (u < 0) return response;
  }
  return PLAYER_RESPONSES[PLAYER_RESPONSES.length - 1];
}

export const DEFAULT_MCTS_OPTIONS = {
  iterations: 256,
  horizon: 4,
  exploration: 0.7,
  discount: 0.8,
  pool: 'repertoire' as CandidatePool,
  objective: 'damage' as BossObjective,
  targetDamage: 6
};

export function createMctsBossPolicy(options: MctsOptions = {}): MctsBossPolicy {
  const config = {
    iterations: Math.max(1, Math.round(options.iterations ?? DEFAULT_MCTS_OPTIONS.iterations)),
    horizon: Math.max(1, Math.round(options.horizon ?? DEFAULT_MCTS_OPTIONS.horizon)),
    exploration: options.exploration ?? DEFAULT_MCTS_OPTIONS.exploration,
    discount: options.discount ?? DEFAULT_MCTS_OPTIONS.discount,
    pool: options.pool ?? DEFAULT_MCTS_OPTIONS.pool,
    objective: options.objective ?? DEFAULT_MCTS_OPTIONS.objective,
    targetDamage: options.targetDamage ?? DEFAULT_MCTS_OPTIONS.targetDamage
  };
  const rng = createSeededRng(((options.seed ?? 1) ^ 0x6d757463) >>> 0);
  const stats: MctsStats = { decisions: 0, iterations: 0, evaluations: 0, wallMs: 0 };
  const deficitTracker = createDeficitTracker(config.objective, config.targetDamage);
  let last: ExpectimaxDecision | null = null;

  /** Una salva del modelo: sortea la respuesta, evalúa y puntúa. */
  function step(ctx: ModelContext, state: DuelState, deficit: number, kind: BossVolleyKind) {
    const response = sampleResponse(persistenceProbabilities(state), rng);
    stats.evaluations += 1;
    const outcome = evaluateVolley(ctx, state, kind, response);
    const { score, nextDeficit } = scoreStep(config.objective, config.targetDamage, deficit, outcome.damage);
    return { score, next: outcome.next, nextDeficit };
  }

  function search(ctx: ModelContext, rootState: DuelState, rootDeficit: number, candidates: BossVolleyKind[]): TreeNode {
    const root = newNode();
    let low = Infinity;
    let high = -Infinity;
    const normalized = (node: TreeNode) => {
      const mean = node.total / node.visits;
      return high > low ? (mean - low) / (high - low) : 0.5;
    };

    for (let it = 0; it < config.iterations; it += 1) {
      let node = root;
      let state = rootState;
      let deficit = rootDeficit;
      const path: TreeNode[] = [];
      const rewards: number[] = [];

      // Selección y expansión: baja con UCT mientras el nodo esté completo; agrega un hijo y para.
      while (rewards.length < config.horizon) {
        const untried = candidates.filter((kind) => !node.children.has(kind));
        let kind: BossVolleyKind;
        let expanded = false;
        if (untried.length > 0) {
          kind = untried[Math.floor(rng() * untried.length)];
          node.children.set(kind, newNode());
          expanded = true;
        } else {
          const logN = Math.log(Math.max(1, node.visits));
          let bestScore = -Infinity;
          kind = candidates[0];
          for (const [childKind, child] of node.children) {
            const ucb = normalized(child) + config.exploration * Math.sqrt(logN / child.visits);
            if (ucb > bestScore) {
              bestScore = ucb;
              kind = childKind;
            }
          }
        }
        const result = step(ctx, state, deficit, kind);
        rewards.push(result.score);
        state = result.next;
        deficit = result.nextDeficit;
        node = node.children.get(kind)!;
        path.push(node);
        if (expanded) break;
      }

      // Simulación: completa el horizonte con ataques al azar.
      while (rewards.length < config.horizon) {
        const kind = candidates[Math.floor(rng() * candidates.length)];
        const result = step(ctx, state, deficit, kind);
        rewards.push(result.score);
        state = result.next;
        deficit = result.nextDeficit;
      }

      // Retropropagación: cada nodo recibe el retorno descontado desde su propia salva en adelante.
      let tail = 0;
      const returns = new Array<number>(rewards.length);
      for (let i = rewards.length - 1; i >= 0; i -= 1) {
        tail = rewards[i] + config.discount * tail;
        returns[i] = tail;
      }
      for (let i = 0; i < path.length; i += 1) {
        path[i].visits += 1;
        path[i].total += returns[i];
        if (i === 0) {
          low = Math.min(low, returns[0]);
          high = Math.max(high, returns[0]);
        }
      }
      root.visits += 1;
      root.total += returns[0];
      stats.iterations += 1;
    }
    return root;
  }

  return {
    stats,
    options: config,
    lastDecision: () => last,
    pickVolley(
      boss: RaycastBossState,
      player: RaycastBossPlayerContext,
      map: RaycastMap,
      context: BossVolleyPickContext,
      time: number
    ): BossVolleyKind | null {
      const started = performance.now();
      const candidates =
        config.pool === 'repertoire' ? bossRepertoire(boss.behavior) : volleyCandidates(boss.behavior, boss.phase, context);
      if (candidates.length === 0) return null;

      const state: DuelState = {
        bossX: boss.x,
        bossY: boss.y,
        playerX: player.x,
        playerY: player.y,
        playerVx: player.vx ?? 0,
        playerVy: player.vy ?? 0,
        playerStationaryMs: player.stationaryMs ?? 0,
        timeMs: time
      };
      const deficit = deficitTracker.update(boss, player);
      const ctx = createModelContext(map, boss, options.params);
      const root = search(ctx, state, deficit, candidates);

      const values = [...root.children].map(([kind, child]) => ({
        kind,
        value: child.visits > 0 ? child.total / child.visits : -Infinity,
        visits: child.visits
      }));
      // El más visitado; en empate, la mejor media; si sigue empatado, se evita repetir el ataque anterior.
      let chosen = values[0];
      for (const entry of values) {
        const moreVisits = entry.visits > chosen.visits;
        const sameVisits = entry.visits === chosen.visits;
        const betterValue = entry.value > chosen.value + 1e-9;
        const tiedValue = Math.abs(entry.value - chosen.value) <= 1e-9;
        if (
          moreVisits ||
          (sameVisits && betterValue) ||
          (sameVisits && tiedValue && chosen.kind === boss.lastVolleyKind && entry.kind !== boss.lastVolleyKind)
        ) {
          chosen = entry;
        }
      }
      last = { kind: chosen.kind, values };
      stats.decisions += 1;
      stats.wallMs += performance.now() - started;
      return chosen.kind;
    }
  };
}
