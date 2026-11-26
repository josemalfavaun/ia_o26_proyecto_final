/**
 * Fondo retro 8-bit para la pantalla de misión: negro, blanco y verde fósforo.
 * Todo se calcula con datos puros (determinista, sin Phaser) y la escena solo los dibuja con rectángulos;
 * así se puede probar que los bloques caen dentro del lienzo.
 */
export const RETRO_PALETTE = {
  black: 0x020804,
  greenDeep: 0x06240f,
  greenDark: 0x0c4a1e,
  greenMid: 0x1f9a3f,
  greenBright: 0x4dff7c,
  white: 0xe9ffe9
} as const;

/** Tamaño del "píxel gordo" del estilo 8-bit. */
export const RETRO_PIXEL = 4;

export interface RetroBuilding {
  x: number;
  width: number;
  height: number;
  /** Ventanas encendidas como [columna, fila] dentro del edificio, en unidades de píxel gordo. */
  windows: Array<[number, number]>;
}

export interface RetroStar {
  x: number;
  y: number;
  /** Fase del parpadeo, en [0, 1). */
  phase: number;
  bright: boolean;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function snap(value: number): number {
  return Math.round(value / RETRO_PIXEL) * RETRO_PIXEL;
}

/** Horizonte de edificios del "complejo abandonado", de lado a lado del lienzo. */
export function buildRetroSkyline(width: number, height: number, seed = 8_081): RetroBuilding[] {
  const random = lcg(seed);
  const maxHeight = Math.round(height * 0.3);
  const minHeight = Math.round(height * 0.08);
  const buildings: RetroBuilding[] = [];
  let x = 0;
  while (x < width) {
    const w = Math.min(snap(28 + random() * 52), width - x);
    const h = snap(minHeight + random() * (maxHeight - minHeight));
    const windows: Array<[number, number]> = [];
    const columns = Math.max(1, Math.floor(w / RETRO_PIXEL / 3) - 1);
    const rows = Math.max(1, Math.floor(h / RETRO_PIXEL / 3) - 1);
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (random() < 0.22) windows.push([1 + c * 3, 1 + r * 3]);
      }
    }
    buildings.push({ x, width: w, height: h, windows });
    x += w;
  }
  return buildings;
}

/** Estrellas en la mitad de arriba, alineadas a la cuadrícula de píxeles gordos. */
export function buildRetroStars(width: number, height: number, count = 46, seed = 4_242): RetroStar[] {
  const random = lcg(seed);
  const stars: RetroStar[] = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: snap(random() * (width - RETRO_PIXEL)),
      y: snap(random() * (height * 0.55)),
      phase: random(),
      bright: random() < 0.25
    });
  }
  return stars;
}

/** Brillo (0 a 1) de una estrella en el instante `timeMs`; parpadea con un escalón, como en 8 bits. */
export function retroStarAlpha(star: RetroStar, timeMs: number): number {
  const cycle = (timeMs / 1400 + star.phase) % 1;
  const level = cycle < 0.5 ? 1 : cycle < 0.75 ? 0.55 : 0.2;
  return star.bright ? level : level * 0.6;
}

/** Líneas de la rejilla en perspectiva del suelo: horizontales cada vez más separadas y verticales que convergen. */
export function buildRetroGrid(width: number, height: number): {
  horizonY: number;
  horizontals: number[];
  verticals: Array<{ x0: number; x1: number }>;
} {
  const horizonY = Math.round(height * 0.7);
  const horizontals: number[] = [];
  for (let i = 1; i <= 9; i += 1) {
    horizontals.push(Math.round(horizonY + (height - horizonY) * (i / 9) ** 2));
  }
  const verticals: Array<{ x0: number; x1: number }> = [];
  const cx = width / 2;
  for (let i = -10; i <= 10; i += 1) {
    verticals.push({ x0: Math.round(cx + i * 14), x1: Math.round(cx + i * 90) });
  }
  return { horizonY, horizontals, verticals };
}
