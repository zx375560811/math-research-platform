import { createMorph } from './vendor/morphicons/dom.js';

// Original 24×24 stroke artwork; Morphicons supplies the transition engine.
export const paths = {
  fit: 'M3 5V19M21 5V19M6 12H18M9 9L6 12L9 15M15 9L18 12L15 15',
  expand: 'M3 9V3H9M15 3H21V9M21 15V21H15M9 21H3V15',
  settings: 'M4 6H20M4 12H20M4 18H20M8 3V9M16 9V15M10 15V21',
  send: 'M3 4L21 12L3 20L6 12ZM6 12H21',
  chat: 'M4 4H20V17H10L4 21ZM8 8H16M8 12H14',
  workspace: 'M3 3H10V10H3ZM14 3H21V10H14ZM3 14H10V21H3ZM14 14H21V21H14Z',
  algebra: 'M12 3L20 7.5V16.5L12 21L4 16.5V7.5ZM4 7.5L12 12L20 7.5M12 12V21',
  number: 'M9 3L6 21M17 3L14 21M4 8H21M3 16H20',
  analysis: 'M3 20H21M4 20V4M6 16C9 16 9 7 12 7S16 16 20 5',
  geometry: 'M3 16C3 4 21 4 21 16C21 21 3 21 3 16ZM3 16C7 11 17 11 21 16M12 7C7 11 7 17 12 20C17 17 17 11 12 7',
  infinity: 'M12 12C9 7 3 6 3 12C3 18 9 17 12 12C15 7 21 6 21 12C21 18 15 17 12 12',
  forward: 'M9 5L16 12L9 19',
  back: 'M15 5L8 12L15 19',
  upload: 'M12 16V3M7 8L12 3L17 8M4 15V21H20V15',
  download: 'M12 3V16M7 11L12 16L17 11M4 17V21H20V17',
  file: 'M5 3H14L19 8V21H5ZM14 3V8H19M8 12H16M8 16H14',
  check: 'M4 12L9 17L20 6',
  alert: 'M12 3L22 21H2ZM12 9V14M12 17V17.2',
  save: 'M4 3H17L21 7V21H3V3ZM7 3V9H16V3M7 21V14H17V21',
  refresh: 'M20 7A9 9 0 0 0 4 6M4 2V7H9M4 17A9 9 0 0 0 20 18M20 22V17H15',
  book: 'M12 5C9 3 5 3 2 4V20C5 19 9 19 12 21C15 19 19 19 22 20V4C19 3 15 3 12 5ZM12 5V21',
  compass: 'M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2ZM16 8L14 14L8 16L10 10Z',
  spark: 'M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z',
};
const namespace = 'http://www.w3.org/2000/svg';
const controllers = new WeakMap();
export function icon(name) {
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', paths[name] || paths.file);
  svg.append(path);
  return svg;
}
export function mountIcons() {
  for (const host of document.querySelectorAll('[data-icon]')) {
    if (host.querySelector('svg')) continue;
    const initial = host.dataset.icon; host.append(icon(initial));
    const target = host.closest('a,button');
    const active = { workspace:'book', compass:'algebra', forward:'check', book:'file', fit:'expand', expand:'fit', settings:'refresh', refresh:'check', send:'check', spark:'chat' }[initial];
    if (!target || !active) continue;
    let hovered = false;
    const update = () => changeIcon(host, hovered || target.matches(':focus-visible') ? active : initial);
    target.addEventListener('mouseenter', () => { hovered = true; update(); });
    target.addEventListener('mouseleave', () => { hovered = false; update(); });
    target.addEventListener('focus', update); target.addEventListener('blur', update);
  }
}
export function changeIcon(host, name) {
  let controller = controllers.get(host);
  if (!controller) {
    controller = createMorph(host.querySelector('path'), paths[host.dataset.icon], { reducedMotion: 'user' });
    controllers.set(host, controller);
  }
  host.dataset.icon = name;
  controller.morphTo(paths[name], 'snappy');
}
