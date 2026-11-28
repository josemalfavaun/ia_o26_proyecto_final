/**
 * Piezas que comparten las dos búsquedas del jefe (expectimax y MCTS), para que se comparen sobre el
 * mismo problema: el mismo modelo del jugador, el mismo objetivo y el mismo conteo del ritmo.
 */
import type { RaycastBossPlayerContext } from '../../game/raycast/RaycastBossAI';
import type { RaycastBossState } from '../../game/raycast/RaycastBoss';
import { classifyPlayerMotion, PLAYER_RESPONSES, type DuelState, type PlayerResponse } from './model';

export type BossObjective = 'damage' | 'pacing';

/** Probabilidad a priori de cada maniobra del jugador. */
export const RESPONSE_PRIOR: Record<PlayerResponse, number> = { stand: 0.06, left: 0.28, right: 0.28, toward: 0.17, away: 0.21 };
/** Peso de "sigue haciendo lo mismo que ya hace". */
export const PERSIST_MASS = 0.5;
/** El déficit acumulado se acota para que una mala racha no domine el resto del combate. */
export const DEFICIT_LIMIT = 100;

/** P(r | s) por persistencia: si el jugador ya se mueve así, lo más probable es que siga igual. */
export function persistenceProbabilities(state: DuelState): Record<PlayerResponse, number> {
  const current = classifyPlayerMotion(state);
  const mixed = {} as Record<PlayerResponse, number>;
  let total = 0;
  for (const response of PLAYER_RESPONSES) {
    const persistence = response === current ? PERSIST_MASS : 0;
    mixed[response] = persistence + (1 - PERSIST_MASS) * RESPONSE_PRIOR[response];
    total += mixed[response];
  }
  for (const response of PLAYER_RESPONSES) mixed[response] /= total;
  return mixed;
}

/**
 * Puntaje de una salva: más alto es mejor. 'damage' suma el daño; 'pacing' castiga la desviación cuadrática
 * del déficit acumulado respecto a la meta por salva.
 */
export function scoreStep(
  objective: BossObjective,
  target: number,
  deficit: number,
  damage: number
): { score: number; nextDeficit: number } {
  if (objective === 'damage') return { score: damage, nextDeficit: 0 };
  const nextDeficit = Math.max(-DEFICIT_LIMIT, Math.min(DEFICIT_LIMIT, deficit + target - damage));
  return { score: -(nextDeficit * nextDeficit), nextDeficit };
}

/** Lleva el déficit de ritmo de cada jefe con el daño que el jugador recibió desde la decisión anterior. */
export function createDeficitTracker(objective: BossObjective, target: number) {
  const damageSeen = new Map<string, number>();
  const lastHealth = new Map<string, number>();
  const deficits = new Map<string, number>();
  return {
    update(boss: RaycastBossState, player: RaycastBossPlayerContext): number {
      if (objective !== 'pacing') return 0;
      const id = boss.id;
      const known = deficits.get(id);
      let received = 0;
      if (player.damageTaken !== undefined) {
        received = Math.max(0, player.damageTaken - (damageSeen.get(id) ?? player.damageTaken));
        damageSeen.set(id, player.damageTaken);
      } else if (player.health !== undefined) {
        received = Math.max(0, (lastHealth.get(id) ?? player.health) - player.health);
        lastHealth.set(id, player.health);
      }
      // La primera decisión no tiene salva previa que contar.
      const next = known === undefined ? 0 : Math.max(-DEFICIT_LIMIT, Math.min(DEFICIT_LIMIT, known + target - received));
      deficits.set(id, next);
      return next;
    }
  };
}
