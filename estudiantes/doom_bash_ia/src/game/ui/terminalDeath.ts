/**
 * Pantalla de fin de la partida con la estética del juego: terminal retro sobre negro, esta vez en rojo de alarma
 * ("señal perdida"), marco pixelado con sombra dura, cifras en cajas cuadradas y teclas cuadradas. Se dibuja en HTML
 * sobre el lienzo (mismo `GlassOverlay` que el tutorial) y todo lo animado es CSS con `steps()`, para que se vea a saltos,
 * como una pantalla vieja.
 *
 * Los builders devuelven texto HTML para poder probarlos sin navegador. Diseñado para el lienzo fijo de 960 x 540.
 */
import { escapeHtml, GLASS_HEIGHT, GLASS_WIDTH } from './liquidGlass';

export const TERMINAL_DEATH_STYLE_ID = 'rd-styles';

const RED = '#ff4d4d';
const RED_DIM = '#ff9a8a';
const RED_DEEP = '#4a0c0c';
const INK = '#120303';
const WHITE = '#fff0ec';
const GREEN = '#4dff7c';

export const TERMINAL_DEATH_CSS = `
.rd-root{width:${GLASS_WIDTH}px;height:${GLASS_HEIGHT}px;display:flex;align-items:center;justify-content:center;pointer-events:none;
  font-family:'SF Mono','Menlo','Consolas',monospace;font-weight:700;color:${WHITE};box-sizing:border-box}
.rd-root *{box-sizing:border-box}
.rd-card{position:relative;width:780px;padding:0 0 22px;background:rgba(10,1,1,.9);border:3px solid ${RED};
  box-shadow:0 0 0 3px ${INK},0 0 0 6px ${RED_DEEP},0 0 52px rgba(255,77,77,.3);overflow:hidden;animation:rdFlicker 4.4s steps(1,end) infinite}
.rd-card::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 2px,transparent 2px 4px)}
.rd-card>*{position:relative;z-index:1}
.rd-bar{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;background:${RED};color:${INK};font-size:15px;letter-spacing:4px}
.rd-bar-dots{display:flex;gap:6px}
.rd-bar-dots i{display:block;width:11px;height:11px;background:${INK}}
.rd-bar-title{flex:1;margin-left:14px}
.rd-bar-tag{font-size:12px;letter-spacing:2px;animation:rdBlink 1s steps(1,end) infinite}
.rd-body{padding:22px 34px 0;text-align:center}
.rd-code{font-size:12px;letter-spacing:4px;color:${RED_DIM};margin-bottom:10px}
.rd-title{margin:0;font-size:58px;line-height:1;letter-spacing:6px;color:${RED};
  text-shadow:4px 4px 0 ${RED_DEEP},0 0 22px rgba(255,77,77,.55);animation:rdGlitch 3.2s steps(1,end) infinite}
.rd-rule{height:8px;margin:14px auto 16px;width:430px;
  background:repeating-linear-gradient(90deg,${RED} 0 14px,transparent 14px 20px)}
.rd-sub{font-size:16px;letter-spacing:1px;color:${WHITE};margin-bottom:6px}
.rd-sub::before{content:'> ';color:${RED}}
.rd-sub::after{content:'';display:inline-block;width:10px;height:17px;margin-left:6px;vertical-align:-2px;background:${RED};animation:rdBlink 1s steps(1,end) infinite}
.rd-level{font-size:12px;letter-spacing:3px;color:${GREEN};opacity:.9;margin-bottom:20px}
.rd-stats{display:flex;justify-content:center;gap:16px;margin-bottom:24px}
.rd-stat{min-width:170px;padding:10px 14px 9px;background:${INK};border:3px solid ${RED};box-shadow:0 5px 0 ${RED_DEEP}}
.rd-stat b{display:block;font-size:30px;letter-spacing:2px;color:${WHITE}}
.rd-stat span{font-size:11px;letter-spacing:4px;color:${RED_DIM}}
.rd-keys{display:flex;justify-content:center;gap:40px}
.rd-key{display:flex;align-items:center;gap:14px;font-size:24px;letter-spacing:3px;color:${WHITE}}
.rd-key b{display:inline-block;min-width:52px;padding:7px 14px;text-align:center;font-size:26px;background:${INK};border:3px solid ${RED};
  box-shadow:0 5px 0 ${RED_DEEP};color:${WHITE}}
.rd-key:first-child b{background:${RED};color:${INK};animation:rdPress 1.6s steps(1,end) infinite}

@keyframes rdFlicker{0%,90%,100%{opacity:1}92%{opacity:.82}94%{opacity:1}96%{opacity:.9}}
@keyframes rdBlink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes rdGlitch{0%,86%,100%{transform:none;text-shadow:4px 4px 0 ${RED_DEEP},0 0 22px rgba(255,77,77,.55)}
  88%{transform:translateX(-5px);text-shadow:-5px 0 0 rgba(77,255,124,.7),5px 0 0 rgba(255,77,77,.9)}
  90%{transform:translateX(4px);text-shadow:5px 0 0 rgba(77,255,124,.7),-5px 0 0 rgba(255,77,77,.9)}
  92%{transform:none;text-shadow:4px 4px 0 ${RED_DEEP},0 0 22px rgba(255,77,77,.55)}}
@keyframes rdPress{0%,60%{transform:none}70%,100%{transform:translateY(3px)}}
`;

/** Inserta la hoja de estilos de la pantalla de fin una sola vez por documento. */
export function ensureTerminalDeathStyles(doc: Document = document): void {
  if (doc.getElementById(TERMINAL_DEATH_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = TERMINAL_DEATH_STYLE_ID;
  style.textContent = TERMINAL_DEATH_CSS;
  doc.head.appendChild(style);
}

export interface DeathTerminalModel {
  title: string;
  subtitle: string;
  levelLine: string;
  stats: Array<{ label: string; value: string }>;
}

export function buildDeathTerminalHtml(model: DeathTerminalModel): string {
  const stats = model.stats
    .map((s) => `<div class="rd-stat"><b>${escapeHtml(s.value)}</b><span>${escapeHtml(s.label)}</span></div>`)
    .join('');
  return `<div class="rd-root"><div class="rd-card">
  <div class="rd-bar"><div class="rd-bar-dots"><i></i><i></i><i></i></div><div class="rd-bar-title">SEÑAL PERDIDA</div><div class="rd-bar-tag">SIN ENLACE</div></div>
  <div class="rd-body">
    <div class="rd-code">// ERROR 0x00DEAD · OPERADOR FUERA DE LÍNEA</div>
    <h2 class="rd-title">${escapeHtml(model.title)}</h2>
    <div class="rd-rule"></div>
    <div class="rd-sub">${escapeHtml(model.subtitle)}</div>
    <div class="rd-level">${escapeHtml(model.levelLine)}</div>
    <div class="rd-stats">${stats}</div>
    <div class="rd-keys"><div class="rd-key"><b>R</b>REINTENTAR</div><div class="rd-key"><b>ESC</b>MENÚ</div></div>
  </div>
</div></div>`;
}
