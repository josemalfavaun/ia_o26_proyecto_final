import { RAYCAST_LEVEL_CATALOG, RAYCAST_WORLD_THREE_CATALOG, RAYCAST_WORLD_TWO_CATALOG } from './RaycastLevel';

/**
 * Atajos de demo (menú, pantalla de misión y partida):
 *
 *   4 = nivel 3     5 = nivel 6     6 = nivel 10      (numeración de los 10 niveles normales, sin jefes)
 *   7 = jefe 1      8 = jefe 2      9 = jefe 3
 *   tecla a la derecha del 0 = pantalla final de victoria
 *
 * Las teclas 1, 2 y 3 siguen siendo las armas dentro de la partida.
 */

/** Arenas de jefe, en orden: teclas 7 / 8 / 9. */
export const RAYCAST_BOSS_SHORTCUT_LEVEL_IDS = ['volt-archon-pit', 'bloom-warden-pit', 'ash-judge-seal'] as const;

export type RaycastBossShortcutSlot = 1 | 2 | 3;

export function getRaycastBossLevelId(slot: RaycastBossShortcutSlot): string {
  return RAYCAST_BOSS_SHORTCUT_LEVEL_IDS[slot - 1];
}

/** Los 10 niveles normales (sin arenas de jefe) en el orden de la campaña: mundo 1, 2 y 3. */
export function listRaycastNormalLevelIds(): string[] {
  return [...RAYCAST_LEVEL_CATALOG, ...RAYCAST_WORLD_TWO_CATALOG, ...RAYCAST_WORLD_THREE_CATALOG]
    .filter((level) => !level.bossConfig)
    .map((level) => level.id);
}

/** Nivel normal número `n` (1 a 10) de la campaña. */
export function getRaycastNormalLevelId(n: number): string {
  return listRaycastNormalLevelIds()[n - 1];
}

export type RaycastDemoShortcut =
  | { kind: 'level'; levelId: string; label: string }
  | { kind: 'victory'; label: string };

type DemoKeyEvent = Pick<KeyboardEvent, 'code' | 'key' | 'repeat'> & Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>>;

/** Dígito 4 a 9 que representa la tecla pulsada (fila superior o teclado numérico), o null. */
function demoDigit(event: DemoKeyEvent): number | null {
  const fromCode = /^(?:Digit|Numpad)([4-9])$/.exec(event.code);
  if (fromCode) return Number(fromCode[1]);
  if (!event.code && /^[4-9]$/.test(event.key)) return Number(event.key);
  return null;
}

/** La tecla a la derecha del 0 es `Minus` por posición física, sea cual sea el idioma del teclado. */
function isVictoryKey(event: DemoKeyEvent): boolean {
  return event.code === 'Minus' || event.code === 'NumpadSubtract';
}

export function resolveRaycastDemoShortcut(event: DemoKeyEvent): RaycastDemoShortcut | null {
  if (event.repeat) return null;
  // Cmd+4, Ctrl+5, etc. son atajos del navegador; no los tocamos.
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  if (isVictoryKey(event)) return { kind: 'victory', label: 'Pantalla final' };

  switch (demoDigit(event)) {
    case 4:
      return { kind: 'level', levelId: getRaycastNormalLevelId(3), label: 'Nivel 3' };
    case 5:
      return { kind: 'level', levelId: getRaycastNormalLevelId(6), label: 'Nivel 6' };
    case 6:
      return { kind: 'level', levelId: getRaycastNormalLevelId(10), label: 'Nivel 10' };
    case 7:
      return { kind: 'level', levelId: getRaycastBossLevelId(1), label: 'Jefe 1' };
    case 8:
      return { kind: 'level', levelId: getRaycastBossLevelId(2), label: 'Jefe 2' };
    case 9:
      return { kind: 'level', levelId: getRaycastBossLevelId(3), label: 'Jefe 3' };
    default:
      return null;
  }
}
