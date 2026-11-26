import { describe, expect, it } from 'vitest';
import { escapeHtml, formatGlassDuration, GLASS_HEIGHT, GLASS_WIDTH } from '../game/ui/liquidGlass';

describe('utilidades de pantallas HTML', () => {
  it('escapa HTML y da formato mm:ss', () => {
    expect(escapeHtml(`<b>"a" & 'b'</b>`)).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
    expect(formatGlassDuration(0)).toBe('00:00');
    expect(formatGlassDuration(125_900)).toBe('02:05');
    expect(formatGlassDuration(-5)).toBe('00:00');
  });

  it('el lienzo es de 960 x 540', () => {
    expect(GLASS_WIDTH).toBe(960);
    expect(GLASS_HEIGHT).toBe(540);
  });
});
