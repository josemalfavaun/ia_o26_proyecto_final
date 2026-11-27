import { describe, expect, it } from 'vitest';
import {
  buildStructuredPrompt,
  fallbackTone,
  narrateStructured,
  NARRATOR_MAX_WORDS,
  parseNarratorReply,
  summarizeNarrator,
  type FetchLike
} from '../../server/src/gameMasterStructured';

const okResponse = (body: unknown): ReturnType<FetchLike> => Promise.resolve({ ok: true, json: async () => body });

describe('M5: validación de la respuesta del narrador', () => {
  it('acepta un JSON correcto y limpia espacios', () => {
    const result = parseNarratorReply(JSON.stringify({ linea: '  El eco  metálico  se acerca. ', tono: 'alerta' }));
    expect(result).toEqual({ ok: true, value: { linea: 'El eco metálico se acerca.', tono: 'alerta' } });
  });

  it.each([
    ['', 'vacio'],
    ['   ', 'vacio'],
    ['no es json', 'json-invalido'],
    ['```json\n{"linea":"hola","tono":"calma"}\n```', 'json-invalido'],
    ['[1,2]', 'esquema'],
    ['{"linea":"hola"}', 'esquema'],
    ['{"linea":"hola","tono":"calma","extra":1}', 'esquema'],
    ['{"linea":3,"tono":"calma"}', 'esquema'],
    ['{"linea":"hola","tono":"furioso"}', 'esquema'],
    ['{"linea":"   ","tono":"calma"}', 'vacio']
  ])('rechaza %j por %s', (raw, reason) => {
    expect(parseNarratorReply(raw)).toEqual({ ok: false, reason });
  });

  it('rechaza líneas con emojis, listas o demasiadas palabras', () => {
    expect(parseNarratorReply(JSON.stringify({ linea: 'Cuidado 🔥 atrás', tono: 'alerta' }))).toEqual({ ok: false, reason: 'emoji' });
    expect(parseNarratorReply(JSON.stringify({ linea: '- primero\n- segundo', tono: 'calma' }))).toEqual({ ok: false, reason: 'lista' });
    const largo = Array.from({ length: NARRATOR_MAX_WORDS + 1 }, () => 'palabra').join(' ');
    expect(parseNarratorReply(JSON.stringify({ linea: largo, tono: 'tension' }))).toEqual({ ok: false, reason: 'demasiado-larga' });
    const justo = Array.from({ length: NARRATOR_MAX_WORDS }, () => 'palabra').join(' ');
    expect(parseNarratorReply(JSON.stringify({ linea: justo, tono: 'tension' })).ok).toBe(true);
  });
});

describe('M5: narrateStructured', () => {
  it('devuelve la línea del modelo cuando es válida', async () => {
    const fetchImpl: FetchLike = () => okResponse({ response: JSON.stringify({ linea: 'Silencio sospechoso.', tono: 'tension' }) });
    const result = await narrateStructured({ event: 'x' }, { fetchImpl });
    expect(result).toMatchObject({ message: 'Silencio sospechoso.', source: 'ollama', tone: 'tension', failure: null });
  });

  it('cae al respaldo con la razón exacta cuando el modelo responde mal', async () => {
    const fetchImpl: FetchLike = () => okResponse({ response: 'texto libre sin JSON' });
    const result = await narrateStructured({ event: 'el jefe empieza una ráfaga' }, { fetchImpl, fallbackSeed: 0 });
    expect(result.source).toBe('fallback');
    expect(result.failure).toBe('json-invalido');
    expect(result.tone).toBe('critico');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('clasifica error HTTP, falta de conexión y tiempo agotado', async () => {
    const http: FetchLike = () => Promise.resolve({ ok: false, json: async () => ({}) });
    expect((await narrateStructured({}, { fetchImpl: http })).failure).toBe('http');
    const down: FetchLike = () => Promise.reject(new TypeError('fetch failed'));
    expect((await narrateStructured({}, { fetchImpl: down })).failure).toBe('sin-conexion');
    const slow: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })));
      });
    expect((await narrateStructured({}, { fetchImpl: slow, timeoutMs: 20 })).failure).toBe('tiempo-agotado');
  });

  it('pide formato JSON y el prompt menciona el esquema', async () => {
    let sent = '';
    const fetchImpl: FetchLike = (_url, init) => {
      sent = init.body;
      return okResponse({ response: '{}' });
    };
    await narrateStructured({ context: 'cisterna', event: 'emboscada' }, { fetchImpl });
    expect(JSON.parse(sent).format).toBe('json');
    const prompt = buildStructuredPrompt({ context: 'cisterna', event: 'emboscada' });
    expect(prompt).toContain('"linea"');
    expect(prompt).toContain('"tono"');
    expect(prompt).toContain('cisterna');
  });
});

describe('M5: resumen de métricas', () => {
  it('cuenta válidas, respaldo, motivos y percentiles', () => {
    const summary = summarizeNarrator([
      { source: 'ollama', latencyMs: 100, failure: null },
      { source: 'ollama', latencyMs: 200, failure: null },
      { source: 'fallback', latencyMs: 300, failure: 'json-invalido' },
      { source: 'fallback', latencyMs: 15000, failure: 'tiempo-agotado' }
    ]);
    expect(summary.total).toBe(4);
    expect(summary.valid).toBe(2);
    expect(summary.validRate).toBeCloseTo(0.5);
    expect(summary.fallbackRate).toBeCloseTo(0.5);
    expect(summary.failures).toEqual({ 'json-invalido': 1, 'tiempo-agotado': 1 });
    // El tiempo agotado no cuenta como latencia de una llamada que respondió.
    expect(summary.latencyP95Ms).toBe(300);
  });

  it('la regla de respaldo asigna tono por palabras del evento', () => {
    expect(fallbackTone('muere el jugador')).toBe('critico');
    expect(fallbackTone('aparece un enemigo')).toBe('alerta');
    expect(fallbackTone('todo en calma')).toBe('calma');
    expect(fallbackTone(undefined)).toBe('tension');
  });
});

describe('prompt', () => {
  it('pide los tonos con la misma grafía que valida el parser (sin acentos)', () => {
    const prompt = buildStructuredPrompt({});
    for (const tone of ['tension', 'alerta', 'calma', 'critico']) expect(prompt).toContain(`"${tone}"`);
    // Con la primera versión del prompt ("tono tensión arcade/horror") el modelo contestaba "tensión" y el parser lo rechazaba.
    expect(prompt).not.toMatch(/tensión|crítico/);
  });
});

describe('diagnóstico de esquema', () => {
  it('describe por qué falla sin cambiar el veredicto', async () => {
    const { describeSchemaProblem } = await import('../../server/src/gameMasterStructured');
    expect(describeSchemaProblem('{"linea":"hola","tono":"tensión"}')).toContain('tono fuera de la lista: tensión');
    expect(describeSchemaProblem('{"mensaje":"hola","tono":"calma"}')).toContain('claves: mensaje|tono');
    expect(describeSchemaProblem('{"linea":3,"tono":"calma"}')).toBe('tipos incorrectos');
    expect(describeSchemaProblem('[1]')).toBe('no es un objeto');
    expect(describeSchemaProblem('{"linea":"hola","tono":"calma"}')).toBeNull();
    expect(describeSchemaProblem('no json')).toBeNull();
    expect(describeSchemaProblem(null)).toBeNull();
  });

  it('entrega la respuesta cruda a onRaw', async () => {
    const seen: Array<string | null> = [];
    const fetchImpl = async () => ({ ok: true, json: async () => ({ response: '{"linea":"hola","tono":"calma"}' }) });
    const { narrateStructured } = await import('../../server/src/gameMasterStructured');
    await narrateStructured({}, { fetchImpl, onRaw: (raw) => void seen.push(raw) });
    expect(seen).toEqual(['{"linea":"hola","tono":"calma"}']);
  });
});
