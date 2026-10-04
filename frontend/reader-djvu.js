// Native DjVu adapter: original bytes decoded in a same-origin Web Worker.
const libraryUrl = '/vendor/djvu/djvu.js';
let library;
function loadLibrary() {
  if (!library) library = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = libraryUrl;
    script.onload = () => resolve(window.DjVu); script.onerror = () => { library = null; script.remove(); reject(new Error('DJVU 解码器加载失败，请刷新重试。')); };
    document.head.append(script);
  });
  return library;
}
function cancelled() { const error = new Error('Rendering cancelled'); error.name = 'RenderingCancelledException'; return error; }
export function getDjvuDocument(url) {
  const controller = new AbortController(); let worker, fatal;
  const guarded = operation => new Promise((resolve, reject) => {
    const abort = () => reject(fatal || cancelled());
    if (controller.signal.aborted) { operation.catch(() => {}); abort(); return; }
    controller.signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
  });
  const promise = (async () => {
    const DjVu = await loadLibrary(); if (controller.signal.aborted) throw cancelled();
    const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) throw new Error('DJVU 文件无法读取，请检查登录状态。');
    const bytes = await response.arrayBuffer(); if (controller.signal.aborted) throw cancelled();
    worker = new DjVu.Worker(libraryUrl);
    worker.worker.addEventListener('error', () => { fatal = new Error('DJVU 解码器运行失败，请刷新重试。'); controller.abort(); });
    const run = worker.run.bind(worker); worker.run = (...tasks) => guarded(run(...tasks));
    await guarded(worker.createDocument(bytes));
    if (!await worker.doc.isBundled().run()) throw new Error('此 DJVU 是多文件索引，请先将整组文件合并为单个 DJVU 后导入。');
    const sizes = await worker.doc.getPagesSizes().run();
    if (!sizes.length || sizes.length > 100000 || sizes.some(s => !Number.isFinite(s.width) || !Number.isFinite(s.height) || s.width <= 0 || s.height <= 0)) throw new Error('DJVU 页数或页面尺寸无效。');
    const doc = {
      numPages: sizes.length, pageSizes: sizes.map(s => [s.width, s.height]),
      async getOutline() {
        const convert = list => (list || []).map(b => ({ title: b.description, dest: b.url, items: convert(b.children) }));
        return convert(await worker.doc.getContents().run());
      },
      async getDestination(url) { const page = await worker.doc.getPageNumberByUrl(url).run(); return page >= 1 && page <= sizes.length ? [page - 1] : null; },
      async getPage(number) {
        const [width, height, rotation] = await worker.run(worker.doc.getPage(number).getWidth(), worker.doc.getPage(number).getHeight(), worker.doc.getPage(number).getRotation());
        const turned = rotation === 90 || rotation === 270; let zones = [];
        const page = {
          getViewport({ scale }) { return { width: (turned ? height : width) * scale, height: (turned ? width : height) * scale, scale }; },
          render({ canvasContext: ctx, viewport, transform }) {
            let stopped = false;
            const promise = (async () => {
              const [textZones, image] = await worker.run(worker.doc.getPage(number).getNormalizedTextZones(), worker.doc.getPage(number).getImageData(false));
              if (stopped || controller.signal.aborted) throw cancelled();
              zones = textZones || [];
              const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height;
              try {
                surface.getContext('2d').putImageData(image, 0, 0);
                ctx.save(); ctx.setTransform(viewport.scale * transform[0], 0, 0, viewport.scale * transform[3], 0, 0);
                if (rotation === 90) { ctx.translate(height, 0); ctx.rotate(Math.PI / 2); }
                else if (rotation === 180) { ctx.translate(width, height); ctx.rotate(Math.PI); }
                else if (rotation === 270) { ctx.translate(0, width); ctx.rotate(-Math.PI / 2); }
                ctx.drawImage(surface, 0, 0); ctx.restore();
              } finally { surface.width = surface.height = 0; }
            })();
            return { promise, cancel() { stopped = true; } };
          },
          async getTextContent() { return { items: zones.map(z => ({ str: z.text })), zones, width, height, rotation }; }
        };
        return page;
      },
      createTextLayer({ textContentSource: source, container, viewport }) {
        return new DjvuTextLayer(source, container, viewport);
      }
    };
    return doc;
  })().catch(error => { worker?.terminate(); throw error; });
  return { promise, async destroy() { controller.abort(); worker?.terminate(); } };
}

class DjvuTextLayer {
  constructor(source, container, viewport) { Object.assign(this, { source, container, viewport }); this.stopped = false; }
  cancel() { this.stopped = true; }
  async render() {
    const { width, height, rotation, zones } = this.source, scale = this.viewport.scale;
    this.container.classList.add('djvu-text-layer');
    for (const zone of zones) {
      if (this.stopped) return;
      if (![zone.x, zone.y, zone.width, zone.height].every(Number.isFinite) || zone.width <= 0 || zone.height <= 0 || !zone.text) continue;
      // DjVu zones use a bottom-left origin. Rotate their top-left coordinates with the image.
      let x = zone.x, y = height - zone.y - zone.height;
      if (rotation === 90) [x, y] = [height - y, x];
      else if (rotation === 180) [x, y] = [width - x, height - y];
      else if (rotation === 270) [x, y] = [y, width - x];
      const span = document.createElement('span'); span.textContent = zone.text;
      Object.assign(span.style, { left: x * scale + 'px', top: y * scale + 'px', width: 'max-content', height: zone.height * scale + 'px', fontSize: zone.height * scale + 'px', transformOrigin: '0 0' });
      this.container.append(span);
      const measured = document.createElement('canvas').getContext('2d'); measured.font = `${zone.height * scale}px sans-serif`;
      const fit = zone.width * scale / Math.max(1, measured.measureText(zone.text).width);
      span.style.transform = `rotate(${rotation}deg) scaleX(${fit})`;
    }
  }
}
