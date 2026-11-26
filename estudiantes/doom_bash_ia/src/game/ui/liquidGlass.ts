/**
 * Utilidades compartidas por las pantallas HTML que se dibujan sobre el lienzo de Phaser (tutorial y fin de partida,
 * ambas en terminal): escape de texto, formato de tiempo y el tamaño fijo del lienzo de 960 x 540.
 * (El nombre del archivo viene de la primera versión de estas pantallas, en vidrio líquido, que ya no existe.)
 */

export const GLASS_WIDTH = 960;
export const GLASS_HEIGHT = 540;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatGlassDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
