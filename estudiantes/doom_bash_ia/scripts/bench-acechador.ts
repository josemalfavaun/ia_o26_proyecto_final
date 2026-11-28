/**
 * Benchmark del acechador estilo Alien: Isolation (arena de escondidas, `src/ai/stalker/arena.ts`).
 *
 *   npm run bench:acechador                 # semillas 10001-10100
 *   npm run bench:acechador -- --test 20    # más rápido
 *
 * Los parámetros del cerebro se fijaron antes de medir (`DEFAULT_STALKER_PARAMS`); durante el desarrollo solo se
 * usaron las semillas 1 a 20. Estas semillas de prueba se corren una sola vez.
 *
 * Cuatro modos con las mismas semillas: regla original (memoria de 4.2 s con la posición real), última posición
 * vista, filtro de partículas, y filtro de partículas más director (pistas y retiradas).
 * Escribe resultados/bench-acechador.md y bench-acechador.csv.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArenaEpisode, type ArenaResult } from '../src/ai/stalker/arena';
import { STALKER_MODES, type StalkerMode } from '../src/ai/stalker/brain';
import { summarize } from '../src/ai/sim/stats';

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
}

const SEEDS = Array.from({ length: arg('test', 100) }, (_, i) => 10001 + i);
const LEVELS = ['access-node', 'glass-cistern', 'relay-catacomb'];
const LABEL: Record<StalkerMode, string> = {
  regla: 'regla original (mira la posición real 4.2 s)',
  ultima: 'última posición vista',
  particulas: 'filtro de partículas',
  director: 'partículas + director'
};

const csv = [
  'level,mode,seed,contact_fraction,losses,reacquire_mean_s,unfinished,catches_per_min,menace_peaks,menace_high_fraction,hints,retreats'
];
const rows = [
  '| Nivel | Modo | Reencuentro, s (menos es mejor) | Contacto visual | Atrapadas por minuto | Ciclos de tensión | Tiempo con amenaza ≥ 0.9 | Pistas | Retiradas |',
  '|---|---|---|---|---|---|---|---|---|'
];
const paired: string[] = [];
const fmt = (xs: number[], digits = 2) => {
  const s = summarize(xs);
  return `${s.mean.toFixed(digits)} ± ${s.ci95.toFixed(digits)}`;
};

for (const level of LEVELS) {
  const byMode = new Map<StalkerMode, ArenaResult[]>();
  for (const mode of STALKER_MODES) {
    const results = SEEDS.map((seed) => runArenaEpisode({ levelId: level, seed, mode }));
    byMode.set(mode, results);
    results.forEach((r, i) =>
      csv.push(
        [
          level,
          mode,
          SEEDS[i],
          r.contactFraction.toFixed(4),
          r.losses,
          r.reacquireMeanS.toFixed(2),
          r.unfinishedSearches,
          r.catchesPerMinute.toFixed(2),
          r.menacePeaks,
          r.menaceHighFraction.toFixed(4),
          r.hints,
          r.retreats
        ].join(',')
      )
    );
    rows.push(
      `| ${level} | ${LABEL[mode]} | ${fmt(results.map((r) => r.reacquireMeanS), 1)} | ${fmt(
        results.map((r) => r.contactFraction * 100),
        1
      )} % | ${fmt(results.map((r) => r.catchesPerMinute))} | ${fmt(results.map((r) => r.menacePeaks))} | ${fmt(
        results.map((r) => r.menaceHighFraction * 100),
        1
      )} % | ${summarize(results.map((r) => r.hints)).mean.toFixed(1)} | ${summarize(results.map((r) => r.retreats)).mean.toFixed(1)} |`
    );
    console.log(`${level} / ${mode} listo`);
  }
  const diff = (a: StalkerMode, b: StalkerMode, f: (r: ArenaResult) => number) => {
    const ra = byMode.get(a)!;
    const rb = byMode.get(b)!;
    return fmt(ra.map((r, i) => f(r) - f(rb[i])));
  };
  paired.push(
    `| ${level} | ${diff('particulas', 'ultima', (r) => r.reacquireMeanS)} | ${diff('particulas', 'regla', (r) => r.reacquireMeanS)} | ${diff(
      'director',
      'particulas',
      (r) => r.menacePeaks
    )} | ${diff('director', 'particulas', (r) => r.menaceHighFraction * 100)} | ${diff('director', 'particulas', (r) => r.catchesPerMinute)} |`
  );
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resultados');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'bench-acechador.csv'), `${csv.join('\n')}\n`);
writeFileSync(
  join(outDir, 'bench-acechador.md'),
  `# Benchmark del acechador (estilo Alien: Isolation)

Arena de escondidas con el mapa real de cada nivel (puertas abiertas), 120 s por episodio, pasos de 50 ms.
Semillas ${SEEDS[0]} a ${SEEDS[SEEDS.length - 1]} (${SEEDS.length}), las mismas para los cuatro modos; corridas una sola vez.
Parámetros fijados antes de medir; en el desarrollo solo se usaron las semillas 1 a 20. Media ± IC95.

- **Reencuentro**: tiempo medio entre perder de vista al bot y volver a verlo; si la búsqueda no termina, cuenta hasta el final.
- **Ciclos de tensión**: veces que el medidor de amenaza llega al tope después de haber bajado a 0.3 o menos.
- El medidor se calcula igual en los cuatro modos, pero solo actúa (pistas y retiradas) en "partículas + director".

${rows.join('\n')}

## Diferencias pareadas (mismas semillas)

| Nivel | Reencuentro: partículas − última vista (s) | Reencuentro: partículas − regla original (s) | Ciclos: director − partículas | Amenaza ≥ 0.9: director − partículas (puntos %) | Atrapadas/min: director − partículas |
|---|---|---|---|---|---|
${paired.join('\n')}
`
);
console.log('Listo. Archivos en resultados/.');
