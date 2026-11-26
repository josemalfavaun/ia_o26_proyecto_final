import { RUN_MODIFIER_ROULETTE } from '../game/raycast/RunModifierRoulette';
import { describe, expect, it } from 'vitest';
import {
  buildPrologueModifierRows,
  PROLOGUE_MODIFIER_NAME_WIDTH,
  computePrologueScreenLayout,
  PROLOGUE_SIDE_MARGIN_PX,
  prologueGridIsConsistent
} from '../game/raycast/RaycastPrologueLayout';

describe('pantalla de misión: matriz 2x2', () => {
  it('acomoda misión, objetivo, modificadores y controles en cuatro cuadrantes en el lienzo del juego', () => {
    const layout = computePrologueScreenLayout(960, 540);
    expect(prologueGridIsConsistent(layout, 960)).toBe(true);
    // Arriba-izquierda misión, arriba-derecha objetivo, abajo-izquierda modificadores, abajo-derecha controles.
    expect(layout.mission.x).toBeLessThan(layout.objective.x);
    expect(layout.mission.y).toBe(layout.objective.y);
    expect(layout.modifiers.x).toBe(layout.mission.x);
    expect(layout.controls.x).toBe(layout.objective.x);
    expect(layout.modifiers.y).toBeGreaterThan(layout.mission.y + layout.mission.height);
    expect(layout.controls.y).toBe(layout.modifiers.y);
  });

  it('deja aire entre cuadrantes y respeta márgenes laterales', () => {
    const layout = computePrologueScreenLayout(960, 540);
    expect(layout.mission.x).toBe(PROLOGUE_SIDE_MARGIN_PX);
    expect(layout.objective.x - (layout.mission.x + layout.mission.width)).toBeGreaterThanOrEqual(12);
    expect(layout.modifiers.y - (layout.mission.y + layout.mission.height)).toBeGreaterThanOrEqual(12);
    expect(layout.objective.x + layout.objective.width).toBeLessThanOrEqual(960 - PROLOGUE_SIDE_MARGIN_PX);
  });

  it('la fila de modificadores es la más alta (caben cinco líneas) y el título queda sobre la matriz', () => {
    const layout = computePrologueScreenLayout(960, 540);
    expect(layout.modifiers.height).toBeGreaterThanOrEqual(120);
    expect(layout.titleY).toBeLessThan(layout.mission.y);
    expect(layout.gamepadY).toBeLessThan(layout.promptY);
  });

  it('se mantiene consistente en otros tamaños de ventana', () => {
    for (const [w, h] of [
      [640, 360],
      [854, 480],
      [1280, 720],
      [1440, 900]
    ]) {
      expect(prologueGridIsConsistent(computePrologueScreenLayout(w, h), w), `${w}x${h}`).toBe(true);
    }
  });

  it('muestra todos los modificadores a la vez y marca solo el activo', () => {
    const none = buildPrologueModifierRows(RUN_MODIFIER_ROULETTE, null);
    expect(none).toHaveLength(RUN_MODIFIER_ROULETTE.length + 1);
    expect(none.filter((r) => r.active)).toHaveLength(1);
    expect(none[0].active).toBe(true);
    expect(none[0].text.startsWith('>')).toBe(true);

    const picked = buildPrologueModifierRows(RUN_MODIFIER_ROULETTE, 'DARK_ROUTE');
    expect(picked.filter((r) => r.active).map((r) => r.id)).toEqual(['DARK_ROUTE']);
    for (const m of RUN_MODIFIER_ROULETTE) {
      expect(picked.some((r) => r.id === m.id && r.text.includes(m.brief))).toBe(true);
    }
  });

  it('cada modificador tiene nombre y descripción cortos que caben en una línea', () => {
    const names = new Set<string>();
    for (const m of RUN_MODIFIER_ROULETTE) {
      expect(m.shortLabel.length).toBeLessThanOrEqual(PROLOGUE_MODIFIER_NAME_WIDTH);
      expect(m.brief.length).toBeGreaterThan(10);
      expect(m.brief.length).toBeLessThanOrEqual(48);
      names.add(m.shortLabel);
    }
    expect(names.size).toBe(RUN_MODIFIER_ROULETTE.length);
    const rows = buildPrologueModifierRows(RUN_MODIFIER_ROULETTE, null);
    expect(Math.max(...rows.map((r) => r.text.length))).toBeLessThanOrEqual(70);
  });
});
