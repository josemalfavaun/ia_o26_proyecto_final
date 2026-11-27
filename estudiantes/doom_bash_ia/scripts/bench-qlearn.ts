/**
 * Benchmark de M4: entrena un bot con Q-learning tabular jerárquico sobre el simulador y lo mide contra los bots de
 * referencia, con semillas que NO vieron durante el entrenamiento.
 *
 *   npm run bench:qlearn                      # completo (unos 6 minutos)
 *   npm run bench:qlearn -- --scale 0.25      # episodios de entrenamiento al 25 %, para probar rápido
 *   npm run bench:qlearn -- --seeds 30        # semillas de prueba (100 por omisión)
 *
 * Semillas: entrenamiento 1..N, validación 5001..5020 (solo para la curva), prueba 10001..10000+seeds.
 * Escribe en resultados/: bench-qlearn.md, bench-qlearn.csv, qlearn-curva.csv y qlearn-tabla-<escenario>.json.
 * Misma semilla, mismo resultado: los archivos se regeneran idénticos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createQBotFactory,
  DEFAULT_Q_HYPER,
  QTable,
  serializeQTable,
  trainQLearning,
  type QHyperParams,
  type TrainingPoint
} from '../src/ai/qlearn/agent';
import { STATE_COUNT, MACRO_COUNT } from '../src/ai/qlearn/macro';
import { idleBotFactory, randomBotFactory, scriptedBotFactory } from '../src/ai/sim/bots';
import { runEpisode } from '../src/ai/sim/runEpisode';
import { proportion, summarize } from '../src/ai/sim/stats';
import type { RaycastDifficultyId, SimBotFactory, SimEpisodeResult } from '../src/ai/types';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const scale = Number(arg('scale', '1'));
const testSeedCount = Number(arg('seeds', '100'));
const testSeeds = Array.from({ length: testSeedCount }, (_, i) => 10001 + i);
const validationSeeds = Array.from({ length: 20 }, (_, i) => 5001 + i);

interface Scenario {
  id: string;
  title: string;
  levelId: string;
  difficulty: RaycastDifficultyId;
  episodes: number;
  hyper: Partial<QHyperParams>;
  hasBoss: boolean;
}

const AGGRESSIVE: Partial<QHyperParams> = { damagePenaltyPerHp: 0.1, bossDamageReward: 100, stepPenalty: 0.02 };

const SCENARIOS: Scenario[] = [
  { id: 'nivel1', title: 'Nivel 1 (access-node)', levelId: 'access-node', difficulty: 'standard', episodes: 1500, hyper: {}, hasBoss: false },
  { id: 'jefe-prudente', title: 'Jefe 1 (volt-archon-pit), recompensa prudente', levelId: 'volt-archon-pit', difficulty: 'standard', episodes: 4000, hyper: {}, hasBoss: true },
  { id: 'jefe-agresivo', title: 'Jefe 1 (volt-archon-pit), recompensa agresiva', levelId: 'volt-archon-pit', difficulty: 'standard', episodes: 4000, hyper: AGGRESSIVE, hasBoss: true }
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resultados');
mkdirSync(outDir, { recursive: true });

const fmt = (value: number, digits = 1): string => value.toFixed(digits);
const pm = (values: number[], digits = 1): string => {
  const s = summarize(values);
  return `${fmt(s.mean, digits)} ± ${fmt(s.ci95, digits)}`;
};
const pct = (successes: number, total: number): string => {
  const { p, ci95 } = proportion(successes, total);
  return `${(p * 100).toFixed(0)} % ± ${(ci95 * 100).toFixed(0)}`;
};

function evaluate(table: QTable, scenario: Scenario, seeds: readonly number[]): { clear: number; damage: number; durationS: number } {
  const bot = createQBotFactory(table);
  const results = seeds.map((seed) => runEpisode({ levelId: scenario.levelId, seed, bot, difficultyId: scenario.difficulty }));
  return {
    clear: results.filter((r) => r.outcome === 'cleared').length / results.length,
    damage: summarize(results.map((r) => r.damageTaken)).mean,
    durationS: summarize(results.map((r) => r.durationMs / 1000)).mean
  };
}

const csvRows = ['escenario,bot,semilla,resultado,duracion_ms,dano_recibido,vida_jefe_restante,digest'];
const curveRows = ['escenario,episodio,epsilon,retorno_medio,validacion_gana,validacion_dano,validacion_duracion_s,estados_visitados'];
const md: string[] = [];
md.push('# Benchmark M4: Q-learning tabular jerárquico');
md.push('');
md.push(`Estados: ${STATE_COUNT}; macros: ${MACRO_COUNT}; decisión cada 160 ms. Semillas de prueba: ${testSeedCount} (10001 en adelante), distintas de las de entrenamiento (desde 1) y de validación (5001 a 5020). Dificultad: standard.`);
md.push('');
md.push('Hiperparámetros base: ' + JSON.stringify(DEFAULT_Q_HYPER) + '. La variante "agresiva" cambia: ' + JSON.stringify(AGGRESSIVE) + '.');
md.push('');

const started = Date.now();
for (const scenario of SCENARIOS) {
  const episodes = Math.max(1, Math.round(scenario.episodes * scale));
  console.log(`\n== ${scenario.title}: ${episodes} episodios de entrenamiento`);
  const every = Math.max(1, Math.floor(episodes / 8));

  const untrained = new QTable();
  const zero = evaluate(untrained, scenario, validationSeeds);
  curveRows.push([scenario.id, 0, '', '', zero.clear.toFixed(3), zero.damage.toFixed(1), zero.durationS.toFixed(1), 0].join(','));

  const { table, curve, hyper } = trainQLearning({
    levelId: scenario.levelId,
    difficulty: scenario.difficulty,
    episodes,
    hyper: scenario.hyper,
    evaluateEvery: every,
    validationSeeds,
    onProgress: (p: TrainingPoint) => console.log(`  ep ${p.episode}: retorno ${p.meanReturn.toFixed(1)}, valida gana ${(p.validationClearRate! * 100).toFixed(0)} %, daño ${p.validationDamage!.toFixed(1)}`)
  });
  for (const p of curve) {
    curveRows.push([scenario.id, p.episode, p.epsilon.toFixed(3), p.meanReturn.toFixed(2), p.validationClearRate!.toFixed(3), p.validationDamage!.toFixed(1), p.validationDurationS!.toFixed(1), p.visitedStates].join(','));
  }
  writeFileSync(
    join(outDir, `qlearn-tabla-${scenario.id}.json`),
    JSON.stringify(serializeQTable(table, { trainedOn: { levelId: scenario.levelId, difficulty: scenario.difficulty, episodes, seedStart: 1 }, hyper })) + '\n'
  );

  const bots: Array<[string, SimBotFactory]> = [
    ['quieto', idleBotFactory],
    ['aleatorio', randomBotFactory],
    ['guionado', scriptedBotFactory],
    ['q-learning', createQBotFactory(table)]
  ];
  const byBot = new Map<string, SimEpisodeResult[]>();
  for (const [name, bot] of bots) {
    const results = testSeeds.map((seed) => runEpisode({ levelId: scenario.levelId, seed, bot, difficultyId: scenario.difficulty }));
    byBot.set(name, results);
    for (const r of results) {
      csvRows.push([scenario.id, name, r.seed, r.outcome, r.durationMs, r.damageTaken.toFixed(1), r.bossHealthFraction === null ? '' : r.bossHealthFraction.toFixed(3), r.digest].join(','));
    }
  }

  md.push(`## ${scenario.title}`);
  md.push('');
  md.push(`Entrenamiento: ${episodes} episodios (${scenario.hasBoss ? 'el jefe es el rival' : 'enemigos del nivel'}). Estados visitados: ${table.visitedStates()} de ${STATE_COUNT}.`);
  md.push('');
  md.push('### Curva de aprendizaje (política voraz en 20 semillas de validación)');
  md.push('');
  md.push('| Episodio de entrenamiento | Gana | Daño recibido | Duración (s) |');
  md.push('|---|---|---|---|');
  md.push(`| 0 (tabla en ceros) | ${(zero.clear * 100).toFixed(0)} % | ${zero.damage.toFixed(1)} | ${zero.durationS.toFixed(1)} |`);
  for (const p of curve) md.push(`| ${p.episode} | ${(p.validationClearRate! * 100).toFixed(0)} % | ${p.validationDamage!.toFixed(1)} | ${p.validationDurationS!.toFixed(1)} |`);
  md.push('');
  md.push(`### Prueba en ${testSeedCount} semillas no vistas`);
  md.push('');
  md.push(`| Bot | Gana | Muere | Tiempo agotado | Daño recibido (media ± IC95) | Duración s (media ± IC95) |${scenario.hasBoss ? ' Vida restante del jefe (media ± IC95) |' : ''}`);
  md.push(`|---|---|---|---|---|---|${scenario.hasBoss ? '---|' : ''}`);
  for (const [name] of bots) {
    const rs = byBot.get(name)!;
    const count = (o: string): number => rs.filter((r) => r.outcome === o).length;
    md.push(
      `| ${name} | ${pct(count('cleared'), rs.length)} | ${pct(count('death'), rs.length)} | ${pct(count('timeout'), rs.length)} | ${pm(rs.map((r) => r.damageTaken))} | ${pm(rs.map((r) => r.durationMs / 1000))} |${scenario.hasBoss ? ` ${pm(rs.map((r) => r.bossHealthFraction ?? 0), 2)} |` : ''}`
    );
  }
  md.push('');
  const q = byBot.get('q-learning')!;
  const g = byBot.get('guionado')!;
  const diff = (f: (r: SimEpisodeResult) => number): string => pm(q.map((r, i) => f(r) - f(g[i])), 2);
  md.push('Diferencia pareada por semilla, q-learning menos guionado (media ± IC95; negativo = mejor para q-learning en estas tres):');
  md.push('');
  md.push(`- Daño recibido: ${diff((r) => r.damageTaken)}`);
  md.push(`- Duración (s): ${pm(q.map((r, i) => (r.durationMs - g[i].durationMs) / 1000), 2)}`);
  if (scenario.hasBoss) md.push(`- Vida restante del jefe: ${diff((r) => r.bossHealthFraction ?? 0)}`);
  md.push('');
}

writeFileSync(join(outDir, 'bench-qlearn.csv'), csvRows.join('\n') + '\n');
writeFileSync(join(outDir, 'qlearn-curva.csv'), curveRows.join('\n') + '\n');
writeFileSync(join(outDir, 'bench-qlearn.md'), md.join('\n') + '\n');
console.log(`\nListo en ${((Date.now() - started) / 1000).toFixed(0)} s. Archivos en resultados/.`);
