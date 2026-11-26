import { describe, expect, it } from 'vitest';
import {
  getRaycastBossLevelId,
  getRaycastNormalLevelId,
  listRaycastNormalLevelIds,
  RAYCAST_BOSS_SHORTCUT_LEVEL_IDS,
  resolveRaycastDemoShortcut
} from '../game/raycast/RaycastBossShortcuts';
import {
  RAYCAST_LEVEL_CATALOG,
  RAYCAST_WORLD_THREE_CATALOG,
  RAYCAST_WORLD_TWO_CATALOG
} from '../game/raycast/RaycastLevel';

const key = (code: string, extra: Record<string, unknown> = {}) => ({ code, key: '', repeat: false, ...extra });

describe('atajos de demo', () => {
  it('los 3 jefes quedan en orden estable', () => {
    expect(getRaycastBossLevelId(1)).toBe(RAYCAST_BOSS_SHORTCUT_LEVEL_IDS[0]);
    expect(getRaycastBossLevelId(2)).toBe(RAYCAST_BOSS_SHORTCUT_LEVEL_IDS[1]);
    expect(getRaycastBossLevelId(3)).toBe(RAYCAST_BOSS_SHORTCUT_LEVEL_IDS[2]);
    expect(RAYCAST_BOSS_SHORTCUT_LEVEL_IDS).toEqual(['volt-archon-pit', 'bloom-warden-pit', 'ash-judge-seal']);
  });

  it('hay 10 niveles normales y los 3 jefes son niveles de la campaña con jefe', () => {
    expect(listRaycastNormalLevelIds()).toHaveLength(10);
    const all = [...RAYCAST_LEVEL_CATALOG, ...RAYCAST_WORLD_TWO_CATALOG, ...RAYCAST_WORLD_THREE_CATALOG];
    for (const id of RAYCAST_BOSS_SHORTCUT_LEVEL_IDS) {
      expect(all.find((level) => level.id === id)?.bossConfig, id).toBeTruthy();
    }
  });

  it('numera los niveles normales en orden de campaña', () => {
    expect(listRaycastNormalLevelIds()).toEqual([
      'access-node',
      'glass-cistern',
      'relay-catacomb',
      'shard-vault',
      'relay-heart',
      'rift-fracture',
      'signal-threshold',
      'sulfur-lattice',
      'meridian-ember-ramp',
      'meridian-gate-cut'
    ]);
    expect(getRaycastNormalLevelId(3)).toBe('relay-catacomb');
    expect(getRaycastNormalLevelId(6)).toBe('rift-fracture');
    expect(getRaycastNormalLevelId(10)).toBe('meridian-gate-cut');
  });

  it('4, 5 y 6 saltan a los niveles 3, 6 y 10; 7, 8 y 9 a los jefes', () => {
    expect(resolveRaycastDemoShortcut(key('Digit4'))).toEqual({ kind: 'level', levelId: 'relay-catacomb', label: 'Nivel 3' });
    expect(resolveRaycastDemoShortcut(key('Digit5'))).toEqual({ kind: 'level', levelId: 'rift-fracture', label: 'Nivel 6' });
    expect(resolveRaycastDemoShortcut(key('Digit6'))).toEqual({ kind: 'level', levelId: 'meridian-gate-cut', label: 'Nivel 10' });
    expect(resolveRaycastDemoShortcut(key('Digit7'))).toEqual({ kind: 'level', levelId: 'volt-archon-pit', label: 'Jefe 1' });
    expect(resolveRaycastDemoShortcut(key('Digit8'))).toEqual({ kind: 'level', levelId: 'bloom-warden-pit', label: 'Jefe 2' });
    expect(resolveRaycastDemoShortcut(key('Digit9'))).toEqual({ kind: 'level', levelId: 'ash-judge-seal', label: 'Jefe 3' });
  });

  it('el teclado numérico hace lo mismo', () => {
    expect(resolveRaycastDemoShortcut(key('Numpad4'))).toMatchObject({ levelId: 'relay-catacomb' });
    expect(resolveRaycastDemoShortcut(key('Numpad9'))).toMatchObject({ levelId: 'ash-judge-seal' });
  });

  it('la tecla a la derecha del 0 (Minus por posición) abre la pantalla final', () => {
    expect(resolveRaycastDemoShortcut(key('Minus'))).toEqual({ kind: 'victory', label: 'Pantalla final' });
    expect(resolveRaycastDemoShortcut(key('NumpadSubtract'))).toEqual({ kind: 'victory', label: 'Pantalla final' });
  });

  it('1, 2, 3 (armas), 0 y letras no disparan atajos', () => {
    for (const code of ['Digit1', 'Digit2', 'Digit3', 'Digit0', 'KeyA', 'Equal']) {
      expect(resolveRaycastDemoShortcut(key(code)), code).toBeNull();
    }
  });

  it('ignora repeticiones y combinaciones del navegador (Cmd/Ctrl/Alt)', () => {
    expect(resolveRaycastDemoShortcut(key('Digit4', { repeat: true }))).toBeNull();
    expect(resolveRaycastDemoShortcut(key('Digit4', { metaKey: true }))).toBeNull();
    expect(resolveRaycastDemoShortcut(key('Digit5', { ctrlKey: true }))).toBeNull();
    expect(resolveRaycastDemoShortcut(key('Minus', { altKey: true }))).toBeNull();
  });

  it('si el evento no trae code (sintético), usa key para los dígitos 4 a 9', () => {
    expect(resolveRaycastDemoShortcut({ code: '', key: '7', repeat: false })).toMatchObject({ levelId: 'volt-archon-pit' });
    expect(resolveRaycastDemoShortcut({ code: '', key: '1', repeat: false })).toBeNull();
  });
});
