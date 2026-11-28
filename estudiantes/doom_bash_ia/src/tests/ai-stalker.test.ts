import { describe, expect, it } from 'vitest';
import { createAiRuntime } from '../ai/runtime/AiRuntime';
import { createSeededRng } from '../ai/sim/rng';
import { runArenaEpisode } from '../ai/stalker/arena';
import {
  concentrate,
  createBelief,
  densestCell,
  isOpenCell,
  observeEmpty,
  predict,
  scatterUniform
} from '../ai/stalker/belief';
import { createStalkerBrain, type StalkerObservation } from '../ai/stalker/brain';
import { createStalkerManager } from '../ai/stalker/manager';
import { createRaycastEnemy } from '../game/raycast/RaycastEnemy';
import { updateRaycastEnemies } from '../game/raycast/RaycastEnemySystem';
import type { RaycastMap } from '../game/raycast/RaycastMap';

/** Dos cuartos separados por una pared con una puerta abajo: el cuarto oeste no ve el este. */
const ROOMS: RaycastMap = {
  tileSize: 1,
  grid: [
    '###########',
    '#....#....#',
    '#....#....#',
    '#....#....#',
    '#.........#',
    '###########'
  ].map((row) => Array.from(row, (ch) => (ch === '#' ? 1 : 0)))
};

function obs(overrides: Partial<StalkerObservation>): StalkerObservation {
  return {
    map: ROOMS,
    timeMs: 0,
    deltaMs: 100,
    stalkerX: 2.5,
    stalkerY: 2.5,
    playerX: 8.5,
    playerY: 2.5,
    sees: false,
    playerFired: false,
    ...overrides
  };
}

describe('creencia con filtro de partículas', () => {
  it('ver una zona vacía descarta sus partículas y las pasa a lo que no se ve', () => {
    const rng = createSeededRng(3);
    const belief = createBelief(200);
    scatterUniform(belief, ROOMS, rng);
    // El observador en el cuarto oeste: después de observar, ninguna partícula queda en ese cuarto (filas 1-3).
    observeEmpty(belief, ROOMS, 2.5, 2.5, 20, rng);
    for (let i = 0; i < belief.size; i += 1) {
      const inWestRoom = belief.xs[i] < 5 && belief.ys[i] < 4;
      expect(inWestRoom).toBe(false);
      expect(isOpenCell(ROOMS, Math.floor(belief.xs[i]), Math.floor(belief.ys[i]))).toBe(true);
    }
  });

  it('concentrar en un punto mueve la celda más densa ahí; predecir la dispersa sin atravesar paredes', () => {
    const rng = createSeededRng(5);
    const belief = createBelief(150);
    scatterUniform(belief, ROOMS, rng);
    concentrate(belief, ROOMS, 8.5, 2.5, 0.4, 1, rng);
    const peak = densestCell(belief);
    expect(Math.hypot(peak.x - 8.5, peak.y - 2.5)).toBeLessThan(1.5);
    for (let k = 0; k < 20; k += 1) predict(belief, ROOMS, 0.2, 2.5, rng);
    for (let i = 0; i < belief.size; i += 1) {
      expect(isOpenCell(ROOMS, Math.floor(belief.xs[i]), Math.floor(belief.ys[i]))).toBe(true);
    }
    expect(densestCell(belief).share).toBeLessThan(1);
  });
});

describe('cerebro del acechador', () => {
  it("'regla' va a la posición REAL del jugador durante 4.2 s y luego deja de saber", () => {
    const brain = createStalkerBrain('regla', 1);
    brain.update(obs({ timeMs: 0, sees: true, playerX: 3.5, playerY: 2.5 }));
    brain.update(obs({ timeMs: 1000, sees: false, playerX: 8.5, playerY: 4.5 }));
    expect(brain.goal(2.5, 2.5)).toEqual({ x: 8.5, y: 4.5, ignorePlayer: false });
    brain.update(obs({ timeMs: 5000, sees: false }));
    expect(brain.goal(2.5, 2.5)).toBeNull();
  });

  it("'ultima' va a donde lo vio por última vez y, al llegar, vuelve a patrullar", () => {
    const brain = createStalkerBrain('ultima', 1);
    brain.update(obs({ timeMs: 0, sees: true, playerX: 4.5, playerY: 4.5 }));
    brain.update(obs({ timeMs: 100, sees: false, playerX: 9.5, playerY: 1.5 }));
    expect(brain.goal(2.5, 2.5)).toMatchObject({ x: 4.5, y: 4.5 });
    brain.update(obs({ timeMs: 200, sees: false, stalkerX: 4.5, stalkerY: 4.5 }));
    expect(brain.goal(4.5, 4.5)).toBeNull();
  });

  it("'particulas' busca en lo que no ha visto: con el jugador escondido al este, la meta queda fuera del cuarto oeste", () => {
    const brain = createStalkerBrain('particulas', 2);
    for (let t = 0; t <= 2000; t += 100) brain.update(obs({ timeMs: t }));
    const goal = brain.goal(2.5, 2.5)!;
    expect(goal).not.toBeNull();
    expect(goal.x >= 5 || goal.y >= 4).toBe(true);
  });

  it("el director sube la amenaza al ver al jugador, se retira al tope (aunque lo vea) y vuelve al bajar", () => {
    const brain = createStalkerBrain('director', 4, { retreatDistance: 4 });
    let t = 0;
    while (brain.phase === 'acecho' && t < 20_000) {
      brain.update(obs({ timeMs: t, sees: true, playerX: 3.5, playerY: 2.5 }));
      t += 100;
    }
    expect(brain.phase).toBe('retirada');
    expect(brain.stats.retreats).toBe(1);
    const goal = brain.goal(2.5, 2.5)!;
    expect(goal.ignorePlayer).toBe(true);
    expect(Math.hypot(goal.x - 3.5, goal.y - 2.5)).toBeGreaterThanOrEqual(4);
    // Lejos y sin verlo, la amenaza baja hasta el alivio y vuelve a acechar.
    for (let k = 0; k < 400 && brain.phase === 'retirada'; k += 1) {
      brain.update(obs({ timeMs: t, sees: false, stalkerX: 1.5, stalkerY: 1.5, playerX: 9.5, playerY: 3.5 }));
      t += 100;
    }
    expect(brain.phase).toBe('acecho');
    expect(brain.menace).toBeLessThanOrEqual(0.3);
  });

  it('el director da pistas cuando lleva rato sin contacto', () => {
    const brain = createStalkerBrain('director', 6);
    for (let t = 0; t <= 13_000; t += 100) brain.update(obs({ timeMs: t }));
    expect(brain.stats.hints).toBeGreaterThanOrEqual(2);
  });
});

describe('arena de escondidas', () => {
  it('es determinista y sus medidas están en rango', () => {
    const a = runArenaEpisode({ levelId: 'access-node', seed: 7, mode: 'director', durationMs: 20_000 });
    const b = runArenaEpisode({ levelId: 'access-node', seed: 7, mode: 'director', durationMs: 20_000 });
    expect(a).toEqual(b);
    expect(a.contactFraction).toBeGreaterThanOrEqual(0);
    expect(a.contactFraction).toBeLessThanOrEqual(1);
    expect(a.menaceHighFraction).toBeLessThanOrEqual(1);
  });
});

describe('acechador en el juego', () => {
  it('sin searchGoal el sistema de enemigos se comporta igual; con meta de búsqueda el STALKER va hacia ella', () => {
    const plain = createRaycastEnemy({ id: 's', kind: 'STALKER', x: 1.5, y: 1.5 });
    const guided = createRaycastEnemy({ id: 's', kind: 'STALKER', x: 1.5, y: 1.5 });
    const player = { x: 9.5, y: 1.5, alive: true }; // al otro lado de la pared: no lo ve
    let t = 1000;
    for (let k = 0; k < 30; k += 1) {
      updateRaycastEnemies(ROOMS, [plain], player, t, 50);
      updateRaycastEnemies(ROOMS, [guided], player, t, 50, { searchGoal: () => ({ x: 1.5, y: 4.5 }) });
      t += 50;
    }
    expect(guided.y).toBeGreaterThan(2.4);
    expect(Math.hypot(guided.x - 1.5, guided.y - 4.5)).toBeLessThan(Math.hypot(plain.x - 1.5, plain.y - 4.5));
  });

  it('en retirada (ignorePlayer) el STALKER no ataca aunque tenga al jugador al lado', () => {
    const enemy = createRaycastEnemy({ id: 's2', kind: 'STALKER', x: 2.5, y: 2.5 });
    let damage = 0;
    let t = 1000;
    for (let k = 0; k < 40; k += 1) {
      damage += updateRaycastEnemies(ROOMS, [enemy], { x: 2.8, y: 2.5, alive: true }, t, 50, {
        searchGoal: () => ({ x: 1.5, y: 4.5, ignorePlayer: true, speedFactor: 1 })
      }).meleeDamage;
      t += 50;
    }
    expect(damage).toBe(0);
  });

  it('el administrador crea un cerebro por STALKER vivo y devuelve metas solo para ellos', () => {
    const manager = createStalkerManager(1);
    const stalker = createRaycastEnemy({ id: 'st', kind: 'STALKER', x: 2.5, y: 2.5 });
    const grunt = createRaycastEnemy({ id: 'gr', kind: 'GRUNT', x: 3.5, y: 3.5 });
    for (let t = 0; t <= 1000; t += 100) {
      manager.tick({ map: ROOMS, enemies: [stalker, grunt], player: { x: 8.5, y: 2.5, alive: true }, timeMs: t, deltaMs: 100, playerFired: false });
    }
    expect(manager.views().map((v) => v.enemyId)).toEqual(['st']);
    expect(manager.searchGoal(grunt, 1000)).toBeNull();
    expect(manager.searchGoal(stalker, 1000)).not.toBeNull();
    stalker.alive = false;
    manager.tick({ map: ROOMS, enemies: [stalker, grunt], player: { x: 8.5, y: 2.5, alive: true }, timeMs: 1100, deltaMs: 100, playerFired: false });
    expect(manager.views()).toEqual([]);
  });

  it('el runtime rota regla → A* → acechador y solo entonces expone los acechadores', () => {
    const runtime = createAiRuntime({ seed: 1 });
    expect(runtime.stalkers()).toBeUndefined();
    expect(runtime.cycleNavigation()).toBe('astar');
    expect(runtime.stalkers()).toBeUndefined();
    expect(runtime.cycleNavigation()).toBe('acechador');
    expect(runtime.stalkers()).toBeDefined();
    expect(runtime.navigator()).toBeDefined();
    const lines = runtime.panelLines({ nowMs: 0, bossAlive: false, playerAlive: true, health: 100, maxHealth: 100 }).join('\n');
    expect(lines).toContain('acechador');
    expect(runtime.cycleNavigation()).toBe('legacy');
    expect(createAiRuntime({ seed: 1, query: '?ia=acechador' }).navigationMode).toBe('acechador');
  });
});
