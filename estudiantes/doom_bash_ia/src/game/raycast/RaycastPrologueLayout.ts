export const PROLOGUE_SIDE_MARGIN_PX = 36;
export const PROLOGUE_GRID_GAP_PX = 16;
export const PROLOGUE_PANEL_PADDING_PX = 16;

export interface PrologueCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrologueScreenLayout {
  centerX: number;
  titleY: number;
  /** Los cuatro cuadrantes de la matriz 2x2 bajo el título. */
  mission: PrologueCell;
  objective: PrologueCell;
  modifiers: PrologueCell;
  controls: PrologueCell;
  gamepadY: number;
  promptY: number;
  footerY: number;
  fontTitle: string;
  fontHeading: string;
  fontBody: string;
  fontSmall: string;
  fontPrompt: string;
}

/**
 * Matriz 2x2 bajo el título:
 *
 *   MISIÓN        | OBJETIVO
 *   MODIFICADORES | CONTROLES
 *
 * La fila de abajo es más alta porque los modificadores pueden llegar a cinco líneas.
 * Abajo del todo van el estado del mando y la línea ENTER / ESC.
 */
export function computePrologueScreenLayout(width: number, height: number): PrologueScreenLayout {
  const short = height <= 480 || width <= 720;
  const centerX = width * 0.5;

  const titleY = Math.round(height * 0.045);
  const gridTop = Math.round(height * (short ? 0.17 : 0.16));
  const promptBlockH = short ? 22 : 26;
  const promptY = height - Math.round(height * 0.03);
  const gamepadY = promptY - promptBlockH - 8;
  const gridBottom = gamepadY - 20;

  const gridWidth = width - PROLOGUE_SIDE_MARGIN_PX * 2;
  const cellWidth = Math.floor((gridWidth - PROLOGUE_GRID_GAP_PX) / 2);
  const gridHeight = gridBottom - gridTop;
  const usable = gridHeight - PROLOGUE_GRID_GAP_PX;
  const topHeight = Math.floor(usable * 0.44);
  const bottomHeight = usable - topHeight;

  const leftX = PROLOGUE_SIDE_MARGIN_PX;
  const rightX = leftX + cellWidth + PROLOGUE_GRID_GAP_PX;
  const bottomY = gridTop + topHeight + PROLOGUE_GRID_GAP_PX;

  return {
    centerX,
    titleY,
    mission: { x: leftX, y: gridTop, width: cellWidth, height: topHeight },
    objective: { x: rightX, y: gridTop, width: cellWidth, height: topHeight },
    modifiers: { x: leftX, y: bottomY, width: cellWidth, height: bottomHeight },
    controls: { x: rightX, y: bottomY, width: cellWidth, height: bottomHeight },
    gamepadY,
    promptY,
    footerY: height - 6,
    fontTitle: short ? '20px' : '26px',
    fontHeading: short ? '13px' : '15px',
    fontBody: short ? '11px' : '13px',
    fontSmall: short ? '11px' : '13px',
    fontPrompt: short ? '12px' : '14px'
  };
}

/** Verdadero si los cuatro cuadrantes caben dentro del lienzo, sin traslaparse entre sí ni con el pie. */
export function prologueGridIsConsistent(layout: PrologueScreenLayout, width: number): boolean {
  const cells = [layout.mission, layout.objective, layout.modifiers, layout.controls];
  const inside = cells.every((c) => c.x >= 0 && c.x + c.width <= width && c.y >= 0 && c.width > 0 && c.height > 0);
  const aboveFooter = cells.every((c) => c.y + c.height < layout.gamepadY);
  const sameColumns = layout.mission.x === layout.modifiers.x && layout.objective.x === layout.controls.x;
  const sameRows = layout.mission.y === layout.objective.y && layout.modifiers.y === layout.controls.y;
  const ordered =
    layout.mission.x + layout.mission.width < layout.objective.x &&
    layout.mission.y + layout.mission.height < layout.modifiers.y;
  return inside && aboveFooter && sameColumns && sameRows && ordered;
}

export interface PrologueModifierRow {
  /** null = "sin modificador". */
  id: string | null;
  text: string;
  active: boolean;
}

export const PROLOGUE_MODIFIER_HINT = 'M / ↑ ↓ elegir  ·  R aleatorio  ·  N ninguno';
export const PROLOGUE_MODIFIER_NAME_WIDTH = 18;

/** Todas las opciones a la vez (una línea cada una); la activa lleva la marca ">". */
export function buildPrologueModifierRows(
  modifiers: ReadonlyArray<{ id: string; shortLabel: string; brief: string }>,
  selectedId: string | null
): PrologueModifierRow[] {
  const rows: PrologueModifierRow[] = [
    { id: null, text: `${selectedId === null ? '>' : ' '} ${'NINGUNO'.padEnd(PROLOGUE_MODIFIER_NAME_WIDTH)} Partida estándar, sin cambios`, active: selectedId === null }
  ];
  for (const m of modifiers) {
    const active = m.id === selectedId;
    rows.push({ id: m.id, text: `${active ? '>' : ' '} ${m.shortLabel.padEnd(PROLOGUE_MODIFIER_NAME_WIDTH)} ${m.brief}`, active });
  }
  return rows;
}
