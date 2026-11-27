import { describe, expect, it } from 'vitest';
import { PRESSURE_ARMS } from '../ai/bandit/arms';
import { analyzeStudy, parseStudyFile, spearman, studyMarkdown } from '../ai/study/analysis';
import type { StudyFile } from '../ai/runtime/AiRuntime';
import { createSeededRng } from '../ai/sim/rng';

/** Archivo sintético SOLO para probar el código: la vida final baja con la presión del brazo. No son datos reales. */
function syntheticFile(anonId: string, count: number, seed: number): StudyFile {
  const rng = createSeededRng(seed);
  const encounters = Array.from({ length: count }, (_, i) => {
    const arm = PRESSURE_ARMS[Math.floor(rng() * PRESSURE_ARMS.length)];
    const health = Math.min(1, Math.max(0, 1 - arm.targetDamage / 14 + (rng() - 0.5) * 0.2));
    const died = health < 0.05;
    return {
      n: i + 1,
      atIso: '2026-01-01T00:00:00.000Z',
      levelId: 'volt-archon-pit',
      difficulty: 'standard',
      armId: arm.id,
      targetDamage: arm.targetDamage,
      reward: (!died && health >= 0.3 && health <= 0.7 ? 1 : 0) as 0 | 1,
      healthFraction: health,
      reason: (died ? 'death' : 'timeout') as 'death' | 'timeout',
      elapsedMs: 40000
    };
  });
  return { version: 1, game: 'doom-bash-ia', anonId, consentIso: '2026-01-01T00:00:00.000Z', encounters };
}

describe('analisis del modo estudio', () => {
  it('spearman: monótona perfecta, inversa y degenerada', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNaN();
    expect(spearman([1, 2], [1, 2])).toBeNaN();
  });

  it('rechaza archivos con formato inválido y acepta los válidos', () => {
    expect(parseStudyFile('no es json')).toBeNull();
    expect(parseStudyFile(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseStudyFile(JSON.stringify({ version: 1, game: 'otro', anonId: 'x', encounters: [] }))).toBeNull();
    expect(parseStudyFile(JSON.stringify({ version: 1, game: 'doom-bash-ia', anonId: 'x', consentIso: 'y', encounters: [{ armId: 1 }] }))).toBeNull();
    expect(parseStudyFile(JSON.stringify(syntheticFile('abc', 3, 1)))).not.toBeNull();
  });

  it('agrega por brazo y detecta que más presión baja la vida', () => {
    const files = [syntheticFile('a', 120, 1), syntheticFile('b', 120, 2), syntheticFile('c', 30, 3)];
    const analysis = analyzeStudy(files, { invalidFiles: 2 });
    expect(analysis.participants).toBe(3);
    expect(analysis.encounters).toBe(270);
    expect(analysis.invalidFiles).toBe(2);
    expect(analysis.perArm.reduce((sum, row) => sum + row.n, 0)).toBe(270);
    expect(analysis.spearmanPressureHealth).toBeLessThan(-0.8);
    const first = analysis.perArm[0];
    const last = analysis.perArm[analysis.perArm.length - 1];
    expect(first.meanHealthFraction).toBeGreaterThan(last.meanHealthFraction);
  });

  it('la repetición por rechazo da recompensas válidas y reporta cuánta evidencia usó', () => {
    const analysis = analyzeStudy([syntheticFile('a', 120, 4), syntheticFile('b', 120, 5)], { replicas: 30 });
    expect(analysis.participantsWithEnoughData).toBe(2);
    expect(analysis.replay.map((r) => r.name)).toHaveLength(2);
    for (const row of analysis.replay) {
      expect(row.meanReward).toBeGreaterThanOrEqual(0);
      expect(row.meanReward).toBeLessThanOrEqual(1);
      // Con 9 brazos se acepta ~1/9 de los encuentros registrados (120 → ~13).
      expect(row.acceptedPerSession).toBeGreaterThan(5);
      expect(row.acceptedPerSession).toBeLessThan(25);
    }
  });

  it('sesiones cortas no se evalúan y el markdown lo dice sin inventar números', () => {
    const analysis = analyzeStudy([syntheticFile('a', 5, 6)]);
    expect(analysis.replay).toHaveLength(0);
    const md = studyMarkdown(analysis, 20);
    expect(md).toContain('Nadie alcanzó 20 encuentros');
    expect(md).toContain('| ritmo-1 |');
  });
});
