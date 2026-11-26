import Phaser from 'phaser';
import { AudioFeedbackSystem } from '../systems/AudioFeedbackSystem';
import { getRaycastFeedbackActions } from '../raycast/RaycastFeedback';
import {
  cycleRaycastDifficulty,
  getRaycastDifficultyPreset,
  RAYCAST_DIFFICULTY_REGISTRY_KEY
} from '../raycast/RaycastDifficulty';
import { buildMainMenuLayout, getMainMenuCopy } from '../raycast/RaycastPresentation';
import { RAYCAST_CSS, RAYCAST_PALETTE } from '../raycast/RaycastPalette';
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
import { AttractBackground } from '../raycast/AttractBackground';
import { buildRaycastGamepadFooterLine } from '../raycast/RaycastInputHelp';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import { RaycastTouchInput } from '../systems/RaycastTouchInput';

const MENU_BACKGROUND = RAYCAST_PALETTE.voidBlack;
const MENU_CYAN = RAYCAST_PALETTE.plasmaBright;
const MENU_CYAN_SOFT = RAYCAST_CSS.accentText;
const MENU_EMBER = RAYCAST_PALETTE.amberWarn;
const MENU_SETTINGS = '#f06f9a';

export class MenuScene extends Phaser.Scene {
  private inputListenersRegistered = false;
  private audioFeedback!: AudioFeedbackSystem;
  private difficultyHintText!: Phaser.GameObjects.Text;
  private gamepadStatusText!: Phaser.GameObjects.Text;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private menuSelectionIndex = 0;
  private background: AttractBackground | null = null;
  private settingsLine!: Phaser.GameObjects.Text;

  private readonly handleStartRaycast = (): void => {
    this.playFeedbackEvent('difficultyStart');
    const difficultyId = getRaycastDifficultyPreset(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.scene.start('PrologueScene', { difficultyId });
  };

  /** Atajos de demo: 4/5/6 = niveles 3/6/10, 7/8/9 = jefes, tecla a la derecha del 0 = pantalla final. */
  private readonly handleDemoShortcut = (event: KeyboardEvent): void => {
    const shortcut = resolveRaycastDemoShortcut(event);
    if (!shortcut) return;
    if (shortcut.kind === 'victory') {
      this.scene.start('VictoryScene', { returnTo: 'MenuScene' });
      return;
    }
    const difficultyId = getRaycastDifficultyPreset(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.scene.start('RaycastScene', {
      levelId: shortcut.levelId,
      difficultyId,
      carryScore: 0,
      carryCampaignMetrics: createEmptyCampaignMetrics(),
      rewardTier: 0,
      runModifierId: null
    });
  };

  private readonly handleOpenSettings = (): void => {
    this.scene.start('SettingsScene');
  };

  private readonly handleOpenMultiplayer = (): void => {
    const input = window.prompt('Servidor co-op (IP:puerto):', 'localhost:3001');
    if (!input) return;
    const url = `ws://${input}`;
    const playerName = `Player${Math.floor(Math.random() * 1000)}`;
    this.scene.start('RaycastScene', {
      netMode: true,
      serverUrl: url,
      playerName,
      carryScore: 0,
      carryCampaignMetrics: createEmptyCampaignMetrics(),
      rewardTier: 0,
      runModifierId: null
    });
  };

  private readonly handleMenuSelectionUp = (): void => {
    this.menuSelectionIndex = (this.menuSelectionIndex + 2 - 1) % 2;
    this.refreshMenuSelectionVisuals();
  };

  private readonly handleMenuSelectionDown = (): void => {
    this.menuSelectionIndex = (this.menuSelectionIndex + 1) % 2;
    this.refreshMenuSelectionVisuals();
  };

  private readonly handleMenuConfirm = (): void => {
    if (this.menuSelectionIndex === 0) {
      this.handleStartRaycast();
      return;
    }
    this.handleOpenSettings();
  };

  private readonly handleMenuCancel = (): void => {
    this.menuSelectionIndex = 0;
    this.refreshMenuSelectionVisuals();
  };

  private readonly handleCycleDifficulty = (): void => {
    const next = cycleRaycastDifficulty(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY));
    this.registry.set(RAYCAST_DIFFICULTY_REGISTRY_KEY, next.id);
    this.difficultyHintText.setText(this.buildDifficultyMenuLine());
    this.playFeedbackEvent('difficultySelect');
  };

  private buildDifficultyMenuLine(): string {
    const preset = getRaycastDifficultyPreset(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY));
    return `DIFICULTAD · ${preset.label.toUpperCase()}  ·  [D] CAMBIAR`;
  }

  constructor() {
    super('MenuScene');
  }

  create(): void {
    prepareGameSession(this.registry);
    const width = this.scale.width;
    const height = this.scale.height;
    const copy = getMainMenuCopy();
    const layout = buildMainMenuLayout(width, height);
    this.audioFeedback = new AudioFeedbackSystem();
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

    this.cameras.main.setBackgroundColor(MENU_BACKGROUND);

    this.background = new AttractBackground(this, width, height);
    this.drawTitleFrame(width, height, layout.titleFrameCenterY);

    this.add
      .text(layout.centerX, layout.titleY, copy.title, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '22px' : '34px',
        fontStyle: '700',
        color: MENU_CYAN_SOFT,
        stroke: '#05070b',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: width - 48 }
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.add
      .text(layout.centerX, layout.subtitleY, copy.subtitle, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '16px' : '22px',
        fontStyle: '700',
        color: '#9ef0cf',
        stroke: '#05070b',
        strokeThickness: 4,
        align: 'center',
        letterSpacing: 8
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.settingsLine = this.add
      .text(layout.centerX, layout.settingsY, copy.settingsPrompt, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: '700',
        color: MENU_SETTINGS,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0.92)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, this.handleOpenSettings);
    this.settingsLine.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.menuSelectionIndex = 1;
      this.refreshMenuSelectionVisuals();
    });
    this.settingsLine.on(Phaser.Input.Events.POINTER_OUT, () => this.refreshMenuSelectionVisuals());

    this.gamepadStatusText = this.add
      .text(layout.centerX, layout.settingsY + 28, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: '700',
        color: '#9ef0cf',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0.82);

    // Multiplayer entry — sits below the gamepad status line (settingsY + 52).
    // Treated as an independent action (like boss shortcuts), not in the
    // gamepad carousel selection index.
    const multiLine = this.add
      .text(layout.centerX, layout.settingsY + 52, '[M] MULTIPLAYER  ·  CO-OP LAN', {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: '700',
        color: '#4de8b0',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0.92)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, this.handleOpenMultiplayer);
    multiLine.on(Phaser.Input.Events.POINTER_OVER, () => multiLine.setColor('#a0fff0'));
    multiLine.on(Phaser.Input.Events.POINTER_OUT, () => multiLine.setColor('#4de8b0'));

    this.difficultyHintText = this.add
      .text(layout.difficultyX, layout.difficultyY, this.buildDifficultyMenuLine(), {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: '700',
        color: '#ff9a38',
        stroke: '#05070b',
        strokeThickness: 4,
        align: 'right'
      })
      .setOrigin(1, 1)
      .setDepth(30)
      .setAlpha(0.95)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, this.handleCycleDifficulty);

    // Un clic en cualquier parte que no sea otra opción inicia la partida.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleBackgroundClick);

    this.refreshMenuSelectionVisuals();
    this.cameras.main.fadeIn(520, 0, 0, 0);

    this.registerInputListeners();
    this.touchInput.create();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInputListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInputListeners, this);
  }

  update(_time: number, deltaMs: number): void {
    this.background?.update(deltaMs);
    this.gamepadInput.update();
    this.touchInput.update();
    const touchMessage = this.touchInput.consumeStatusMessage();
    const gamepadMessage = this.gamepadInput.consumeStatusMessage();
    const statusLine = touchMessage ?? buildRaycastGamepadFooterLine(this.gamepadInput.getDebugInfo(), gamepadMessage);
    this.gamepadStatusText.setText(statusLine);
    this.gamepadStatusText.setAlpha(touchMessage || gamepadMessage || this.gamepadInput.isConnected() ? 0.92 : 0.72);

    if (this.touchInput.consumePressed('confirm') || this.touchInput.consumePressed('pause')) {
      this.handleMenuConfirm();
    }
    if (this.touchInput.consumePressed('cancel')) {
      this.handleMenuCancel();
    }
    if (this.gamepadInput.consumePressed('navUp') || this.touchInput.consumePressed('navUp')) {
      this.handleMenuSelectionUp();
    }
    if (this.gamepadInput.consumePressed('navDown') || this.touchInput.consumePressed('navDown')) {
      this.handleMenuSelectionDown();
    }
    if (this.touchInput.consumePressed('navLeft')) {
      this.handleMenuSelectionUp();
    }
    if (this.touchInput.consumePressed('navRight')) {
      this.handleMenuSelectionDown();
    }
    if (this.gamepadInput.consumePressed('confirm') || this.gamepadInput.consumePressed('pause')) {
      this.handleMenuConfirm();
    }
    if (this.gamepadInput.consumePressed('cancel')) {
      this.handleMenuCancel();
    }
  }

  private readonly handleBackgroundClick = (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void => {
    if (currentlyOver.length > 0) return;
    this.handleStartRaycast();
  };

  private drawTitleFrame(width: number, height: number, centerY: number): void {
    const graphics = this.add.graphics().setDepth(22);
    const frameWidth = Math.min(width - 120, 620);
    const frameHeight = Math.min(height * 0.2, 132);
    const frameX = width * 0.5 - frameWidth * 0.5;
    const frameY = centerY - frameHeight * 0.5;

    graphics.fillStyle(0x050810, 0.62);
    graphics.fillRoundedRect(frameX, frameY, frameWidth, frameHeight, 14);
    graphics.lineStyle(2, MENU_CYAN, 0.45);
    graphics.strokeRoundedRect(frameX, frameY, frameWidth, frameHeight, 14);
    graphics.lineStyle(1, MENU_EMBER, 0.25);
    graphics.strokeRoundedRect(frameX + 8, frameY + 8, frameWidth - 16, frameHeight - 16, 10);
  }

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const kb = this.input.keyboard;
    kb?.once('keydown-A', this.handleStartRaycast);
    kb?.once('keydown-a', this.handleStartRaycast);
    kb?.on('keydown-D', this.handleCycleDifficulty);
    kb?.on('keydown-d', this.handleCycleDifficulty);
    kb?.on('keydown', this.handleDemoShortcut);
    kb?.on('keydown-S', this.handleOpenSettings);
    kb?.on('keydown-s', this.handleOpenSettings);
    kb?.on('keydown-M', this.handleOpenMultiplayer);
    kb?.on('keydown-m', this.handleOpenMultiplayer);
    this.inputListenersRegistered = true;
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const kb = this.input.keyboard;
    kb?.off('keydown-A', this.handleStartRaycast);
    kb?.off('keydown-a', this.handleStartRaycast);
    kb?.off('keydown-D', this.handleCycleDifficulty);
    kb?.off('keydown-d', this.handleCycleDifficulty);
    kb?.off('keydown', this.handleDemoShortcut);
    kb?.off('keydown-S', this.handleOpenSettings);
    kb?.off('keydown-s', this.handleOpenSettings);
    kb?.off('keydown-M', this.handleOpenMultiplayer);
    kb?.off('keydown-m', this.handleOpenMultiplayer);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleBackgroundClick);
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();
    this.inputListenersRegistered = false;
  }

  private refreshMenuSelectionVisuals(): void {
    this.settingsLine?.setColor(this.menuSelectionIndex === 1 ? '#ffd0e8' : MENU_SETTINGS);
  }

  private playFeedbackEvent(event: 'difficultySelect' | 'difficultyStart'): void {
    getRaycastFeedbackActions(event).forEach((action) => {
      this.audioFeedback.play(action.cue, action.intensity, this.time.now + (action.delayMs ?? 0));
    });
  }
}
