/**
 * Medición de M5: llama al modelo local (Ollama) con el prompt estructurado y cuenta cuántas respuestas son válidas,
 * cuántas caen al respaldo y por qué, y la latencia.
 *
 *   ollama serve                     # y tener el modelo descargado: ollama pull llama3.2:3b
 *   npm run bench:narrator           # 60 llamadas
 *   npm run bench:narrator -- --calls 30 --model llama3.2:3b
 *
 * Las cifras dependen del modelo y de la máquina, así que NO son reproducibles bit a bit como las del simulador:
 * el archivo guarda el modelo, la fecha y la URL usada. Si Ollama no responde, el script lo dice y no escribe
 * resultados (no se inventan números).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOllamaBaseUrl, OLLAMA_MODEL } from '../server/src/gameMaster';
import { describeSchemaProblem, narrateStructured, summarizeNarrator, type NarratorRecord } from '../server/src/gameMasterStructured';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const calls = Number(arg('calls', '60'));
if (process.argv.includes('--model')) process.env.OLLAMA_MODEL = arg('model', OLLAMA_MODEL);

const CONTEXTS = ['sector hostil, terminal dañado', 'pasillo de servicio sin luz', 'cisterna de cristal inundada', 'catacumba de relés', 'arena del jefe, el suelo vibra'];
const EVENTS = [
  'el jugador avanza con cautela',
  'aparece una emboscada de enemigos',
  'el jugador recoge munición',
  'el jugador queda con poca vida',
  'el jefe empieza una ráfaga',
  'el jugador despeja la sala en silencio'
];

async function main(): Promise<void> {
  const base = getOllamaBaseUrl();
  console.log(`Modelo: ${process.env.OLLAMA_MODEL ?? OLLAMA_MODEL} en ${base}; ${calls} llamadas.`);
  const records: NarratorRecord[] = [];
  const rows = ['llamada,contexto,evento,fuente,fallo,detalle_esquema,latencia_ms,mensaje,respuesta_cruda'];
  const csv = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;
  const rejected: Array<{ call: number; raw: string; detail: string }> = [];
  for (let i = 0; i < calls; i += 1) {
    const context = CONTEXTS[i % CONTEXTS.length];
    const event = EVENTS[Math.floor(i / CONTEXTS.length) % EVENTS.length];
    let raw: string | null = null;
    const result = await narrateStructured({ context, event }, { fallbackSeed: i, onRaw: (value) => (raw = value) });
    const detail = result.failure === 'esquema' ? describeSchemaProblem(raw) ?? '' : '';
    if (result.failure === 'esquema' && rejected.length < 8) rejected.push({ call: i + 1, raw: raw ?? '', detail });
    records.push({ source: result.source, latencyMs: result.latencyMs, failure: result.failure });
    rows.push([i + 1, csv(context), csv(event), result.source, result.failure ?? '', csv(detail), result.latencyMs, csv(result.message), csv(raw ?? '')].join(','));
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${calls}`);
  }
  const summary = summarizeNarrator(records);
  const unreachable = (summary.failures['sin-conexion'] ?? 0) + (summary.failures['tiempo-agotado'] ?? 0);
  if (unreachable === calls) {
    console.error(`Ollama no respondió en ninguna llamada (${base}). No se escribió nada: inicia "ollama serve" y vuelve a correr.`);
    process.exit(1);
  }
  const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resultados');
  mkdirSync(outDir, { recursive: true });
  const pct = (x: number): string => `${(x * 100).toFixed(0)} %`;
  const md = [
    '# Medición de M5: narrador estructurado',
    '',
    `Modelo: ${process.env.OLLAMA_MODEL ?? OLLAMA_MODEL}. Servidor: ${base}. Fecha: ${new Date().toISOString().slice(0, 10)}. Llamadas: ${calls}.`,
    '',
    'No es reproducible bit a bit (depende del modelo y de la máquina). El detalle de cada llamada está en `narrador-llamadas.csv`.',
    '',
    '| Métrica | Valor |',
    '|---|---|',
    `| Respuestas válidas (JSON con esquema, ≤22 palabras, sin emojis ni listas) | ${summary.valid} de ${summary.total} (${pct(summary.validRate)}) |`,
    `| Uso del respaldo por reglas | ${pct(summary.fallbackRate)} |`,
    `| Latencia mediana de las llamadas que respondieron | ${summary.latencyP50Ms.toFixed(0)} ms |`,
    `| Latencia p95 | ${summary.latencyP95Ms.toFixed(0)} ms |`,
    '',
    'Motivos de fallo: ' + (Object.keys(summary.failures).length === 0 ? 'ninguno' : Object.entries(summary.failures).map(([k, v]) => `${k}: ${v}`).join(', ')),
    ''
  ];
  if (rejected.length > 0) {
    md.push('Primeras respuestas rechazadas por esquema (para ver qué devolvió el modelo):', '');
    for (const item of rejected) md.push(`- Llamada ${item.call}: ${item.detail || 'sin detalle'}. Respuesta: \`${item.raw.replace(/\s+/g, ' ').slice(0, 200)}\``);
    md.push('');
  }
  writeFileSync(join(outDir, 'bench-narrador.md'), md.join('\n'));
  writeFileSync(join(outDir, 'narrador-llamadas.csv'), rows.join('\n') + '\n');
  console.log(md.join('\n'));
}

void main();
