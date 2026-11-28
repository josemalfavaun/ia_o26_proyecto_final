/**
 * Conecta el cerebro del acechador (`brain.ts`) con los enemigos `STALKER` del juego. Un cerebro por enemigo,
 * en modo 'director' (filtro de partículas + director con medidor de amenaza).
 *
 * El juego lo usa así, cada cuadro: `tick(...)` antes de `updateRaycastEnemies`, y `searchGoal` como modificador
 * del sistema de enemigos. Cuando un acechador detecta al jugador (por la regla del juego), lo persigue como
 * siempre; cuando no, va a donde diga su creencia, y durante una retirada del director se aleja aunque lo vea.
 */
import type { RaycastEnemy } from '../../game/raycast/RaycastEnemy';
import type { RaycastSearchGoal } from '../../game/raycast/RaycastEnemySystem';
import { castRay, type RaycastMap } from '../../game/raycast/RaycastMap';
import { createStalkerBrain, type StalkerBrain, type StalkerParams, type StalkerPhase } from './brain';

export interface StalkerTickInput {
  map: RaycastMap;
  enemies: readonly RaycastEnemy[];
  player: { x: number; y: number; alive: boolean };
  timeMs: number;
  deltaMs: number;
  /** El jugador disparó desde el cuadro anterior. */
  playerFired: boolean;
}

export interface StalkerView {
  enemyId: string;
  x: number;
  y: number;
  menace: number;
  phase: StalkerPhase;
  hints: number;
  retreats: number;
  particlesX: Float64Array | null;
  particlesY: Float64Array | null;
}

export interface StalkerManager {
  tick(input: StalkerTickInput): void;
  searchGoal(enemy: RaycastEnemy, time: number): RaycastSearchGoal | null;
  views(): StalkerView[];
  reset(): void;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function createStalkerManager(seed: number, params: Partial<StalkerParams> = {}): StalkerManager {
  const brains = new Map<string, { brain: StalkerBrain; enemy: RaycastEnemy; lastAttackAt: number }>();
  const visionRange = params.visionRange ?? 10.5;

  return {
    tick(input) {
      const alive = new Set<string>();
      for (const enemy of input.enemies) {
        if (!enemy.alive || enemy.kind !== 'STALKER') continue;
        alive.add(enemy.id);
        let entry = brains.get(enemy.id);
        if (!entry || entry.enemy !== enemy) {
          entry = { brain: createStalkerBrain('director', (seed ^ hashId(enemy.id)) >>> 0, params), enemy, lastAttackAt: -Infinity };
          brains.set(enemy.id, entry);
        }
        const dx = input.player.x - enemy.x;
        const dy = input.player.y - enemy.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const sees =
          input.player.alive &&
          distance <= visionRange &&
          (distance < 0.3 || castRay(input.map, enemy.x, enemy.y, angle, angle).distance + 0.08 >= distance);
        entry.brain.update({
          map: input.map,
          timeMs: input.timeMs,
          deltaMs: input.deltaMs,
          stalkerX: enemy.x,
          stalkerY: enemy.y,
          playerX: input.player.x,
          playerY: input.player.y,
          sees,
          playerFired: input.playerFired
        });
        // Alcanzar al jugador sube la amenaza (como mucho una vez por segundo).
        if (input.player.alive && distance < 0.8 && input.timeMs - entry.lastAttackAt >= 1000) {
          entry.lastAttackAt = input.timeMs;
          entry.brain.notifyAttack();
        }
      }
      for (const id of [...brains.keys()]) if (!alive.has(id)) brains.delete(id);
    },
    searchGoal(enemy) {
      if (enemy.kind !== 'STALKER') return null;
      const entry = brains.get(enemy.id);
      if (!entry || entry.enemy !== enemy) return null;
      const goal = entry.brain.goal(enemy.x, enemy.y);
      if (!goal) return null;
      return { x: goal.x, y: goal.y, ignorePlayer: goal.ignorePlayer, speedFactor: goal.ignorePlayer ? 1 : 0.7 };
    },
    views() {
      return [...brains.values()].map(({ brain, enemy }) => ({
        enemyId: enemy.id,
        x: enemy.x,
        y: enemy.y,
        menace: brain.menace,
        phase: brain.phase,
        hints: brain.stats.hints,
        retreats: brain.stats.retreats,
        particlesX: brain.belief?.xs ?? null,
        particlesY: brain.belief?.ys ?? null
      }));
    },
    reset() {
      brains.clear();
    }
  };
}
