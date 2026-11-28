/**
 * Arena de escondidas para medir el acechador (sin navegador, determinista con semilla).
 *
 * Usa el mapa real de un nivel (con las puertas abiertas, como el simulador M0), la misma línea de vista que el
 * juego (`castRay`) y la misma búsqueda A* que los enemigos. Hay solo dos agentes:
 *
 *  - Quien se esconde (bot): deambula entre celdas al azar; si ve al acechador cerca, huye a una celda lejana que
 *    el acechador no ve, y le dispara si lo tiene a menos de 6 celdas (eso hace ruido).
 *  - El acechador: si ve al bot, lo persigue; si no, va a donde diga su cerebro (`brain.ts`) según el modo; si el
 *    cerebro no propone nada, patrulla.
 *
 * Si el acechador alcanza al bot (menos de 0.8 celdas), cuenta una atrapada y el bot reaparece lejos y fuera de
 * vista, para tener muchas búsquedas por episodio. Esto NO es el juego completo: no hay daño, armas, otros
 * enemigos ni el oído "a través de paredes" del juego; es un banco de pruebas de la búsqueda.
 */
import { castRay, type RaycastMap } from '../../game/raycast/RaycastMap';
import { findPathAStar, type Waypoint } from '../astar/search';
import { createSeededRng, type Rng } from '../sim/rng';
import { createSimWorld } from '../sim/SimWorld';
import { openCells } from './belief';
import { createStalkerBrain, type StalkerMode, type StalkerParams } from './brain';

export interface ArenaOptions {
  levelId: string;
  seed: number;
  mode: StalkerMode;
  durationMs?: number;
  stepMs?: number;
  params?: Partial<StalkerParams>;
}

export interface ArenaResult {
  /** Fracción del tiempo en que el acechador ve al bot. */
  contactFraction: number;
  /** Veces que lo perdió de vista. */
  losses: number;
  /** Tiempo medio, en s, entre perderlo y volver a verlo (las búsquedas sin terminar cuentan hasta el final). */
  reacquireMeanS: number;
  /** Búsquedas que no terminaron antes del final del episodio. */
  unfinishedSearches: number;
  catchesPerMinute: number;
  /** Ciclos de tensión: el medidor llega al tope después de haber bajado a 0.3 o menos. */
  menacePeaks: number;
  /** Fracción del tiempo con el medidor en 0.9 o más. */
  menaceHighFraction: number;
  hints: number;
  retreats: number;
}

const STALKER_CHASE_SPEED = 2.68; // 268 / 100, `speed` del STALKER en el juego
const STALKER_SEARCH_SPEED = STALKER_CHASE_SPEED * 0.7;
const STALKER_PATROL_SPEED = STALKER_CHASE_SPEED * 0.54; // la misma fracción que su patrulla en el juego
const EVADER_WANDER_SPEED = 2.2;
const EVADER_FLEE_SPEED = 3.0;
const EVADER_SIGHT = 9;
const SHOT_RANGE = 6;
const SHOT_INTERVAL_MS = 800;
const CATCH_DISTANCE = 0.8;

function lineOfSight(map: RaycastMap, ax: number, ay: number, bx: number, by: number): boolean {
  const distance = Math.hypot(bx - ax, by - ay);
  if (distance < 0.3) return true;
  const angle = Math.atan2(by - ay, bx - ax);
  return castRay(map, ax, ay, angle, angle).distance + 0.08 >= distance;
}

interface Mover {
  x: number;
  y: number;
  path: Waypoint[];
  goalKey: number;
}

function cellKey(x: number, y: number): number {
  return Math.floor(y) * 4096 + Math.floor(x);
}

/** Avanza por la ruta A* hacia (gx, gy); recalcula si cambia la celda meta. */
function moveToward(map: RaycastMap, mover: Mover, gx: number, gy: number, speed: number, seconds: number): void {
  const key = cellKey(gx, gy);
  if (key !== mover.goalKey || mover.path.length === 0) {
    const result = findPathAStar(map, mover.x, mover.y, gx, gy, { maxNodes: 4000 });
    mover.path = result.found ? result.path.slice() : [];
    mover.goalKey = key;
    if (mover.path.length === 0 && Math.floor(mover.x) === Math.floor(gx) && Math.floor(mover.y) === Math.floor(gy)) {
      mover.path = [{ x: gx, y: gy }];
    }
  }
  let budget = speed * seconds;
  while (budget > 0 && mover.path.length > 0) {
    const next = mover.path[0];
    const d = Math.hypot(next.x - mover.x, next.y - mover.y);
    if (d <= budget) {
      mover.x = next.x;
      mover.y = next.y;
      budget -= d;
      mover.path.shift();
    } else {
      mover.x += ((next.x - mover.x) / d) * budget;
      mover.y += ((next.y - mover.y) / d) * budget;
      budget = 0;
    }
  }
}

function randomCell(map: RaycastMap, rng: Rng): { x: number; y: number } {
  const cells = openCells(map);
  const [cx, cy] = cells[Math.floor(rng() * cells.length)];
  return { x: cx + 0.5, y: cy + 0.5 };
}

/** Celda lejana a (fx, fy) que no se ve desde ahí; la mejor de `tries` intentos. */
function hidingCell(map: RaycastMap, rng: Rng, fx: number, fy: number, minDistance: number, tries = 30) {
  let best = randomCell(map, rng);
  let bestScore = -Infinity;
  for (let k = 0; k < tries; k += 1) {
    const cell = randomCell(map, rng);
    const d = Math.hypot(cell.x - fx, cell.y - fy);
    const hidden = !lineOfSight(map, fx, fy, cell.x, cell.y);
    const score = d + (hidden ? 100 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = cell;
    }
    if (hidden && d >= minDistance) return cell;
  }
  return best;
}

export function runArenaEpisode(options: ArenaOptions): ArenaResult {
  const durationMs = options.durationMs ?? 120_000;
  const stepMs = options.stepMs ?? 50;
  const world = createSimWorld({ levelId: options.levelId, seed: options.seed });
  const map = world.map;
  const rng = createSeededRng(((options.seed >>> 0) ^ 0x7a11e4) >>> 0);
  const brain = createStalkerBrain(options.mode, options.seed, options.params);
  const visionRange = options.params?.visionRange ?? 10.5;

  const evader: Mover & { target: { x: number; y: number }; fleeing: boolean; nextShotAt: number } = {
    x: world.player.x,
    y: world.player.y,
    path: [],
    goalKey: -1,
    target: randomCell(map, rng),
    fleeing: false,
    nextShotAt: 0
  };
  const start = hidingCell(map, rng, evader.x, evader.y, 8);
  const stalker: Mover & { patrol: { x: number; y: number } } = {
    x: start.x,
    y: start.y,
    path: [],
    goalKey: -1,
    patrol: randomCell(map, rng)
  };

  let ticks = 0;
  let seeTicks = 0;
  let highTicks = 0;
  let catches = 0;
  let losses = 0;
  let unfinished = 0;
  const searchTimes: number[] = [];
  let lostAt: number | null = null;
  let previousSees = false;
  let armed = true;
  let peaks = 0;

  for (let t = 0; t < durationMs; t += stepMs) {
    const seconds = stepMs / 1000;
    const distance = Math.hypot(evader.x - stalker.x, evader.y - stalker.y);
    const sees = distance <= visionRange && lineOfSight(map, stalker.x, stalker.y, evader.x, evader.y);

    // Quien se esconde.
    const seesStalker = distance <= EVADER_SIGHT && sees;
    let fired = false;
    if (seesStalker && !evader.fleeing) {
      evader.fleeing = true;
      evader.target = hidingCell(map, rng, stalker.x, stalker.y, 8);
    }
    if (seesStalker && distance <= SHOT_RANGE && t >= evader.nextShotAt) {
      fired = true;
      evader.nextShotAt = t + SHOT_INTERVAL_MS;
    }
    moveToward(map, evader, evader.target.x, evader.target.y, evader.fleeing ? EVADER_FLEE_SPEED : EVADER_WANDER_SPEED, seconds);
    if (Math.hypot(evader.target.x - evader.x, evader.target.y - evader.y) < 0.2) {
      evader.fleeing = false;
      evader.target = randomCell(map, rng);
    }

    // Cerebro del acechador.
    brain.update({
      map,
      timeMs: t,
      deltaMs: stepMs,
      stalkerX: stalker.x,
      stalkerY: stalker.y,
      playerX: evader.x,
      playerY: evader.y,
      sees,
      playerFired: fired
    });
    const goal = brain.goal(stalker.x, stalker.y);
    if (sees && !goal?.ignorePlayer) {
      moveToward(map, stalker, evader.x, evader.y, STALKER_CHASE_SPEED, seconds);
    } else if (goal) {
      moveToward(map, stalker, goal.x, goal.y, goal.ignorePlayer ? STALKER_CHASE_SPEED : STALKER_SEARCH_SPEED, seconds);
    } else {
      if (Math.hypot(stalker.patrol.x - stalker.x, stalker.patrol.y - stalker.y) < 0.3) stalker.patrol = randomCell(map, rng);
      moveToward(map, stalker, stalker.patrol.x, stalker.patrol.y, STALKER_PATROL_SPEED, seconds);
    }

    // Mediciones.
    ticks += 1;
    if (sees) seeTicks += 1;
    if (brain.menace >= 0.9) highTicks += 1;
    if (brain.menace <= 0.3) armed = true;
    if (armed && brain.menace >= 0.99) {
      peaks += 1;
      armed = false;
    }
    if (previousSees && !sees) {
      losses += 1;
      lostAt = t;
    } else if (!previousSees && sees && lostAt !== null) {
      searchTimes.push((t - lostAt) / 1000);
      lostAt = null;
    }
    previousSees = sees;

    if (!goal?.ignorePlayer && Math.hypot(evader.x - stalker.x, evader.y - stalker.y) < CATCH_DISTANCE) {
      catches += 1;
      brain.notifyAttack();
      const respawn = hidingCell(map, rng, stalker.x, stalker.y, 10);
      evader.x = respawn.x;
      evader.y = respawn.y;
      evader.path = [];
      evader.goalKey = -1;
      evader.fleeing = false;
      evader.target = randomCell(map, rng);
    }
  }
  if (lostAt !== null) {
    unfinished += 1;
    searchTimes.push((durationMs - lostAt) / 1000);
  }

  return {
    contactFraction: seeTicks / ticks,
    losses,
    reacquireMeanS: searchTimes.length ? searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length : durationMs / 1000,
    unfinishedSearches: unfinished,
    catchesPerMinute: catches / (durationMs / 60_000),
    menacePeaks: peaks,
    menaceHighFraction: highTicks / ticks,
    hints: brain.stats.hints,
    retreats: brain.stats.retreats
  };
}
