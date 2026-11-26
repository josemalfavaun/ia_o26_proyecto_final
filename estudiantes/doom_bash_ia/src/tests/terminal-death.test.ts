import { describe, expect, it } from 'vitest';
import {
  buildDeathTerminalHtml,
  ensureTerminalDeathStyles,
  TERMINAL_DEATH_CSS,
  TERMINAL_DEATH_STYLE_ID
} from '../game/ui/terminalDeath';

const model = {
  title: 'FIN DE LA PARTIDA',
  subtitle: 'Enlace caído.',
  levelLine: 'SECTOR 1/6 <img src=x>',
  stats: [
    { label: 'TIEMPO', value: '01:30' },
    { label: 'BAJAS', value: '7' },
    { label: 'PUNTAJE', value: '630' }
  ]
};

describe('pantalla de fin de partida en terminal', () => {
  it('dice FIN DE LA PARTIDA, muestra las cifras y las teclas R y ESC', () => {
    const html = buildDeathTerminalHtml(model);
    expect(html).toContain('FIN DE LA PARTIDA');
    expect(html).toContain('SEÑAL PERDIDA');
    expect(html).toContain('<b>R</b>REINTENTAR');
    expect(html).toContain('<b>ESC</b>MENÚ');
    for (const value of ['01:30', '7', '630']) expect(html).toContain(`<b>${value}</b>`);
    for (const label of ['TIEMPO', 'BAJAS', 'PUNTAJE']) expect(html).toContain(label);
  });

  it('no inyecta HTML desde el texto', () => {
    const html = buildDeathTerminalHtml(model);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('ya no es vidrio líquido: sin desenfoque ni degradados 80s, y no estorba al ratón', () => {
    expect(TERMINAL_DEATH_CSS).not.toContain('backdrop-filter');
    expect(TERMINAL_DEATH_CSS).not.toContain('linear-gradient(180deg,#fff');
    expect(TERMINAL_DEATH_CSS).toContain('pointer-events:none');
    expect(TERMINAL_DEATH_CSS).toContain('steps(');
  });

  it('las teclas son tan grandes como el texto que las acompaña', () => {
    expect(TERMINAL_DEATH_CSS).toMatch(/\.rd-key b\{[^}]*font-size:2[4-9]px/);
  });

  it('la hoja de estilos se inserta una sola vez', () => {
    const added: Array<{ id: string }> = [];
    const doc = {
      getElementById: (id: string) => added.find((e) => e.id === id) ?? null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { appendChild: (el: { id: string }) => added.push(el) }
    } as unknown as Document;
    ensureTerminalDeathStyles(doc);
    ensureTerminalDeathStyles(doc);
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe(TERMINAL_DEATH_STYLE_ID);
  });
});
