/**
 * M4: acciones de alto nivel y discretización del estado para el Q-learning del bot jugador.
 *
 * Es un agente jerárquico: el Q-learning elige UNA acción de alto nivel ("macro") cada
 * `MACRO_TICKS` pasos de simulación, y un controlador fijo la traduce a movimiento, giro y
 * disparo. El controlador apunta y recarga solo; lo que se aprende es cuándo avanzar, rodear,
 * retroceder o esquivar. Con eso la tabla queda de 1 620 estados por 6 acciones.
 */
import { IDLE_ACTION, type PlayerAction, type SimObservation } from '../types';
import type { Waypoint } from '../astar/search';
import { findDodgeDirection, findGridRoute, pickTarget } from '../sim/bots';

/** Pasos de simulación (20 ms cada uno) que dura una decisión: 160 ms. */
export const MACRO_TICKS = 8;

export const MACROS = ['sostener', 'avanzar', 'rodear-izq', 'rodear-der', 'retroceder', 'esquivar'] as const;
export type Macro = (typeof MACROS)[number];
export const MACRO_COUNT = MACROS.length;

const DIST_BUCKETS = 5;
const LOS_BUCKETS = 2;
const AIM_BUCKETS = 3;
const HP_BUCKETS = 3;
const AMMO_BUCKETS = 3;
const THREAT_BUCKETS = 2;
const CROWD_BUCKETS = 3;

export const STATE_COUNT =
  DIST_BUCKETS * LOS_BUCKETS * AIM_BUCKETS * HP_BUCKETS * AMMO_BUCKETS * THREAT_BUCKETS * CROWD_BUCKETS;

function wrapAngle(angle: number): number {
  let wrapped = angle % (Math.PI * 2);
  if (wrapped > Math.PI) wrapped -= Math.PI * 2;
  if (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Distancia al objetivo: 0 sin objetivo, 1 menos de 3, 2 menos de 6, 3 menos de 10, 4 más lejos. */
function distanceBucket(distance: number | null): number {
  if (distance === null) return 0;
  if (distance < 3) return 1;
  if (distance < 6) return 2;
  if (distance < 10) return 3;
  return 4;
}

/** Índice del estado discretizado, en [0, STATE_COUNT). */
export function encodeState(observation: SimObservation): number {
  const target = pickTarget(observation);
  const { player } = observation;
  const dist = distanceBucket(target ? target.distance : null);
  const los = target && target.hasLineOfSight ? 1 : 0;
  const error = target ? Math.abs(wrapAngle(target.bearing - player.angle)) : Math.PI;
  const aim = error < 0.12 ? 0 : error < 0.6 ? 1 : 2;
  const hpFraction = player.maxHealth > 0 ? player.health / player.maxHealth : 0;
  const hp = hpFraction >= 0.66 ? 0 : hpFraction >= 0.33 ? 1 : 2;
  const ammo = player.ammo === 0 || player.reloading ? 0 : player.ammo <= 2 ? 1 : 2;
  const threat = findDodgeDirection(observation) ? 1 : 0;
  let near = observation.enemies.filter((enemy) => enemy.distance < 5).length;
  if (observation.boss && observation.boss.distance < 8) near += 1;
  const crowd = Math.min(2, near);
  let index = dist;
  index = index * LOS_BUCKETS + los;
  index = index * AIM_BUCKETS + aim;
  index = index * HP_BUCKETS + hp;
  index = index * AMMO_BUCKETS + ammo;
  index = index * THREAT_BUCKETS + threat;
  index = index * CROWD_BUCKETS + crowd;
  return index;
}

const ROUTE_REPLAN_MS = 350;
const ROUTE_LOOKAHEAD = 2;
const TURN_GAIN = 4;
const FIRE_TOLERANCE = 0.1;

/**
 * Traduce una macro a la acción de un paso. Guarda la ruta por celdas entre pasos para no recalcularla
 * en cada uno, así que hay un controlador por episodio.
 */
export class MacroController {
  private route: Waypoint[] = [];
  private replanAtMs = 0;

  act(macro: Macro, observation: SimObservation): PlayerAction {
    const { player } = observation;
    const needsReload = player.ammo === 0 && !player.reloading;
    const target = pickTarget(observation);
    if (!target) {
      return { ...IDLE_ACTION, reload: !player.reloading && player.ammo < player.ammoCapacity };
    }
    if (macro === 'esquivar') {
      const dodge = findDodgeDirection(observation);
      if (dodge) {
        const right = { x: Math.cos(player.angle + Math.PI / 2), y: Math.sin(player.angle + Math.PI / 2) };
        const side = dodge.x * right.x + dodge.y * right.y;
        const ahead = dodge.x * Math.cos(player.angle) + dodge.y * Math.sin(player.angle);
        const error = wrapAngle(target.bearing - player.angle);
        return {
          forward: Math.abs(ahead) > 0.5 ? (ahead > 0 ? 1 : -1) : 0,
          strafe: Math.abs(side) > 0.2 ? (side > 0 ? 1 : -1) : 1,
          turn: clampUnit(error * TURN_GAIN),
          fire: target.hasLineOfSight && Math.abs(error) < FIRE_TOLERANCE && !needsReload,
          reload: needsReload
        };
      }
      // Sin amenaza no hay nada que esquivar: se comporta como "sostener".
      macro = 'sostener';
    }
    if (target.hasLineOfSight) {
      this.route = [];
      const error = wrapAngle(target.bearing - player.angle);
      let forward = 0;
      let strafe = 0;
      if (macro === 'avanzar') forward = 1;
      else if (macro === 'retroceder') forward = -1;
      else if (macro === 'rodear-izq') strafe = -1;
      else if (macro === 'rodear-der') strafe = 1;
      return {
        forward,
        strafe,
        turn: clampUnit(error * TURN_GAIN),
        fire: Math.abs(error) < FIRE_TOLERANCE && !needsReload,
        reload: needsReload
      };
    }
    // Sin línea de visión no hay a quién disparar: cualquier macro que no sea retroceder sigue la ruta al objetivo.
    if (macro === 'retroceder') {
      return { forward: -1, strafe: 0, turn: 0, fire: false, reload: needsReload || (!player.reloading && player.ammo < player.ammoCapacity / 2) };
    }
    if (observation.timeMs >= this.replanAtMs) {
      this.route = findGridRoute(observation.map, player.x, player.y, target.x, target.y);
      this.replanAtMs = observation.timeMs + ROUTE_REPLAN_MS;
    }
    while (this.route.length > 1 && Math.hypot(this.route[0].x - player.x, this.route[0].y - player.y) < 0.45) this.route.shift();
    const waypoint = this.route[Math.min(ROUTE_LOOKAHEAD - 1, this.route.length - 1)] ?? target;
    const bearing = Math.atan2(waypoint.y - player.y, waypoint.x - player.x);
    const error = wrapAngle(bearing - player.angle);
    const advance = macro === 'avanzar' || macro === 'rodear-izq' || macro === 'rodear-der';
    return {
      forward: advance && Math.abs(error) < 1.2 ? 1 : 0,
      strafe: 0,
      turn: clampUnit(error * TURN_GAIN),
      fire: false,
      reload: needsReload || (!player.reloading && player.ammo < player.ammoCapacity / 2)
    };
  }
}

