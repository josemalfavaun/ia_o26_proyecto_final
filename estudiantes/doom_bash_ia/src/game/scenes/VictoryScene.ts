import Phaser from 'phaser';
import {
  alarmPulse,
  buildingHeightAt,
  clamp01,
  corridorTravel,
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
  helicopterFrame,
  helicopterPosition,
  lcg,
  operatorOnGround,
  operatorX,
  screenShake,
  smokeRise,
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
} from '../raycast/RaycastVictoryScenes';

export interface VictorySceneData {
  /** Escena a la que se vuelve con ENTER, ESC, ESPACIO o un clic. */
  returnTo?: string;
}

const W = 960;
const H = 540;
const PX = VICTORY_PIXEL;
const HORIZON = 360;
const GROUND_FEET = 412;

function lerpColor(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}

/** Círculo hecho de filas de píxeles gordos, para que todo mantenga el look 8-bit. */
function pixelDisc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  const r = Math.max(PX, Math.round(radius / PX) * PX);
  for (let dy = -r; dy < r; dy += PX) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - (dy + PX / 2) ** 2)) / PX) * PX;
    if (half > 0) g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, PX);
  }
}

/** Dibuja un sprite hecho de filas de texto; cada carácter es un color de la paleta (el punto es transparente). */
function drawSprite(
  g: Phaser.GameObjects.Graphics,
  rows: readonly string[],
  x: number,
  y: number,
  scale: number,
  palette: Readonly<Record<string, number>>,
  alpha = 1
): void {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      const color = palette[ch];
      if (color === undefined) {
        c += 1;
        continue;
      }
      let end = c + 1;
      while (end < row.length && row[end] === ch) end += 1;
      g.fillStyle(color, alpha);
      g.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), (end - c) * scale, scale);
      c = end;
    }
  }
}

const SOLDIER_PALETTE = { '#': 0x3a4f66, r: 0x151a20, h: 0x5d7c9b, b: 0x66795a } as const;
const SOLDIER_SIDE_PALETTE = {
  h: 0x3a4834,
  v: 0xffb03c,
  s: 0xb08064,
  g: 0x785a46,
  n: 0x303628,
  k: 0x36423a,
  a: 0x6e785a,
  u: 0x242a26,
  t: 0x5a4628,
  p: 0x2c323c,
  b: 0x16161a,
  m: 0x3c424a,
  r: 0x12141a
} as const;
const HELI_PALETTE = { '#': 0x2a3138, g: 0x7fd0ff, r: 0xa9b2bc } as const;

/**
 * Escena final de la partida. Cuatro tiempos en pixel-art original: el operador corre por el pasillo del complejo,
 * la puerta de salida se abre, amanece afuera mientras el complejo BIN BASH estalla en cadena y llega la extracción,
 * y una terminal resume que salimos con vida y terminamos el juego. ENTER, ESC, ESPACIO o un clic vuelven al menú.
 */
export class VictoryScene extends Phaser.Scene {
  private returnTo = 'MenuScene';
  /** Tiempo (el mismo que recibe `update`) del primer fotograma de la escena; null hasta que corre el primero. */
  private startedAt: number | null = null;
  private gfx!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private captionText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private signText!: Phaser.GameObjects.Text;
  private terminalText!: Phaser.GameObjects.Text;
  private endText!: Phaser.GameObjects.Text;
  private inputListenersRegistered = false;
  private leaving = false;
  private stars: { x: number; y: number; phase: number }[] = [];
  private ridge: number[] = [];

  constructor() {
    super('VictoryScene');
  }

  init(data: VictorySceneData = {}): void {
    this.returnTo = data.returnTo ?? 'MenuScene';
    this.leaving = false;
    this.startedAt = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    this.gfx = this.add.graphics().setDepth(0);

    const rand = lcg(5);
    this.stars = Array.from({ length: 70 }, () => ({
      x: Math.round((rand() * W) / PX) * PX,
      y: Math.round((rand() * 250) / PX) * PX,
      phase: rand() * 6
    }));
    const ridgeRand = lcg(21);
    let h = 70;
    this.ridge = Array.from({ length: W / 24 + 2 }, () => {
      h = Math.max(30, Math.min(120, h + (ridgeRand() - 0.5) * 46));
      return Math.round(h / PX) * PX;
    });

    this.titleText = this.add
      .text(W / 2, 62, VICTORY_TITLE, {
        fontFamily: 'monospace',
        fontSize: '50px',
        fontStyle: '700',
        color: '#f4fff0',
        stroke: '#04140a',
        strokeThickness: 8,
        letterSpacing: 6
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);
    this.captionText = this.add
      .text(W / 2, H - 44, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: '700',
        color: '#bfffd2',
        stroke: '#04140a',
        strokeThickness: 5,
        letterSpacing: 3
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.signText = this.add
      .text(0, 0, 'BIN/BASH', {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: '700',
        color: '#ff9d3c',
        stroke: '#1a0a00',
        strokeThickness: 4,
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setVisible(false);
    this.terminalText = this.add
      .text(190, 168, '', {
        fontFamily: 'monospace',
        fontSize: '21px',
        fontStyle: '700',
        color: '#6dff9c',
        lineSpacing: 14
      })
      .setDepth(10)
      .setVisible(false);
    this.endText = this.add
      .text(W / 2, 442, 'FIN', {
        fontFamily: 'monospace',
        fontSize: '34px',
        fontStyle: '700',
        color: '#f4fff0',
        stroke: '#04140a',
        strokeThickness: 7,
        letterSpacing: 12
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
    this.hintText = this.add
      .text(W / 2, H - 14, 'ENTER · ESC · ESPACIO: VOLVER AL MENÚ', {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: '700',
        color: '#d7ffe3',
        stroke: '#04140a',
        strokeThickness: 4
      })
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setAlpha(0.8);

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.registerInputListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInputListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInputListeners, this);
  }

  update(time: number): void {
    // `this.time.now` (reloj de la escena) no comparte base con el `time` de update; en la primera visita estaba
    // desfasado y la escena arrancaba en el final. Se toma el origen del propio `time` del primer fotograma.
    if (this.startedAt === null) this.startedAt = time;
    const t = time - this.startedAt;
    const g = this.gfx;
    g.clear();
    const beat = victoryBeat(t);

    this.signText.setVisible(false);
    this.terminalText.setVisible(false);
    this.endText.setVisible(false);

    if (beat.id === 'corridor' || beat.id === 'door') {
      this.drawCorridor(t);
    } else {
      this.drawExterior(t);
    }

    const flash = flashAlpha(t);
    if (flash > 0.01) {
      g.fillStyle(0xfff6dc, flash);
      g.fillRect(0, 0, W, H);
    }

    if (beat.id === 'epilogue') this.drawEpilogue(t, beat.localMs);

    this.titleText.setAlpha(titleAlpha(t));
    this.captionText.setText(victoryCaption(t));
    this.captionText.setAlpha(beat.id === 'epilogue' ? clamp01(0.4 + titleAlpha(t) * 0.6) : 1 - clamp01((flash - 0.85) / 0.15));
  }

  /* ------------------------------ 1 y 2: pasillo y puerta ------------------------------ */

  private drawCorridor(t: number): void {
    const g = this.gfx;
    const cx = W / 2;
    const bob = Math.round((Math.sin(t / 170) * PX) / PX) * PX;
    const cy = 238 + bob;
    const F = 320;
    const HW = 1;
    const HH = 0.62;
    const zd = doorDistance(t);
    const travel = corridorTravel(t);
    const doorHW = (F * HW) / zd;
    const doorHH = (F * HH) / zd;
    const open = doorOpenAmount(t);

    g.fillStyle(0x03060a, 1);
    g.fillRect(0, 0, W, H);

    // Paredes: columnas con paneles, costuras y luces ámbar, con niebla por distancia.
    for (let x = 0; x < W; x += PX) {
      const dx = Math.abs(x + PX / 2 - cx);
      if (dx < doorHW) continue;
      const z = (F * HW) / dx;
      const half = (F * HH) / z;
      const u = (z + travel) % 2;
      const seam = u < 0.12;
      const fog = clamp01(z / 15);
      let color = Math.floor(z + travel) % 2 === 0 ? 0x22362d : 0x1a2a23;
      if (seam) color = 0x0b1411;
      color = lerpColor(color, 0x03060a, fog);
      g.fillStyle(color, 1);
      g.fillRect(x, Math.round(cy - half), PX, Math.round(half * 2));
      if (!seam && u > 0.5 && u < 0.9) {
        // Ventana ámbar con luz.
        g.fillStyle(lerpColor(0xffb43c, 0x03060a, fog), 1);
        g.fillRect(x, Math.round(cy - half * 0.5), PX, Math.max(PX, Math.round(half * 0.22 / PX) * PX));
      }
      if (!seam && u < 0.4) {
        g.fillStyle(lerpColor(0x4dff7c, 0x03060a, fog * 1.3), 0.55);
        g.fillRect(x, Math.round(cy + half * 0.55), PX, PX);
      }
    }

    // Piso y techo: franjas por tramo para sentir la carrera.
    for (let y = 0; y < H; y += PX) {
      const dy = Math.abs(y + PX / 2 - cy);
      if (dy < 2) continue;
      const z = (F * HH) / dy;
      if (z > zd) continue;
      const halfW = (F * HW) / z;
      const x0 = Math.max(0, Math.round(cx - halfW));
      const x1 = Math.min(W, Math.round(cx + halfW));
      const fog = clamp01(z / 15);
      const isFloor = y + PX / 2 > cy;
      const band = Math.floor(z + travel) % 2 === 0;
      let color = isFloor ? (band ? 0x182226 : 0x10181a) : band ? 0x141c20 : 0x0d1316;
      g.fillStyle(lerpColor(color, 0x03060a, fog), 1);
      g.fillRect(x0, y, x1 - x0, PX);
      if (!isFloor && (z + travel) % 2 < 0.5) {
        // Tubo de luz fría en el centro del techo, con niebla por distancia.
        g.fillStyle(lerpColor(0xcfe9ff, 0x03060a, fog * 1.1), 1);
        g.fillRect(Math.round(cx - halfW * 0.22), y, Math.round(halfW * 0.44), PX);
      }
    }

    // Puerta de salida al fondo del pasillo.
    const dl = Math.round(cx - doorHW);
    const dt = Math.round(cy - doorHH);
    const dwi = Math.round(doorHW * 2);
    const dhi = Math.round(doorHH * 2);
    g.fillStyle(lerpColor(0x1a2530, 0xfff3d2, open), 1);
    g.fillRect(dl, dt, dwi, dhi);
    if (open > 0.02) {
      g.fillStyle(0xffffff, 0.18 * open);
      g.fillRect(dl - PX * 2, dt - PX * 2, dwi + PX * 4, dhi + PX * 4);
    }
    const halfLeaf = Math.round((doorHW * (1 - open)) / PX) * PX;
    g.fillStyle(0x3a4650, 1);
    g.fillRect(dl, dt, halfLeaf, dhi);
    g.fillRect(dl + dwi - halfLeaf, dt, halfLeaf, dhi);
    g.fillStyle(0x5b6a76, 1);
    g.fillRect(dl, dt, Math.min(halfLeaf, PX), dhi);
    g.fillRect(dl + dwi - Math.min(halfLeaf, PX), dt, Math.min(halfLeaf, PX), dhi);
    // Franja de peligro arriba de la puerta y letrero verde de salida.
    const stripeH = Math.max(PX, Math.round(doorHH * 0.12 / PX) * PX);
    for (let sx = 0; sx < dwi; sx += PX * 2) {
      g.fillStyle(Math.floor(sx / (PX * 2)) % 2 === 0 ? 0xffc83c : 0x14110a, 1);
      g.fillRect(dl + sx, dt - stripeH, Math.min(PX * 2, dwi - sx), stripeH);
    }
    const signW = Math.max(PX * 6, Math.round(doorHW * 0.9 / PX) * PX);
    g.fillStyle(0x0a2414, 1);
    g.fillRect(Math.round(cx - signW / 2), dt - stripeH - PX * 6, signW, PX * 4);
    g.fillStyle(0x57ff8c, 0.55 + 0.45 * alarmPulse(t));
    g.fillRect(Math.round(cx - signW / 2) + PX, dt - stripeH - PX * 5, signW - PX * 2, PX * 2);

    // Operador de espaldas, corriendo hacia la puerta.
    if (open < 0.65) {
      const frame = soldierBackFrame(t);
      const scale = PX * 2;
      const sx = Math.round(cx - (frame[0].length * scale) / 2);
      const sy = H - 118 + (Math.floor(t / 170) % 2 === 0 ? 0 : PX);
      g.fillStyle(0x000000, 0.35);
      g.fillRect(sx - scale, sy + frame.length * scale - PX, frame[0].length * scale + scale * 2, PX * 2);
      drawSprite(g, frame, sx, sy, scale, SOLDIER_PALETTE);
    }

    // Alarma roja en los bordes mientras suena (primeros tiempos).
    const alarm = (1 - clamp01((t - 8_000) / 2_000)) * (0.14 + 0.2 * alarmPulse(t));
    if (alarm > 0.01) {
      g.fillStyle(0xff2a2a, alarm);
      g.fillRect(0, 0, W, PX * 6);
      g.fillRect(0, H - PX * 6, W, PX * 6);
      g.fillRect(0, 0, PX * 5, H);
      g.fillRect(W - PX * 5, 0, PX * 5, H);
    }
  }

  /* ------------------------------ 3: exterior ------------------------------ */

  private drawExterior(t: number): void {
    const g = this.gfx;
    const sp = sunProgress(t);
    const et = exteriorTime(t);
    const shake = screenShake(t);
    const ox = shake === 0 ? 0 : (Math.floor(t / 50) % 2 === 0 ? shake : -shake);
    const oy = shake === 0 ? 0 : (Math.floor(t / 70) % 2 === 0 ? PX : 0);

    // Cielo en franjas: de noche profunda a amanecer anaranjado en el horizonte.
    const skyTop = lerpColor(0x050818, 0x3a6ea5, sp);
    const skyLow = lerpColor(0x1a1030, 0xffb36a, sp);
    for (let y = 0; y < HORIZON + PX; y += PX * 2) {
      const k = (y / HORIZON) ** 1.6;
      g.fillStyle(lerpColor(skyTop, skyLow, k), 1);
      g.fillRect(0, y, W, PX * 2);
    }

    const starAlpha = clamp01(1 - sp * 1.5);
    if (starAlpha > 0.02) {
      for (const s of this.stars) {
        g.fillStyle(0xe8f0ff, starAlpha * (0.5 + 0.5 * Math.sin(t / 420 + s.phase)));
        g.fillRect(s.x, s.y, PX, PX);
      }
    }

    // Sol: sube del horizonte con halo.
    const sunX = 800;
    const sunY = 405 - 120 * sp;
    for (let i = 4; i >= 1; i -= 1) pixelDisc(g, sunX, sunY, 36 + i * 22, 0xffd27a, 0.05 * sp);
    pixelDisc(g, sunX, sunY, 36, lerpColor(0xff7a3a, 0xfff1b0, sp));

    // Montañas lejanas.
    g.fillStyle(lerpColor(0x090d1a, 0x3a3358, sp), 1);
    for (let i = 0; i < this.ridge.length; i += 1) {
      g.fillRect(i * 24, HORIZON - this.ridge[i], 24, this.ridge[i]);
    }

    // Suelo con camino de tierra.
    g.fillStyle(lerpColor(0x0a0d0a, 0x2b2a1c, sp), 1);
    g.fillRect(0, HORIZON, W, H - HORIZON);
    g.fillStyle(lerpColor(0x12150f, 0x4a4228, sp), 1);
    g.fillRect(0, GROUND_FEET - 4, W, PX * 6);
    g.fillStyle(lerpColor(0x070907, 0x1b1a12, sp), 1);
    for (let x = 0; x < W; x += PX * 8) g.fillRect(x + ((x / PX) % 3) * PX, GROUND_FEET + PX * 9, PX * 3, PX);

    this.drawFacility(t, ox, oy, sp);

    // Cerca del perímetro hacia la derecha.
    g.fillStyle(lerpColor(0x15181c, 0x59534a, sp), 1);
    for (let x = 470; x < W; x += 48) g.fillRect(x, HORIZON + 4, PX, PX * 8);
    g.fillRect(470, HORIZON + 10, W - 470, 2);

    // Cadena de explosiones, escombros y humo.
    for (let i = 0; i < FACILITY_EXPLOSIONS.length; i += 1) {
      const e = FACILITY_EXPLOSIONS[i];
      const rise = smokeRise(t, i);
      if (rise > 0) {
        for (let k = 0; k < 7; k += 1) {
          const sy = e.y - rise * (150 + 24 * k) + k * 8;
          const sx = e.x + Math.sin(k * 1.7 + i) * (14 + rise * 30);
          pixelDisc(g, sx + ox, sy + oy, 10 + k * 3 + rise * 14, 0x2a2724, 0.4 * (1 - rise * 0.55));
        }
      }
      const st = explosionState(e, t);
      if (st) {
        const cx = e.x + ox;
        const cy = e.y + oy;
        pixelDisc(g, cx, cy, st.radius * 1.15, 0xc0301a, st.alpha * 0.55);
        pixelDisc(g, cx, cy, st.radius * 0.85, 0xff7a1f, st.alpha * 0.85);
        pixelDisc(g, cx, cy, st.radius * 0.55, 0xffd45a, st.alpha);
        pixelDisc(g, cx, cy, st.radius * 0.28, 0xffffff, st.alpha);
      }
      for (const d of debrisFor(i, t)) {
        g.fillStyle(d.hot ? 0xffa23c : 0x2b2420, 1);
        g.fillRect(d.x + ox, d.y + oy, d.size, d.size);
      }
    }

    // Luz de la nave en el suelo mientras aterriza.
    const heli = helicopterPosition(t);
    if (heli && et > 14_500 && et < 21_000) {
      g.fillStyle(0xfff4c8, 0.1);
      g.fillTriangle(heli.x + 60, heli.y + 36, heli.x + 20, HORIZON + 70, heli.x + 150, HORIZON + 70);
    }

    // Operador de perfil, caminando hacia la extracción: casco con visor, chaleco, mochila y rifle.
    if (operatorOnGround(t)) {
      const walking = et < 17_500;
      const frame = walking ? soldierFrame(t) : soldierFrame(0);
      const scale = 3;
      const sx = Math.round(operatorX(t));
      const bob = walking && Math.floor(t / 260) % 2 === 1 ? 0 : -scale;
      const sy = GROUND_FEET - frame.length * scale + bob + scale;
      g.fillStyle(0x000000, 0.3);
      g.fillRect(sx, GROUND_FEET - PX, frame[0].length * scale, PX * 2);
      // La luz del amanecer tiñe al operador de cálido a medida que sale el sol.
      const lit: Record<string, number> = {};
      for (const [key, color] of Object.entries(SOLDIER_SIDE_PALETTE)) {
        lit[key] = key === 'v' ? color : lerpColor(color, 0xffb36a, sp * 0.28);
      }
      drawSprite(g, frame, sx, sy, scale, lit);
      // Reflejo del visor.
      g.fillStyle(0xffe2a0, 0.5 + 0.3 * Math.sin(t / 300));
      g.fillRect(sx + 12 * scale, sy + 3 * scale, scale, scale);
    }

    if (heli) {
      const frame = helicopterFrame(t);
      g.fillStyle(0x000000, 0.28);
      g.fillRect(heli.x + PX * 6, HORIZON + 44, PX * 34, PX * 2);
      drawSprite(g, frame, heli.x + ox * 0, heli.y, PX, HELI_PALETTE);
    }

    // Viñeta suave para que el título y los textos se lean.
    g.fillStyle(0x000000, 0.18);
    g.fillRect(0, 0, W, PX * 8);
    g.fillRect(0, H - PX * 14, W, PX * 14);
  }

  private drawFacility(t: number, ox: number, oy: number, sp: number): void {
    const g = this.gfx;
    const stage = damageStage(t);
    const base = HORIZON + 14;
    const rand = lcg(77);
    FACILITY_BUILDINGS.forEach((b, index) => {
      const h = buildingHeightAt(b, t);
      const x = b.x + ox;
      const top = base - h + oy;
      g.fillStyle(lerpColor(0x0d1118, 0x2b303a, sp * 0.8), 1);
      g.fillRect(x, top, b.width, h);
      g.fillStyle(lerpColor(0x070a0f, 0x1c2029, sp * 0.8), 1);
      g.fillRect(x + b.width - PX * 3, top, PX * 3, h);
      g.fillStyle(lerpColor(0x161c26, 0x3d4350, sp * 0.8), 1);
      g.fillRect(x, top, b.width, PX);

      // Ventanas: se apagan y se rompen a medida que avanza el daño.
      for (let wy = top + PX * 4; wy < base - PX * 6; wy += PX * 6) {
        for (let wx = x + PX * 3; wx < x + b.width - PX * 6; wx += PX * 6) {
          const r = rand();
          const lit = r > 0.35 + stage * 0.09;
          g.fillStyle(lit ? 0xffb43c : 0x151a22, lit ? 0.85 : 1);
          g.fillRect(wx, wy, PX * 3, PX * 2);
        }
      }
      // Fuego en la base de los edificios dañados.
      if (stage >= 2 && h > 24) {
        for (let fx = x; fx < x + b.width - PX; fx += PX * 3) {
          const flick = Math.floor(t / 90 + fx / PX + index) % 3;
          g.fillStyle(flick === 0 ? 0xffd45a : flick === 1 ? 0xff7a1f : 0xc0301a, 0.9);
          g.fillRect(fx, base - PX * (2 + flick) + oy, PX * 2, PX * (2 + flick));
        }
      }
      // Antena del edificio alto.
      if (index === 1 && h > 120) {
        g.fillStyle(0x2a3038, 1);
        g.fillRect(x + b.width / 2 - PX, top - PX * 9, PX, PX * 9);
        g.fillStyle(Math.floor(t / 450) % 2 === 0 ? 0xff3a3a : 0x3a0d0d, 1);
        g.fillRect(x + b.width / 2 - PX, top - PX * 10, PX, PX);
      }
      // Letrero BIN/BASH, mientras el edificio siga en pie.
      if (index === 1 && h > 80) {
        this.signText.setVisible(true).setPosition(x + b.width / 2, top + PX * 6);
        this.signText.setAlpha(clamp01(1 - stage * 0.22));
      }
    });
    // Puerta por la que salió el operador, con luz.
    if (buildingHeightAt(FACILITY_BUILDINGS[2], t) > PX * 12) {
      g.fillStyle(lerpColor(0xfff3d2, 0x3a2a14, clamp01(exteriorTime(t) / 4_000)), 1);
      g.fillRect(286 + ox, base - PX * 11 + oy, PX * 7, PX * 11);
    }
  }

  /* ------------------------------ 4: epílogo ------------------------------ */

  private drawEpilogue(t: number, localMs: number): void {
    const g = this.gfx;
    const veil = epilogueVeil(t);
    g.fillStyle(0x020805, veil);
    g.fillRect(0, 0, W, H);

    const panelAlpha = clamp01(localMs / 900);
    g.fillStyle(0x02160a, 0.88 * panelAlpha);
    g.fillRect(150, 134, 660, 290);
    g.lineStyle(3, 0x4dff7c, 0.9 * panelAlpha);
    g.strokeRect(150, 134, 660, 290);
    g.lineStyle(1, 0x4dff7c, 0.35 * panelAlpha);
    g.strokeRect(158, 142, 644, 274);
    g.fillStyle(0x4dff7c, 0.07 * panelAlpha);
    for (let y = 136; y < 422; y += 4) g.fillRect(152, y, 656, 1);

    const typed = typedLines(EPILOGUE_LINES, Math.max(0, localMs - 900));
    const done = Math.max(0, localMs - 900) >= epilogueTypingMs();
    const cursor = Math.floor(t / 420) % 2 === 0 ? '█' : ' ';
    const lines = typed.slice();
    if (!done && lines.length > 0) lines[lines.length - 1] += cursor;
    this.terminalText.setVisible(true).setText(lines.join('\n')).setAlpha(panelAlpha);

    const endAt = 900 + epilogueTypingMs() + 700;
    if (localMs > endAt) {
      this.endText.setVisible(true).setAlpha(clamp01((localMs - endAt) / 900) * (0.75 + 0.25 * Math.sin(t / 380)));
    }
  }

  /* ------------------------------ entrada ------------------------------ */

  private readonly leave = (): void => {
    if (this.leaving) return;
    this.leaving = true;
    this.cleanupInputListeners();
    this.scene.start(this.returnTo);
  };

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', this.leave);
    kb?.on('keydown-ESC', this.leave);
    kb?.on('keydown-SPACE', this.leave);
    this.input.on('pointerdown', this.leave);
    this.inputListenersRegistered = true;
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const kb = this.input.keyboard;
    kb?.off('keydown-ENTER', this.leave);
    kb?.off('keydown-ESC', this.leave);
    kb?.off('keydown-SPACE', this.leave);
    this.input.off('pointerdown', this.leave);
    this.inputListenersRegistered = false;
  }
}

/** Duración de los tiempos animados antes del epílogo, expuesta para que otros módulos sepan cuánto dura la película. */
export const VICTORY_ANIMATED_MS = VICTORY_BEATS[3].startMs;
