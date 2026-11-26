/**
 * Sprites de los jefes: cada jefe del juego (por su `id`) usa un conjunto de siete cuadros PNG con el mismo lienzo
 * (520 x 661). Los textos de este archivo son datos puros, sin Phaser, para poder probarlos en vitest.
 *
 *   volt-archon     -> volt_archon_casual  (jefe del nivel 3)
 *   bloom-warden    -> bloom_warden_casual (jefe del nivel 6)
 *   ash-judge       -> ash_judge_santa     (jefe del nivel 10, el principal)
 *   ash-judge-twin  -> ash_judge_astro     (jefe del nivel 10, el gemelo que pelea al mismo tiempo)
 */
export type RaycastBossSpriteState = 'idle' | 'walk1' | 'walk2' | 'telegraph' | 'attack' | 'hurt' | 'death';

export const RAYCAST_BOSS_SPRITE_STATES: readonly RaycastBossSpriteState[] = [
  'idle',
  'walk1',
  'walk2',
  'telegraph',
  'attack',
  'hurt',
  'death'
];

const STATE_FILE: Record<RaycastBossSpriteState, string> = {
  idle: 'idle',
  walk1: 'walk_1',
  walk2: 'walk_2',
  telegraph: 'telegraph',
  attack: 'attack',
  hurt: 'hurt',
  death: 'death'
};

export const RAYCAST_BOSS_SPRITE_SET_BY_BOSS_ID: Readonly<Record<string, string>> = {
  'volt-archon': 'volt_archon_casual',
  'bloom-warden': 'bloom_warden_casual',
  'ash-judge': 'ash_judge_santa',
  'ash-judge-twin': 'ash_judge_astro'
};

export function getRaycastBossSpriteSetId(bossId: string): string | null {
  return RAYCAST_BOSS_SPRITE_SET_BY_BOSS_ID[bossId] ?? null;
}

export function raycastBossTextureKey(setId: string, state: RaycastBossSpriteState): string {
  return `raycast_boss_${setId}_${STATE_FILE[state]}`;
}

export function raycastBossTexturePath(setId: string, state: RaycastBossSpriteState): string {
  return `assets/raycast/bosses/${setId}/${setId}_${STATE_FILE[state]}.png`;
}

/** Todas las imágenes que hay que cargar para dibujar a los jefes. */
export function raycastBossSpriteAssets(): Array<{ key: string; path: string }> {
  const out: Array<{ key: string; path: string }> = [];
  for (const setId of new Set(Object.values(RAYCAST_BOSS_SPRITE_SET_BY_BOSS_ID))) {
    for (const state of RAYCAST_BOSS_SPRITE_STATES) {
      out.push({ key: raycastBossTextureKey(setId, state), path: raycastBossTexturePath(setId, state) });
    }
  }
  return out;
}

/** Qué cuadro toca: muerte, golpe, aviso (carga) y ataque en los últimos 180 ms, caminar o reposo. */
export function selectRaycastBossSpriteState(
  boss: { alive: boolean; hitFlashUntil: number; telegraphUntil: number },
  time: number,
  moved: boolean
): RaycastBossSpriteState {
  if (!boss.alive) return 'death';
  if (time < boss.hitFlashUntil) return 'hurt';
  const telegraphRemaining = boss.telegraphUntil - time;
  if (telegraphRemaining > 0 && telegraphRemaining <= 180) return 'attack';
  if (telegraphRemaining > 0) return 'telegraph';
  if (moved) return Math.floor(time / 180) % 2 === 0 ? 'walk1' : 'walk2';
  return 'idle';
}
