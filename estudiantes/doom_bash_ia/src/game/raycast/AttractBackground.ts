import type Phaser from 'phaser';
import {
  ATTRACT_FADE_MS,
  attractActAfter,
  attractFadeAlpha,
  createBossCombat,
  createPatrolCombat,
  type AttractCombat
} from '../../ai/runtime/attractCombat';
import { getAtmosphereForDirector } from './RaycastAtmosphere';
import { registerRaycastOptionalAssets } from './raycastAssetHooks';
import { RAYCAST_LEVEL_BOSS, RAYCAST_LEVEL_CATALOG, type RaycastLevel } from './RaycastLevel';
import { RaycastRenderer } from './RaycastRenderer';

/**
 * Fondo de menús: el motor real del juego dibuja lo que pasa solo, sin que nadie juegue.
 * Dos actos que se alternan con un fundido a negro:
 *  1. Patrulla: un bot con A* recorre el nivel, se detiene a disparar a los enemigos que le salen al paso.
 *  2. Jefe: pelea contra el jefe 1 (Volt Archon) con sus fases y abanicos reales, hasta derrotarlo.
 * Encima va una capa oscura (con viñeta y líneas de rastreo) para que lo que se lea quede por delante.
 * Si algo falla (textura, nivel) los menús siguen funcionando con fondo liso.
 */
export class AttractBackground {
  private combat: AttractCombat | null = null;
  private patrolRenderer: RaycastRenderer | null = null;
  private bossRenderer: RaycastRenderer | null = null;
  private activeRenderer: RaycastRenderer | null = null;
  private readonly patrolLevel: RaycastLevel;
  private readonly fade: Phaser.GameObjects.Graphics;
  private readonly width: number;
  private readonly height: number;
  private switchedAt = 0;
  private actSerial = 0;
  private lastFadeAlpha = -1;
  private broken = false;

  constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
    options: { level?: RaycastLevel; shadeAlpha?: number } = {}
  ) {
    this.width = width;
    this.height = height;
    this.patrolLevel = options.level ?? RAYCAST_LEVEL_CATALOG[0];
    try {
      registerRaycastOptionalAssets(scene);
      this.startAct('patrol', scene.time.now);
    } catch (error) {
      console.warn('Fondo de menú no disponible, uso fondo liso.', error);
      this.broken = true;
      this.combat = null;
      this.activeRenderer = null;
    }

    // Por encima de los sprites del renderer (profundidades 6.8 a 20) y por debajo del texto del menú (30).
    const shade = scene.add.graphics().setDepth(21);
    shade.fillStyle(0x03060a, options.shadeAlpha ?? 0.36);
    shade.fillRect(0, 0, width, height);
    // Viñeta: más oscuro hacia arriba y abajo para dirigir la mirada al centro.
    for (let i = 0; i < 6; i += 1) {
      shade.fillStyle(0x000000, 0.07);
      shade.fillRect(0, 0, width, (i + 1) * 14);
      shade.fillRect(0, height - (i + 1) * 14, width, (i + 1) * 14);
    }
    shade.lineStyle(1, 0x000000, 0.22);
    for (let y = 0; y < height; y += 4) shade.lineBetween(0, y, width, y);
    this.fade = scene.add.graphics().setDepth(25);
  }

  /** Arranca un acto nuevo; crea su renderer la primera vez y oculta el del acto anterior. */
  private startAct(kind: 'patrol' | 'boss', now: number): void {
    this.actSerial += 1;
    const seed = 20_261_126 + this.actSerial * 17;
    const combat =
      kind === 'patrol'
        ? createPatrolCombat(this.patrolLevel, now, { seed })
        : createBossCombat(RAYCAST_LEVEL_BOSS, now, { seed });
    let renderer = kind === 'patrol' ? this.patrolRenderer : this.bossRenderer;
    if (!renderer) {
      // El renderer queda atado al mapa del primer acto de su tipo; los siguientes son clones idénticos.
      renderer = new RaycastRenderer(this.scene, combat.map, kind === 'patrol' ? this.patrolLevel : RAYCAST_LEVEL_BOSS);
      if (kind === 'patrol') this.patrolRenderer = renderer;
      else this.bossRenderer = renderer;
    }
    if (this.activeRenderer && this.activeRenderer !== renderer) this.activeRenderer.hideAll();
    this.activeRenderer = renderer;
    this.combat = combat;
    this.switchedAt = now;
  }

  update(deltaMs: number): void {
    if (this.broken || !this.combat || !this.activeRenderer) return;
    const now = this.scene.time.now;
    try {
      this.combat.update(deltaMs, now);
      if (this.combat.done) {
        const next = attractActAfter(this.combat.kind);
        try {
          this.startAct(next, now);
        } catch (error) {
          // Si el jefe no se puede dibujar, la patrulla sigue en bucle.
          console.warn('No se pudo iniciar el acto del fondo.', error);
          this.startAct('patrol', now);
        }
      }
      this.draw(now);
    } catch (error) {
      console.warn('Fondo de menú detenido por un error.', error);
      this.broken = true;
      this.activeRenderer?.hideAll();
      this.drawFade(0);
    }
  }

  private draw(now: number): void {
    const combat = this.combat;
    const renderer = this.activeRenderer;
    if (!combat || !renderer) return;
    const { width, height } = this.scene.scale;
    const atmosphere = getAtmosphereForDirector(null, 0);
    renderer.render(combat.player, width, height, atmosphere);
    renderer.renderEnemies(combat.player, combat.enemies, width, height, now, atmosphere);
    renderer.renderBoss(combat.player, combat.boss, width, height, now, atmosphere);
    renderer.renderEnemyProjectiles(combat.player, combat.projectiles, width, height);
    renderer.renderWeaponOverlay(combat.weapon, width, height, combat.muzzleAlpha(now));
    this.drawFade(attractFadeAlpha(now - this.switchedAt));
  }

  private drawFade(alpha: number): void {
    const rounded = Math.round(alpha * 40) / 40;
    if (rounded === this.lastFadeAlpha) return;
    this.lastFadeAlpha = rounded;
    this.fade.clear();
    if (rounded > 0) {
      this.fade.fillStyle(0x000000, rounded);
      this.fade.fillRect(0, 0, this.width, this.height);
    }
  }
}

/** Duración del fundido entre actos, expuesta para pruebas y para ajustar el ritmo. */
export const ATTRACT_BACKGROUND_FADE_MS = ATTRACT_FADE_MS;
