export interface RaycastEpisodeBannerInput {
  currentLevelNumber: number;
  totalLevels: number;
  levelName: string;
  /** World 2 arc banner (replaces EP 1 line when set). */
  worldTwoSector?: { index: number; total: number };
  /** World 3 arc banner — checked before World 2 when both could apply (mutually exclusive levels). */
  worldThreeSector?: { index: number; total: number };
}

export interface RaycastOverlayHintInput {
  currentLevelNumber: number;
  canAdvance: boolean;
  episodeComplete: boolean;
  /** Episode finale (boss) cleared — World 2 placeholder available. */
  finaleBossCleared?: boolean;
  /** True only when World 2 content is not shipped (W-key teaser). */
  worldTwoLocked?: boolean;
  /** Boss down and next sector is World 2 — emphasize N continue. */
  continueToWorldTwo?: boolean;
  /** World 2 finale cleared and next sector is World 3 — emphasize N continue. */
  continueToWorldThree?: boolean;
  masteryUnlocked?: boolean;
}

export interface RaycastDifficultyMenuCopyInput {
  label: string;
  summary: string;
}

export interface RaycastHelpOverlayInput {
  difficultyLabel?: string;
  difficultySummary?: string;
  minimapToggleKey?: string;
}

export interface RaycastPriorityMessageInput {
  levelComplete: boolean;
  episodeComplete: boolean;
  finaleBossCleared?: boolean;
  worldTwoLocked?: boolean;
  fullArcClear?: boolean;
  /** When continuing from Episode 1 boss into World 2 — colder transition copy */
  worldTwoTransition?: boolean;
  playerAlive: boolean;
  playerHealth: number;
  objective: string;
  hint: string;
  lowHealthHint?: string | null;
  combatMessage?: string;
  combatMessageActive: boolean;
  blockedHintActive: boolean;
}

export interface RaycastPriorityMessage {
  text: string;
  tone: 'critical' | 'warning' | 'info' | 'routine';
}

export interface RaycastLevelStartObjectiveInput {
  objective: string;
  hasBoss?: boolean;
  keyTotal?: number;
  livingEnemyCount?: number;
}

/** Neutral team credit — no individual author names in UI surfaces. */
export const RAYCAST_TEAM_CREDIT_LINE = 'A Doom Bin Bash Project';

export function getMainMenuInputHints(): string {
  return 'A iniciar  ·  B volver  ·  Start iniciar';
}

/** Strings and vertical placement for the boot MenuScene. */
export interface MainMenuCopy {
  title: string;
  /** Línea bajo el título. */
  subtitle: string;
  settingsPrompt: string;
  footerCredit: string;
}

export interface MainMenuLayout {
  centerX: number;
  titleY: number;
  subtitleY: number;
  settingsY: number;
  /** Center Y for the decorative frame behind the title and subtitle */
  titleFrameCenterY: number;
  /** Esquina inferior derecha donde vive el selector de dificultad (texto con origen 1,1). */
  difficultyX: number;
  difficultyY: number;
}

export interface RaycastDeathGlassInput {
  levelDisplayLine: string;
  elapsedMs: number;
  enemiesKilled: number;
  score: number;
}

/** Pantalla de fin de partida (terminal): título corto, una frase y tres cifras. */
export function buildRaycastDeathGlassModel(input: RaycastDeathGlassInput): {
  title: string;
  subtitle: string;
  levelLine: string;
  stats: Array<{ label: string; value: string }>;
} {
  const seconds = Math.max(0, Math.floor(input.elapsedMs / 1000));
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return {
    title: 'FIN DE LA PARTIDA',
    subtitle: 'Enlace caído. Ajusta tu ruta y vuelve a intentarlo.',
    levelLine: input.levelDisplayLine,
    stats: [
      { label: 'TIEMPO', value: time },
      { label: 'BAJAS', value: String(input.enemiesKilled) },
      { label: 'PUNTAJE', value: String(Math.max(0, Math.round(input.score))) }
    ]
  };
}

export function buildRaycastEpisodeBanner(input: RaycastEpisodeBannerInput): string {
  if (input.worldThreeSector) {
    return `WORLD 3 // EMBER MERIDIAN — THIRD HELL  |  SECTOR ${input.worldThreeSector.index}/${input.worldThreeSector.total}  ${input.levelName.toUpperCase()}`;
  }
  if (input.worldTwoSector) {
    return `WORLD 2 // ABYSS STRATUM — GLASS ABYSS, NOT THE FORGE  |  SECTOR ${input.worldTwoSector.index}/${input.worldTwoSector.total}  ${input.levelName.toUpperCase()}`;
  }
  return `EP 1 // CINDER FORGE STRATUM  |  LVL ${input.currentLevelNumber}/${input.totalLevels} ${input.levelName.toUpperCase()}`;
}

export function buildRaycastOverlayHint(input: RaycastOverlayHintInput): string {
  if (input.episodeComplete && input.masteryUnlocked) {
    return 'SEÑAL VERDADERA DESBLOQUEADA  |  N FINAL  |  R REPETIR  |  ESC MENÚ';
  }
  if (input.episodeComplete && input.finaleBossCleared && input.worldTwoLocked) {
    return 'W MUNDO 2 (BLOQUEADO)  |  N FINAL  |  R REPETIR JEFE  |  ESC MENÚ';
  }
  if (!input.episodeComplete && input.finaleBossCleared && input.continueToWorldThree) {
    return 'N CONTINUAR A MUNDO 3 — MERIDIANA ASCUA  |  R REINICIAR SECTOR  |  ESC MENÚ';
  }
  if (!input.episodeComplete && input.finaleBossCleared && input.continueToWorldTwo) {
    return 'N CONTINUAR A MUNDO 2  |  R REPETIR JEFE  |  ESC MENÚ';
  }
  if (input.episodeComplete) return 'N VER FINAL  |  R REPETIR  |  ESC MENÚ';
  if (input.canAdvance) return `N CONTINUAR  |  R REINICIAR SECTOR  |  ESC MENÚ`;
  return `R REINICIAR SECTOR  |  ESC MENÚ`;
}

export function buildRaycastMasteryEndingLines(input: {
  episodeComplete: boolean;
  fullArcClear: boolean;
  masteryUnlocked: boolean;
  impossibleModeUnlocked: boolean;
  hiddenChallengeHookUnlocked: boolean;
}): string[] {
  if (!input.episodeComplete || !input.fullArcClear) return [];
  if (!input.masteryUnlocked) {
    return ['FINAL NORMAL // SEÑAL CONTENIDA', 'META DE MAESTRÍA // OBTÉN S O SS EN TODOS LOS SECTORES'];
  }
  const lines = [
    'FINAL SEÑAL VERDADERA // MALLA NÚCLEO ESTABILIZADA',
    'FINAL SECRETO // EL ECO CORRUPTO AÚN LLAMA DESDE ABAJO',
    'EXTRACCIÓN COMPLETA // NAVE REPARADA, SEÑAL RESTAURADA, COMPLEJO SOBREVIVIDO'
  ];
  if (input.impossibleModeUnlocked) lines.push('DESBLOQUEO // MODO IMPOSIBLE');
  if (input.hiddenChallengeHookUnlocked) lines.push('GANCHO // NODO DE DESAFÍO FINAL ACTIVADO');
  return lines;
}

export function buildRaycastStatusMessage(
  levelComplete: boolean,
  episodeComplete: boolean,
  playerAlive: boolean,
  finaleBossCleared = false,
  worldTwoLocked = true,
  fullArcClear = false,
  worldTwoTransition = false
): string {
  if (levelComplete) {
    if (fullArcClear) {
      return 'Arco completo despejado — Episodio 1 + Mundo 2 + Meridiana Ascua (Mundo 3). Presiona R para reintentar o ESC para menú.';
    }
    if (episodeComplete && finaleBossCleared && worldTwoLocked) {
      return 'Jefe neutralizado. W para señal de Mundo 2, R para repetir jefe, ESC para menú.';
    }
    if (!episodeComplete && finaleBossCleared && !worldTwoLocked) {
      return worldTwoTransition
        ? 'Archon cayó — el estrato abisal se abrió. Presiona N para descender, R para repetir jefe, ESC para menú.'
        : 'Jefe neutralizado. Presiona N para descender a Mundo 2, R para repetir jefe, ESC para menú.';
    }
    return episodeComplete
      ? 'Episodio completado. Presiona R para repetir final o ESC para menú.'
      : 'Sector despejado. Presiona N para continuar, R para repetir o ESC para menú.';
  }
  if (playerAlive) return 'Barre el sector. Mantente en movimiento.';
  return 'Señal perdida. Presiona R para reintentar o ESC para menú.';
}

export function buildRaycastDifficultyMenuLine(input: RaycastDifficultyMenuCopyInput): string {
  return `DIFFICULTY // ${input.label.toUpperCase()} // ${input.summary.toUpperCase()}`;
}

export function buildRaycastHelpOverlayText(input: RaycastHelpOverlayInput = {}): string {
  const minimapToggleKey = input.minimapToggleKey ?? 'M';
  const difficultyLine =
    input.difficultyLabel && input.difficultySummary
      ? `DIFFICULTY // ${input.difficultyLabel.toUpperCase()} // ${input.difficultySummary}`
      : null;

  return [
    'MOVER // WASD',
    'GIRAR // MOUSE, QE, FLECHAS',
    'DISPARO // F, ESPACIO, CLICK',
    'ARMAS // 1, 2, 3',
    `MAPA // ${minimapToggleKey}`,
    'INTERACTUAR // CAMINA SOBRE PORTONES, CERRADURAS Y SALIDAS',
    'REINICIO / MENÚ // R REINICIAR, ESC MENÚ',
    'DEPURAR // TAB',
    difficultyLine,
    'MENÚ TÍTULO // A INICIAR OPERACIÓN',
    'H O ? // MOSTRAR/OCULTAR AYUDA'
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function buildRaycastPriorityMessage(input: RaycastPriorityMessageInput): RaycastPriorityMessage {
  if (!input.playerAlive) {
    return {
      text: buildRaycastStatusMessage(false, false, false),
      tone: 'critical'
    };
  }

  if (input.levelComplete) {
    return {
      text: buildRaycastStatusMessage(
        true,
        input.episodeComplete,
        true,
        Boolean(input.finaleBossCleared),
        input.worldTwoLocked !== false,
        Boolean(input.fullArcClear),
        Boolean(input.worldTwoTransition)
      ),
      tone: 'info'
    };
  }

  if (input.playerHealth <= 25) {
    return {
      text:
        input.lowHealthHint ??
        (input.objective === 'REACH EXIT'
          ? 'VIDA CRÍTICA. LA SALIDA ESTÁ ABIERTA, EMPUJA EXTRACCIÓN YA.'
          : 'VIDA CRÍTICA. ROMPE CONTACTO O FUERZA EL OBJETIVO.'),
      tone: 'critical'
    };
  }

  if (input.blockedHintActive) {
    return {
      text: input.hint,
      tone: 'warning'
    };
  }

  if (input.combatMessageActive && input.combatMessage) {
    return {
      text: input.combatMessage,
      tone: 'warning'
    };
  }

  if (input.playerHealth <= 50) {
    return {
      text: input.lowHealthHint ?? 'VIDA BAJA. MUÉVETE Y EVITA INTERCAMBIAR DAÑO.',
      tone: 'warning'
    };
  }

  if (input.objective === 'REACH EXIT') {
    return {
      text: 'NODO DE SALIDA ACTIVO. CORTA RUTA A EXTRACCIÓN.',
      tone: 'info'
    };
  }

  return {
    text: input.hint,
    tone: 'routine'
  };
}

export function buildRaycastLevelStartObjectiveMessage(input: RaycastLevelStartObjectiveInput): string {
  const objective = input.objective.trim().toUpperCase();
  if (input.hasBoss) return 'OBJETIVO // DERROTA AL JEFE Y EXTRAE.';
  if (objective === 'FIND KEY' || objective === 'FIND TOKEN') return 'OBJETIVO // RECUPERA LA LLAVE Y ESCAPA.';
  if (objective === 'OPEN DOOR' || objective === 'OPEN GATE') return 'OBJETIVO // ABRE LA COMPUERTA Y AVANZA.';
  if (objective === 'SURVIVE AMBUSH') {
    return (input.livingEnemyCount ?? 0) > 0
      ? 'OBJETIVO // ELIMINA TODOS LOS HOSTILES.'
      : 'OBJETIVO // SOBREVIVE A LA EMBOSCADA Y EXTRAE.';
  }
  if (objective === 'REACH EXIT' || objective === 'EXIT READY') return 'OBJETIVO // LLEGA AL PUNTO DE EXTRACCIÓN.';
  return input.keyTotal && input.keyTotal > 0
    ? 'OBJETIVO // RECUPERA LA LLAVE Y ESCAPA.'
    : 'OBJETIVO // AVANZA A EXTRACCIÓN.';
}

export function getMainMenuCopy(): MainMenuCopy {
  return {
    title: 'DOOM BIN BASH EDITION',
    subtitle: 'with IA',
    settingsPrompt: 'S — CONFIG (SESIÓN)',
    footerCredit: RAYCAST_TEAM_CREDIT_LINE
  };
}

export interface PrologueCopy {
  missionBlock: string;
  objectiveBlock: string;
  controlsBlock: string;
  continueLine: string;
  backLine: string;
}

/** Pantalla previa limpia para la corrida raycast. */
export function getPrologueCopy(): PrologueCopy {
  return {
    missionBlock:
      'MISIÓN:\nUna señal de rescate quedó atrapada en un complejo abandonado que ahora se defiende solo. Cruza sus tres estratos (Forja de Ceniza, Abismo de Cristal y Meridiana Ascua), derrota al jefe de cada uno y recupera la señal para salir con vida.',
    objectiveBlock:
      'OBJETIVO:\nEn cada sector: busca las llaves, abre las puertas selladas, sobrevive a la emboscada y llega a la salida. Al final de cada mundo te espera un jefe; derrótalo para seguir. Los secretos, la puntería y la rapidez suben tu puntaje.',
    controlsBlock:
      'WASD · mover\nMouse · apuntar y disparar\n1 / 2 / 3 · cambiar de arma\nR · recargar\nESC · pausa\nMando · A iniciar · B volver',
    continueLine: '[ ENTER / A  INICIAR ]',
    backLine: '[ ESC / B  MENÚ ]'
  };
}

export function buildMainMenuLayout(width: number, height: number): MainMenuLayout {
  const centerX = width * 0.5;
  const shortViewport = width <= 720 || height <= 405;
  const titleY = Math.round(height * (shortViewport ? 0.36 : 0.38));
  const subtitleY = titleY + (shortViewport ? 30 : 38);
  const titleFrameCenterY = titleY + (shortViewport ? 10 : 12);
  const settingsY = titleY + (shortViewport ? 84 : 104);
  const cornerPad = shortViewport ? 16 : 24;

  return {
    centerX,
    titleY,
    subtitleY,
    settingsY,
    titleFrameCenterY,
    difficultyX: width - cornerPad,
    difficultyY: height - cornerPad
  };
}
