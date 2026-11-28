/**
 * Creencia del acechador sobre dónde está el jugador: un filtro de partículas sobre la rejilla del nivel.
 *
 * Cada partícula es una hipótesis concreta "el jugador está aquí". El filtro alterna dos pasos:
 *  - Predicción (modelo de movimiento): cada partícula camina al azar por celdas libres, a la velocidad a la
 *    que se supone que se mueve el jugador. Con el tiempo la nube se dispersa por los pasillos.
 *  - Observación: las partículas que el acechador VE vacías (dentro de su alcance y con línea de vista) se
 *    descartan y se remuestrea desde las que sobreviven. Ver al jugador colapsa la nube en su posición; oír un
 *    disparo o recibir una pista del director mueve una fracción de partículas cerca de ese punto.
 *
 * Es un filtro bayesiano con verosimilitud 0/1 para "no lo veo" (si el jugador estuviera en una celda visible,
 * lo vería). La estimación que usa el acechador es la celda con más partículas.
 */
import { castRay, type RaycastMap } from '../../game/raycast/RaycastMap';
import type { Rng } from '../sim/rng';

export interface ParticleBelief {
  xs: Float64Array;
  ys: Float64Array;
  readonly size: number;
}

export function isOpenCell(map: RaycastMap, cx: number, cy: number): boolean {
  return cy >= 0 && cy < map.grid.length && cx >= 0 && cx < map.grid[0].length && map.grid[cy][cx] === 0;
}

/** Celdas libres del nivel (se calcula una vez por mapa). */
const OPEN_CELLS = new WeakMap<RaycastMap, Array<[number, number]>>();
export function openCells(map: RaycastMap): Array<[number, number]> {
  let cells = OPEN_CELLS.get(map);
  if (!cells) {
    cells = [];
    for (let y = 0; y < map.grid.length; y += 1) {
      for (let x = 0; x < map.grid[y].length; x += 1) if (map.grid[y][x] === 0) cells.push([x, y]);
    }
    OPEN_CELLS.set(map, cells);
  }
  return cells;
}

export function createBelief(size: number): ParticleBelief {
  return { xs: new Float64Array(size), ys: new Float64Array(size), size };
}

/** Reparte las partículas al azar por todo el nivel (no se sabe nada). */
export function scatterUniform(belief: ParticleBelief, map: RaycastMap, rng: Rng): void {
  const cells = openCells(map);
  for (let i = 0; i < belief.size; i += 1) {
    const [cx, cy] = cells[Math.floor(rng() * cells.length)];
    belief.xs[i] = cx + 0.15 + rng() * 0.7;
    belief.ys[i] = cy + 0.15 + rng() * 0.7;
  }
}

/** Mueve una fracción de las partículas (o todas) alrededor de (x, y), con dispersión `spread` en celdas. */
export function concentrate(
  belief: ParticleBelief,
  map: RaycastMap,
  x: number,
  y: number,
  spread: number,
  fraction: number,
  rng: Rng
): void {
  const count = Math.round(belief.size * Math.max(0, Math.min(1, fraction)));
  for (let k = 0; k < count; k += 1) {
    const i = fraction >= 1 ? k : Math.floor(rng() * belief.size);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const px = x + (rng() * 2 - 1) * spread;
      const py = y + (rng() * 2 - 1) * spread;
      if (isOpenCell(map, Math.floor(px), Math.floor(py))) {
        belief.xs[i] = px;
        belief.ys[i] = py;
        break;
      }
      if (attempt === 7) {
        belief.xs[i] = x;
        belief.ys[i] = y;
      }
    }
  }
}

/** Paso de predicción: caminata al azar por celdas libres durante `seconds` a velocidad `speed` (celdas/s). */
export function predict(belief: ParticleBelief, map: RaycastMap, seconds: number, speed: number, rng: Rng): void {
  const step = speed * seconds;
  if (step <= 0) return;
  for (let i = 0; i < belief.size; i += 1) {
    const angle = rng() * Math.PI * 2;
    const length = step * (0.4 + rng() * 0.6);
    const nx = belief.xs[i] + Math.cos(angle) * length;
    const ny = belief.ys[i] + Math.sin(angle) * length;
    if (isOpenCell(map, Math.floor(nx), Math.floor(ny))) {
      belief.xs[i] = nx;
      belief.ys[i] = ny;
    }
  }
}

function visibleFrom(map: RaycastMap, ox: number, oy: number, x: number, y: number, range: number): boolean {
  const dx = x - ox;
  const dy = y - oy;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance < 0.3) return true;
  const angle = Math.atan2(dy, dx);
  return castRay(map, ox, oy, angle, angle).distance + 0.08 >= distance;
}

/**
 * Paso de observación negativa: el observador en (ox, oy) no ve al jugador. Se descartan las partículas que
 * estarían a la vista y se remuestrea copiando sobrevivientes (con un poco de ruido). Si no sobrevive ninguna,
 * se reparte la nube por el nivel. Devuelve cuántas partículas se descartaron.
 */
export function observeEmpty(
  belief: ParticleBelief,
  map: RaycastMap,
  ox: number,
  oy: number,
  range: number,
  rng: Rng
): number {
  const survivors: number[] = [];
  const removed: number[] = [];
  for (let i = 0; i < belief.size; i += 1) {
    if (visibleFrom(map, ox, oy, belief.xs[i], belief.ys[i], range)) removed.push(i);
    else survivors.push(i);
  }
  if (removed.length === 0) return 0;
  if (survivors.length === 0) {
    scatterUniform(belief, map, rng);
    return removed.length;
  }
  for (const i of removed) {
    const j = survivors[Math.floor(rng() * survivors.length)];
    const px = belief.xs[j] + (rng() * 2 - 1) * 0.3;
    const py = belief.ys[j] + (rng() * 2 - 1) * 0.3;
    const ok = isOpenCell(map, Math.floor(px), Math.floor(py));
    belief.xs[i] = ok ? px : belief.xs[j];
    belief.ys[i] = ok ? py : belief.ys[j];
  }
  return removed.length;
}

/**
 * Celda que concentra más creencia: la que tiene más partículas sumando sus 8 vecinas (suaviza el ruido de una
 * sola celda). Devuelve el centro de la celda y qué fracción de la nube cae en ese bloque de 3 × 3.
 */
export function densestCell(belief: ParticleBelief): { x: number; y: number; share: number } {
  const counts = new Map<number, number>();
  for (let i = 0; i < belief.size; i += 1) {
    const key = Math.floor(belief.ys[i]) * 4096 + Math.floor(belief.xs[i]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = 0;
  let best = -1;
  for (const [key, own] of counts) {
    if (own <= 0) continue;
    let sum = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) sum += counts.get(key + dy * 4096 + dx) ?? 0;
    }
    if (sum > best || (sum === best && key < bestKey)) {
      best = sum;
      bestKey = key;
    }
  }
  return { x: (bestKey % 4096) + 0.5, y: Math.floor(bestKey / 4096) + 0.5, share: best / belief.size };
}
