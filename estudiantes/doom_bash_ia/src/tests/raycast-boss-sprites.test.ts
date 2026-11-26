import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getRaycastBossSpriteSetId,
  RAYCAST_BOSS_SPRITE_SET_BY_BOSS_ID,
  RAYCAST_BOSS_SPRITE_STATES,
  raycastBossSpriteAssets,
  raycastBossTextureKey,
  selectRaycastBossSpriteState
} from '../game/raycast/raycastBossSprites';
import { RAYCAST_LEVEL_WORLD3_ASH_JUDGE } from '../game/raycast/RaycastWorldThreeLevels';
import { RAYCAST_LEVEL_BOSS } from '../game/raycast/RaycastLevel';

const alive = { alive: true, hitFlashUntil: 0, telegraphUntil: 0 };

describe('sprites de los jefes', () => {
  it('cada jefe del juego tiene su conjunto, y el gemelo del nivel 10 tiene uno distinto al principal', () => {
    expect(getRaycastBossSpriteSetId('volt-archon')).toBe('volt_archon_casual');
    expect(getRaycastBossSpriteSetId('bloom-warden')).toBe('bloom_warden_casual');
    expect(getRaycastBossSpriteSetId('ash-judge')).toBe('ash_judge_santa');
    expect(getRaycastBossSpriteSetId('ash-judge-twin')).toBe('ash_judge_astro');
    expect(getRaycastBossSpriteSetId('desconocido')).toBeNull();
    expect(new Set(Object.values(RAYCAST_BOSS_SPRITE_SET_BY_BOSS_ID)).size).toBe(4);
  });

  it('los ids de los niveles de jefe coinciden con los del mapa de sprites', () => {
    expect(getRaycastBossSpriteSetId(RAYCAST_LEVEL_BOSS.bossConfig!.id)).not.toBeNull();
    expect(getRaycastBossSpriteSetId(RAYCAST_LEVEL_WORLD3_ASH_JUDGE.bossConfig!.id)).toBe('ash_judge_santa');
  });

  it('lista 4 conjuntos x 7 cuadros con llaves únicas y los archivos existen con lienzo de 520 x 661', () => {
    const assets = raycastBossSpriteAssets();
    expect(assets).toHaveLength(4 * RAYCAST_BOSS_SPRITE_STATES.length);
    expect(new Set(assets.map((a) => a.key)).size).toBe(assets.length);
    for (const asset of assets) {
      const file = resolve(__dirname, '../../public', asset.path);
      expect(existsSync(file), asset.path).toBe(true);
      const buf = readFileSync(file);
      // Cabecera PNG: ancho y alto en los bytes 16-23.
      expect(buf.readUInt32BE(16), asset.path).toBe(520);
      expect(buf.readUInt32BE(20), asset.path).toBe(661);
    }
  });

  it('elige el cuadro correcto según el estado del jefe', () => {
    expect(selectRaycastBossSpriteState(alive, 1000, false)).toBe('idle');
    expect(['walk1', 'walk2']).toContain(selectRaycastBossSpriteState(alive, 1000, true));
    expect(selectRaycastBossSpriteState({ ...alive, hitFlashUntil: 1200 }, 1000, true)).toBe('hurt');
    expect(selectRaycastBossSpriteState({ ...alive, telegraphUntil: 1600 }, 1000, false)).toBe('telegraph');
    expect(selectRaycastBossSpriteState({ ...alive, telegraphUntil: 1100 }, 1000, false)).toBe('attack');
    expect(selectRaycastBossSpriteState({ alive: false, hitFlashUntil: 0, telegraphUntil: 0 }, 1000, false)).toBe('death');
    expect(raycastBossTextureKey('ash_judge_santa', 'walk1')).toBe('raycast_boss_ash_judge_santa_walk_1');
  });

  it('al caminar alterna dos cuadros distintos con el tiempo', () => {
    const a = selectRaycastBossSpriteState(alive, 0, true);
    const b = selectRaycastBossSpriteState(alive, 200, true);
    expect(a).not.toBe(b);
  });
});
