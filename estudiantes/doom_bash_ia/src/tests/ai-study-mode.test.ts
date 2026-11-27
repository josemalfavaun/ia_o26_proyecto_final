import { describe, expect, it } from 'vitest';
import { createAiRuntime, ENCOUNTER_WINDOW_MS, isStudyRequested, type KeyValueStorage, type StudyFile } from '../ai/runtime/AiRuntime';
import { PRESSURE_ARMS } from '../ai/bandit/arms';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const frame = (nowMs: number, over: Partial<{ bossAlive: boolean; playerAlive: boolean; health: number }> = {}) => ({
  nowMs,
  bossAlive: true,
  playerAlive: true,
  health: 50,
  maxHealth: 100,
  levelId: 'volt-archon-pit',
  difficulty: 'standard',
  ...over
});

/**
 * Cierra `count` encuentros por ventana agotada. El runtime abre el siguiente en cuanto cierra uno (el jefe sigue vivo),
 * así que basta avanzar el reloj una ventana por encuentro.
 */
function playEncounters(runtime: ReturnType<typeof createAiRuntime>, count: number, startMs = 1000): number {
  let now = startMs;
  runtime.update(frame(now));
  for (let i = 0; i < count; i += 1) {
    now += ENCOUNTER_WINDOW_MS;
    runtime.update(frame(now));
  }
  return now;
}

describe('modo estudio: activación', () => {
  it('solo se pide con ?estudio=1 y no se activa sin consentimiento', () => {
    expect(isStudyRequested('?estudio=1')).toBe(true);
    expect(isStudyRequested('estudio=true&ia=astar')).toBe(true);
    expect(isStudyRequested('?ia=bandido')).toBe(false);
    expect(isStudyRequested('')).toBe(false);

    const normal = createAiRuntime({ query: '?ia=bandido', seed: 1 });
    expect(normal.studyRequested).toBe(false);
    expect(normal.enableStudy()).toBe(false);
    expect(normal.exportStudy()).toBeNull();

    const asked = createAiRuntime({ query: '?estudio=1', seed: 1 });
    expect(asked.studyRequested).toBe(true);
    expect(asked.studyActive).toBe(false);
    expect(asked.exportStudy()).toBeNull();
    expect(asked.enableStudy()).toBe(true);
    expect(asked.studyActive).toBe(true);
  });

  it('sin activar, jugar no guarda nada del estudio', () => {
    const storage = memoryStorage();
    const runtime = createAiRuntime({ query: '?estudio=1', storage, seed: 2 });
    playEncounters(runtime, 3);
    expect(runtime.studyCount()).toBe(0);
    expect(storage.data.has('doom-bash-ia:estudio:v1')).toBe(false);
  });
});

describe('modo estudio: registro de encuentros', () => {
  it('guarda cada encuentro con su brazo, resultado y contexto, y no aprende', () => {
    const storage = memoryStorage();
    const runtime = createAiRuntime({ query: '?estudio=1', storage, seed: 3 });
    runtime.enableStudy();
    playEncounters(runtime, 5);
    expect(runtime.studyCount()).toBe(5);

    const file = JSON.parse(runtime.exportStudy() as string) as StudyFile;
    expect(file.version).toBe(1);
    expect(file.game).toBe('doom-bash-ia');
    expect(file.anonId).toMatch(/^[0-9a-f]{16}$/);
    expect(file.encounters).toHaveLength(5);
    for (const encounter of file.encounters) {
      expect(PRESSURE_ARMS.map((arm) => arm.id)).toContain(encounter.armId);
      expect(encounter.levelId).toBe('volt-archon-pit');
      expect(encounter.difficulty).toBe('standard');
      expect(encounter.reason).toBe('timeout');
      expect(encounter.healthFraction).toBeCloseTo(0.5);
      expect(encounter.reward).toBe(1); // 50 % de vida cae dentro de la banda 30-70 %
      expect(encounter.elapsedMs).toBe(ENCOUNTER_WINDOW_MS);
    }
    // El bandido no recibió ninguna evidencia: sus creencias no se tocan en el modo estudio.
    expect(storage.data.has('doom-bash-ia:bandido:v1')).toBe(false);
  });

  it('el archivo no contiene datos personales', () => {
    const runtime = createAiRuntime({ query: '?estudio=1', storage: memoryStorage(), seed: 4 });
    runtime.enableStudy();
    playEncounters(runtime, 2);
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key);
          walk(inner);
        }
      }
    };
    walk(JSON.parse(runtime.exportStudy() as string));
    expect([...keys].sort()).toEqual(
      ['anonId', 'atIso', 'consentIso', 'difficulty', 'elapsedMs', 'encounters', 'game', 'healthFraction', 'levelId', 'n', 'reason', 'reward', 'armId', 'targetDamage', 'version'].sort()
    );
  });

  it('los brazos se asignan de forma uniforme al azar (no por Thompson)', () => {
    const runtime = createAiRuntime({ query: '?estudio=1', storage: memoryStorage(), seed: 5 });
    runtime.enableStudy();
    playEncounters(runtime, 900);
    const counts = new Map<string, number>();
    for (const encounter of (JSON.parse(runtime.exportStudy() as string) as StudyFile).encounters) {
      counts.set(encounter.armId, (counts.get(encounter.armId) ?? 0) + 1);
    }
    expect(counts.size).toBe(PRESSURE_ARMS.length);
    for (const count of counts.values()) expect(count).toBeGreaterThan(60); // esperado 100 por brazo
  });

  it('la muerte y la caída del jefe cierran el encuentro con su razón', () => {
    const runtime = createAiRuntime({ query: '?estudio=1', storage: memoryStorage(), seed: 6 });
    runtime.enableStudy();
    runtime.update(frame(1000));
    runtime.update(frame(5000, { playerAlive: false, health: 0 }));
    runtime.update(frame(6000, { bossAlive: false, playerAlive: true, health: 100 }));
    runtime.update(frame(7000));
    runtime.update(frame(9000, { bossAlive: false }));
    const encounters = (JSON.parse(runtime.exportStudy() as string) as StudyFile).encounters;
    expect(encounters.map((e) => e.reason)).toEqual(['death', 'cleared']);
    expect(encounters[0].reward).toBe(0);
  });

  it('persiste entre recargas con el mismo identificador anónimo y no deja cambiar el modo del jefe', () => {
    const storage = memoryStorage();
    const first = createAiRuntime({ query: '?estudio=1', storage, seed: 7 });
    first.enableStudy();
    playEncounters(first, 2);
    const anon = (JSON.parse(first.exportStudy() as string) as StudyFile).anonId;

    const second = createAiRuntime({ query: '?estudio=1', storage, seed: 8 });
    expect(second.studyActive).toBe(true);
    expect(second.studyCount()).toBe(2);
    playEncounters(second, 1);
    const file = JSON.parse(second.exportStudy() as string) as StudyFile;
    expect(file.anonId).toBe(anon);
    expect(file.encounters.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(second.cycleBossDirector()).toBe('bandit');
  });
});
