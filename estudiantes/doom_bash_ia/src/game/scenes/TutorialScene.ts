import Phaser from 'phaser';
import { AttractBackground } from '../raycast/AttractBackground';
import { getRaycastDifficultyPreset, RAYCAST_DIFFICULTY_REGISTRY_KEY, type RaycastDifficultyId } from '../raycast/RaycastDifficulty';
import { RAYCAST_LEVEL_CATALOG } from '../raycast/RaycastLevel';
import { resolveRaycastDemoShortcut } from '../raycast/RaycastBossShortcuts';
import { buildTutorialModel } from '../raycast/RaycastTutorial';
import { createEmptyCampaignMetrics } from '../raycast/RaycastScore';
import type { RunModifierId } from '../raycast/RunModifierRoulette';
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
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import { RaycastTouchInput } from '../systems/RaycastTouchInput';
import { GlassOverlay } from '../ui/GlassOverlay';
import { buildTutorialTerminalHtml, ensureTerminalTutorialStyles } from '../ui/terminalTutorial';
import { stopGameMasterVoice } from '../../services/gameMasterVoice';

export interface TutorialSceneData {
  difficultyId?: RaycastDifficultyId;
  runModifierId?: RunModifierId | null;
}

/**
 * Tutorial de vidrio líquido antes del nivel 1: una animación en bucle (moverse, disparar y recargar, armas y
 * objetivo del nivel) sobre el fondo en vivo. ENTER, clic o A del mando empiezan la partida.
 */
export class TutorialScene extends Phaser.Scene {
  private difficultyId!: RaycastDifficultyId;
  private runModifierId: RunModifierId | null = null;
  private background: AttractBackground | null = null;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private inputListenersRegistered = false;
  private leaving = false;

  constructor() {
    super('TutorialScene');
  }

  init(data: TutorialSceneData = {}): void {
    this.difficultyId = getRaycastDifficultyPreset(data.difficultyId ?? this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.runModifierId = data.runModifierId ?? null;
    this.leaving = false;
  }

  create(): void {
    stopGameMasterVoice('tutorial_enter');
    prepareGameSession(this.registry);
    const width = this.scale.width;
    const height = this.scale.height;
    this.cameras.main.setBackgroundColor(0x020408);

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

    this.background = new AttractBackground(this, width, height, { shadeAlpha: 0.4 });

    new GlassOverlay(this, buildTutorialTerminalHtml(buildTutorialModel(RAYCAST_LEVEL_CATALOG[0])), ensureTerminalTutorialStyles);

    this.cameras.main.fadeIn(420, 0, 0, 0);
    this.registerInputListeners();
    this.touchInput.create();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInputListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInputListeners, this);
  }

  update(_time: number, deltaMs: number): void {
    this.background?.update(deltaMs);
    this.gamepadInput.update();
    this.touchInput.update();
    if (this.touchInput.consumePressed('confirm') || this.gamepadInput.consumePressed('confirm') || this.gamepadInput.consumePressed('pause')) {
      this.startRun();
      return;
    }
    if (this.touchInput.consumePressed('cancel') || this.gamepadInput.consumePressed('cancel')) {
      this.backToMenu();
    }
  }

  private readonly startRun = (): void => {
    if (this.leaving) return;
    this.leaving = true;
    this.cleanupInputListeners();
    this.scene.start('RaycastScene', { difficultyId: this.difficultyId, runModifierId: this.runModifierId });
  };

  private readonly backToMenu = (): void => {
    if (this.leaving) return;
    this.leaving = true;
    this.cleanupInputListeners();
    this.scene.start('MenuScene');
  };

  /** Atajos de demo: 4/5/6 = niveles 3/6/10, 7/8/9 = jefes, tecla a la derecha del 0 = pantalla final. */
  private readonly handleDemoShortcut = (event: KeyboardEvent): void => {
    const shortcut = resolveRaycastDemoShortcut(event);
    if (!shortcut || this.leaving) return;
    this.leaving = true;
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

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', this.startRun);
    kb?.on('keydown-SPACE', this.startRun);
    kb?.on('keydown-ESC', this.backToMenu);
    kb?.on('keydown', this.handleDemoShortcut);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.startRun);
    this.inputListenersRegistered = true;
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const kb = this.input.keyboard;
    kb?.off('keydown-ENTER', this.startRun);
    kb?.off('keydown-SPACE', this.startRun);
    kb?.off('keydown-ESC', this.backToMenu);
    kb?.off('keydown', this.handleDemoShortcut);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.startRun);
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();
    this.inputListenersRegistered = false;
  }
}
