import { formatRaycastActiveInputLine, formatRaycastControlsHelpBlock, type RaycastActiveInputKind } from './RaycastInputHelp';
/** Pause menu labels shared by RaycastScene — keeps the gameplay scene slimmer. */

export const RAYCAST_PAUSE_MENU_LABELS = [
  'Reanudar',
  'Reiniciar nivel',
  'Ajustes (GM / FPS)',
  'Controles de entrada',
  'Menú principal',
  'Subir volumen',
  'Bajar volumen',
  'Alternar minimapa',
  'Alternar HUD debug',
] as const;

export type RaycastPauseMenuAction =
  | 'resume'
  | 'restart'
  | 'settings'
  | 'controls'
  | 'menu'
  | 'vol_up'
  | 'vol_down'
  | 'minimap'
  | 'debug';

export const RAYCAST_PAUSE_MENU_ACTIONS: RaycastPauseMenuAction[] = [
  'resume',
  'restart',
  'settings',
  'controls',
  'menu',
  'vol_up',
  'vol_down',
  'minimap',
  'debug',
];

export const RAYCAST_SETTINGS_GM_ROWS = [
  'gm_narration',
  'gm_voice',
  'gm_voice_volume',
  'gm_test',
] as const;

export const RAYCAST_SETTINGS_PERF_ROWS = [
  'fps_target',
  'render_quality',
  'minimap_quality',
] as const;

export const RAYCAST_SETTINGS_DEBUG_ROWS = ['debug_perf_hud', 'debug_gm_logs'] as const;

export const RAYCAST_SETTINGS_PAUSE_ROWS = [
  ...RAYCAST_SETTINGS_GM_ROWS,
  ...RAYCAST_SETTINGS_PERF_ROWS,
  ...RAYCAST_SETTINGS_DEBUG_ROWS,
  'back',
] as const;

export type RaycastSettingsPauseRow = (typeof RAYCAST_SETTINGS_PAUSE_ROWS)[number];

export const RAYCAST_CONTROL_PAUSE_ROWS = [
  'control',
  'mouse',
  'pad_sens',
  'left_deadzone',
  'right_deadzone',
  'invert_y',
  'vibration',
  'screenshake',
  'minimap',
  'back',
] as const;

export type RaycastControlPauseRow = (typeof RAYCAST_CONTROL_PAUSE_ROWS)[number];

const DEFAULT_LINE_CHARS = 100;
const DEFAULT_COL_CHARS = 30;

export function truncatePauseField(text: string, maxChars: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`;
}

export interface RaycastPauseMenuMxModel {
  activeInput: RaycastActiveInputKind;
  volumePct: number;
  selectionIndex: number;
  worldLine: string;
  difficultyLabel: string;
  score: number;
  highScore: number;
  missionLine: string;
  objectiveLine: string;
  hintLine: string;
  tokensLine: string;
  secretsLine: string;
  modifiersLine: string;
}

export interface RaycastSettingsPauseModel {
  activeInput: RaycastActiveInputKind;
  selectionIndex: number;
  gmNarration: string;
  gmVoice: string;
  gmVoiceVolume: string;
  gmStatus: string;
  gmTestHint: string;
  fpsTarget: string;
  renderQuality: string;
  minimapQuality: string;
  debugPerfHud: string;
  debugGmLogs: string;
}

export interface RaycastControlPauseModel {
  activeInput: RaycastActiveInputKind;
  controlStatus: string;
  gamepadDebugLine?: string;
  gamepadLiveLine?: string;
  selectionIndex: number;
  mouseSensitivity: string;
  gamepadSensitivity: string;
  leftDeadzone: string;
  rightDeadzone: string;
  invertY: string;
  vibration: string;
  screenshake: string;
  minimap: string;
}

/** Junta fragmentos con ' · ' en tantas líneas como hagan falta para que ninguna pase de `width` (sin cortar texto). */
function packPauseParts(parts: string[], width: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const part of parts) {
    const next = cur ? `${cur} · ${part}` : part;
    if (cur && next.length > width) {
      lines.push(cur);
      cur = part;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => truncatePauseField(l, width));
}

function formatSectionHeader(title: string): string {
  return `// ${title}`;
}

function formatSettingsRow(
  rowId: RaycastSettingsPauseRow,
  label: string,
  value: string,
  selectionIndex: number,
): string {
  const idx = RAYCAST_SETTINGS_PAUSE_ROWS.indexOf(rowId);
  const prefix = idx === selectionIndex ? '>' : ' ';
  return `${prefix} ${label.padEnd(16)} ${value}`;
}

/**
 * Menú de pausa principal: secciones a todo el ancho (la misión sale completa) separadas por una línea en blanco,
 * controles resumidos y el menú en dos columnas. Son ~27 líneas con letra de 10 px, así que cabe en el panel.
 */
export function formatRaycastPauseMenuMxBody(
  model: RaycastPauseMenuMxModel,
  opts?: { lineChars?: number },
): string {
  const w = opts?.lineChars ?? DEFAULT_LINE_CHARS;
  const L = (s: string) => truncatePauseField(s, w);

  const menuCell = (i: number): string => {
    const label = RAYCAST_PAUSE_MENU_LABELS[i];
    if (label === undefined) return '';
    return `${i === model.selectionIndex ? '> ' : '  '}${label}`;
  };
  const split = Math.ceil(RAYCAST_PAUSE_MENU_LABELS.length / 2);
  const menuLines: string[] = [];
  for (let i = 0; i < split; i += 1) {
    menuLines.push(`${menuCell(i).padEnd(32)}${menuCell(i + split)}`.trimEnd());
  }

  // Una línea en blanco entre bloques para que cada párrafo se vea definido.
  return [
    formatSectionHeader('PARTIDA'),
    L(`Mundo · ${model.worldLine}`),
    L(`Dificultad · ${model.difficultyLabel}  ·  Puntaje · ${model.score}  ·  Mejor · ${model.highScore}`),
    L(`${model.tokensLine}  ·  ${model.secretsLine}`),
    '',
    formatSectionHeader('MISIÓN'),
    L(model.missionLine),
    '',
    formatSectionHeader('OBJETIVO'),
    L(`Objetivo · ${model.objectiveLine}`),
    L(`Pista · ${model.hintLine}`),
    L(`Mods · ${model.modifiersLine}`),
    '',
    formatSectionHeader('CONTROLES'),
    formatRaycastActiveInputLine(model.activeInput),
    ...packPauseParts(formatRaycastControlsHelpBlock(model.activeInput).split('\n'), w),
    '',
    formatSectionHeader('MENÚ'),
    ...menuLines,
    '',
    `↑↓ menú · ENTER · ESC  ·  VOLUMEN ${model.volumePct}%`,
  ].join('\n');
}

const SETTINGS_ROW_LABELS: Record<RaycastSettingsPauseRow, string> = {
  gm_narration: 'Narración',
  gm_voice: 'Voz',
  gm_voice_volume: 'Volumen voz',
  gm_test: 'Probar voz GM',
  fps_target: 'FPS objetivo',
  render_quality: 'Calidad render',
  minimap_quality: 'Minimapa calidad',
  debug_perf_hud: 'HUD perf',
  debug_gm_logs: 'Logs GM',
  back: 'Volver',
};

export function formatRaycastSettingsPauseBody(model: RaycastSettingsPauseModel): string {
  const valueByRow: Record<RaycastSettingsPauseRow, string> = {
    gm_narration: model.gmNarration,
    gm_voice: model.gmVoice,
    gm_voice_volume: model.gmVoiceVolume,
    gm_test: model.gmTestHint,
    fps_target: model.fpsTarget,
    render_quality: model.renderQuality,
    minimap_quality: model.minimapQuality,
    debug_perf_hud: model.debugPerfHud,
    debug_gm_logs: model.debugGmLogs,
    back: 'menú de pausa',
  };

  const lines: string[] = [
    'AJUSTES',
    formatRaycastActiveInputLine(model.activeInput),
    `Estado · ${model.gmStatus}`,
    '',
    formatSectionHeader('GAME MASTER'),
  ];

  for (const rowId of RAYCAST_SETTINGS_GM_ROWS) {
    lines.push(formatSettingsRow(rowId, SETTINGS_ROW_LABELS[rowId], valueByRow[rowId], model.selectionIndex));
  }

  lines.push('', formatSectionHeader('PERFORMANCE'));
  for (const rowId of RAYCAST_SETTINGS_PERF_ROWS) {
    lines.push(formatSettingsRow(rowId, SETTINGS_ROW_LABELS[rowId], valueByRow[rowId], model.selectionIndex));
  }

  lines.push('', formatSectionHeader('DEBUG'));
  for (const rowId of RAYCAST_SETTINGS_DEBUG_ROWS) {
    lines.push(formatSettingsRow(rowId, SETTINGS_ROW_LABELS[rowId], valueByRow[rowId], model.selectionIndex));
  }

  lines.push(
    '',
    formatSettingsRow('back', SETTINGS_ROW_LABELS.back, valueByRow.back, model.selectionIndex),
    '',
    '↑↓ navegar · ←→ cambiar · ENTER · ESC',
  );
  return lines.join('\n');
}

const CONTROL_ROW_LABELS: Record<RaycastControlPauseRow, string> = {
  control: 'Estado',
  mouse: 'Ratón sens',
  pad_sens: 'Mando sens',
  left_deadzone: 'Deadzone izq',
  right_deadzone: 'Deadzone der',
  invert_y: 'Invertir Y',
  vibration: 'Vibración',
  screenshake: 'Screenshake',
  minimap: 'Minimapa',
  back: 'Volver',
};

export function formatRaycastControlPauseBody(model: RaycastControlPauseModel, opts?: { columnChars?: number }): string {
  const w = opts?.columnChars ?? DEFAULT_COL_CHARS;
  const L = (s: string) => truncatePauseField(s, w);
  const valueByRow: Record<RaycastControlPauseRow, string> = {
    control: model.controlStatus,
    mouse: model.mouseSensitivity,
    pad_sens: model.gamepadSensitivity,
    left_deadzone: model.leftDeadzone,
    right_deadzone: model.rightDeadzone,
    invert_y: model.invertY,
    vibration: model.vibration,
    screenshake: model.screenshake,
    minimap: model.minimap,
    back: 'menú de pausa',
  };

  const lines: string[] = [
    'CONTROLES DE ENTRADA',
    formatRaycastActiveInputLine(model.activeInput),
    ...(model.gamepadDebugLine ? ['', L(model.gamepadDebugLine)] : []),
    ...(model.gamepadLiveLine ? ['', L(model.gamepadLiveLine)] : []),
    '',
    formatSectionHeader('CONTROLES'),
  ];

  for (const rowId of RAYCAST_CONTROL_PAUSE_ROWS) {
    if (rowId === 'control') continue;
    const idx = RAYCAST_CONTROL_PAUSE_ROWS.indexOf(rowId);
    const prefix = idx === model.selectionIndex ? '>' : ' ';
    lines.push(`${prefix} ${CONTROL_ROW_LABELS[rowId].padEnd(14)} ${valueByRow[rowId]}`);
  }

  lines.push('', '↑↓ · ←→ · ENTER · ESC');
  return lines.join('\n');
}
