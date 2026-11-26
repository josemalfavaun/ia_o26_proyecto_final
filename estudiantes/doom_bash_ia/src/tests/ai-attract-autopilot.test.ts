import { describe, expect, it } from 'vitest';
import { createAttractAutopilot, listAttractGoals } from '../ai/runtime/attractAutopilot';
import {
  RAYCAST_LEVEL_CATALOG,
  RAYCAST_WORLD_THREE_CATALOG,
  RAYCAST_WORLD_TWO_CATALOG,
  cloneRaycastMap
} from '../game/raycast/RaycastLevel';
import { isWallAt } from '../game/raycast/RaycastMap';

const ALL_LEVELS = [...RAYCAST_LEVEL_CATALOG, ...RAYCAST_WORLD_TWO_CATALOG, ...RAYCAST_WORLD_THREE_CATALOG];

describe('piloto automático del fondo del menú', () => {
  it('las posiciones se miden en casillas (tileSize 1), igual que A*', () => {
    for (const level of ALL_LEVELS) {
      expect(cloneRaycastMap(level.map).tileSize).toBe(1);
    }
  });

  it('toda zona candidata cae en una casilla libre y cada nivel tiene al menos dos metas', () => {
    for (const level of ALL_LEVELS) {
      const map = cloneRaycastMap(level.map);
      const goals = listAttractGoals(level, map);
      expect(goals.length, level.id).toBeGreaterThanOrEqual(2);
      for (const goal of goals) {
        expect(isWallAt(map, goal.x, goal.y), `${level.id} ${goal.x},${goal.y}`).toBe(false);
      }
    }
  });

  it('recorre 3 minutos de cada nivel sin entrar nunca a un muro y llega a varias metas', () => {
    for (const level of ALL_LEVELS) {
      const pilot = createAttractAutopilot(level);
      const visited = new Set<string>();
      let moved = 0;
      for (let frame = 0; frame < 3 * 60 * 30; frame += 1) {
        const before = { x: pilot.player.x, y: pilot.player.y };
        pilot.update(1000 / 30);
        expect(isWallAt(pilot.map, pilot.player.x, pilot.player.y), `${level.id} frame ${frame}`).toBe(false);
        moved += Math.hypot(pilot.player.x - before.x, pilot.player.y - before.y);
        visited.add(`${Math.floor(pilot.player.x / 3)},${Math.floor(pilot.player.y / 3)}`);
      }
      expect(moved, level.id).toBeGreaterThan(60);
      expect(visited.size, level.id).toBeGreaterThanOrEqual(3);
      expect(pilot.stats.plans, level.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('es determinista con la misma semilla y las semillas cambian el recorrido', () => {
    const level = RAYCAST_LEVEL_CATALOG[0];
    const run = (seed: number): string => {
      const pilot = createAttractAutopilot(level, { seed });
      for (let i = 0; i < 1800; i += 1) pilot.update(33);
      return `${pilot.player.x.toFixed(3)},${pilot.player.y.toFixed(3)},${pilot.player.angle.toFixed(3)}`;
    };
    expect(run(7)).toBe(run(7));
    const outcomes = new Set([1, 2, 3, 4, 5, 6].map(run));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('con las puertas abiertas recorre buena parte de un nivel grande, no solo la zona de inicio', () => {
    const pilot = createAttractAutopilot(RAYCAST_LEVEL_CATALOG[0]);
    let maxX = 0;
    for (let i = 0; i < 3 * 60 * 30; i += 1) {
      pilot.update(33);
      maxX = Math.max(maxX, pilot.player.x);
    }
    expect(maxX).toBeGreaterThan(12);
  });

  it('ignora saltos de tiempo enormes (pestaña en segundo plano) sin teletransportarse', () => {
    const pilot = createAttractAutopilot(RAYCAST_LEVEL_CATALOG[1]);
    const before = { x: pilot.player.x, y: pilot.player.y };
    pilot.update(60_000);
    expect(Math.hypot(pilot.player.x - before.x, pilot.player.y - before.y)).toBeLessThan(0.5);
  });
});
