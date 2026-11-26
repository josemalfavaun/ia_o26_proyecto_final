/**
 * Piloto automático para el fondo de la pantalla de inicio (modo "attract").
 *
 * Una cámara recorre un nivel real del juego sin que nadie la maneje: elige una zona del nivel como meta,
 * calcula la ruta con A* (el mismo `findPathAStar` que usan los enemigos) y avanza por ella girando
 * suavemente hacia el siguiente waypoint. Al llegar, elige otra zona. No usa Phaser: el menú solo le pide
 * `update(dtMs)` y dibuja con el renderer del juego lo que devuelve.
 *
 * Es determinista: el orden de las metas sale de un generador congruencial con semilla.
 */
import { findPathAStar, type Waypoint } from '../astar/search';
import { cloneRaycastMap, openRaycastDoor, type RaycastLevel } from '../../game/raycast/RaycastLevel';
import { isWallAt, type RaycastMap } from '../../game/raycast/RaycastMap';
import type { RaycastPlayerState } from '../../game/raycast/RaycastPlayerController';

export interface AttractAutopilotOptions {
  /** Velocidad de avance en casillas por segundo. */
  speed?: number;
  /** Giro máximo en radianes por segundo. */
  turnRate?: number;
  /** Cuántos waypoints adelante apunta la cámara (suaviza las esquinas). */
  lookahead?: number;
  /** Radio del cuerpo que A* exige libre en cada celda. */
  radius?: number;
  seed?: number;
}

export interface AttractAutopilot {
  readonly level: RaycastLevel;
  readonly map: RaycastMap;
  /** Estado vivo de la cámara; se actualiza en `update` y es el mismo objeto en cada llamada. */
  readonly player: RaycastPlayerState;
  /** Avanza `dtMs` milisegundos y devuelve el estado de la cámara. */
  update(dtMs: number): RaycastPlayerState;
  /** Ruta vigente (solo lectura), útil para pruebas. */
  currentRoute(): readonly Waypoint[];
  /** Cuántas rutas ha planeado hasta ahora. */
  readonly stats: { plans: number };
}

const DEFAULTS: Required<AttractAutopilotOptions> = {
  speed: 1.9,
  turnRate: 2.6,
  lookahead: 1,
  radius: 0.28,
  seed: 20_261_125
};

const REACHED_WAYPOINT = 0.42;
const REPLAN_MS = 450;
const GOAL_RADIUS = 0.7;
const IDLE_BETWEEN_GOALS_MS = 250;
const MAX_DT_MS = 100;
const TAU = Math.PI * 2;

function wrapAngle(angle: number): number {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

/** Metas candidatas: centro de cada zona del nivel que cae en una casilla libre. */
export function listAttractGoals(level: RaycastLevel, map: RaycastMap): Waypoint[] {
  const goals: Waypoint[] = [];
  for (const zone of level.zones) {
    if (!isWallAt(map, zone.x, zone.y)) goals.push({ x: zone.x, y: zone.y });
  }
  return goals;
}

export function createAttractAutopilot(level: RaycastLevel, options: AttractAutopilotOptions = {}): AttractAutopilot {
  const config = { ...DEFAULTS, ...options };
  const map = cloneRaycastMap(level.map);
  // Es solo un paseo de cámara: con las puertas abiertas recorre el nivel completo, no solo la zona de inicio.
  for (const door of level.doors) openRaycastDoor(map, door);
  const goals = listAttractGoals(level, map);
  const player: RaycastPlayerState = {
    x: level.playerStart.x,
    y: level.playerStart.y,
    angle: level.playerStart.angle,
    velocity: { x: 0, y: 0 }
  };
  const stats = { plans: 0 };

  let rngState = config.seed >>> 0;
  const nextRandom = (): number => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 0x1_0000_0000;
  };

  let route: Waypoint[] = [];
  let goal: Waypoint | null = null;
  let lastGoalIndex = -1;
  let clockMs = 0;
  let replanAtMs = 0;

  function planRoute(toGoal: Waypoint): boolean {
    const result = findPathAStar(map, player.x, player.y, toGoal.x, toGoal.y, {
      radius: config.radius,
      maxNodes: 4000
    });
    stats.plans += 1;
    if (!result.found) return false;
    route = result.path;
    replanAtMs = clockMs + REPLAN_MS;
    return true;
  }

  /** Elige la siguiente zona con ruta; si ninguna la tiene, se queda quieto hasta el siguiente intento. */
  function pickNextGoal(): void {
    goal = null;
    route = [];
    if (goals.length === 0) return;
    const start = Math.floor(nextRandom() * goals.length);
    for (let offset = 0; offset < goals.length; offset += 1) {
      const index = (start + offset) % goals.length;
      if (index === lastGoalIndex) continue;
      const candidate = goals[index];
      // Una meta a menos de 2 casillas no sirve: la cámara apenas se movería.
      if (Math.hypot(candidate.x - player.x, candidate.y - player.y) < 2) continue;
      if (planRoute(candidate)) {
        goal = candidate;
        lastGoalIndex = index;
        return;
      }
    }
    replanAtMs = clockMs + REPLAN_MS;
  }

  function update(dtMs: number): RaycastPlayerState {
    const dt = Math.min(Math.max(dtMs, 0), MAX_DT_MS) / 1000;
    if (dt === 0) return player;
    clockMs += dt * 1000;

    if (!goal) {
      if (clockMs >= replanAtMs) pickNextGoal();
      player.velocity.x = 0;
      player.velocity.y = 0;
      if (!goal) return player;
    }

    // Se replanea desde donde está cada REPLAN_MS (como el navegador de enemigos): si la cámara se desvía de
    // la ruta por un giro amplio, la ruta nueva parte de su casilla actual y no se queda dando vueltas.
    if (clockMs >= replanAtMs && !planRoute(goal)) {
      goal = null;
      replanAtMs = clockMs;
      return player;
    }
    while (route.length > 1 && Math.hypot(route[0].x - player.x, route[0].y - player.y) < REACHED_WAYPOINT) route.shift();

    const finalPoint = route[route.length - 1] ?? goal;
    if (Math.hypot(goal.x - player.x, goal.y - player.y) < GOAL_RADIUS || route.length === 0) {
      goal = null;
      route = [];
      replanAtMs = clockMs + IDLE_BETWEEN_GOALS_MS;
      player.velocity.x = 0;
      player.velocity.y = 0;
      return player;
    }

    const target = route[Math.min(config.lookahead - 1, route.length - 1)] ?? finalPoint;
    const desired = Math.atan2(target.y - player.y, target.x - player.x);
    const diff = wrapAngle(desired - player.angle);
    const maxTurn = config.turnRate * dt;
    player.angle = wrapAngle(player.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));

    // Camina más despacio cuando todavía está girando; así no se desliza de lado por los pasillos.
    const alignment = Math.max(0.25, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)));
    const step = config.speed * alignment * dt;
    const vx = Math.cos(player.angle) * step;
    const vy = Math.sin(player.angle) * step;
    const nextX = player.x + vx;
    const nextY = player.y + vy;
    if (isWallAt(map, nextX, nextY)) {
      // Red de seguridad: si el paso cae en un muro, se desliza por el eje libre (si hay) y replanea pronto.
      replanAtMs = clockMs + 120;
      const slideX = !isWallAt(map, nextX, player.y);
      const slideY = !isWallAt(map, player.x, nextY);
      if (slideX) player.x = nextX;
      else if (slideY) player.y = nextY;
      player.velocity.x = slideX ? vx / dt : 0;
      player.velocity.y = !slideX && slideY ? vy / dt : 0;
      return player;
    }
    player.x = nextX;
    player.y = nextY;
    player.velocity.x = vx / dt;
    player.velocity.y = vy / dt;
    return player;
  }

  pickNextGoal();

  return {
    level,
    map,
    player,
    update,
    currentRoute: () => route,
    stats
  };
}
