/**
 * Acechador estilo Alien: Isolation. Dos IA, como en el juego de Creative Assembly:
 *
 *  - Director (macro): siempre sabe dónde está el jugador y lleva un MEDIDOR DE AMENAZA. Sube cuando el
 *    acechador ve al jugador o anda cerca; baja cuando está lejos. Si el medidor llega al tope, el director
 *    lo RETIRA a una zona lejana hasta que la amenaza baje (alivio). Mientras tanto, si el acechador lleva rato
 *    sin contacto, le da una PISTA de la zona aproximada del jugador (con ruido, nunca la posición exacta).
 *  - Acechador (micro): no hace trampa. Solo sabe lo que ve (alcance y línea de vista) y lo que oye (disparos).
 *    Cuando pierde al jugador lo busca con una creencia de filtro de partículas (`belief.ts`) y va a la celda
 *    con más creencia.
 *
 * El mismo código tiene cuatro modos para poder compararlos con las mismas semillas:
 *  - 'regla': lo que hace el juego base. Al perder de vista al jugador, durante 4.2 s va a la posición REAL
 *    del jugador (el juego actualiza la "última posición conocida" con la verdadera mientras dura la memoria).
 *  - 'ultima': va a la última posición donde lo vio, sin trampa; al llegar, patrulla.
 *  - 'particulas': filtro de partículas, sin director.
 *  - 'director': filtro de partículas más director (pistas y retiradas).
 * El medidor de amenaza se calcula en los cuatro modos (para medir), pero solo actúa en 'director'.
 */
import type { RaycastMap } from '../../game/raycast/RaycastMap';
import { createSeededRng, type Rng } from '../sim/rng';
import {
  concentrate,
  createBelief,
  densestCell,
  isOpenCell,
  observeEmpty,
  openCells,
  predict,
  scatterUniform,
  type ParticleBelief
} from './belief';

export type StalkerMode = 'regla' | 'ultima' | 'particulas' | 'director';
export const STALKER_MODES: readonly StalkerMode[] = ['regla', 'ultima', 'particulas', 'director'];

export type StalkerPhase = 'acecho' | 'retirada';

export interface StalkerParams {
  /** Alcance de vista en celdas (el `detectionRange` del STALKER en el juego es 10.5). */
  visionRange: number;
  /** Radio en celdas en el que oye un disparo. */
  hearingRange: number;
  /** Velocidad que el filtro supone para el jugador (celdas/s). */
  assumedPlayerSpeed: number;
  particles: number;
  /** Cada cuánto se corre predicción + observación (ms). */
  filterIntervalMs: number;
  /** Memoria de la regla original (ms). */
  ruleMemoryMs: number;
  /** Medidor de amenaza, por segundo: sube viendo, sube cerca, baja lejos. */
  menaceSeeRate: number;
  menaceNearRate: number;
  menaceNearRange: number;
  menaceDecayRate: number;
  /** Cuánto sube la amenaza cuando el acechador alcanza al jugador. */
  menaceAttackBump: number;
  /** La retirada termina cuando la amenaza baja a este nivel. */
  menaceRelief: number;
  /** Sin contacto durante este tiempo, el director da una pista (ms). */
  hintAfterMs: number;
  /** Ruido de la pista, en celdas (± uniforme). */
  hintNoise: number;
  /** Distancia mínima del punto de retirada al jugador (celdas). */
  retreatDistance: number;
}

export const DEFAULT_STALKER_PARAMS: StalkerParams = {
  visionRange: 10.5,
  hearingRange: 14,
  assumedPlayerSpeed: 2.5,
  particles: 300,
  filterIntervalMs: 200,
  ruleMemoryMs: 4200,
  menaceSeeRate: 0.22,
  menaceNearRate: 0.05,
  menaceNearRange: 5,
  menaceDecayRate: 0.06,
  menaceAttackBump: 0.35,
  menaceRelief: 0.3,
  hintAfterMs: 6000,
  hintNoise: 2.5,
  retreatDistance: 10
};

export interface StalkerObservation {
  map: RaycastMap;
  timeMs: number;
  deltaMs: number;
  stalkerX: number;
  stalkerY: number;
  /** Posición real del jugador. Solo la usan la regla original (memoria con trampa) y el director. */
  playerX: number;
  playerY: number;
  /** El acechador ve al jugador en este instante (alcance y línea de vista). */
  sees: boolean;
  /** Hubo un disparo del jugador en este paso. */
  playerFired: boolean;
}

export interface StalkerGoal {
  x: number;
  y: number;
  /** Retirada del director: el acechador se aleja aunque vea al jugador. */
  ignorePlayer: boolean;
}

export interface StalkerBrain {
  readonly mode: StalkerMode;
  readonly belief: ParticleBelief | null;
  readonly menace: number;
  readonly phase: StalkerPhase;
  readonly stats: { hints: number; retreats: number; heardShots: number };
  update(obs: StalkerObservation): void;
  /** El acechador alcanzó al jugador (ataque cuerpo a cuerpo): la amenaza sube de golpe. */
  notifyAttack(): void;
  /** A dónde ir cuando NO ve al jugador (o durante una retirada); null = patrullar como siempre. */
  goal(stalkerX: number, stalkerY: number): StalkerGoal | null;
}

export function createStalkerBrain(
  mode: StalkerMode,
  seed: number,
  params: Partial<StalkerParams> = {}
): StalkerBrain {
  const p: StalkerParams = { ...DEFAULT_STALKER_PARAMS, ...params };
  const rng: Rng = createSeededRng(((seed >>> 0) ^ 0x41c3e7a1) >>> 0);
  const usesParticles = mode === 'particulas' || mode === 'director';
  const belief = usesParticles ? createBelief(p.particles) : null;
  let initialized = false;
  let filterClockMs = 0;
  let menace = 0;
  let phase: StalkerPhase = 'acecho';
  let retreatPoint: { x: number; y: number } | null = null;
  let lastSeenAt = -Infinity;
  let lastSeenX = 0;
  let lastSeenY = 0;
  let lastHintAt = -Infinity;
  let reachedLastSeen = true;
  let truePlayer = { x: 0, y: 0 };
  let now = 0;
  const stats = { hints: 0, retreats: 0, heardShots: 0 };

  function pickRetreatPoint(map: RaycastMap, px: number, py: number): { x: number; y: number } {
    const cells = openCells(map);
    let best: [number, number] = cells[0];
    let bestDistance = -1;
    for (let k = 0; k < 40; k += 1) {
      const cell = cells[Math.floor(rng() * cells.length)];
      const d = Math.hypot(cell[0] + 0.5 - px, cell[1] + 0.5 - py);
      if (d >= p.retreatDistance) return { x: cell[0] + 0.5, y: cell[1] + 0.5 };
      if (d > bestDistance) {
        bestDistance = d;
        best = cell;
      }
    }
    return { x: best[0] + 0.5, y: best[1] + 0.5 };
  }

  return {
    mode,
    belief,
    get menace() {
      return menace;
    },
    get phase() {
      return phase;
    },
    stats,
    notifyAttack() {
      menace = Math.min(1, menace + p.menaceAttackBump);
    },
    update(obs) {
      // La primera pista del director llega después de `hintAfterMs` sin contacto, no en el primer instante.
      if (!Number.isFinite(lastHintAt)) lastHintAt = obs.timeMs;
      now = obs.timeMs;
      truePlayer = { x: obs.playerX, y: obs.playerY };
      const dt = obs.deltaMs / 1000;
      const distance = Math.hypot(obs.playerX - obs.stalkerX, obs.playerY - obs.stalkerY);

      // Medidor de amenaza (se mide en todos los modos).
      if (obs.sees) menace += p.menaceSeeRate * dt;
      else if (distance < p.menaceNearRange) menace += p.menaceNearRate * dt;
      else menace -= p.menaceDecayRate * dt;
      menace = Math.max(0, Math.min(1, menace));

      if (obs.sees) {
        lastSeenAt = obs.timeMs;
        lastSeenX = obs.playerX;
        lastSeenY = obs.playerY;
        reachedLastSeen = false;
      } else if (!reachedLastSeen && Math.hypot(lastSeenX - obs.stalkerX, lastSeenY - obs.stalkerY) < 0.6) {
        reachedLastSeen = true;
      }

      if (mode === 'director') {
        if (phase === 'acecho' && menace >= 1) {
          phase = 'retirada';
          stats.retreats += 1;
          retreatPoint = pickRetreatPoint(obs.map, obs.playerX, obs.playerY);
        } else if (phase === 'retirada' && menace <= p.menaceRelief) {
          phase = 'acecho';
          retreatPoint = null;
        }
        if (
          phase === 'retirada' &&
          retreatPoint &&
          Math.hypot(retreatPoint.x - obs.stalkerX, retreatPoint.y - obs.stalkerY) < 0.8
        ) {
          retreatPoint = pickRetreatPoint(obs.map, obs.playerX, obs.playerY);
        }
      }

      if (!belief) return;
      if (!initialized) {
        scatterUniform(belief, obs.map, rng);
        initialized = true;
      }
      if (obs.sees) {
        concentrate(belief, obs.map, obs.playerX, obs.playerY, 0.4, 1, rng);
        filterClockMs = 0;
        return;
      }
      if (obs.playerFired && distance <= p.hearingRange) {
        stats.heardShots += 1;
        concentrate(belief, obs.map, obs.playerX, obs.playerY, 1.5, 0.6, rng);
      }
      if (
        mode === 'director' &&
        phase === 'acecho' &&
        obs.timeMs - lastSeenAt >= p.hintAfterMs &&
        obs.timeMs - lastHintAt >= p.hintAfterMs
      ) {
        lastHintAt = obs.timeMs;
        stats.hints += 1;
        let hx = obs.playerX;
        let hy = obs.playerY;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const cx = obs.playerX + (rng() * 2 - 1) * p.hintNoise;
          const cy = obs.playerY + (rng() * 2 - 1) * p.hintNoise;
          if (isOpenCell(obs.map, Math.floor(cx), Math.floor(cy))) {
            hx = cx;
            hy = cy;
            break;
          }
        }
        concentrate(belief, obs.map, hx, hy, p.hintNoise, 0.5, rng);
      }
      filterClockMs += obs.deltaMs;
      if (filterClockMs >= p.filterIntervalMs) {
        predict(belief, obs.map, filterClockMs / 1000, p.assumedPlayerSpeed, rng);
        observeEmpty(belief, obs.map, obs.stalkerX, obs.stalkerY, p.visionRange, rng);
        filterClockMs = 0;
      }
    },
    goal(stalkerX, stalkerY) {
      if (mode === 'director' && phase === 'retirada' && retreatPoint) {
        return { x: retreatPoint.x, y: retreatPoint.y, ignorePlayer: true };
      }
      switch (mode) {
        case 'regla':
          return now - lastSeenAt <= p.ruleMemoryMs ? { x: truePlayer.x, y: truePlayer.y, ignorePlayer: false } : null;
        case 'ultima':
          return reachedLastSeen ? null : { x: lastSeenX, y: lastSeenY, ignorePlayer: false };
        default: {
          if (!belief || !initialized) return null;
          const target = densestCell(belief);
          if (Math.hypot(target.x - stalkerX, target.y - stalkerY) < 0.3) return null;
          return { x: target.x, y: target.y, ignorePlayer: false };
        }
      }
    }
  };
}
