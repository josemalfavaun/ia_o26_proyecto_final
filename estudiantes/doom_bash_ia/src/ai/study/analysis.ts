/**
 * Análisis de los archivos del modo estudio (partidas con personas).
 *
 * Los datos salen del juego con brazos asignados de forma uniforme al azar, así que:
 *  1. La comparación entre brazos no tiene sesgo de selección (cada brazo ve jugadores parecidos).
 *  2. Se puede evaluar OFFLINE cualquier política con el método de repetición por rechazo (Li et al., 2011): la política
 *     propone un brazo; si coincide con el registrado se acepta ese resultado y la política aprende; si no, se descarta.
 *     Con registro uniforme el estimador es insesgado.
 * Qué NO permite: con unas decenas de encuentros por persona y 9 brazos, el bandido no alcanza a aprender dentro de una
 * sola sesión real. Lo que se valida es el SIMULADOR (¿los brazos con más presión bajan más la vida de personas reales?
 * ¿la banda de reto tiene sentido?), no una mejora de Thompson sobre el azar.
 */
import { PRESSURE_ARMS } from '../bandit/arms';
import { createThompsonSelector } from '../bandit/policies';
import { createUniformSelector } from '../bandit/policies';
import { mean, proportionCi } from './numeric';
import type { StudyEncounter, StudyFile } from '../runtime/AiRuntime';

export interface ArmRow {
  armId: string;
  targetDamage: number;
  n: number;
  /** Fracción de encuentros que cayeron en la banda de reto (recompensa 1) con su intervalo de Wilson. */
  inBand: number;
  inBandCi: number;
  deathRate: number;
  meanHealthFraction: number;
}

export interface ReplayRow {
  name: string;
  /** Recompensa media por encuentro aceptado, promediada sobre réplicas. */
  meanReward: number;
  /** Encuentros aceptados por sesión y réplica (cuánta evidencia usó el estimador). */
  acceptedPerSession: number;
}

export interface StudyAnalysis {
  participants: number;
  encounters: number;
  invalidFiles: number;
  perArm: ArmRow[];
  /** Spearman entre daño objetivo del brazo y fracción de vida final. Negativo = más presión, menos vida. */
  spearmanPressureHealth: number;
  /** Cuántas personas tienen al menos `minEncounters` encuentros. */
  participantsWithEnoughData: number;
  replay: ReplayRow[];
  byLevel: Array<{ levelId: string; encounters: number }>;
}

export function parseStudyFile(text: string): StudyFile | null {
  try {
    const value = JSON.parse(text) as Partial<StudyFile>;
    if (value.version !== 1 || value.game !== 'doom-bash-ia' || typeof value.anonId !== 'string' || !Array.isArray(value.encounters)) return null;
    const ok = value.encounters.every(
      (e) => typeof e === 'object' && e !== null && typeof e.armId === 'string' && (e.reward === 0 || e.reward === 1) && typeof e.healthFraction === 'number'
    );
    return ok ? (value as StudyFile) : null;
  } catch {
    return null;
  }
}

function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) result[order[k].index] = rank;
    i = j + 1;
  }
  return result;
}

export function spearman(x: readonly number[], y: readonly number[]): number {
  if (x.length < 3 || x.length !== y.length) return Number.NaN;
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? Number.NaN : num / Math.sqrt(dx * dy);
}

/** Repetición por rechazo de una política sobre una sesión registrada con brazos uniformes. */
function replaySession(encounters: readonly StudyEncounter[], make: (seed: number) => { select(): number; update(arm: number, reward: 0 | 1): void }, seed: number): { rewards: number[] } {
  const policy = make(seed);
  const rewards: number[] = [];
  const armIndex = new Map(PRESSURE_ARMS.map((arm, index) => [arm.id, index]));
  for (const encounter of encounters) {
    const logged = armIndex.get(encounter.armId);
    if (logged === undefined) continue;
    if (policy.select() === logged) {
      policy.update(logged, encounter.reward);
      rewards.push(encounter.reward);
    }
  }
  return { rewards };
}

export function analyzeStudy(files: readonly StudyFile[], options: { invalidFiles?: number; minEncounters?: number; replicas?: number } = {}): StudyAnalysis {
  const minEncounters = options.minEncounters ?? 20;
  const replicas = options.replicas ?? 200;
  const all = files.flatMap((file) => file.encounters);

  const perArm: ArmRow[] = PRESSURE_ARMS.map((arm) => {
    const rows = all.filter((e) => e.armId === arm.id);
    const hits = rows.filter((e) => e.reward === 1).length;
    const { p, ci95 } = proportionCi(hits, rows.length);
    return {
      armId: arm.id,
      targetDamage: arm.targetDamage,
      n: rows.length,
      inBand: p,
      inBandCi: ci95,
      deathRate: rows.length ? rows.filter((e) => e.reason === 'death').length / rows.length : Number.NaN,
      meanHealthFraction: rows.length ? mean(rows.map((e) => e.healthFraction)) : Number.NaN
    };
  });

  const spearmanPressureHealth = spearman(
    all.map((e) => e.targetDamage),
    all.map((e) => e.healthFraction)
  );

  const sessions = files.filter((file) => file.encounters.length >= minEncounters);
  const policies: Array<{ name: string; make: (seed: number) => { select(): number; update(arm: number, reward: 0 | 1): void } }> = [
    { name: 'Thompson (a ciegas, desde cero)', make: (seed) => createThompsonSelector({ arms: PRESSURE_ARMS.length, seed }) },
    { name: 'Azar uniforme', make: (seed) => createUniformSelector({ arms: PRESSURE_ARMS.length, seed }) }
  ];
  const replay: ReplayRow[] = [];
  if (sessions.length > 0) {
    for (const policy of policies) {
      const rewards: number[] = [];
      let accepted = 0;
      for (let r = 0; r < replicas; r += 1) {
        for (const session of sessions) {
          const out = replaySession(session.encounters, policy.make, 1000 + r);
          rewards.push(...out.rewards);
          accepted += out.rewards.length;
        }
      }
      replay.push({ name: policy.name, meanReward: rewards.length ? mean(rewards) : Number.NaN, acceptedPerSession: accepted / (replicas * sessions.length) });
    }
  }

  const levels = new Map<string, number>();
  for (const e of all) levels.set(e.levelId, (levels.get(e.levelId) ?? 0) + 1);

  return {
    participants: files.length,
    encounters: all.length,
    invalidFiles: options.invalidFiles ?? 0,
    perArm,
    spearmanPressureHealth,
    participantsWithEnoughData: sessions.length,
    replay,
    byLevel: [...levels.entries()].map(([levelId, encounters]) => ({ levelId, encounters })).sort((a, b) => b.encounters - a.encounters)
  };
}

const pct = (value: number, digits = 0): string => (Number.isNaN(value) ? '—' : `${(value * 100).toFixed(digits)} %`);

export function studyMarkdown(analysis: StudyAnalysis, minEncounters = 20): string {
  const lines: string[] = [];
  lines.push('# Modo estudio: partidas con personas');
  lines.push('');
  lines.push(
    `Personas (archivos válidos): **${analysis.participants}** · encuentros: **${analysis.encounters}** · archivos descartados por formato: ${analysis.invalidFiles}.`
  );
  lines.push('');
  lines.push('Cada encuentro es una pelea contra el jefe de 40 s con un brazo asignado de forma uniforme al azar. La recompensa es 1 si la persona termina viva con entre 30 % y 70 % de vida.');
  lines.push('');
  lines.push('## Resultado por brazo');
  lines.push('');
  lines.push('| Brazo | Encuentros | En banda (IC 95 %) | Muertes | Vida final media |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const row of analysis.perArm) {
    lines.push(`| ${row.armId} | ${row.n} | ${pct(row.inBand)} ± ${pct(row.inBandCi)} | ${pct(row.deathRate)} | ${pct(row.meanHealthFraction)} |`);
  }
  lines.push('');
  lines.push(
    `Correlación de Spearman entre la presión del brazo y la vida final: **${Number.isNaN(analysis.spearmanPressureHealth) ? '—' : analysis.spearmanPressureHealth.toFixed(3)}** (si los brazos hacen lo que dice el simulador debería ser negativa).`
  );
  lines.push('');
  lines.push('## Repetición por rechazo (evaluación offline)');
  lines.push('');
  if (analysis.replay.length === 0) {
    lines.push(`Nadie alcanzó ${minEncounters} encuentros, así que no se evaluó ninguna política.`);
  } else {
    lines.push(`Sesiones con al menos ${minEncounters} encuentros: ${analysis.participantsWithEnoughData}.`);
    lines.push('');
    lines.push('| Política | Recompensa media | Encuentros aceptados por sesión |');
    lines.push('|---|---:|---:|');
    for (const row of analysis.replay) lines.push(`| ${row.name} | ${pct(row.meanReward, 1)} | ${row.acceptedPerSession.toFixed(1)} |`);
    lines.push('');
    lines.push('Con 9 brazos solo se acepta alrededor de un encuentro de cada nueve, así que cada sesión da poca evidencia; la diferencia entre políticas hay que leerla con ese cuidado.');
  }
  lines.push('');
  lines.push('## Por nivel');
  lines.push('');
  for (const level of analysis.byLevel) lines.push(`- ${level.levelId}: ${level.encounters}`);
  lines.push('');
  return lines.join('\n');
}
