import { describe, expect, it } from 'vitest';
import { computeGlassPlacement } from '../game/ui/GlassOverlay';

describe('colocación del overlay de vidrio', () => {
  it('escala 1 cuando el canvas mide 960 de ancho y se coloca en su esquina', () => {
    expect(computeGlassPlacement({ left: 120, top: 40, width: 960 }, { left: 0, top: 0 })).toEqual({ left: 120, top: 40, scale: 1 });
  });

  it('escala con el canvas (FIT) y resta la posición del padre', () => {
    const p = computeGlassPlacement({ left: 108, top: 0, width: 1324 }, { left: 8, top: 0 });
    expect(p.left).toBe(100);
    expect(p.top).toBe(0);
    expect(p.scale).toBeCloseTo(1324 / 960, 6);
  });

  it('si el canvas aún no tiene ancho no rompe la escala', () => {
    expect(computeGlassPlacement({ left: 0, top: 0, width: 0 }, { left: 0, top: 0 }).scale).toBe(1);
  });
});
