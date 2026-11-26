import { describe, expect, it } from 'vitest';
import {
  buildRetroGrid,
  buildRetroSkyline,
  buildRetroStars,
  RETRO_PIXEL,
  retroStarAlpha
} from '../game/raycast/RaycastRetroBackdrop';

describe('fondo retro 8-bit', () => {
  it('el horizonte cubre el ancho completo sin salirse del lienzo', () => {
    const skyline = buildRetroSkyline(960, 540);
    expect(skyline[0].x).toBe(0);
    for (const b of skyline) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(960);
      expect(b.height).toBeGreaterThan(0);
      expect(b.height).toBeLessThanOrEqual(540 * 0.3 + RETRO_PIXEL);
    }
    const last = skyline[skyline.length - 1];
    expect(last.x + last.width).toBe(960);
  });

  it('es determinista y las ventanas caen dentro de su edificio', () => {
    expect(buildRetroSkyline(960, 540)).toEqual(buildRetroSkyline(960, 540));
    for (const b of buildRetroSkyline(960, 540)) {
      for (const [c, r] of b.windows) {
        expect(c * RETRO_PIXEL).toBeLessThan(b.width);
        expect(r * RETRO_PIXEL).toBeLessThan(b.height);
      }
    }
  });

  it('las estrellas están en el cielo (mitad de arriba) y alineadas a la cuadrícula de píxeles', () => {
    const stars = buildRetroStars(960, 540);
    expect(stars).toHaveLength(46);
    for (const s of stars) {
      expect(s.x % RETRO_PIXEL).toBe(0);
      expect(s.y % RETRO_PIXEL).toBe(0);
      expect(s.y).toBeLessThanOrEqual(540 * 0.55 + RETRO_PIXEL);
      expect(s.x).toBeLessThan(960);
    }
  });

  it('el parpadeo de las estrellas se mantiene entre 0 y 1', () => {
    for (const s of buildRetroStars(960, 540)) {
      for (let t = 0; t < 6000; t += 137) {
        const a = retroStarAlpha(s, t);
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it('la rejilla del suelo separa más las líneas cuanto más cerca del espectador', () => {
    const grid = buildRetroGrid(960, 540);
    expect(grid.horizontals.length).toBeGreaterThan(5);
    for (let i = 2; i < grid.horizontals.length; i += 1) {
      const prev = grid.horizontals[i - 1] - grid.horizontals[i - 2];
      const next = grid.horizontals[i] - grid.horizontals[i - 1];
      expect(next).toBeGreaterThanOrEqual(prev);
    }
    expect(grid.horizontals[grid.horizontals.length - 1]).toBeLessThanOrEqual(540);
  });
});
