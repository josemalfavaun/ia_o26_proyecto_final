/**
 * Tutorial previo a la partida con la estética del juego: terminal retro en verde fósforo sobre negro, marco
 * pixelado, teclas cuadradas con sombra dura y barra de munición por segmentos. Se dibuja en HTML sobre el lienzo
 * (mismo `GlassOverlay` que las demás pantallas) y las animaciones son CSS puro, así que funciona "a manera de video".
 *
 * Los builders devuelven texto HTML para poder probarlos sin navegador. Diseñado para el lienzo fijo de 960 x 540.
 */
import type { TutorialModel } from '../raycast/RaycastTutorial';
import { escapeHtml, GLASS_HEIGHT, GLASS_WIDTH } from './liquidGlass';

export const TERMINAL_TUTORIAL_STYLE_ID = 'rt-styles';

const GREEN = '#4dff7c';
const GREEN_DIM = '#8fd9a2';
const GREEN_DEEP = '#0c4a1e';
const INK = '#031208';
const WHITE = '#e9ffe9';

export const TERMINAL_TUTORIAL_CSS = `
.rt-root{width:${GLASS_WIDTH}px;height:${GLASS_HEIGHT}px;display:flex;align-items:center;justify-content:center;pointer-events:none;
  font-family:'SF Mono','Menlo','Consolas',monospace;font-weight:700;color:${WHITE};box-sizing:border-box}
.rt-root *{box-sizing:border-box}
.rt-card{position:relative;width:840px;padding:0 0 16px;background:rgba(0,9,3,.88);border:3px solid ${GREEN};
  box-shadow:0 0 0 3px ${INK},0 0 0 6px ${GREEN_DEEP},0 0 46px rgba(77,255,124,.28);overflow:hidden;animation:rtFlicker 6s infinite}
.rt-card::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 2px,transparent 2px 4px)}
.rt-card>*{position:relative;z-index:1}
.rt-bar{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;background:${GREEN};color:${INK};
  font-size:15px;letter-spacing:4px}
.rt-bar-dots{display:flex;gap:6px}
.rt-bar-dots i{display:block;width:11px;height:11px;background:${INK}}
.rt-bar-title{flex:1;margin-left:14px}
.rt-bar-level{font-size:12px;letter-spacing:2px}
.rt-stage{position:relative;height:290px;margin:10px 26px 0}
.rt-scene{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  animation:rtScene 22s steps(1,end) infinite;animation-delay:calc(var(--i) * 5.5s)}
.rt-scene h3{margin:0 0 4px;font-size:22px;letter-spacing:6px;color:${GREEN};text-shadow:0 0 10px rgba(77,255,124,.55)}
.rt-scene h3::before{content:'// ';color:${GREEN_DIM}}
.rt-scene p{margin:0 0 16px;font-size:14px;letter-spacing:1px;color:${GREEN_DIM}}
.rt-row{display:flex;align-items:center;justify-content:center;gap:54px}
.rt-pad{display:grid;grid-template-columns:repeat(3,62px);grid-template-rows:repeat(2,62px);gap:8px;justify-content:center}
.rt-key{display:flex;align-items:center;justify-content:center;font-size:26px;color:${WHITE};background:${INK};
  border:3px solid ${GREEN};box-shadow:0 5px 0 ${GREEN_DEEP}}
.rt-key.w{grid-column:2;grid-row:1;animation:rtHitW 5.5s steps(1,end) infinite}
.rt-key.a{grid-column:1;grid-row:2;animation:rtHitA 5.5s steps(1,end) infinite}
.rt-key.s{grid-column:2;grid-row:2;animation:rtHitS 5.5s steps(1,end) infinite}
.rt-key.d{grid-column:3;grid-row:2;animation:rtHitD 5.5s steps(1,end) infinite}
.rt-field{position:relative;width:236px;height:156px;background:#010a04;border:3px solid ${GREEN};
  background-image:linear-gradient(rgba(77,255,124,.16) 2px,transparent 2px),linear-gradient(90deg,rgba(77,255,124,.16) 2px,transparent 2px);background-size:26px 26px}
.rt-dot{position:absolute;left:104px;top:68px;width:18px;height:18px;background:${GREEN};box-shadow:0 0 12px ${GREEN};animation:rtWalk 5.5s steps(14,end) infinite}
.rt-mouse{position:relative;width:64px;height:96px;border:3px solid ${WHITE};background:${INK}}
.rt-mouse::before{content:'';position:absolute;left:50%;top:0;width:3px;height:40px;margin-left:-1px;background:${WHITE}}
.rt-mouse i{position:absolute;left:0;top:0;width:calc(50% - 1px);height:40px;background:${GREEN};animation:rtClick .9s steps(1,end) infinite}
.rt-ammo{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.rt-ammo-label{font-size:12px;letter-spacing:4px;color:${GREEN_DIM}}
.rt-ammo-bar{width:280px;height:24px;border:3px solid ${GREEN};background:${INK};padding:3px}
.rt-ammo-bar i{display:block;height:100%;width:100%;
  background:repeating-linear-gradient(90deg,${GREEN} 0 22px,transparent 22px 28px);animation:rtAmmo 5.5s steps(10,end) infinite}
.rt-rkey{width:54px;height:54px;font-size:28px;animation:rtHitR 5.5s steps(1,end) infinite}
.rt-cards{display:flex;gap:16px}
.rt-weapon{width:210px;padding:14px 12px;text-align:center;background:${INK};border:3px solid ${GREEN_DEEP}}
.rt-weapon .rt-key{width:46px;height:46px;margin:0 auto 10px;font-size:22px}
.rt-weapon b{display:block;font-size:17px;letter-spacing:2px;margin-bottom:5px;color:${WHITE}}
.rt-weapon span{font-size:12px;color:${GREEN_DIM}}
.rt-weapon:nth-child(1){animation:rtCard1 5.5s steps(1,end) infinite}
.rt-weapon:nth-child(2){animation:rtCard2 5.5s steps(1,end) infinite}
.rt-weapon:nth-child(3){animation:rtCard3 5.5s steps(1,end) infinite}
.rt-brief{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.rt-brief li{font-size:18px;letter-spacing:1px;color:${WHITE};padding-left:44px;position:relative}
.rt-brief li::before{content:'[>]';position:absolute;left:0;color:${GREEN}}
.rt-foot{display:flex;align-items:center;justify-content:space-between;margin:8px 26px 0}
.rt-dots{display:flex;gap:8px}
.rt-dots i{width:34px;height:8px;background:${GREEN_DEEP};animation:rtDot 22s steps(1,end) infinite;animation-delay:calc(var(--i) * 5.5s)}
.rt-go{font-size:20px;letter-spacing:3px;color:${GREEN}}
.rt-go b{display:inline-block;padding:4px 12px;margin-right:10px;background:${GREEN};color:${INK};animation:rtBlink 1.1s steps(1,end) infinite}
.rt-esc{font-size:12px;letter-spacing:3px;color:${GREEN_DIM}}

@keyframes rtScene{0%{opacity:0}1%,24%{opacity:1}25%,100%{opacity:0}}
@keyframes rtFlicker{0%,94%,100%{opacity:1}95%{opacity:.9}97%{opacity:1}}
@keyframes rtHitW{0%,3%,22%,100%{background:${INK};color:${WHITE};transform:none}4%,21%{background:${GREEN};color:${INK};transform:translateY(3px)}}
@keyframes rtHitA{0%,23%,42%,100%{background:${INK};color:${WHITE};transform:none}24%,41%{background:${GREEN};color:${INK};transform:translateY(3px)}}
@keyframes rtHitS{0%,43%,62%,100%{background:${INK};color:${WHITE};transform:none}44%,61%{background:${GREEN};color:${INK};transform:translateY(3px)}}
@keyframes rtHitD{0%,63%,82%,100%{background:${INK};color:${WHITE};transform:none}64%,81%{background:${GREEN};color:${INK};transform:translateY(3px)}}
@keyframes rtWalk{0%,3%{transform:translate(0,0)}20%{transform:translate(0,-52px)}25%{transform:translate(0,-52px)}40%{transform:translate(-78px,-52px)}45%{transform:translate(-78px,-52px)}60%{transform:translate(-78px,26px)}65%{transform:translate(-78px,26px)}80%{transform:translate(52px,26px)}100%{transform:translate(0,0)}}
@keyframes rtClick{0%,60%,100%{opacity:.2}20%,40%{opacity:1}}
@keyframes rtAmmo{0%,8%{width:100%}46%,60%{width:0}80%,100%{width:100%}}
@keyframes rtHitR{0%,46%,84%,100%{background:${INK};color:${WHITE};transform:none}50%,76%{background:${GREEN};color:${INK};transform:translateY(3px)}}
@keyframes rtCard1{0%,32%,100%{border-color:${GREEN_DEEP};background:${INK}}2%,30%{border-color:${GREEN};background:#062212}}
@keyframes rtCard2{0%,34%,66%,100%{border-color:${GREEN_DEEP};background:${INK}}36%,64%{border-color:${GREEN};background:#062212}}
@keyframes rtCard3{0%,68%,100%{border-color:${GREEN_DEEP};background:${INK}}70%,98%{border-color:${GREEN};background:#062212}}
@keyframes rtDot{0%{background:${GREEN_DEEP}}1%,24%{background:${GREEN}}25%,100%{background:${GREEN_DEEP}}}
@keyframes rtBlink{0%,100%{opacity:1}50%{opacity:.35}}
`;

/** Inserta la hoja de estilos del tutorial una sola vez por documento. */
export function ensureTerminalTutorialStyles(doc: Document = document): void {
  if (doc.getElementById(TERMINAL_TUTORIAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = TERMINAL_TUTORIAL_STYLE_ID;
  style.textContent = TERMINAL_TUTORIAL_CSS;
  doc.head.appendChild(style);
}

export function buildTutorialTerminalHtml(model: TutorialModel): string {
  const weaponCards = model.weapons
    .map(
      (w) =>
        `<div class="rt-weapon"><div class="rt-key">${w.slot}</div><b>${escapeHtml(w.name.toUpperCase())}</b><span>${escapeHtml(w.note)}</span></div>`
    )
    .join('');
  const brief = model.briefing.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  return `<div class="rt-root"><div class="rt-card">
  <div class="rt-bar"><div class="rt-bar-dots"><i></i><i></i><i></i></div><div class="rt-bar-title">ENTRENAMIENTO</div><div class="rt-bar-level">${escapeHtml(model.levelName.toUpperCase())}</div></div>
  <div class="rt-stage">
    <div class="rt-scene" style="--i:0"><h3>MUÉVETE</h3><p>W A S D para caminar · el mouse apunta</p>
      <div class="rt-row">
        <div class="rt-pad"><div class="rt-key w">W</div><div class="rt-key a">A</div><div class="rt-key s">S</div><div class="rt-key d">D</div></div>
        <div class="rt-field"><div class="rt-dot"></div></div>
      </div></div>
    <div class="rt-scene" style="--i:1"><h3>DISPARA Y RECARGA</h3><p>Clic para disparar · R para recargar (${model.pistolAmmo} tiros)</p>
      <div class="rt-row">
        <div class="rt-mouse"><i></i></div>
        <div class="rt-ammo"><div class="rt-ammo-label">MUNICIÓN</div><div class="rt-ammo-bar"><i></i></div><div class="rt-key rt-rkey">R</div></div>
      </div></div>
    <div class="rt-scene" style="--i:2"><h3>CAMBIA DE ARMA</h3><p>Teclas 1, 2 y 3</p>
      <div class="rt-cards">${weaponCards}</div></div>
    <div class="rt-scene" style="--i:3"><h3>TU MISIÓN</h3><p>Lo que pide este nivel</p>
      <ul class="rt-brief">${brief}</ul></div>
  </div>
  <div class="rt-foot"><div class="rt-dots"><i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i><i style="--i:3"></i></div>
    <div class="rt-go"><b>ENTER</b>COMENZAR</div><div class="rt-esc">ESC · MENÚ</div></div>
</div></div>`;
}
