import { describe, expect, it } from 'vitest';
import { clearDistance, createBossCombat, createPatrolCombat, hasLineOfSight } from '../ai/runtime/attractCombat';
import { RAYCAST_LEVEL_BOSS, RAYCAST_LEVEL_CATALOG } from '../game/raycast/RaycastLevel';
import { isWallAt } from '../game/raycast/RaycastMap';

function run(combat: ReturnType<typeof createPatrolCombat>, fromMs: number, totalMs: number, stepMs = 50, each?: (now: number) => void): number {
  let now = fromMs;
  for (let t = 0; t < totalMs; t += stepMs) {
    now += stepMs;
    combat.update(stepMs, now);
    each?.(now);
  }
  return now;
}

describe('combate de fondo: patrulla', () => {
  it('el bot encuentra enemigos, dispara y los abate sin salirse del mapa', () => {
    const level = RAYCAST_LEVEL_CATALOG[0];
    const combat = createPatrolCombat(level, 1000);
    let maxAlive = 0;
    run(combat, 1000, 40_000, 50, () => {
      const p = combat.player;
      expect(isWallAt(combat.map, p.x, p.y)).toBe(false);
      for (const e of combat.enemies) expect(isWallAt(combat.map, e.x, e.y)).toBe(false);
      maxAlive = Math.max(maxAlive, combat.enemies.filter((e) => e.alive).length);
    });
    expect(combat.stats.shots).toBeGreaterThan(10);
    expect(combat.stats.kills).toBeGreaterThanOrEqual(3);
    expect(maxAlive).toBeLessThanOrEqual(3);
    expect(combat.weapon).toBe('PISTOL');
    expect(combat.kind).toBe('patrol');
  });

  it('el destello del arma sube al disparar y se apaga solo', () => {
    const combat = createPatrolCombat(RAYCAST_LEVEL_CATALOG[0], 0);
    let flashedAt = -1;
    let now = 0;
    for (let i = 0; i < 1200 && flashedAt < 0; i += 1) {
      now += 50;
      combat.update(50, now);
      if (combat.muzzleAlpha(now) > 0.9) flashedAt = now;
    }
    expect(flashedAt).toBeGreaterThan(0);
    expect(combat.muzzleAlpha(flashedAt + 500)).toBe(0);
  });

  it('termina el acto al cumplirse su duración', () => {
    const combat = createPatrolCombat(RAYCAST_LEVEL_CATALOG[0], 0, { durationMs: 5000 });
    expect(combat.done).toBe(false);
    run(combat, 0, 6000);
    expect(combat.done).toBe(true);
  });

  it('es determinista con la misma semilla', () => {
    const a = createPatrolCombat(RAYCAST_LEVEL_CATALOG[0], 0, { seed: 7 });
    const b = createPatrolCombat(RAYCAST_LEVEL_CATALOG[0], 0, { seed: 7 });
    run(a, 0, 15_000);
    run(b, 0, 15_000);
    expect(a.stats).toEqual(b.stats);
    expect(a.player.x).toBeCloseTo(b.player.x, 9);
  });

  it('ignora pasos de tiempo absurdos', () => {
    const combat = createPatrolCombat(RAYCAST_LEVEL_CATALOG[0], 0);
    combat.update(60_000, 60_000);
    expect(Number.isFinite(combat.player.x)).toBe(true);
    combat.update(0, 60_000);
    combat.update(-5, 60_000);
    expect(Number.isFinite(combat.player.y)).toBe(true);
  });
});

describe('combate de fondo: jefe 1', () => {
  it('pelea contra Volt Archon, pasa por sus fases y lo derrota', () => {
    const combat = createBossCombat(RAYCAST_LEVEL_BOSS, 0);
    expect(combat.kind).toBe('boss');
    expect(combat.boss?.behavior).toBe('volt-archon');
    expect(combat.weapon).toBe('SHOTGUN');
    const phases = new Set<number>();
    let lastHealth = combat.boss!.health;
    let projectilesSeen = 0;
    run(combat, 0, 40_000, 50, () => {
      const boss = combat.boss!;
      phases.add(boss.phase);
      expect(boss.health).toBeLessThanOrEqual(lastHealth);
      lastHealth = boss.health;
      projectilesSeen = Math.max(projectilesSeen, combat.projectiles.length);
      expect(isWallAt(combat.map, combat.player.x, combat.player.y)).toBe(false);
    });
    expect(phases.has(1) && phases.has(2) && phases.has(3)).toBe(true);
    expect(projectilesSeen).toBeGreaterThan(0);
    expect(combat.boss!.alive).toBe(false);
    expect(combat.stats.kills).toBe(1);
    expect(combat.done).toBe(true);
  });

  it('no termina antes de que caiga el jefe', () => {
    const combat = createBossCombat(RAYCAST_LEVEL_BOSS, 0);
    run(combat, 0, 8000);
    expect(combat.boss!.alive).toBe(true);
    expect(combat.done).toBe(false);
  });

  it('cae hacia el final de la pelea, no al principio', () => {
    const combat = createBossCombat(RAYCAST_LEVEL_BOSS, 0, { durationMs: 21_000 });
    run(combat, 0, 12_000);
    expect(combat.boss!.alive).toBe(true);
    run(combat, 12_000, 14_000);
    expect(combat.boss!.alive).toBe(false);
  });

  it('un nivel sin jefe se rechaza', () => {
    expect(() => createBossCombat(RAYCAST_LEVEL_CATALOG[0], 0)).toThrow();
  });
});

describe('ayudas de línea de visión', () => {
  it('clearDistance y hasLineOfSight respetan los muros', () => {
    const level = RAYCAST_LEVEL_BOSS;
    const { x, y } = level.playerStart;
    expect(clearDistance(level.map, x, y, level.playerStart.angle, 0.5)).toBeGreaterThan(0);
    expect(hasLineOfSight(level.map, x, y, x, y)).toBe(true);
    expect(hasLineOfSight(level.map, x, y, -5, -5)).toBe(false);
  });
});
