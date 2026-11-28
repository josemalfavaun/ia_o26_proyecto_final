import { describe, expect, it } from 'vitest';
import { bossRepertoire, createExpectimaxBossPolicy } from '../ai/expectimax/policy';
import { createMctsBossPolicy } from '../ai/mcts/policy';
import { scriptedBotFactory } from '../ai/sim/bots';
import { runEpisode } from '../ai/sim/runEpisode';
import { createSimWorld } from '../ai/sim/SimWorld';
import { volleyCandidates, type RaycastBossPlayerContext } from '../game/raycast/RaycastBossAI';
import { RAYCAST_LEVEL_BOSS } from '../game/raycast/RaycastLevel';

function arena(offsetY = 3.4, vx = 0) {
  const world = createSimWorld({ levelId: RAYCAST_LEVEL_BOSS.id, seed: 1 });
  const boss = world.bosses[0];
  const player: RaycastBossPlayerContext = {
    x: boss.x,
    y: boss.y + offsetY,
    alive: true,
    stationaryMs: 0,
    vx,
    vy: 0,
    health: 100,
    damageTaken: 0
  };
  return { boss, player, map: world.map };
}

const context = {
  distance: 3.4,
  playerStationary: false,
  playerKiting: false,
  playerCornered: false,
  desperation: false,
  timeSinceLastVolleyMs: 800
};

describe('MCTS del jefe', () => {
  it('elige siempre un ataque del repertorio y cada iteración visita un hijo de la raíz', () => {
    const { boss, player, map } = arena();
    const policy = createMctsBossPolicy({ iterations: 120, horizon: 3, seed: 7 });
    const kind = policy.pickVolley(boss, player, map, context, 5000);
    expect(bossRepertoire(boss.behavior)).toContain(kind);
    const decision = policy.lastDecision()!;
    expect(decision.kind).toBe(kind);
    expect(decision.values.reduce((sum, entry) => sum + (entry.visits ?? 0), 0)).toBe(120);
    expect(policy.stats.iterations).toBe(120);
    // Cada iteración evalúa exactamente `horizon` salvas (árbol + simulación).
    expect(policy.stats.evaluations).toBe(120 * 3);
  });

  it('con la misma semilla decide lo mismo; con el grupo de la regla solo usa sus candidatos', () => {
    const run = (seed: number) => {
      const { boss, player, map } = arena(3.4, 4);
      const policy = createMctsBossPolicy({ iterations: 80, seed, pool: 'rule', objective: 'pacing', targetDamage: 4 });
      const picks = [0, 1, 2, 3].map((i) => policy.pickVolley(boss, { ...player, damageTaken: i * 3 }, map, context, 5000 + i * 900));
      return { picks, allowed: volleyCandidates(boss.behavior, boss.phase, context) };
    };
    const a = run(3);
    const b = run(3);
    expect(a.picks).toEqual(b.picks);
    for (const pick of a.picks) expect(a.allowed).toContain(pick);
  });

  it('con horizonte 1 y presupuesto grande coincide en valor con expectimax de profundidad 1', () => {
    const { boss, player, map } = arena(3.2);
    const exact = createExpectimaxBossPolicy({ depth: 1, pool: 'repertoire', objective: 'damage' });
    exact.pickVolley(boss, player, map, context, 5000);
    const values = new Map(exact.lastDecision()!.values.map((entry) => [entry.kind, entry.value]));
    const best = Math.max(...values.values());
    const mcts = createMctsBossPolicy({ iterations: 3000, horizon: 1, objective: 'damage', seed: 11 });
    const kind = mcts.pickVolley(boss, player, map, context, 5000)!;
    // La respuesta del jugador se sortea, así que se pide que la elegida esté cerca del óptimo exacto.
    expect(values.get(kind)!).toBeGreaterThanOrEqual(best * 0.9);
  });

  it('pelea un combate completo en el simulador', () => {
    const result = runEpisode({
      seed: 2,
      levelId: RAYCAST_LEVEL_BOSS.id,
      bot: scriptedBotFactory,
      bossPolicyFactory: (seed) => createMctsBossPolicy({ iterations: 64, seed }),
      maxMs: 20_000
    });
    expect(result.bossVolleys).toBeGreaterThan(0);
  });
});
