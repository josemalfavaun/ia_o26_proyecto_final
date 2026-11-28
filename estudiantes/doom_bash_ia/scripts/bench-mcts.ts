/**
 * Benchmark de MCTS para el jefe: regla original contra expectimax (prof. 1, 2 y 3) y contra MCTS con tres
 * presupuestos, sobre el mismo modelo del duelo y con los dos objetivos (daño y ritmo 4).
 *
 *   npm run bench:mcts                   # ajuste con semillas 1-20 y prueba con 10001-10100
 *   npm run bench:mcts -- --test 30      # prueba más corta
 *
 * Protocolo (como en Q-learning):
 *  1. Ajuste, semillas 1 a 20, jugador guionado, solo presión: se elige la constante de exploración c y el
 *     horizonte de MCTS, por objetivo. Las semillas de prueba no se usan para elegir nada.
 *  2. Prueba, semillas 10001 en adelante, una sola vez: todas las políticas, jugador guionado y aleatorio.
 *
 * Mediciones por celda, con las mismas semillas para todas las políticas:
 *  - Presión: jugador invulnerable 45 s. Daño por salva y error de ritmo |daño por salva − 4|.
 *  - Combate: jugador normal hasta 90 s. Porcentaje en que el jugador vence al jefe, tiempo que sobrevive, vida del jefe.
 *  - Costo: evaluaciones del modelo y milisegundos por decisión (los ms dependen de la computadora).
 * Escribe resultados/bench-mcts.md, bench-mcts.csv y bench-mcts-ajuste.csv.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BossObjective } from '../src/ai/expectimax/objective';
import { createExpectimaxBossPolicy } from '../src/ai/expectimax/policy';
import { createMctsBossPolicy } from '../src/ai/mcts/policy';
import { randomBotFactory, scriptedBotFactory } from '../src/ai/sim/bots';
import { runBatch } from '../src/ai/sim/runEpisode';
import { proportion, summarize } from '../src/ai/sim/stats';
import type { SimBotFactory } from '../src/ai/types';
import type { RaycastBossPolicy } from '../src/game/raycast/RaycastBossPolicy';

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
}

const TARGET = 4;
const BOSSES = ['volt-archon-pit', 'bloom-warden-pit', 'ash-judge-seal'];
const TUNE_SEEDS = Array.from({ length: arg('tune', 20) }, (_, i) => i + 1);
const TEST_SEEDS = Array.from({ length: arg('test', 100) }, (_, i) => 10001 + i);
const TUNE_ITERATIONS = 256;
const BUDGETS = [64, 256, 1024];
const EXPLORATIONS = [0.3, 0.7, 1.4];
const HORIZONS = [2, 4, 6];
const OBJECTIVES: BossObjective[] = ['damage', 'pacing'];
const OBJECTIVE_LABEL: Record<BossObjective, string> = { damage: 'daño', pacing: `ritmo ${TARGET}` };

interface Costly {
  stats: { decisions: number; evaluations: number; wallMs: number };
}

/** Fábrica que además guarda cada política creada para sumar su costo. */
function tracked(make: (seed: number) => RaycastBossPolicy & Costly) {
  const created: Costly[] = [];
  return {
    factory: (seed: number) => {
      const policy = make(seed);
      created.push(policy);
      return policy;
    },
    cost() {
      const decisions = created.reduce((s, p) => s + p.stats.decisions, 0) || 1;
      return {
        evaluations: created.reduce((s, p) => s + p.stats.evaluations, 0) / decisions,
        ms: created.reduce((s, p) => s + p.stats.wallMs, 0) / decisions
      };
    }
  };
}

function pressureMetric(objective: BossObjective, damage: number, volleys: number): number {
  const perVolley = damage / Math.max(1, volleys);
  return objective === 'damage' ? perVolley : Math.abs(perVolley - TARGET);
}

// ---------- 1. Ajuste ----------
const tuneCsv = ['objective,exploration,horizon,boss,seed,pressure_damage,pressure_volleys'];
const chosen = {} as Record<BossObjective, { exploration: number; horizon: number; score: number }>;
for (const objective of OBJECTIVES) {
  let best: { exploration: number; horizon: number; score: number } | null = null;
  for (const exploration of EXPLORATIONS) {
    for (const horizon of HORIZONS) {
      const scores: number[] = [];
      for (const boss of BOSSES) {
        const runs = runBatch(
          {
            levelId: boss,
            bot: scriptedBotFactory,
            invulnerable: true,
            maxMs: 45_000,
            bossPolicyFactory: (seed) =>
              createMctsBossPolicy({ iterations: TUNE_ITERATIONS, exploration, horizon, objective, targetDamage: TARGET, seed })
          },
          TUNE_SEEDS
        );
        runs.forEach((r, i) => {
          tuneCsv.push([objective, exploration, horizon, boss, TUNE_SEEDS[i], r.damageTaken.toFixed(1), r.bossVolleys].join(','));
          scores.push(pressureMetric(objective, r.damageTaken, r.bossVolleys));
        });
      }
      const mean = summarize(scores).mean;
      // 'damage' se maximiza; el error de ritmo se minimiza.
      const score = objective === 'damage' ? mean : -mean;
      if (!best || score > best.score) best = { exploration, horizon, score };
    }
  }
  chosen[objective] = best!;
  console.log(`ajuste ${objective}: c=${best!.exploration}, horizonte=${best!.horizon}`);
}

// ---------- 2. Prueba ----------
const PLAYERS: Array<[string, SimBotFactory]> = [
  ['guionado', scriptedBotFactory],
  ['aleatorio', randomBotFactory]
];

type Entry = [string, ReturnType<typeof tracked> | null];
function policiesFor(objective: BossObjective): Entry[] {
  const { exploration, horizon } = chosen[objective];
  return [
    ['regla original', null],
    ...[1, 2, 3].map(
      (depth): Entry => [
        `expectimax prof. ${depth}`,
        tracked(() => createExpectimaxBossPolicy({ depth, pool: 'repertoire', objective, targetDamage: TARGET }))
      ]
    ),
    ...BUDGETS.map(
      (iterations): Entry => [
        `MCTS ${iterations} it.`,
        tracked((seed) => createMctsBossPolicy({ iterations, exploration, horizon, objective, targetDamage: TARGET, seed }))
      ]
    )
  ];
}

const csv = ['objective,boss,player,policy,seed,pressure_damage,pressure_volleys,outcome,survival_ms,boss_health_fraction'];
const sections: string[] = [];
const pairedLines: string[] = [];

for (const objective of OBJECTIVES) {
  const metricName = objective === 'damage' ? 'Daño por salva (más es más duro)' : `Error de ritmo vs ${TARGET} (menos es mejor)`;
  const rows = [
    `| Jefe | Jugador | Política | ${metricName} | Jugador vence al jefe | Sobrevive, s | Vida del jefe | Evaluaciones por decisión | ms por decisión |`,
    '|---|---|---|---|---|---|---|---|---|'
  ];
  for (const boss of BOSSES) {
    for (const [playerName, bot] of PLAYERS) {
      const perPolicy = new Map<string, number[]>();
      for (const [policyName, entry] of policiesFor(objective)) {
        const factory = entry?.factory;
        const pressure = runBatch({ levelId: boss, bot, bossPolicyFactory: factory, invulnerable: true, maxMs: 45_000 }, TEST_SEEDS);
        const combat = runBatch({ levelId: boss, bot, bossPolicyFactory: factory, maxMs: 90_000 }, TEST_SEEDS);
        const metric = pressure.map((r) => pressureMetric(objective, r.damageTaken, r.bossVolleys));
        perPolicy.set(policyName, metric);
        TEST_SEEDS.forEach((seed, i) => {
          csv.push(
            [
              objective,
              boss,
              playerName,
              policyName,
              seed,
              pressure[i].damageTaken.toFixed(1),
              pressure[i].bossVolleys,
              combat[i].outcome,
              combat[i].durationMs,
              (combat[i].bossHealthFraction ?? 0).toFixed(3)
            ].join(',')
          );
        });
        const m = summarize(metric);
        const wins = proportion(combat.filter((r) => r.outcome === 'cleared').length, TEST_SEEDS.length);
        const survival = summarize(combat.map((r) => r.durationMs / 1000));
        const bossHealth = summarize(combat.map((r) => r.bossHealthFraction ?? 0));
        const cost = entry?.cost();
        rows.push(
          `| ${boss} | ${playerName} | ${policyName} | ${m.mean.toFixed(2)} ± ${m.ci95.toFixed(2)} | ${(wins.p * 100).toFixed(0)} % ± ${(
            wins.ci95 * 100
          ).toFixed(0)} | ${survival.mean.toFixed(1)} ± ${survival.ci95.toFixed(1)} | ${bossHealth.mean.toFixed(2)} | ${
            cost ? cost.evaluations.toFixed(0) : '–'
          } | ${cost ? cost.ms.toFixed(2) : '–'} |`
        );
      }
      // Diferencia pareada (mismas semillas): MCTS 256 contra la mejor profundidad de expectimax en esta celda.
      const better = (a: number, b: number) => (objective === 'damage' ? a > b : a < b);
      let bestEx = 'expectimax prof. 1';
      for (const depth of [2, 3]) {
        const name = `expectimax prof. ${depth}`;
        if (better(summarize(perPolicy.get(name)!).mean, summarize(perPolicy.get(bestEx)!).mean)) bestEx = name;
      }
      const mcts = perPolicy.get('MCTS 256 it.')!;
      const ex = perPolicy.get(bestEx)!;
      const diff = summarize(mcts.map((v, i) => v - ex[i]));
      pairedLines.push(
        `| ${OBJECTIVE_LABEL[objective]} | ${boss} | ${playerName} | ${bestEx} | ${diff.mean.toFixed(2)} ± ${diff.ci95.toFixed(2)} |`
      );
      console.log(`${objective} / ${boss} / ${playerName} listo`);
    }
  }
  sections.push(
    `## Objetivo: ${OBJECTIVE_LABEL[objective]}\n\nMCTS ajustado: c = ${chosen[objective].exploration}, horizonte = ${chosen[objective].horizon} salvas.\n\n${rows.join('\n')}`
  );
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resultados');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'bench-mcts-ajuste.csv'), `${tuneCsv.join('\n')}\n`);
writeFileSync(join(outDir, 'bench-mcts.csv'), `${csv.join('\n')}\n`);
writeFileSync(
  join(outDir, 'bench-mcts.md'),
  `# Benchmark de MCTS para el jefe

Ajuste: semillas ${TUNE_SEEDS[0]} a ${TUNE_SEEDS[TUNE_SEEDS.length - 1]}, jugador guionado, ${TUNE_ITERATIONS} iteraciones, rejilla c ∈ {${EXPLORATIONS.join(', ')}} × horizonte ∈ {${HORIZONS.join(', ')}}.
Prueba: semillas ${TEST_SEEDS[0]} a ${TEST_SEEDS[TEST_SEEDS.length - 1]} (${TEST_SEEDS.length}), medidas una sola vez; no se usaron para ajustar.
Todas las políticas buscan sobre el mismo modelo del duelo (\`src/ai/expectimax/model.ts\`) con el repertorio completo del jefe.
"Daño por salva" y "error de ritmo": jugador invulnerable 45 s. Combate: jugador normal hasta 90 s. IC95 (Wilson en las proporciones).
Las evaluaciones por decisión miden el costo de búsqueda en la misma unidad para las dos búsquedas; los ms dependen de la computadora.

${sections.join('\n\n')}

## Diferencia pareada: MCTS 256 it. menos la mejor profundidad de expectimax en cada celda

Mismas semillas; media ± IC95. En "daño", positivo es que MCTS presiona más; en "ritmo", negativo es que MCTS se acerca más a la meta.
Ojo: escoger "la mejor profundidad" con los mismos datos favorece un poco a expectimax.

| Objetivo | Jefe | Jugador | Contra | Diferencia |
|---|---|---|---|---|
${pairedLines.join('\n')}
`
);
console.log('Listo. Archivos en resultados/.');
