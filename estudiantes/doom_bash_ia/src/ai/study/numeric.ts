import { proportion } from '../sim/stats';

export function mean(values: readonly number[]): number {
  return values.length === 0 ? Number.NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Proporción con intervalo de Wilson (semiancho). */
export function proportionCi(successes: number, total: number): { p: number; ci95: number } {
  return proportion(successes, total);
}
