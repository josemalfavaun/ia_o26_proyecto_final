import { describe, expect, it } from 'vitest';
import { buildLevelBriefing, buildTutorialModel } from '../game/raycast/RaycastTutorial';
import {
  RAYCAST_LEVEL_CATALOG,
  RAYCAST_WORLD_THREE_CATALOG,
  RAYCAST_WORLD_TWO_CATALOG
} from '../game/raycast/RaycastLevel';

const ALL = [...RAYCAST_LEVEL_CATALOG, ...RAYCAST_WORLD_TWO_CATALOG, ...RAYCAST_WORLD_THREE_CATALOG];

describe('tutorial', () => {
  it('el nivel 1 pide ficha, dos puertas, emboscadas y salida (datos reales del nivel)', () => {
    const lines = buildLevelBriefing(RAYCAST_LEVEL_CATALOG[0]);
    expect(lines).toEqual([
      'Encuentra la ficha',
      'Abre 2 puertas bloqueadas',
      'Sobrevive las emboscadas del camino',
      'Llega a la salida'
    ]);
  });

  it('cada nivel tiene un resumen no vacío y los jefes piden derrotarlo', () => {
    for (const level of ALL) {
      const lines = buildLevelBriefing(level);
      expect(lines.length, level.id).toBeGreaterThan(0);
      if (level.progression.requireBossDefeated) expect(lines[0], level.id).toMatch(/jefe/i);
      else expect(lines[lines.length - 1], level.id).toBe('Llega a la salida');
    }
  });

  it('los niveles con combate obligatorio lo piden', () => {
    const level = ALL.find((l) => l.progression.requireCombatClear);
    expect(level).toBeTruthy();
    expect(buildLevelBriefing(level!)).toContain('Elimina a todos los enemigos');
  });

  it('el modelo trae las tres armas en orden con su munición', () => {
    const model = buildTutorialModel(RAYCAST_LEVEL_CATALOG[0]);
    expect(model.weapons.map((w) => w.slot)).toEqual([1, 2, 3]);
    expect(model.weapons.map((w) => w.name)).toEqual(['Pistola', 'Escopeta', 'Lanzador']);
    expect(model.pistolAmmo).toBe(10);
    expect(model.weapons[1].note).toContain('perdigones');
    expect(model.weapons[2].note).toContain('área');
  });
});
