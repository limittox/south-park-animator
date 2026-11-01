/**
 * The show's look: flat paper cut-outs. Parts are still drawn with ink outlines (so they read
 * on their own), and these rules strip the outline from every filled shape on a character and
 * from natural shapes (`.nat`) in a scene, while scene props keep a thin, darker edge.
 * Interior lines (mouths, creases, seams) have no fill and keep their ink. `.ol` marks
 * outline-only paths; `.keep` keeps an outline on purpose.
 */
export const FLAT_CSS =
  '.sp-char [stroke="#1d1d1d"][fill]:not([fill="none"]):not(.keep),.sp-char .ol,.sp-scene .ol,.sp-scene .nat[stroke="#1d1d1d"],.sp-scene .nat [stroke="#1d1d1d"]{stroke:none!important}' +
  // Background props in the show do have edges: thin, and a darker shade of their own colour.
  '.sp-scene [stroke="#1d1d1d"][fill]:not([fill="none"]):not(.keep):not(.nat){stroke:rgba(0,0,0,.28);stroke-width:2.5px}';

export function installFlatStyle(): void {
  const style = document.createElement('style');
  style.dataset.flat = '';
  style.textContent = FLAT_CSS;
  document.head.append(style);
}
