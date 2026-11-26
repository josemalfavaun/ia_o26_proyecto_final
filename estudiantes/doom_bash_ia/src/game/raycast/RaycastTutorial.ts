import { getWeaponConfig, WEAPON_ORDER } from '../systems/WeaponConfig';
import type { RaycastLevel } from './RaycastLevel';

export interface TutorialWeapon {
  slot: number;
  name: string;
  note: string;
}

export interface TutorialModel {
  levelName: string;
  /** Qué hay que hacer en el nivel, sacado de los datos reales del nivel. */
  briefing: string[];
  weapons: TutorialWeapon[];
  pistolAmmo: number;
}

const WEAPON_NAMES_ES: Record<string, string> = {
  PISTOL: 'Pistola',
  SHOTGUN: 'Escopeta',
  LAUNCHER: 'Lanzador'
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}

/** Objetivos del nivel en lenguaje llano: se arma con lo que el nivel realmente exige, no con texto fijo. */
export function buildLevelBriefing(level: RaycastLevel): string[] {
  const lines: string[] = [];
  if (level.progression.requireBossDefeated) {
    lines.push('Derrota al jefe de la arena');
    lines.push('Cuando caiga, llega a la extracción');
    return lines;
  }
  if (level.keys.length > 0) {
    lines.push(level.keys.length === 1 ? 'Encuentra la ficha' : `Encuentra ${plural(level.keys.length, 'ficha', 'fichas')}`);
  }
  if (level.doors.length > 0) {
    lines.push(level.doors.length === 1 ? 'Abre la puerta bloqueada' : `Abre ${plural(level.doors.length, 'puerta bloqueada', 'puertas bloqueadas')}`);
  }
  if (level.progression.requiredExitTriggerIds.length > 0) {
    lines.push('Sobrevive las emboscadas del camino');
  }
  if (level.progression.requireCombatClear) {
    lines.push('Elimina a todos los enemigos');
  }
  lines.push('Llega a la salida');
  return lines;
}

export function buildTutorialModel(level: RaycastLevel): TutorialModel {
  const weapons = WEAPON_ORDER.map((kind, index): TutorialWeapon => {
    const cfg = getWeaponConfig(kind, 'raycast');
    const ammo = plural(cfg.ammoCapacity, 'tiro', 'tiros');
    const note =
      cfg.pelletCount > 1 ? `${ammo} · ${cfg.pelletCount} perdigones` : cfg.explosionRadius > 0 ? `${ammo} · daña en área` : `${ammo} · precisa`;
    return { slot: index + 1, name: WEAPON_NAMES_ES[kind] ?? cfg.label, note };
  });
  return {
    levelName: level.name,
    briefing: buildLevelBriefing(level),
    weapons,
    pistolAmmo: getWeaponConfig('PISTOL', 'raycast').ammoCapacity
  };
}
