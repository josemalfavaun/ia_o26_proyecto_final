import { describe, expect, it } from 'vitest';
import { buildTutorialModel } from '../game/raycast/RaycastTutorial';
import { RAYCAST_LEVEL_CATALOG } from '../game/raycast/RaycastLevel';
import {
  buildTutorialTerminalHtml,
  ensureTerminalTutorialStyles,
  TERMINAL_TUTORIAL_CSS,
  TERMINAL_TUTORIAL_STYLE_ID
} from '../game/ui/terminalTutorial';

describe('tutorial en terminal retro', () => {
  const html = buildTutorialTerminalHtml(buildTutorialModel(RAYCAST_LEVEL_CATALOG[0]));

  it('tiene las cuatro escenas, el nivel y ENTER para comenzar', () => {
    expect(html.match(/class="rt-scene"/g)).toHaveLength(4);
    for (const text of ['MUÉVETE', 'DISPARA Y RECARGA', 'CAMBIA DE ARMA', 'TU MISIÓN', 'COMENZAR', 'ENTER', 'ESC']) {
      expect(html, text).toContain(text);
    }
    expect(html).toContain('Encuentra la ficha');
    expect(html).toContain('PISTOLA');
    expect(html).toContain('ESCOPETA');
    expect(html).toContain('LANZADOR');
    expect(html).toContain('SLAG FOUNDRY');
  });

  it('ya no usa vidrio líquido: sin desenfoque, solo verde y negro del juego', () => {
    expect(TERMINAL_TUTORIAL_CSS).not.toContain('backdrop-filter');
    expect(TERMINAL_TUTORIAL_CSS).not.toContain('border-radius');
    expect(html).not.toContain('lg-');
    expect(TERMINAL_TUTORIAL_CSS).toContain('#4dff7c');
  });

  it('cada escena tiene su animación y todas las animaciones declaradas existen', () => {
    const used = new Set([...TERMINAL_TUTORIAL_CSS.matchAll(/animation:(rt\w+)/g)].map((m) => m[1]));
    for (const name of used) {
      expect(TERMINAL_TUTORIAL_CSS, name).toContain(`@keyframes ${name}{`);
    }
    expect(used.size).toBeGreaterThanOrEqual(12);
  });

  it('inserta la hoja de estilos una sola vez', () => {
    const added: Array<{ id: string }> = [];
    const doc = {
      getElementById: (id: string) => added.find((e) => e.id === id) ?? null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { appendChild: (el: { id: string }) => added.push(el) }
    } as unknown as Document;
    ensureTerminalTutorialStyles(doc);
    ensureTerminalTutorialStyles(doc);
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe(TERMINAL_TUTORIAL_STYLE_ID);
  });
});
