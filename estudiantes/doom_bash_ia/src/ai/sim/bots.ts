/**
 * Bots de referencia (M0). Son el rival contra el que se mide cada mejora de IA:
 * - quieto: no hace nada. Mide cuánto daño hacen los enemigos a un blanco inmóvil.
 * - aleatorio: movimientos y disparos al azar, sin mirar el mundo.
 * - guionado: apunta al objetivo más cercano con línea de visión, se mueve de lado y mantiene
 *   distancia. Es un jugador mediocre pero coherente, y es la referencia principal.
 */
import { IDLE_ACTION, type PlayerAction, type SimBot, type SimBotFactory, type SimObservation } from '../types';
import { RAYCAST_MOVEMENT } from '../../game/raycast/RaycastMovement';
import type { RaycastMap } from '../../game/raycast/RaycastMap';
import { searchGrid, type Waypoint } from '../astar/search';
import { createSeededRng, symmetricNoise } from './rng';

function wrapAngle(angle: number): number {
  let wrapped = angle % (Math.PI * 2);
  if (wrapped > Math.PI) wrapped -= Math.PI * 2;
  if (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export const idleBotFactory: SimBotFactory = (): SimBot => ({
  name: 'quieto',
  decide: () => IDLE_ACTION
});

export const randomBotFactory: SimBotFactory = (seed: number): SimBot => {
  const rng = createSeededRng((seed ^ 0x9e3779b9) >>> 0);
  const pick = (): number => Math.floor(rng() * 3) - 1;
  let holdUntilMs = 0;
  let current: PlayerAction = IDLE_ACTION;
  return {
    name: 'aleatorio',
    decide(observation: SimObservation): PlayerAction {
      if (observation.timeMs >= holdUntilMs) {
        holdUntilMs = observation.timeMs + 250 + rng() * 450;
        current = { forward: pick(), strafe: pick(), turn: pick(), fire: rng() < 0.35, reload: false };
      }
      if (observation.player.ammo === 0 && !observation.player.reloading) {
        return { ...current, fire: false, reload: true };
      }
      return current;
    }
  };
};

interface Target {
  x: number;
  y: number;
  bearing: number;
  distance: number;
  hasLineOfSight: boolean;
}

/**
 * Ruta por celdas hacia (toX, toY) para el bot de prueba. Usa el mismo buscador que la IA (BFS), con el
 * radio de colisión del jugador. Devuelve [] si ya está en la celda o si no hay ruta.
 */
export function findGridRoute(map: RaycastMap, fromX: number, fromY: number, toX: number, toY: number): Waypoint[] {
  return searchGrid(map, fromX, fromY, toX, toY, { algorithm: 'bfs', radius: RAYCAST_MOVEMENT.collisionRadius }).path;
}

function pickTarget(observation: SimObservation): Target | null {
  const visibleEnemy = observation.enemies.find((enemy) => enemy.hasLineOfSight);
  const enemy = visibleEnemy ?? observation.enemies[0] ?? null;
  const boss = observation.boss;
  if (boss && (!enemy || (boss.hasLineOfSight && (!visibleEnemy || boss.distance <= visibleEnemy.distance)))) {
    return boss;
  }
  return enemy;
}

const ROUTE_REPLAN_MS = 350;
/** Cuántas celdas por delante de la ruta apunta el bot; más lejos suaviza las esquinas. */
const ROUTE_LOOKAHEAD = 2;

export const scriptedBotFactory: SimBotFactory = (seed: number): SimBot => {
  const rng = createSeededRng((seed ^ 0x85ebca6b) >>> 0);
  let strafeSign = rng() < 0.5 ? -1 : 1;
  let flipAtMs = 0;
  let route: Waypoint[] = [];
  let replanAtMs = 0;
  return {
    name: 'guionado',
    decide(observation: SimObservation): PlayerAction {
      const { player } = observation;
      if (observation.timeMs >= flipAtMs) {
        strafeSign = -strafeSign;
        flipAtMs = observation.timeMs + 700 + rng() * 900;
      }
      const needsReload = player.ammo === 0 && !player.reloading;
      const target = pickTarget(observation);
      if (!target) {
        return { ...IDLE_ACTION, reload: !player.reloading && player.ammo < player.ammoCapacity };
      }
      if (target.hasLineOfSight) {
        route = [];
        const error = wrapAngle(target.bearing - player.angle + symmetricNoise(rng) * 0.04);
        let forward = 1;
        if (target.distance < 3.5) forward = -1;
        else if (target.distance <= 7) forward = 0;
        return {
          forward,
          strafe: strafeSign,
          turn: clampUnit(error * 4),
          fire: Math.abs(error) < 0.1 && !needsReload,
          reload: needsReload
        };
      }
      // Sin línea de visión: sigue una ruta por celdas hacia el objetivo y recarga si le queda poco.
      if (observation.timeMs >= replanAtMs) {
        route = findGridRoute(observation.map, player.x, player.y, target.x, target.y);
        replanAtMs = observation.timeMs + ROUTE_REPLAN_MS;
      }
      while (route.length > 1 && Math.hypot(route[0].x - player.x, route[0].y - player.y) < 0.45) route.shift();
      const waypoint = route[Math.min(ROUTE_LOOKAHEAD - 1, route.length - 1)] ?? target;
      const bearing = Math.atan2(waypoint.y - player.y, waypoint.x - player.x);
      const error = wrapAngle(bearing - player.angle);
      return {
        forward: Math.abs(error) < 1.2 ? 1 : 0,
        strafe: 0,
        turn: clampUnit(error * 4),
        fire: false,
        reload: needsReload || (!player.reloading && player.ammo < player.ammoCapacity / 2)
      };
    }
  };
};

export const REFERENCE_BOTS: readonly SimBotFactory[] = [idleBotFactory, randomBotFactory, scriptedBotFactory];
