/**
 * Datos y líneas de tiempo puras de la escena final ("MISIÓN CUMPLIDA"): una secuencia de cuatro tiempos en pixel-art
 * original dibujado con rectángulos. Aquí no hay Phaser, para poder probar los tiempos sin navegador.
 *
 *  1. PASILLO     El operador corre por el pasillo del complejo hacia la puerta de salida (mismo look del juego).
 *  2. PUERTA      La puerta se abre y el destello blanco da paso al exterior.
 *  3. EXTERIOR    Amanecer: el operador sale caminando, el complejo estalla en cadena detrás de él y llega la extracción.
 *  4. EPÍLOGO     Terminal con el resumen de la partida, el título y el fin.
 */
export const VICTORY_TITLE = 'MISIÓN CUMPLIDA';
export const VICTORY_PIXEL = 4;

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function easeOutCubic(x: number): number {
  const t = clamp01(x);
  return 1 - (1 - t) ** 3;
}

export function easeInOut(x: number): number {
  const t = clamp01(x);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/* ------------------------------- tiempos ------------------------------- */

export type VictoryBeatId = 'corridor' | 'door' | 'exterior' | 'epilogue';

export const VICTORY_BEATS: readonly { id: VictoryBeatId; startMs: number; endMs: number }[] = [
  { id: 'corridor', startMs: 0, endMs: 7_500 },
  { id: 'door', startMs: 7_500, endMs: 10_000 },
  { id: 'exterior', startMs: 10_000, endMs: 30_500 },
  { id: 'epilogue', startMs: 30_500, endMs: Number.POSITIVE_INFINITY }
];

export function victoryBeat(timeMs: number): { id: VictoryBeatId; localMs: number; progress: number } {
  const t = Math.max(0, timeMs);
  const beat = VICTORY_BEATS.find((b) => t >= b.startMs && t < b.endMs) ?? VICTORY_BEATS[VICTORY_BEATS.length - 1];
  const span = beat.endMs - beat.startMs;
  return {
    id: beat.id,
    localMs: t - beat.startMs,
    progress: Number.isFinite(span) ? clamp01((t - beat.startMs) / span) : 1
  };
}

/** Pie de pantalla de cada tiempo. */
export function victoryCaption(timeMs: number): string {
  const { id, localMs } = victoryBeat(timeMs);
  switch (id) {
    case 'corridor':
      return localMs < 3_000 ? 'NÚCLEO DESACTIVADO' : 'EVACUACIÓN INMEDIATA: AL EXTERIOR';
    case 'door':
      return 'SALIDA ABIERTA';
    case 'exterior':
      return localMs < 9_000 ? 'AMANECER FUERA DEL COMPLEJO' : localMs < 16_000 ? 'COMPLEJO BIN BASH: PURGA COMPLETA' : 'EXTRACCIÓN EN CAMINO';
    default:
      return 'SALIMOS CON VIDA. JUEGO COMPLETADO.';
  }
}

/* --------------------------- 1. pasillo y puerta --------------------------- */

/** Avance del operador por el pasillo, de 0 a 1 durante el primer tiempo. */
export function corridorProgress(timeMs: number): number {
  return easeInOut(timeMs / VICTORY_BEATS[0].endMs);
}

/** Distancia (en unidades del túnel) a la que está la puerta: se acerca a medida que se corre. */
export function doorDistance(timeMs: number): number {
  return 7 - 5.6 * corridorProgress(timeMs);
}

/** Cuánto se ha corrido por el túnel; mueve las franjas del piso y del techo. */
export function corridorTravel(timeMs: number): number {
  return corridorProgress(timeMs) * 34;
}

/** Pulso de la alarma de 0 a 1 (rojo en el borde de la pantalla). */
export function alarmPulse(timeMs: number): number {
  return 0.5 + 0.5 * Math.sin(timeMs / 210);
}

/** Qué tanto se abre la puerta: 0 cerrada, 1 abierta de par en par. Empieza al comenzar el segundo tiempo. */
export function doorOpenAmount(timeMs: number): number {
  return easeInOut((timeMs - VICTORY_BEATS[1].startMs) / 1_700);
}

/** Destello blanco: sube con la puerta, llega a 1 al terminar el segundo tiempo y baja ya en el exterior. */
export function flashAlpha(timeMs: number): number {
  const rise = clamp01((timeMs - (VICTORY_BEATS[1].startMs + 900)) / (VICTORY_BEATS[1].endMs - VICTORY_BEATS[1].startMs - 900));
  const fall = clamp01((timeMs - VICTORY_BEATS[2].startMs) / 2_200);
  return timeMs < VICTORY_BEATS[2].startMs ? rise ** 1.4 : 1 - easeOutCubic(fall);
}

/** Soldado de espalda en dos cuadros de carrera. `#` uniforme, `h` casco, `b` mochila, `r` rifle. */
export const SOLDIER_BACK_FRAMES: readonly (readonly string[])[] = [
  [
    '...hhhh...',
    '..hhhhhh..',
    '..hhhhhh..',
    '...####...',
    '.r######..',
    '.r#bbbb#..',
    '.r#bbbb#..',
    '..#bbbb#..',
    '..######..',
    '..##..##..',
    '..##..##..',
    '.###..###.'
  ],
  [
    '...hhhh...',
    '..hhhhhh..',
    '..hhhhhh..',
    '...####...',
    '..######r.',
    '..#bbbb#r.',
    '..#bbbb#r.',
    '..#bbbb#..',
    '..######..',
    '...####...',
    '...####...',
    '..######..'
  ]
];

export function soldierBackFrame(timeMs: number, stepMs = 170): readonly string[] {
  return SOLDIER_BACK_FRAMES[Math.floor(timeMs / stepMs) % SOLDIER_BACK_FRAMES.length];
}

/* --------------------------- 2. exterior: amanecer --------------------------- */

/** Soldado de perfil, mirando a la derecha, en dos cuadros de caminata. `h` casco, `v` visor, `s` piel, `g` pañuelo, `n` mochila,
 * `k` chaleco, `a` bolsillo, `u` camisa, `t` cinturón, `p` pantalón, `b` botas, `m`/`r` rifle. */
export const SOLDIER_FRAMES: readonly (readonly string[])[] = [
  [
    '........hhhh........',
    '.......hhhhhh.......',
    '......hhhhhhhh......',
    '......hhhhhhvvv.....',
    '......hhhhssssv.....',
    '.......hhsssss......',
    '.......ssssssg......',
    '........ssss........',
    '.....nnkkkkkkk......',
    '....nnnkkaakkkk.....',
    '....nnnkkkkkkk......',
    '....nnnkpkkpkssmmmmm',
    '....nnnkkkkkkksmmmmm',
    '.....nnkkkkkkk......',
    '.....nnuuuuuuu......',
    '......ttttttt.......',
    '.......ppppp........',
    '.......ppppppp......',
    '......pppp.pppp.....',
    '......pppp..pppp....',
    '.....pppp....pppp...',
    '.....pppp....pppp...',
    '.....pppp.....pppp..',
    '....bbbbb.....bbbbb.',
    '....bbbbbb....bbbbbb',
    '....bbbbbb....bbbbbb'
  ],
  [
    '........hhhh........',
    '.......hhhhhh.......',
    '......hhhhhhhh......',
    '......hhhhhhvvv.....',
    '......hhhhssssv.....',
    '.......hhsssss......',
    '.......ssssssg......',
    '........ssss........',
    '.....nnkkkkkkk......',
    '....nnnkkaakkkk.....',
    '....nnnkkkkkkk......',
    '....nnnkpkkpkssmmmmm',
    '....nnnkkkkkkksmmmmm',
    '.....nnkkkkkkk......',
    '.....nnuuuuuuu......',
    '......ttttttt.......',
    '.......ppppp........',
    '.......pppppp.......',
    '.......ppppppp......',
    '........pppppp......',
    '........pppppp......',
    '.........pppp.......',
    '.........pppp.......',
    '........bbbbbb......',
    '.......bbbbbbb......',
    '.......bbbbbbb......'
  ]
];

export function soldierFrame(timeMs: number, stepMs = 260): readonly string[] {
  return SOLDIER_FRAMES[Math.floor(timeMs / stepMs) % SOLDIER_FRAMES.length];
}

/** Tiempo local del exterior, en ms desde que empieza ese tiempo. */
export function exteriorTime(timeMs: number): number {
  return Math.max(0, timeMs - VICTORY_BEATS[2].startMs);
}

/** Avance del sol de 0 (bajo el horizonte) a 1 (ya salió). */
export function sunProgress(timeMs: number): number {
  return easeOutCubic(exteriorTime(timeMs) / 17_000);
}

/** Posición horizontal del operador en el exterior: sale de la puerta y camina hacia el punto de extracción. */
export function operatorX(timeMs: number): number {
  const t = exteriorTime(timeMs);
  const walk = easeInOut(t / 17_500);
  return 300 + 330 * walk;
}

/** El operador sube a la nave: de ahí en adelante ya no se dibuja en tierra. */
export const BOARDING_MS = 18_500;

export function operatorOnGround(timeMs: number): boolean {
  return exteriorTime(timeMs) < BOARDING_MS;
}

export interface CollapsingBuilding {
  x: number;
  width: number;
  height: number;
  /** Cuándo empieza a caer (ms del exterior) y cuánto dura. */
  collapseAtMs: number;
  collapseMs: number;
}

/** Edificios del complejo, a la izquierda del exterior; el letrero BIN BASH va en el más alto. */
export const FACILITY_BUILDINGS: readonly CollapsingBuilding[] = [
  { x: 20, width: 92, height: 150, collapseAtMs: 5_400, collapseMs: 5_200 },
  { x: 124, width: 120, height: 232, collapseAtMs: 3_800, collapseMs: 6_600 },
  { x: 256, width: 76, height: 118, collapseAtMs: 6_800, collapseMs: 4_800 },
  { x: 344, width: 60, height: 88, collapseAtMs: 8_000, collapseMs: 4_000 }
];

/** Altura visible de un edificio, siempre en múltiplos de píxel y sin crecer nunca. */
export function buildingHeightAt(b: CollapsingBuilding, timeMs: number): number {
  const p = easeInOut((exteriorTime(timeMs) - b.collapseAtMs) / b.collapseMs);
  const h = b.height * (1 - 0.94 * p);
  return Math.max(VICTORY_PIXEL, Math.round(h / VICTORY_PIXEL) * VICTORY_PIXEL);
}

export interface Explosion {
  /** ms del exterior. */
  startMs: number;
  durationMs: number;
  /** Posición en el lienzo de 960 x 540. */
  x: number;
  y: number;
  maxRadius: number;
}

/** Cadena de explosiones: empieza en el edificio alto y se propaga hacia los lados. */
export const FACILITY_EXPLOSIONS: readonly Explosion[] = [
  { startMs: 3_600, durationMs: 1_000, x: 184, y: 150, maxRadius: 58 },
  { startMs: 4_300, durationMs: 900, x: 150, y: 215, maxRadius: 50 },
  { startMs: 5_200, durationMs: 1_000, x: 66, y: 270, maxRadius: 54 },
  { startMs: 6_000, durationMs: 1_100, x: 214, y: 240, maxRadius: 66 },
  { startMs: 6_900, durationMs: 1_100, x: 294, y: 275, maxRadius: 56 },
  { startMs: 7_800, durationMs: 1_200, x: 372, y: 300, maxRadius: 52 },
  { startMs: 8_800, durationMs: 1_500, x: 190, y: 285, maxRadius: 92 }
];

/** Radio y opacidad de una explosión en un instante; fuera de su ventana no existe. */
export function explosionState(e: Explosion, timeMs: number): { radius: number; alpha: number } | null {
  const p = (exteriorTime(timeMs) - e.startMs) / e.durationMs;
  if (p < 0 || p > 1) return null;
  return { radius: e.maxRadius * easeOutCubic(p), alpha: 1 - p * p };
}

/** Cuántas explosiones ya ocurrieron: define la etapa de daño del complejo. */
export function damageStage(timeMs: number): number {
  const t = exteriorTime(timeMs);
  return FACILITY_EXPLOSIONS.filter((e) => t >= e.startMs).length;
}

/** Sacudida de pantalla en píxeles: crece con cada explosión y se apaga al terminar la cadena. */
export function screenShake(timeMs: number): number {
  let s = 0;
  for (const e of FACILITY_EXPLOSIONS) {
    const p = (exteriorTime(timeMs) - e.startMs) / 450;
    if (p >= 0 && p <= 1) s = Math.max(s, (1 - p) * (e.maxRadius / 20));
  }
  return Math.round(s / VICTORY_PIXEL) * VICTORY_PIXEL;
}

/** Fragmento que sale disparado en una explosión: balística simple, determinista. */
export interface Debris {
  x: number;
  y: number;
  size: number;
  hot: boolean;
}

export function debrisFor(explosionIndex: number, timeMs: number, count = 12): Debris[] {
  const e = FACILITY_EXPLOSIONS[explosionIndex];
  const age = (exteriorTime(timeMs) - e.startMs) / 1000;
  if (age < 0 || age > 2.2) return [];
  const rand = lcg(9_173 + explosionIndex * 131);
  const out: Debris[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI * (0.1 + 0.8 * rand());
    const speed = 70 + 150 * rand();
    out.push({
      x: Math.round(e.x + Math.cos(angle) * speed * age),
      y: Math.round(e.y + Math.sin(angle) * speed * age + 260 * age * age),
      size: rand() < 0.35 ? 2 * VICTORY_PIXEL : VICTORY_PIXEL,
      hot: age < 0.9
    });
  }
  return out;
}

/** Humo: columnas que suben desde cada explosión una vez que pasó. */
export function smokeRise(timeMs: number, explosionIndex: number): number {
  const e = FACILITY_EXPLOSIONS[explosionIndex];
  return clamp01((exteriorTime(timeMs) - e.startMs - 600) / 9_000);
}

/** Nave de extracción: llega desde la derecha, se queda en estacionario y despega con el operador a bordo. */
export const HELICOPTER_FRAMES: readonly (readonly string[])[] = [
  [
    '..............rrrrrrrrrrrrrrrrrrrrrr..............',
    '.................................#................',
    '.................######..........#................',
    '..............##############.....#................',
    '............##ggggg#########....####..............',
    '...........##gggggg##########.###########.........',
    '..........###gggggg###################...#........',
    '..........##########################.####.#.......',
    '............########################.....#........',
    '..............##..................##..............',
    '...........#########################..............'
  ],
  [
    '................rrrrrrrrrrrrrrrrrr................',
    '.................................#................',
    '.................######..........#................',
    '..............##############.....#................',
    '............##ggggg#########....####..............',
    '...........##gggggg##########.###########.........',
    '..........###gggggg###################...#........',
    '..........##########################.####.#.......',
    '............########################.....#........',
    '..............##..................##..............',
    '...........#########################..............'
  ]
];

export function helicopterFrame(timeMs: number): readonly string[] {
  return HELICOPTER_FRAMES[Math.floor(timeMs / 70) % HELICOPTER_FRAMES.length];
}

export const HELICOPTER_ARRIVE_MS = 13_500;
export const HELICOPTER_LANDED_MS = 17_000;
export const HELICOPTER_TAKEOFF_MS = 21_000;

/** Posición (esquina superior izquierda del dibujo) de la nave en el lienzo de 960 x 540, o null si no está en pantalla. */
export function helicopterPosition(timeMs: number): { x: number; y: number } | null {
  const t = exteriorTime(timeMs);
  if (t < HELICOPTER_ARRIVE_MS) return null;
  const landY = 350;
  if (t < HELICOPTER_LANDED_MS) {
    const p = easeOutCubic((t - HELICOPTER_ARRIVE_MS) / (HELICOPTER_LANDED_MS - HELICOPTER_ARRIVE_MS));
    return { x: Math.round(1_040 - 340 * p), y: Math.round(60 + (landY - 60) * p) };
  }
  if (t < HELICOPTER_TAKEOFF_MS) return { x: 700, y: landY };
  const q = easeInOut((t - HELICOPTER_TAKEOFF_MS) / 7_500);
  return { x: Math.round(700 + 360 * q), y: Math.round(landY - 300 * q) };
}

/* --------------------------- 3. epílogo: terminal --------------------------- */

/** Resumen de la partida: el operador salió con vida y terminó el juego. */
export const EPILOGUE_LINES: readonly string[] = [
  '> ENLACE RESTABLECIDO',
  '> NIVELES COMPLETADOS ....... 10 / 10',
  '> JEFES ABATIDOS ............. 3 / 3',
  '> COMPLEJO BIN BASH .......... DESTRUIDO',
  '> OPERADOR ................... CON VIDA',
  '> JUEGO ...................... COMPLETADO'
];

/** Texto visible en la terminal: escribe línea por línea, a `charsPerSec`, con una pausa entre líneas. */
export function typedLines(lines: readonly string[], timeMs: number, charsPerSec = 26, pauseMs = 320): string[] {
  const out: string[] = [];
  let remaining = Math.max(0, timeMs);
  for (const line of lines) {
    const typingMs = (line.length / charsPerSec) * 1000;
    if (remaining <= 0) break;
    if (remaining >= typingMs) {
      out.push(line);
      remaining -= typingMs + pauseMs;
    } else {
      out.push(line.slice(0, Math.floor((remaining / 1000) * charsPerSec)));
      remaining = 0;
    }
  }
  return out;
}

/** Cuánto dura escribir todo el epílogo. */
export function epilogueTypingMs(lines: readonly string[] = EPILOGUE_LINES, charsPerSec = 26, pauseMs = 320): number {
  return lines.reduce((sum, line) => sum + (line.length / charsPerSec) * 1000 + pauseMs, 0);
}

/** Opacidad del título: aparece justo al empezar el epílogo. */
export function titleAlpha(timeMs: number): number {
  return clamp01((timeMs - VICTORY_BEATS[3].startMs) / 1_200);
}

/** Opacidad del velo oscuro bajo el epílogo. */
export function epilogueVeil(timeMs: number): number {
  return 0.62 * clamp01((timeMs - (VICTORY_BEATS[3].startMs - 1_500)) / 2_500);
}
