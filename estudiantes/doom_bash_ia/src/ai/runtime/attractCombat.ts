/**
 * Combate de demostración para el fondo de los menús (modo "attract").
 *
 * Dos actos, ambos con el motor y los datos reales del juego, sin que nadie juegue:
 *  - Patrulla: el bot recorre el nivel con A* (`attractAutopilot`); cuando ve enemigos se detiene, gira, apunta y
 *    dispara hasta abatirlos. Los enemigos salen del nivel con las mismas fichas (`createRaycastEnemy`) y avanzan
 *    hacia él; los de tipo RANGED lanzan proyectiles que fallan a propósito (el bot es invulnerable).
 *  - Jefe: pelea contra el jefe 1 (Volt Archon) usando su estado, movimiento y volleys reales; el bot da vueltas
 *    por la arena apuntándole con la escopeta hasta derrotarlo.
 *
 * No usa Phaser: el fondo solo pide `update(dtMs, nowMs)` y dibuja lo que expone. `nowMs` es el reloj de la escena,
 * porque los renderers comparan contra él (`hitFlashUntil`, `deathBurstUntil`, ...).
 */
import { createAttractAutopilot, type AttractAutopilot } from './attractAutopilot';
import {
  cloneRaycastMap,
  type RaycastLevel
} from '../../game/raycast/RaycastLevel';
import { isWallAt, type RaycastMap } from '../../game/raycast/RaycastMap';
import type { RaycastPlayerState } from '../../game/raycast/RaycastPlayerController';
import { createRaycastEnemy, type RaycastEnemy } from '../../game/raycast/RaycastEnemy';
import type { RaycastEnemyProjectile } from '../../game/raycast/RaycastEnemySystem';
import {
  createRaycastBossState,
  damageRaycastBoss,
  tickRaycastBossMovement,
  tickRaycastBossVolleys,
  type RaycastBossState
} from '../../game/raycast/RaycastBoss';
import type { EnemyKind } from '../../game/types/game';

export type AttractWeapon = 'PISTOL' | 'SHOTGUN';

export interface AttractCombat {
  readonly kind: 'patrol' | 'boss';
  readonly map: RaycastMap;
  readonly player: RaycastPlayerState;
  readonly enemies: RaycastEnemy[];
  readonly projectiles: RaycastEnemyProjectile[];
  readonly boss: RaycastBossState | null;
  readonly weapon: AttractWeapon;
  /** Destello del arma de 0 a 1 en el instante `nowMs`. */
  muzzleAlpha(nowMs: number): number;
  readonly stats: { shots: number; kills: number; hits: number };
  /** Verdadero cuando el acto ya cumplió su historia y toca pasar al siguiente. */
  readonly done: boolean;
  update(dtMs: number, nowMs: number): void;
}

const MAX_DT_MS = 100;
const TAU = Math.PI * 2;
const MUZZLE_MS = 140;

function wrapAngle(angle: number): number {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Distancia libre en línea recta desde (x, y) hacia `angle`, hasta `maxDistance`. */
export function clearDistance(map: RaycastMap, x: number, y: number, angle: number, maxDistance: number): number {
  const step = 0.1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = step; d <= maxDistance; d += step) {
    if (isWallAt(map, x + cos * d, y + sin * d)) return d - step;
  }
  return maxDistance;
}

export function hasLineOfSight(map: RaycastMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dist = Math.hypot(bx - ax, by - ay);
  return clearDistance(map, ax, ay, Math.atan2(by - ay, bx - ax), dist) >= dist - 0.15;
}

function turnToward(player: RaycastPlayerState, desired: number, maxTurn: number): number {
  const diff = wrapAngle(desired - player.angle);
  player.angle = wrapAngle(player.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
  return Math.abs(wrapAngle(desired - player.angle));
}

function openAround(map: RaycastMap, x: number, y: number, r = 0.32): boolean {
  return (
    !isWallAt(map, x, y) &&
    !isWallAt(map, x + r, y) &&
    !isWallAt(map, x - r, y) &&
    !isWallAt(map, x, y + r) &&
    !isWallAt(map, x, y - r)
  );
}

function stepProjectiles(projectiles: RaycastEnemyProjectile[], map: RaycastMap, dt: number, nowMs: number, player: RaycastPlayerState): void {
  for (const p of projectiles) {
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // El bot es invulnerable: lo que le llega se disipa justo antes de tocarlo.
    if (isWallAt(map, p.x, p.y) || nowMs - p.createdAt > 4200 || Math.hypot(p.x - player.x, p.y - player.y) < 0.45) {
      p.alive = false;
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i -= 1) if (!projectiles[i].alive) projectiles.splice(i, 1);
}

/* -------------------------------------------------------------------------- */
/* Acto 1: patrulla                                                            */
/* -------------------------------------------------------------------------- */

const PATROL_KINDS: readonly EnemyKind[] = ['GRUNT', 'STALKER', 'RANGED', 'BRUTE', 'GRUNT', 'STALKER'];
const PATROL_MAX_ALIVE = 3;
const PATROL_SPAWN_EVERY_MS = 2600;
const PATROL_ENGAGE_RANGE = 9;
const PATROL_FIRE_EVERY_MS = 360;
const PATROL_DAMAGE = 24;
const PATROL_DURATION_MS = 20_000;
const ENEMY_SPEED: Partial<Record<EnemyKind, number>> = { GRUNT: 0.95, STALKER: 1.35, BRUTE: 0.7, RANGED: 0 };
const ENEMY_STOP_DISTANCE = 3.1;

export interface AttractCombatOptions {
  seed?: number;
  /** Cuánto dura el acto antes de pedir el siguiente. */
  durationMs?: number;
}

export function createPatrolCombat(level: RaycastLevel, nowMs: number, options: AttractCombatOptions = {}): AttractCombat {
  const random = makeRandom(options.seed ?? 20_261_126);
  const durationMs = options.durationMs ?? PATROL_DURATION_MS;
  const autopilot: AttractAutopilot = createAttractAutopilot(level, { seed: options.seed });
  const map = autopilot.map;
  const enemies: RaycastEnemy[] = [];
  const projectiles: RaycastEnemyProjectile[] = [];
  const stats = { shots: 0, kills: 0, hits: 0 };
  const startedAt = nowMs;
  let lastUpdateAt = nowMs;
  let nextSpawnAt = nowMs + 700;
  let nextShotAt = 0;
  let lastShotAt = -10_000;
  let kindIndex = 0;
  let spawnSerial = 0;

  function makeEnemy(x: number, y: number, now: number): void {
    const kind = PATROL_KINDS[kindIndex % PATROL_KINDS.length];
    kindIndex += 1;
    spawnSerial += 1;
    const enemy = createRaycastEnemy({ id: `attract-${spawnSerial}`, kind, x, y });
    enemy.spawnTelegraphStartedAt = now;
    enemy.spawnTelegraphUntil = now + 450;
    enemies.push(enemy);
  }

  /**
   * Los enemigos salen por delante del bot: primero sobre su propia ruta A* (así hay siempre alguien en el pasillo
   * que va a recorrer, aunque sea angosto) y, si no hay ruta útil, a la vista con mirada despejada.
   */
  function trySpawn(player: RaycastPlayerState, now: number): void {
    const alive = enemies.filter((e) => e.alive);
    for (const wp of autopilot.currentRoute()) {
      const d = Math.hypot(wp.x - player.x, wp.y - player.y);
      if (d < 4 || d > 8) continue;
      if (!openAround(map, wp.x, wp.y, 0.3)) continue;
      if (alive.some((e) => Math.hypot(e.x - wp.x, e.y - wp.y) < 2)) continue;
      makeEnemy(wp.x, wp.y, now);
      return;
    }
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = player.angle + (random() - 0.5) * 1.6;
      const clear = clearDistance(map, player.x, player.y, angle, 8);
      if (clear < 3.2) continue;
      const dist = 3 + random() * Math.max(0.2, clear - 3.6);
      const x = player.x + Math.cos(angle) * dist;
      const y = player.y + Math.sin(angle) * dist;
      if (!openAround(map, x, y)) continue;
      makeEnemy(x, y, now);
      return;
    }
  }

  function pickTarget(player: RaycastPlayerState): RaycastEnemy | null {
    let best: RaycastEnemy | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d > PATROL_ENGAGE_RANGE || d < 0.8) continue;
      if (!hasLineOfSight(map, player.x, player.y, e.x, e.y)) continue;
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  function moveEnemies(player: RaycastPlayerState, dt: number, now: number): void {
    for (const e of enemies) {
      if (!e.alive || now < e.spawnTelegraphUntil || now < e.staggerUntil) continue;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = ENEMY_SPEED[e.kind] ?? 0.9;
      if (speed > 0 && dist > ENEMY_STOP_DISTANCE && hasLineOfSight(map, e.x, e.y, player.x, player.y)) {
        const nx = e.x + (dx / dist) * speed * dt;
        const ny = e.y + (dy / dist) * speed * dt;
        if (openAround(map, nx, ny, 0.2)) {
          e.x = nx;
          e.y = ny;
        }
      }
      if (e.kind === 'RANGED' && now - e.lastAttack > 2300 && hasLineOfSight(map, e.x, e.y, player.x, player.y)) {
        e.lastAttack = now;
        // Dispara apuntando a un lado: el bot es invulnerable y así se ve el fuego enemigo sin golpearlo.
        const side = (spawnSerial % 2 === 0 ? 1 : -1) * 1.1;
        const aim = Math.atan2(dy, dx) + Math.atan2(side, dist);
        projectiles.push({
          x: e.x + Math.cos(aim) * 0.4,
          y: e.y + Math.sin(aim) * 0.4,
          vx: Math.cos(aim) * 3.2,
          vy: Math.sin(aim) * 3.2,
          damage: 0,
          radius: 0.1,
          alive: true,
          color: 0xff7733,
          createdAt: now
        });
      }
    }
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      if (!enemies[i].alive && now > enemies[i].deathBurstUntil + 3200) enemies.splice(i, 1);
    }
  }

  const combat: AttractCombat = {
    kind: 'patrol',
    map,
    get player() {
      return autopilot.player;
    },
    enemies,
    projectiles,
    boss: null,
    weapon: 'PISTOL',
    stats,
    get done() {
      return lastUpdateAt - startedAt >= durationMs;
    },
    muzzleAlpha(now: number): number {
      return Math.max(0, 1 - (now - lastShotAt) / MUZZLE_MS);
    },
    update(dtMs: number, now: number): void {
      lastUpdateAt = now;
      const dt = Math.min(Math.max(dtMs, 0), MAX_DT_MS) / 1000;
      if (dt === 0) return;
      const player = autopilot.player;

      if (now >= nextSpawnAt) {
        nextSpawnAt = now + PATROL_SPAWN_EVERY_MS;
        if (enemies.filter((e) => e.alive).length < PATROL_MAX_ALIVE) trySpawn(player, now);
      }

      const target = pickTarget(player);
      if (target) {
        // Se planta y apunta: mientras hay un blanco a la vista no camina.
        player.velocity.x = 0;
        player.velocity.y = 0;
        const desired = Math.atan2(target.y - player.y, target.x - player.x);
        const error = turnToward(player, desired, 4.4 * dt);
        if (error < 0.07 && now >= nextShotAt) {
          nextShotAt = now + PATROL_FIRE_EVERY_MS;
          lastShotAt = now;
          stats.shots += 1;
          stats.hits += 1;
          target.health -= PATROL_DAMAGE;
          target.hitFlashUntil = now + 140;
          target.staggerUntil = now + 160;
          target.flinchOffsetRad = (stats.shots % 2 === 0 ? 1 : -1) * 0.05;
          if (target.health <= 0) {
            target.alive = false;
            target.deathBurstUntil = now + 520;
            stats.kills += 1;
          }
        }
      } else {
        autopilot.update(dtMs);
      }

      moveEnemies(player, dt, now);
      stepProjectiles(projectiles, map, dt, now, player);
    }
  };
  return combat;
}

/* -------------------------------------------------------------------------- */
/* Acto 2: pelea contra el jefe 1                                              */
/* -------------------------------------------------------------------------- */

const BOSS_FIGHT_MS = 21_000;
const BOSS_FIRE_EVERY_MS = 640;
const BOSS_ORBIT_RADIUS = 4.4;
const BOSS_LINGER_MS = 2800;

/** Pelea con el jefe del nivel (`level.bossConfig`): termina cuando cae y se ve su derrota unos segundos. */
export function createBossCombat(level: RaycastLevel, nowMs: number, options: AttractCombatOptions = {}): AttractCombat {
  const bossConfig = level.bossConfig;
  if (!bossConfig) throw new Error(`El nivel ${level.id} no tiene jefe.`);
  const fightMs = options.durationMs ?? BOSS_FIGHT_MS;
  const map = cloneRaycastMap(level.map);
  const player: RaycastPlayerState = {
    x: level.playerStart.x,
    y: level.playerStart.y,
    angle: level.playerStart.angle,
    velocity: { x: 0, y: 0 }
  };
  const boss = createRaycastBossState(bossConfig, nowMs, { arenaLevelId: level.id });
  const projectiles: RaycastEnemyProjectile[] = [];
  const stats = { shots: 0, kills: 0, hits: 0 };
  let theta = Math.atan2(player.y - boss.y, player.x - boss.x);
  let nextShotAt = nowMs + 1500;
  let lastShotAt = -10_000;
  let defeatedAt = 0;
  let lastUpdateAt = nowMs;
  // Daño por disparo calculado para que el jefe caiga hacia el final de `fightMs`, pase por sus tres fases y no antes.
  // Solo cuentan los disparos con línea de visión (aprox. dos tercios del tiempo), de ahí el factor.
  const damagePerShot = boss.maxHealth / ((fightMs / BOSS_FIRE_EVERY_MS) * 0.6);

  const combat: AttractCombat = {
    kind: 'boss',
    map,
    player,
    enemies: [],
    projectiles,
    boss,
    weapon: 'SHOTGUN',
    stats,
    get done() {
      return defeatedAt > 0 && lastUpdateAt - defeatedAt > BOSS_LINGER_MS;
    },
    muzzleAlpha(now: number): number {
      return Math.max(0, 1 - (now - lastShotAt) / (MUZZLE_MS * 1.5));
    },
    update(dtMs: number, now: number): void {
      lastUpdateAt = now;
      const dt = Math.min(Math.max(dtMs, 0), MAX_DT_MS) / 1000;
      if (dt === 0) return;

      const ctx = { x: player.x, y: player.y, alive: true, stationaryMs: 0, vx: player.velocity.x, vy: player.velocity.y };
      if (boss.alive) {
        tickRaycastBossMovement(boss, map, ctx, dtMs, now);
        projectiles.push(...tickRaycastBossVolleys(boss, ctx, now, map));
      }

      // Órbita: el bot da vueltas alrededor del jefe a una distancia segura, esquivando sus abanicos.
      // Si un muro tapa al jefe, la órbita avanza más rápido hasta recuperar la vista.
      const visible = hasLineOfSight(map, player.x, player.y, boss.x, boss.y);
      theta += (visible ? 0.3 : 1.1) * dt;
      const wantX = boss.x + Math.cos(theta) * BOSS_ORBIT_RADIUS;
      const wantY = boss.y + Math.sin(theta) * BOSS_ORBIT_RADIUS;
      const dx = wantX - player.x;
      const dy = wantY - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const step = Math.min(dist, 2.6 * dt);
        const nx = player.x + (dx / dist) * step;
        const ny = player.y + (dy / dist) * step;
        if (openAround(map, nx, ny, 0.3)) {
          player.velocity.x = ((nx - player.x) / dt) || 0;
          player.velocity.y = ((ny - player.y) / dt) || 0;
          player.x = nx;
          player.y = ny;
        } else {
          // Un muro estorba la órbita: se sigue la órbita por el otro lado.
          theta += 0.9 * dt;
        }
      }

      const desired = Math.atan2(boss.y - player.y, boss.x - player.x);
      const error = turnToward(player, desired, 5 * dt);
      if (boss.alive && visible && error < 0.09 && now >= nextShotAt) {
        nextShotAt = now + BOSS_FIRE_EVERY_MS;
        lastShotAt = now;
        stats.shots += 1;
        stats.hits += 1;
        const killed = damageRaycastBoss(boss, damagePerShot, now, { fromX: player.x, fromY: player.y, map });
        if (killed) {
          stats.kills += 1;
          defeatedAt = now;
          projectiles.length = 0;
        }
      }
      stepProjectiles(projectiles, map, dt, now, player);
    }
  };
  return combat;
}

/* -------------------------------------------------------------------------- */
/* Guion del fondo: patrulla -> jefe -> patrulla ...                           */
/* -------------------------------------------------------------------------- */

export const ATTRACT_FADE_MS = 450;

/** El guion alterna: después de la patrulla viene el jefe y después del jefe, otra vez la patrulla. */
export function attractActAfter(kind: 'patrol' | 'boss'): 'patrol' | 'boss' {
  return kind === 'patrol' ? 'boss' : 'patrol';
}

/** Opacidad de la cortina negra entre actos: 1 justo al cambiar y 0 cuando termina el fundido. */
export function attractFadeAlpha(msSinceSwitch: number): number {
  if (!(msSinceSwitch >= 0)) return 1;
  return Math.max(0, 1 - msSinceSwitch / ATTRACT_FADE_MS);
}
