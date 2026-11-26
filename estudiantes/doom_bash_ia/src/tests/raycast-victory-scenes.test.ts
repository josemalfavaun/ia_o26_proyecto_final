import { describe, expect, it } from 'vitest';
import {
  alarmPulse,
  BOARDING_MS,
  buildingHeightAt,
  corridorProgress,
  damageStage,
  debrisFor,
  doorDistance,
  doorOpenAmount,
  EPILOGUE_LINES,
  epilogueTypingMs,
  epilogueVeil,
  exteriorTime,
  explosionState,
  FACILITY_BUILDINGS,
  FACILITY_EXPLOSIONS,
  flashAlpha,
  HELICOPTER_FRAMES,
  helicopterPosition,
  operatorOnGround,
  operatorX,
  screenShake,
  smokeRise,
  SOLDIER_BACK_FRAMES,
  SOLDIER_FRAMES,
  soldierBackFrame,
  soldierFrame,
  sunProgress,
  titleAlpha,
  typedLines,
  victoryBeat,
  victoryCaption,
  VICTORY_BEATS,
  VICTORY_PIXEL,
  VICTORY_TITLE
} from '../game/raycast/RaycastVictoryScenes';

const rectangular = (frames: readonly (readonly string[])[]): boolean =>
  new Set(frames.flatMap((f) => f.map((row) => row.length))).size === 1 && new Set(frames.map((f) => f.length)).size === 1;

describe('escena final: tiempos', () => {
  it('el título es MISIÓN CUMPLIDA', () => {
    expect(VICTORY_TITLE).toBe('MISIÓN CUMPLIDA');
  });

  it('los cuatro tiempos son contiguos y en orden', () => {
    expect(VICTORY_BEATS.map((b) => b.id)).toEqual(['corridor', 'door', 'exterior', 'epilogue']);
    for (let i = 1; i < VICTORY_BEATS.length; i += 1) expect(VICTORY_BEATS[i].startMs).toBe(VICTORY_BEATS[i - 1].endMs);
    expect(VICTORY_BEATS[0].startMs).toBe(0);
  });

  it('victoryBeat ubica cada instante y el epílogo es el final', () => {
    expect(victoryBeat(0).id).toBe('corridor');
    expect(victoryBeat(8_000).id).toBe('door');
    expect(victoryBeat(12_000).id).toBe('exterior');
    expect(victoryBeat(31_000).id).toBe('epilogue');
    expect(victoryBeat(9_999_999)).toMatchObject({ id: 'epilogue', progress: 1 });
    expect(victoryBeat(-50).id).toBe('corridor');
    expect(victoryBeat(3_750).progress).toBeCloseTo(0.5, 5);
  });

  it('cada tiempo tiene su pie de pantalla y el final dice que salimos con vida', () => {
    for (let t = 0; t < 40_000; t += 500) expect(victoryCaption(t).length).toBeGreaterThan(0);
    expect(victoryCaption(0)).toMatch(/NÚCLEO/);
    expect(victoryCaption(35_000)).toMatch(/CON VIDA/);
    expect(victoryCaption(35_000)).toMatch(/COMPLETADO/);
  });
});

describe('escena final: pasillo y puerta', () => {
  it('la carrera avanza sin retroceder y la puerta se acerca', () => {
    let last = -1;
    let lastDist = Infinity;
    for (let t = 0; t <= 9_000; t += 250) {
      const p = corridorProgress(t);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(doorDistance(t)).toBeLessThanOrEqual(lastDist);
      last = p;
      lastDist = doorDistance(t);
    }
    expect(corridorProgress(VICTORY_BEATS[0].endMs)).toBe(1);
    expect(doorDistance(0)).toBeGreaterThan(doorDistance(8_000));
  });

  it('la puerta está cerrada al inicio y abierta del todo al terminar su tiempo', () => {
    expect(doorOpenAmount(0)).toBe(0);
    expect(doorOpenAmount(VICTORY_BEATS[1].startMs)).toBe(0);
    expect(doorOpenAmount(VICTORY_BEATS[1].endMs)).toBe(1);
  });

  it('el destello sube hacia el exterior y se apaga después', () => {
    expect(flashAlpha(0)).toBe(0);
    expect(flashAlpha(VICTORY_BEATS[2].startMs)).toBeGreaterThan(0.95);
    expect(flashAlpha(VICTORY_BEATS[2].startMs + 4_000)).toBe(0);
    for (let t = 0; t < 20_000; t += 100) {
      const f = flashAlpha(t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('la alarma oscila entre 0 y 1', () => {
    for (let t = 0; t < 3_000; t += 50) {
      expect(alarmPulse(t)).toBeGreaterThanOrEqual(0);
      expect(alarmPulse(t)).toBeLessThanOrEqual(1);
    }
  });

  it('los sprites son rectangulares y alternan cuadros', () => {
    for (const set of [SOLDIER_FRAMES, SOLDIER_BACK_FRAMES, HELICOPTER_FRAMES]) expect(rectangular(set)).toBe(true);
    expect(soldierFrame(0)).not.toBe(soldierFrame(300));
    expect(soldierFrame(0)).toBe(soldierFrame(520));
    expect(soldierBackFrame(0)).not.toBe(soldierBackFrame(200));
  });
});

describe('escena final: exterior', () => {
  const T0 = VICTORY_BEATS[2].startMs;

  it('exteriorTime nunca es negativo', () => {
    expect(exteriorTime(0)).toBe(0);
    expect(exteriorTime(T0 + 1_000)).toBe(1_000);
  });

  it('el sol solo sube', () => {
    let last = -1;
    for (let t = T0; t < T0 + 25_000; t += 250) {
      const s = sunProgress(t);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(sunProgress(T0)).toBe(0);
    expect(sunProgress(T0 + 25_000)).toBe(1);
  });

  it('los edificios solo bajan, en múltiplos de píxel y nunca desaparecen del todo', () => {
    for (const b of FACILITY_BUILDINGS) {
      let last = Infinity;
      for (let t = T0; t <= T0 + 20_000; t += 250) {
        const h = buildingHeightAt(b, t);
        expect(h).toBeLessThanOrEqual(last);
        expect(h % VICTORY_PIXEL).toBe(0);
        expect(h).toBeGreaterThanOrEqual(VICTORY_PIXEL);
        last = h;
      }
      expect(Math.abs(buildingHeightAt(b, T0) - b.height)).toBeLessThanOrEqual(VICTORY_PIXEL / 2);
      expect(buildingHeightAt(b, T0 + 20_000)).toBeLessThan(b.height * 0.2);
    }
  });

  it('las explosiones ocurren en cadena, dentro del lienzo, y cada una crece y se apaga', () => {
    for (let i = 1; i < FACILITY_EXPLOSIONS.length; i += 1) {
      expect(FACILITY_EXPLOSIONS[i].startMs).toBeGreaterThan(FACILITY_EXPLOSIONS[i - 1].startMs);
    }
    for (const e of FACILITY_EXPLOSIONS) {
      expect(e.x).toBeGreaterThan(0);
      expect(e.x).toBeLessThan(960);
      expect(e.y).toBeGreaterThan(0);
      expect(e.y).toBeLessThan(540);
      expect(explosionState(e, T0 + e.startMs - 10)).toBeNull();
      expect(explosionState(e, T0 + e.startMs + e.durationMs + 10)).toBeNull();
      const early = explosionState(e, T0 + e.startMs + e.durationMs * 0.2)!;
      const late = explosionState(e, T0 + e.startMs + e.durationMs * 0.9)!;
      expect(late.radius).toBeGreaterThan(early.radius);
      expect(late.alpha).toBeLessThan(early.alpha);
    }
  });

  it('la etapa de daño cuenta explosiones ya ocurridas', () => {
    expect(damageStage(T0)).toBe(0);
    expect(damageStage(T0 + 60_000)).toBe(FACILITY_EXPLOSIONS.length);
  });

  it('la sacudida es múltiplo de píxel y se apaga al terminar la cadena', () => {
    let max = 0;
    for (let t = T0; t < T0 + 20_000; t += 50) {
      const s = screenShake(t);
      expect(s % VICTORY_PIXEL).toBe(0);
      max = Math.max(max, s);
    }
    expect(max).toBeGreaterThan(0);
    expect(screenShake(T0 + 20_000)).toBe(0);
    expect(screenShake(T0)).toBe(0);
  });

  it('los escombros son deterministas, caen y no existen fuera de su ventana', () => {
    const e = FACILITY_EXPLOSIONS[0];
    expect(debrisFor(0, T0 + e.startMs - 100)).toEqual([]);
    expect(debrisFor(0, T0 + e.startMs + 5_000)).toEqual([]);
    const a = debrisFor(0, T0 + e.startMs + 700);
    const b = debrisFor(0, T0 + e.startMs + 700);
    expect(a).toEqual(b);
    expect(a.length).toBe(12);
    const later = debrisFor(0, T0 + e.startMs + 1_800);
    expect(later.reduce((s, d) => s + d.y, 0) / later.length).toBeGreaterThan(a.reduce((s, d) => s + d.y, 0) / a.length);
  });

  it('el humo sube de 0 a 1 después de la explosión', () => {
    const e = FACILITY_EXPLOSIONS[0];
    expect(smokeRise(T0 + e.startMs, 0)).toBe(0);
    expect(smokeRise(T0 + e.startMs + 20_000, 0)).toBe(1);
  });

  it('el operador camina hacia la derecha sin retroceder y deja de verse al abordar', () => {
    let last = -Infinity;
    for (let t = T0; t < T0 + 22_000; t += 250) {
      const x = operatorX(t);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
    expect(operatorX(T0)).toBe(300);
    expect(operatorOnGround(T0 + BOARDING_MS - 1)).toBe(true);
    expect(operatorOnGround(T0 + BOARDING_MS + 1)).toBe(false);
  });

  it('la nave llega, aterriza al lado del operador y despega', () => {
    expect(helicopterPosition(T0 + 1_000)).toBeNull();
    const arrive = helicopterPosition(T0 + 14_000)!;
    const landed = helicopterPosition(T0 + 19_000)!;
    const away = helicopterPosition(T0 + 28_000)!;
    expect(arrive.x).toBeGreaterThan(landed.x);
    expect(arrive.y).toBeLessThan(landed.y);
    expect(away.x).toBeGreaterThan(landed.x);
    expect(away.y).toBeLessThan(landed.y);
    // El operador llega a la nave antes de subir.
    expect(operatorX(T0 + BOARDING_MS)).toBeGreaterThan(landed.x - 120);
  });
});

describe('escena final: epílogo', () => {
  it('la terminal dice que salimos con vida y terminamos el juego', () => {
    const text = EPILOGUE_LINES.join('\n');
    expect(text).toMatch(/CON VIDA/);
    expect(text).toMatch(/COMPLETADO/);
    expect(text).toMatch(/DESTRUIDO/);
  });

  it('typedLines escribe línea por línea, con la última a medias', () => {
    expect(typedLines(EPILOGUE_LINES, 0)).toEqual([]);
    const mid = typedLines(EPILOGUE_LINES, 700);
    expect(mid.length).toBeGreaterThan(0);
    expect(EPILOGUE_LINES[0].startsWith(mid[0])).toBe(true);
    expect(typedLines(EPILOGUE_LINES, 10_000_000)).toEqual([...EPILOGUE_LINES]);
    expect(typedLines(EPILOGUE_LINES, -20)).toEqual([]);
  });

  it('epilogueTypingMs alcanza para escribirlo todo', () => {
    expect(typedLines(EPILOGUE_LINES, epilogueTypingMs())).toEqual([...EPILOGUE_LINES]);
  });

  it('el título y el velo aparecen al llegar al epílogo', () => {
    expect(titleAlpha(0)).toBe(0);
    expect(titleAlpha(VICTORY_BEATS[3].startMs + 5_000)).toBe(1);
    expect(epilogueVeil(0)).toBe(0);
    expect(epilogueVeil(VICTORY_BEATS[3].startMs + 5_000)).toBeCloseTo(0.62, 5);
  });
});
