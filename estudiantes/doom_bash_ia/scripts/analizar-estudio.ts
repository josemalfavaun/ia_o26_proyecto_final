/**
 * Analiza los archivos JSON que bajan las personas con la tecla K en el modo estudio.
 *
 *   npm run analizar:estudio                      # lee datos/sesiones/*.json
 *   npm run analizar:estudio -- --dir otra/ruta   # otra carpeta
 *
 * La carpeta datos/ está en .gitignore: los archivos de las personas no se suben al repositorio.
 * Escribe resultados/estudio-resumen.md (solo agregados, sin identificadores).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeStudy, parseStudyFile, studyMarkdown } from '../src/ai/study/analysis';
import type { StudyFile } from '../src/ai/runtime/AiRuntime';

const here = dirname(fileURLToPath(import.meta.url));
const dirIndex = process.argv.indexOf('--dir');
const dir = resolve(dirIndex >= 0 && process.argv[dirIndex + 1] ? process.argv[dirIndex + 1] : join(here, '..', 'datos', 'sesiones'));
const MIN_ENCOUNTERS = 20;

if (!existsSync(dir)) {
  console.log(`No existe ${dir}. Crea la carpeta y pon ahí los .json que te manden las personas.`);
  process.exit(0);
}

const files: StudyFile[] = [];
let invalid = 0;
const seen = new Set<string>();
for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  const parsed = parseStudyFile(readFileSync(join(dir, name), 'utf8'));
  if (!parsed) {
    invalid += 1;
    continue;
  }
  // Si alguien manda dos veces su archivo, se queda el más completo.
  if (seen.has(parsed.anonId)) {
    const index = files.findIndex((f) => f.anonId === parsed.anonId);
    if (parsed.encounters.length > files[index].encounters.length) files[index] = parsed;
    continue;
  }
  seen.add(parsed.anonId);
  files.push(parsed);
}

if (files.length === 0) {
  console.log(`No hay archivos válidos en ${dir} (descartados: ${invalid}). No se escribe nada.`);
  process.exit(0);
}

const analysis = analyzeStudy(files, { invalidFiles: invalid, minEncounters: MIN_ENCOUNTERS });
const out = join(here, '..', 'resultados');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'estudio-resumen.md'), studyMarkdown(analysis, MIN_ENCOUNTERS));
console.log(`Personas: ${analysis.participants}, encuentros: ${analysis.encounters}. Resumen en resultados/estudio-resumen.md`);
