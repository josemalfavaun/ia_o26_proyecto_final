import type Phaser from 'phaser';
import { GLASS_HEIGHT, GLASS_WIDTH } from './liquidGlass';

export interface GlassPlacement {
  left: number;
  top: number;
  scale: number;
}

/** Calcula dónde poner el overlay para que cubra exactamente el canvas, que Phaser escala con FIT. */
export function computeGlassPlacement(
  canvasRect: { left: number; top: number; width: number },
  parentRect: { left: number; top: number }
): GlassPlacement {
  return {
    left: canvasRect.left - parentRect.left,
    top: canvasRect.top - parentRect.top,
    scale: canvasRect.width > 0 ? canvasRect.width / GLASS_WIDTH : 1
  };
}

/**
 * Overlay HTML (pantallas en terminal) encima del canvas de Phaser.
 *
 * No usa el contenedor DOM de Phaser porque `#app` centra con flex y el contenedor termina desplazado; en su lugar
 * se monta dentro de `#app`, se coloca con la posición real del canvas y se escala con transform (el diseño es de
 * 960 x 540). No intercepta el ratón: los clics llegan al canvas. Se destruye solo al cerrarse la escena.
 */
export class GlassOverlay {
  private readonly element: HTMLElement;
  private readonly parent: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private destroyed = false;
  private timer: number | null = null;

  /** `ensureStyles` mete la hoja de estilos de la pantalla (tutorial o fin de partida) una sola vez. */
  constructor(
    private readonly scene: Phaser.Scene,
    html: string,
    ensureStyles: () => void
  ) {
    ensureStyles();
    this.canvas = scene.game.canvas;
    this.parent = this.canvas.parentElement ?? document.body;
    this.element = document.createElement('div');
    this.element.innerHTML = html;
    Object.assign(this.element.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: `${GLASS_WIDTH}px`,
      height: `${GLASS_HEIGHT}px`,
      transformOrigin: '0 0',
      pointerEvents: 'none',
      zIndex: '5'
    });
    this.parent.appendChild(this.element);
    this.place();
    scene.scale.on('resize', this.place, this);
    window.addEventListener('resize', this.place);
    // El canvas termina de acomodarse un instante después de arrancar la escena.
    this.timer = window.setTimeout(this.place, 120);
    scene.events.once('shutdown', this.destroy, this);
    scene.events.once('destroy', this.destroy, this);
  }

  private readonly place = (): void => {
    if (this.destroyed) return;
    const placement = computeGlassPlacement(this.canvas.getBoundingClientRect(), this.parent.getBoundingClientRect());
    this.element.style.left = `${placement.left}px`;
    this.element.style.top = `${placement.top}px`;
    this.element.style.transform = `scale(${placement.scale})`;
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    window.removeEventListener('resize', this.place);
    this.scene.scale?.off('resize', this.place, this);
    this.element.remove();
  }
}
