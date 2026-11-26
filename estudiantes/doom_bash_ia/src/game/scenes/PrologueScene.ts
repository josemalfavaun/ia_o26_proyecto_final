import Phaser from 'phaser';
import { getRaycastDifficultyPreset, RAYCAST_DIFFICULTY_REGISTRY_KEY, type RaycastDifficultyId } from '../raycast/RaycastDifficulty';
import { getPrologueCopy } from '../raycast/RaycastPresentation';
import {
  buildPrologueModifierRows,
  computePrologueScreenLayout,
  PROLOGUE_MODIFIER_HINT,
  PROLOGUE_PANEL_PADDING_PX,
  type PrologueCell
} from '../raycast/RaycastPrologueLayout';
import {
  buildRetroGrid,
  buildRetroSkyline,
  buildRetroStars,
  RETRO_PALETTE,
  RETRO_PIXEL,
  retroStarAlpha
} from '../raycast/RaycastRetroBackdrop';
import {
  rollRunModifier,
  RUN_MODIFIER_ROULETTE,
  type RunModifierId
} from '../raycast/RunModifierRoulette';
import { createEmptyCampaignMetrics } from '../raycast/RaycastScore';
import { prepareGameSession } from '../save/persistSessionSettings';
import {
  getGamepadInvertY,
  getGamepadLeftDeadzone,
  getGamepadRightDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getTouchButtonScale,
  getTouchControlsEnabled,
  getTouchJoystickDeadzone,
  getTouchLookSensitivity
} from '../sessionSettings';
import { resolveRaycastDemoShortcut } from '../raycast/RaycastBossShortcuts';
import { buildRaycastGamepadFooterLine } from '../raycast/RaycastInputHelp';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import { RaycastTouchInput } from '../systems/RaycastTouchInput';
import { stopGameMasterVoice } from '../../services/gameMasterVoice';

const BG = RETRO_PALETTE.black;
const HEADING_COLOR = '#4dff7c';
const BODY_COLOR = '#e9ffe9';
const MUTED_COLOR = '#8fd9a2';

export interface PrologueSceneData {
  difficultyId?: RaycastDifficultyId;
  runModifierId?: RunModifierId | null;
}

export class PrologueScene extends Phaser.Scene {
  private difficultyId!: RaycastDifficultyId;
  private runModifierId: RunModifierId | null = null;
  private modifierRowTexts: Phaser.GameObjects.Text[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private gamepadStatusText!: Phaser.GameObjects.Text;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private inputListenersRegistered = false;
  private retroStars = buildRetroStars(960, 540);
  private starGraphics: Phaser.GameObjects.Graphics | null = null;
  private scanBand: Phaser.GameObjects.Rectangle | null = null;

  private readonly handleContinueRaycast = (): void => {
    stopGameMasterVoice('prologue_start_run');
    this.cleanupInputListeners();
    this.scene.start('TutorialScene', { difficultyId: this.difficultyId, runModifierId: this.runModifierId });
  };

  private readonly handleBackToMenu = (): void => {
    stopGameMasterVoice('prologue_exit_menu');
    this.cleanupInputListeners();
    this.scene.start('MenuScene');
  };

  /** Atajos de demo: 4/5/6 = niveles 3/6/10, 7/8/9 = jefes, tecla a la derecha del 0 = pantalla final. */
  private readonly handleDemoShortcut = (event: KeyboardEvent): void => {
    const shortcut = resolveRaycastDemoShortcut(event);
    if (!shortcut) return;
    stopGameMasterVoice('prologue_demo_shortcut');
    this.cleanupInputListeners();
    if (shortcut.kind === 'victory') {
      this.scene.start('VictoryScene', { returnTo: 'MenuScene' });
      return;
    }
    this.scene.start('RaycastScene', {
      levelId: shortcut.levelId,
      difficultyId: this.difficultyId,
      carryScore: 0,
      carryCampaignMetrics: createEmptyCampaignMetrics(),
      rewardTier: 0,
      runModifierId: this.runModifierId
    });
  };

  /** Recorre "ninguno" + los 8 modificadores (todos están a la vista; esto solo mueve la marca). */
  private shiftModifier(delta: number): void {
    const ids: Array<RunModifierId | null> = [null, ...RUN_MODIFIER_ROULETTE.map((m) => m.id)];
    const idx = ids.indexOf(this.runModifierId);
    this.runModifierId = ids[(idx + delta + ids.length) % ids.length];
    this.refreshModifierText();
  }

  constructor() {
    super('PrologueScene');
  }

  init(data: PrologueSceneData = {}): void {
    this.difficultyId = getRaycastDifficultyPreset(data.difficultyId ?? this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.registry.set(RAYCAST_DIFFICULTY_REGISTRY_KEY, this.difficultyId);
    this.runModifierId = data.runModifierId ?? null;
  }

  create(): void {
    stopGameMasterVoice('prologue_enter');
    prepareGameSession(this.registry);
    const width = this.scale.width;
    const height = this.scale.height;
    this.cameras.main.setBackgroundColor(BG);
    this.gamepadInput = new RaycastGamepadInput({
      getSettings: () => ({
        leftDeadzone: getGamepadLeftDeadzone(this.registry),
        rightDeadzone: getGamepadRightDeadzone(this.registry),
        lookSensitivity: getGamepadSensitivity(this.registry),
        invertLookY: getGamepadInvertY(this.registry),
        vibrationEnabled: getGamepadVibrationEnabled(this.registry)
      })
    });
    this.touchInput = new RaycastTouchInput(this, {
      mode: 'ui',
      getSettings: () => ({
        enabled: getTouchControlsEnabled(this.registry),
        buttonScale: getTouchButtonScale(this.registry),
        lookSensitivity: getTouchLookSensitivity(this.registry),
        joystickDeadzone: getTouchJoystickDeadzone(this.registry)
      })
    });

    this.drawRetroBackdrop(width, height);

    const copy = getPrologueCopy();
    const layout = computePrologueScreenLayout(width, height);
    this.retroStars = buildRetroStars(width, height);
    const panelPad = PROLOGUE_PANEL_PADDING_PX;
    const heading = (cell: PrologueCell, label: string): void => {
      this.add
        .text(cell.x + panelPad, cell.y + 12, label, {
          fontFamily: 'monospace',
          fontSize: layout.fontHeading,
          fontStyle: '700',
          color: HEADING_COLOR,
          letterSpacing: 2
        })
        .setDepth(4);
    };
    const body = (cell: PrologueCell, text: string, color: string, size: string): Phaser.GameObjects.Text =>
      this.add
        .text(cell.x + panelPad, cell.y + 40, text, {
          fontFamily: 'monospace',
          fontSize: size,
          fontStyle: '700',
          color,
          lineSpacing: 4,
          wordWrap: { width: cell.width - panelPad * 2, useAdvancedWrap: true }
        })
        .setDepth(4);

    this.drawRetroPanel(layout.mission);
    this.drawRetroPanel(layout.objective);
    this.drawRetroPanel(layout.modifiers);
    this.drawRetroPanel(layout.controls);

    this.add
      .text(layout.centerX, layout.titleY, 'DOOM BIN BASH EDITION', {
        fontFamily: 'monospace',
        fontSize: layout.fontTitle,
        fontStyle: '700',
        color: BODY_COLOR,
        stroke: '#052b12',
        strokeThickness: 6,
        letterSpacing: 3
      })
      .setOrigin(0.5, 0)
      .setDepth(4);

    heading(layout.mission, '// MISIÓN');
    body(layout.mission, copy.missionBlock.replace(/^MISIÓN:\n/, ''), BODY_COLOR, layout.fontBody);

    heading(layout.objective, '// OBJETIVO');
    body(layout.objective, copy.objectiveBlock.replace(/^OBJETIVO:\n/, ''), BODY_COLOR, layout.fontBody);

    heading(layout.modifiers, '// MODIFICADORES (OPCIONAL)');
    this.createModifierRows(layout.modifiers, panelPad);

    heading(layout.controls, '// CONTROLES');
    body(layout.controls, copy.controlsBlock, BODY_COLOR, layout.fontSmall);

    this.promptText = this.add
      .text(layout.centerX, layout.promptY, `${copy.continueLine}   ${copy.backLine}`, {
        fontFamily: 'monospace',
        fontSize: layout.fontPrompt,
        fontStyle: '700',
        color: HEADING_COLOR,
        align: 'center'
      })
      .setOrigin(0.5, 1)
      .setDepth(5);
    this.tweens.add({ targets: this.promptText, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Stepped' });

    this.gamepadStatusText = this.add
      .text(layout.centerX, layout.gamepadY, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: MUTED_COLOR,
        align: 'center'
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.82)
      .setDepth(5);

    this.cameras.main.fadeIn(520, 0, 0, 0);

    this.registerInputListeners();
    this.touchInput.create();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInputListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInputListeners, this);
  }

  update(time: number): void {
    this.updateRetroBackdrop(time);
    this.gamepadInput.update();
    this.touchInput.update();
    const touchMessage = this.touchInput.consumeStatusMessage();
    const gamepadMessage = this.gamepadInput.consumeStatusMessage();
    const statusLine = touchMessage ?? buildRaycastGamepadFooterLine(this.gamepadInput.getDebugInfo(), gamepadMessage);
    this.gamepadStatusText.setText(statusLine);
    this.gamepadStatusText.setAlpha(touchMessage || gamepadMessage || this.gamepadInput.isConnected() ? 0.92 : 0.72);

    if (this.touchInput.consumePressed('confirm') || this.touchInput.consumePressed('pause')) {
      this.handleContinueRaycast();
      return;
    }
    if (this.touchInput.consumePressed('cancel')) {
      this.handleBackToMenu();
      return;
    }
    if (this.touchInput.consumePressed('navRight') || this.touchInput.consumePressed('nextWeapon')) {
      this.shiftModifier(1);
    }
    if (this.touchInput.consumePressed('navLeft') || this.touchInput.consumePressed('previousWeapon')) {
      this.shiftModifier(-1);
    }
    if (this.gamepadInput.consumePressed('confirm') || this.gamepadInput.consumePressed('pause')) {
      this.handleContinueRaycast();
      return;
    }
    if (this.gamepadInput.consumePressed('cancel')) {
      this.handleBackToMenu();
      return;
    }
    if (this.gamepadInput.consumePressed('navRight') || this.gamepadInput.consumePressed('nextWeapon')) {
      this.shiftModifier(1);
    }
    if (this.gamepadInput.consumePressed('navLeft') || this.gamepadInput.consumePressed('previousWeapon')) {
      this.shiftModifier(-1);
    }
  }

  /** Fondo 8-bit: cielo con estrellas, horizonte de edificios del complejo y rejilla verde en perspectiva. */
  private drawRetroBackdrop(width: number, height: number): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(RETRO_PALETTE.black, 1);
    g.fillRect(0, 0, width, height);

    // Cielo en bandas de color sólido (degradado escalonado, como en una paleta de 8 bits).
    const horizonY = buildRetroGrid(width, height).horizonY;
    const bands = [RETRO_PALETTE.greenDeep, 0x041a0b, 0x031208, 0x020d05];
    bands.forEach((color, i) => {
      g.fillStyle(color, 1);
      g.fillRect(0, Math.round((horizonY / bands.length) * (bands.length - 1 - i)), width, Math.ceil(horizonY / bands.length) + 1);
    });

    // Luna de píxeles gordos.
    const moonX = Math.round(width * 0.9);
    const moonY = Math.round(height * 0.075);
    g.fillStyle(RETRO_PALETTE.white, 0.9);
    for (let dy = -5; dy <= 5; dy += 1) {
      const span = Math.round(Math.sqrt(25 - dy * dy));
      g.fillRect(moonX - span * RETRO_PIXEL, moonY + dy * RETRO_PIXEL, span * 2 * RETRO_PIXEL, RETRO_PIXEL);
    }

    // Horizonte: edificios del complejo con ventanas encendidas.
    for (const b of buildRetroSkyline(width, height)) {
      const top = horizonY - b.height;
      g.fillStyle(RETRO_PALETTE.greenDeep, 1);
      g.fillRect(b.x, top, b.width, b.height);
      g.lineStyle(2, RETRO_PALETTE.greenDark, 1);
      g.strokeRect(b.x + 1, top + 1, b.width - 2, b.height - 2);
      g.fillStyle(RETRO_PALETTE.greenMid, 0.85);
      for (const [c, r] of b.windows) {
        g.fillRect(b.x + c * RETRO_PIXEL, top + r * RETRO_PIXEL, RETRO_PIXEL, RETRO_PIXEL);
      }
    }

    // Suelo con rejilla en perspectiva.
    g.fillStyle(0x020a04, 1);
    g.fillRect(0, horizonY, width, height - horizonY);
    const grid = buildRetroGrid(width, height);
    g.lineStyle(1, RETRO_PALETTE.greenMid, 0.55);
    g.lineBetween(0, horizonY, width, horizonY);
    for (const y of grid.horizontals) g.lineBetween(0, y, width, y);
    g.lineStyle(1, RETRO_PALETTE.greenMid, 0.4);
    for (const v of grid.verticals) g.lineBetween(v.x0, horizonY, v.x1, height);

    // Estrellas: se redibujan despacio en `updateRetroBackdrop` para que parpadeen.
    this.starGraphics = this.add.graphics().setDepth(0);

    // Banda de barrido de monitor CRT y líneas de rastreo.
    this.scanBand = this.add.rectangle(width / 2, -20, width, 28, RETRO_PALETTE.greenBright, 0.06).setDepth(1);
    const scan = this.add.graphics().setDepth(1);
    scan.lineStyle(1, 0x000000, 0.28);
    for (let y = 0; y < height; y += 3) scan.lineBetween(0, y, width, y);
  }

  private updateRetroBackdrop(time: number): void {
    if (this.starGraphics) {
      this.starGraphics.clear();
      for (const star of this.retroStars) {
        this.starGraphics.fillStyle(star.bright ? RETRO_PALETTE.white : RETRO_PALETTE.greenBright, retroStarAlpha(star, time));
        this.starGraphics.fillRect(star.x, star.y, RETRO_PIXEL, RETRO_PIXEL);
      }
    }
    if (this.scanBand) {
      const travel = this.scale.height + 40;
      this.scanBand.y = ((time / 14) % travel) - 20;
    }
  }

  /** Panel de 8 bits: fondo oscuro, borde verde y esquinas recortadas en escalones. */
  private drawRetroPanel(cell: PrologueCell): void {
    const g = this.add.graphics().setDepth(3);
    const { x, y, width, height } = cell;
    const n = RETRO_PIXEL;
    g.fillStyle(0x000000, 0.52);
    g.fillRect(x + n, y, width - n * 2, height);
    g.fillRect(x, y + n, width, height - n * 2);
    g.fillStyle(RETRO_PALETTE.greenBright, 0.9);
    g.fillRect(x + n, y, width - n * 2, 2);
    g.fillRect(x + n, y + height - 2, width - n * 2, 2);
    g.fillRect(x, y + n, 2, height - n * 2);
    g.fillRect(x + width - 2, y + n, 2, height - n * 2);
    // Escalones de las cuatro esquinas.
    g.fillRect(x + 2, y + 2, n - 2, n - 2);
    g.fillRect(x + width - n, y + 2, n - 2, n - 2);
    g.fillRect(x + 2, y + height - n, n - 2, n - 2);
    g.fillRect(x + width - n, y + height - n, n - 2, n - 2);
  }

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const kb = this.input.keyboard;

    kb?.once('keydown-SPACE', this.handleContinueRaycast);
    kb?.once('keydown-ENTER', this.handleContinueRaycast);
    kb?.once('keydown-A', this.handleContinueRaycast);
    kb?.once('keydown-a', this.handleContinueRaycast);
    kb?.on('keydown-DOWN', this.handleCycleModifier);
    kb?.on('keydown-UP', this.handleCycleModifierBack);
    kb?.on('keydown-M', this.handleCycleModifier);
    kb?.on('keydown-m', this.handleCycleModifier);
    kb?.on('keydown-R', this.handleRollModifier);
    kb?.on('keydown-r', this.handleRollModifier);
    kb?.on('keydown-N', this.handleClearModifier);
    kb?.on('keydown-n', this.handleClearModifier);
    kb?.on('keydown', this.handleDemoShortcut);

    kb?.once('keydown-ESC', this.handleBackToMenu);

    this.inputListenersRegistered = true;
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const kb = this.input.keyboard;

    kb?.off('keydown-SPACE', this.handleContinueRaycast);
    kb?.off('keydown-ENTER', this.handleContinueRaycast);
    kb?.off('keydown-A', this.handleContinueRaycast);
    kb?.off('keydown-a', this.handleContinueRaycast);
    kb?.off('keydown-DOWN', this.handleCycleModifier);
    kb?.off('keydown-UP', this.handleCycleModifierBack);
    kb?.off('keydown-M', this.handleCycleModifier);
    kb?.off('keydown-m', this.handleCycleModifier);
    kb?.off('keydown-R', this.handleRollModifier);
    kb?.off('keydown-r', this.handleRollModifier);
    kb?.off('keydown-N', this.handleClearModifier);
    kb?.off('keydown-n', this.handleClearModifier);
    kb?.off('keydown', this.handleDemoShortcut);
    kb?.off('keydown-ESC', this.handleBackToMenu);
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();

    this.inputListenersRegistered = false;
  }

  private readonly handleCycleModifier = (): void => {
    this.shiftModifier(1);
  };

  private readonly handleCycleModifierBack = (): void => {
    this.shiftModifier(-1);
  };

  private readonly handleRollModifier = (): void => {
    this.runModifierId = rollRunModifier().id;
    this.refreshModifierText();
  };

  private readonly handleClearModifier = (): void => {
    this.runModifierId = null;
    this.refreshModifierText();
  };

  private modifierRowsData(): ReturnType<typeof buildPrologueModifierRows> {
    return buildPrologueModifierRows(RUN_MODIFIER_ROULETTE, this.runModifierId);
  }

  /** Una línea por modificador (todos visibles); clic en una línea la elige. */
  private createModifierRows(cell: PrologueCell, pad: number): void {
    const rows = this.modifierRowsData();
    const innerWidth = cell.width - pad * 2;
    const longest = Math.max(...rows.map((r) => r.text.length));
    // Letra monoespaciada: ~0.6 de su tamaño de ancho por carácter.
    const fontPx = Math.max(9, Math.min(12, Math.floor(innerWidth / (longest * 0.6))));
    const lineH = Math.round(fontPx * 1.5);
    this.modifierRowTexts = rows.map((row, i) => {
      const t = this.add
        .text(cell.x + pad, cell.y + 38 + i * lineH, row.text, {
          fontFamily: 'monospace',
          fontSize: `${fontPx}px`,
          fontStyle: '700',
          color: row.active ? HEADING_COLOR : MUTED_COLOR
        })
        .setDepth(4)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        this.runModifierId = this.modifierRowsData()[i].id as RunModifierId | null;
        this.refreshModifierText();
      });
      return t;
    });
    this.add
      .text(cell.x + pad, cell.y + 38 + rows.length * lineH + 4, PROLOGUE_MODIFIER_HINT, {
        fontFamily: 'monospace',
        fontSize: `${Math.max(9, fontPx - 1)}px`,
        fontStyle: '700',
        color: HEADING_COLOR
      })
      .setDepth(4)
      .setAlpha(0.85);
  }

  private refreshModifierText(): void {
    this.modifierRowsData().forEach((row, i) => {
      this.modifierRowTexts[i]?.setText(row.text).setColor(row.active ? HEADING_COLOR : MUTED_COLOR);
    });
  }
}
