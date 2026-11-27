/**
 * M5: narrador con salida estructurada. Le pide al modelo local (Ollama) un JSON con esquema fijo, lo valida
 * campo por campo y, si algo falla, cae a la regla de respaldo que el juego ya traía (`pickFallbackMessage`).
 * Cada intento queda clasificado (válido o la razón exacta del fallo) para poder medir tasa de validez,
 * latencia y uso del respaldo.
 *
 * Se activa con GAME_MASTER_STRUCTURED=1. Sin la bandera el servidor usa `narrate` de siempre, que es la línea base.
 */
import { getOllamaGenerateUrl, OLLAMA_MODEL, OLLAMA_TIMEOUT_MS, pickFallbackMessage, type NarrateRequest } from './gameMaster.js';

export const NARRATOR_TONES = ['tension', 'alerta', 'calma', 'critico'] as const;
export type NarratorTone = (typeof NARRATOR_TONES)[number];

/** Máximo de palabras de la línea, igual que pide el prompt original. */
export const NARRATOR_MAX_WORDS = 22;

export interface StructuredNarration {
  linea: string;
  tono: NarratorTone;
}

export type NarratorFailure =
  | 'sin-conexion'
  | 'tiempo-agotado'
  | 'http'
  | 'vacio'
  | 'json-invalido'
  | 'esquema'
  | 'demasiado-larga'
  | 'emoji'
  | 'lista';

export type ParseResult = { ok: true; value: StructuredNarration } | { ok: false; reason: NarratorFailure };

export function isStructuredNarratorEnabled(): boolean {
  return process.env.GAME_MASTER_STRUCTURED === '1';
}

export function buildStructuredPrompt(body: NarrateRequest): string {
  const context = body.context?.trim() || 'sector hostil, terminal dañado';
  const event = body.event?.trim() || 'el jugador avanza con cautela';
  return [
    'Eres el Game Master de un FPS retro raycast en español (México).',
    `Responde SOLO con un objeto JSON con exactamente estas claves: "linea" (una frase de máximo ${NARRATOR_MAX_WORDS} palabras, estilo arcade de horror, sin listas ni emojis) y "tono" (escribe EXACTAMENTE una de estas palabras, en minúsculas y sin acentos: ${NARRATOR_TONES.map((t) => `"${t}"`).join(', ')}).`,
    `Contexto: ${context}.`,
    `Evento: ${event}.`
  ].join(' ');
}

const EMOJI = /\p{Extended_Pictographic}/u;
const LIST_MARKER = /(^|\n)\s*([-*•]|\d+[.)])\s+/;

/** Valida la respuesta cruda del modelo. No corrige nada: lo que no cumple es un fallo y se contabiliza. */
export function parseNarratorReply(raw: string | null | undefined): ParseResult {
  if (raw === null || raw === undefined || raw.trim() === '') return { ok: false, reason: 'vacio' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'json-invalido' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'esquema' };
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes('linea') || !keys.includes('tono')) return { ok: false, reason: 'esquema' };
  if (typeof record.linea !== 'string' || typeof record.tono !== 'string') return { ok: false, reason: 'esquema' };
  if (!(NARRATOR_TONES as readonly string[]).includes(record.tono)) return { ok: false, reason: 'esquema' };
  const linea = record.linea.replace(/\s+/g, ' ').trim();
  if (linea === '') return { ok: false, reason: 'vacio' };
  if (EMOJI.test(linea)) return { ok: false, reason: 'emoji' };
  if (LIST_MARKER.test(record.linea)) return { ok: false, reason: 'lista' };
  if (linea.split(' ').length > NARRATOR_MAX_WORDS) return { ok: false, reason: 'demasiado-larga' };
  return { ok: true, value: { linea, tono: record.tono as NarratorTone } };
}

/**
 * Solo para diagnóstico (el bench lo usa): dice POR QUÉ una respuesta cruda no cumple el esquema, sin cambiar el veredicto
 * de `parseNarratorReply`. Devuelve null si el esquema sí se cumple o si el problema no es de esquema.
 */
export function describeSchemaProblem(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return 'no es un objeto';
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes('linea') || !keys.includes('tono')) return `claves: ${keys.join('|') || '(ninguna)'}`;
  if (typeof record.linea !== 'string' || typeof record.tono !== 'string') return 'tipos incorrectos';
  if (!(NARRATOR_TONES as readonly string[]).includes(record.tono)) return `tono fuera de la lista: ${record.tono}`;
  return null;
}

export interface ModelCall {
  raw: string | null;
  latencyMs: number;
  failure: Extract<NarratorFailure, 'sin-conexion' | 'tiempo-agotado' | 'http'> | null;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export interface NarratorDeps {
  fetchImpl?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
  /** Para pruebas: fija qué mensaje de respaldo sale. */
  fallbackSeed?: number;
  /** Diagnóstico: recibe la respuesta cruda del modelo (o null) de cada llamada. */
  onRaw?: (raw: string | null) => void;
}

/** Pide la respuesta al modelo con `format: "json"` y mide la latencia. Nunca lanza. */
export async function callOllamaStructured(prompt: string, deps: NarratorDeps = {}): Promise<ModelCall> {
  const fetchImpl = deps.fetchImpl ?? (fetch as unknown as FetchLike);
  const now = deps.now ?? (() => Date.now());
  const controller = new AbortController();
  const timeoutMs = deps.timeoutMs ?? OLLAMA_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = now();
  try {
    const response = await fetchImpl(getOllamaGenerateUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' }),
      signal: controller.signal
    });
    if (!response.ok) return { raw: null, latencyMs: now() - started, failure: 'http' };
    const data = (await response.json()) as { response?: string };
    return { raw: data.response ?? null, latencyMs: now() - started, failure: null };
  } catch (error) {
    const aborted = controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError';
    return { raw: null, latencyMs: now() - started, failure: aborted ? 'tiempo-agotado' : 'sin-conexion' };
  } finally {
    clearTimeout(timer);
  }
}

/** Tono de la regla de respaldo, según palabras del evento. Es la línea base contra la que se compara al modelo. */
export function fallbackTone(event: string | undefined): NarratorTone {
  const text = (event ?? '').toLowerCase();
  if (/(muer|baja|crític|critic|jefe|boss|derrota)/.test(text)) return 'critico';
  if (/(enemigo|ataque|disparo|alarma|emboscada)/.test(text)) return 'alerta';
  if (/(calma|silencio|despej|recoge|pickup)/.test(text)) return 'calma';
  return 'tension';
}

export interface StructuredNarrateResponse {
  message: string;
  source: 'ollama' | 'fallback';
  tone: NarratorTone;
  latencyMs: number;
  /** Solo si cayó al respaldo: por qué. */
  failure: NarratorFailure | null;
}

export async function narrateStructured(body: NarrateRequest = {}, deps: NarratorDeps = {}): Promise<StructuredNarrateResponse> {
  const call = await callOllamaStructured(buildStructuredPrompt(body), deps);
  deps.onRaw?.(call.raw);
  if (call.failure === null) {
    const parsed = parseNarratorReply(call.raw);
    if (parsed.ok) {
      return { message: parsed.value.linea, source: 'ollama', tone: parsed.value.tono, latencyMs: call.latencyMs, failure: null };
    }
    return fallbackResponse(body, call.latencyMs, parsed.reason, deps);
  }
  return fallbackResponse(body, call.latencyMs, call.failure, deps);
}

function fallbackResponse(body: NarrateRequest, latencyMs: number, failure: NarratorFailure, deps: NarratorDeps): StructuredNarrateResponse {
  return {
    message: pickFallbackMessage(deps.fallbackSeed ?? Date.now()),
    source: 'fallback',
    tone: fallbackTone(body.event),
    latencyMs,
    failure
  };
}

export interface NarratorRecord {
  source: 'ollama' | 'fallback';
  latencyMs: number;
  failure: NarratorFailure | null;
}

export interface NarratorSummary {
  total: number;
  valid: number;
  validRate: number;
  fallbackRate: number;
  failures: Partial<Record<NarratorFailure, number>>;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

/** Resumen de una tanda de narraciones. La latencia es la de las llamadas al modelo que sí respondieron. */
export function summarizeNarrator(records: readonly NarratorRecord[]): NarratorSummary {
  const failures: Partial<Record<NarratorFailure, number>> = {};
  let valid = 0;
  for (const record of records) {
    if (record.failure === null && record.source === 'ollama') valid += 1;
    else if (record.failure !== null) failures[record.failure] = (failures[record.failure] ?? 0) + 1;
  }
  const answered = records
    .filter((r) => r.failure === null || !['sin-conexion', 'tiempo-agotado', 'http'].includes(r.failure))
    .map((r) => r.latencyMs)
    .sort((a, b) => a - b);
  const total = records.length;
  return {
    total,
    valid,
    validRate: total === 0 ? Number.NaN : valid / total,
    fallbackRate: total === 0 ? Number.NaN : (total - valid) / total,
    failures,
    latencyP50Ms: percentile(answered, 0.5),
    latencyP95Ms: percentile(answered, 0.95)
  };
}
