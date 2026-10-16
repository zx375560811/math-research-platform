'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { fixturePdf } = require('./fixture.cjs');

// Reproduce the reported missing method in both the display and worker realms.
const removeComputed = 'delete Map.prototype.getOrInsertComputed; delete WeakMap.prototype.getOrInsertComputed;\n';
async function main() {
  const root = path.resolve(__dirname, '..'), document = fixturePdf(3, 1024 * 1024);
  const ranges = []; let browser, workerRequests = 0;
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    if (name === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; object-src 'none'" });
      return response.end('<!doctype html><title>PDF cache regression</title><link rel="stylesheet" href="/vendor/pdfjs/text_layer.css">');
    }
    if (name === '/book.pdf') {
      const match = request.headers.range && /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      const start = match ? Number(match[1]) : 0, end = match && match[2] ? Math.min(Number(match[2]), document.length - 1) : document.length - 1;
      const headers = { 'Content-Type': 'application/pdf', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 };
      if (match) { ranges.push([start, end]); headers['Content-Range'] = `bytes ${start}-${end}/${document.length}`; }
      response.writeHead(match ? 206 : 200, headers); return response.end(document.subarray(start, end + 1));
    }
    if (/^\/vendor\/pdfjs\/(pdf(?:\.worker)?\.mjs|text_layer\.css|cmaps\/[A-Za-z0-9_-]+\.bcmap|standard_fonts\/[A-Za-z0-9_-]+\.(pfb|ttf))$/.test(name)) {
      response.writeHead(200, { 'Content-Type': name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
      if (name.endsWith('pdf.worker.mjs')) { workerRequests++; response.write(removeComputed); }
      return response.end(fs.readFileSync(path.join(root, name.slice(1))));
    }
    response.writeHead(404); response.end();
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.MATH_BROWSER_EXECUTABLE ? { executablePath: process.env.MATH_BROWSER_EXECUTABLE } : {}) });
    const page = await browser.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(removeComputed);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async () => {
      const { getDocument, GlobalWorkerOptions, TextLayer } = await import('/vendor/pdfjs/pdf.mjs');
      GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
      const task = getDocument({ url: '/book.pdf', disableStream: true, disableAutoFetch: true, isEvalSupported: false, useWasm: false, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/' });
      let timer;
      try {
        return await Promise.race([(async () => {
          const pdf = await task.promise, texts = [];
          for (const number of [1, 2, 3, 1]) {
            const p = await pdf.getPage(number), viewport = p.getViewport({ scale: 1 });
            const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
            await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const text = await p.getTextContent(), container = document.createElement('div'); document.body.append(container);
            await new TextLayer({ textContentSource: text, container, viewport }).render(); texts.push(container.textContent);
            const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            if (!pixels.some((value, index) => index % 4 === 0 && pixels[index + 3] > 0 && value < 128)) throw new Error('Rendered PDF has no visible ink');
          }
          const outlines = await pdf.getOutline(), metadata = pdf.getMetadata(), again = pdf.getMetadata();
          await Promise.all([metadata, again]);
          return { pages: pdf.numPages, texts, outline: outlines.map(item => item.title), cachedMetadata: metadata === again, realWorker: task._worker.port instanceof Worker, mapMethod: typeof Map.prototype.getOrInsertComputed, weakMapMethod: typeof WeakMap.prototype.getOrInsertComputed };
        })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PDF cache regression timed out')), 25000); })]);
      } finally { clearTimeout(timer); await task.destroy(); }
    });
    assert.equal(result.pages, 3); assert.equal(result.realWorker, true); assert.ok(workerRequests > 0);
    assert.deepEqual(result.texts.map(text => text.match(/Mathematics (\d)/)?.[1]), ['1', '2', '3', '1']);
    assert.deepEqual(result.outline, ['Chapter One', 'Chapter Two']); assert.equal(result.cachedMetadata, true);
    assert.equal(result.mapMethod, 'undefined'); assert.equal(result.weakMapMethod, 'undefined');
    assert.ok(ranges.some(([start, end]) => start > 0 && end > start && end - start + 1 < document.length), 'PDF.js must still read partial HTTP ranges');
    assert.deepEqual(errors, []);
    // A cache must retain falsy values and reuse the same promise or object.
    for (const name of ['pdf.mjs', 'pdf.worker.mjs']) {
      const source = fs.readFileSync(path.join(root, 'vendor/pdfjs', name), 'utf8');
      assert.doesNotMatch(source, /\.getOrInsertComputed\(/);
      const helper = source.match(/function getCachedValue\(map, key, create\) \{[\s\S]*?\n\}/);
      assert.ok(helper, `Cache helper missing in ${name}`); const getCachedValue = vm.runInNewContext('(' + helper[0] + ')');
      for (const Cache of [Map, WeakMap]) for (const expected of [undefined, null, false, 0, {}, Promise.resolve(7)]) {
        const cache = new Cache(), key = {}; let calls = 0;
        const create = received => { assert.equal(received, key); calls++; return expected; };
        assert.equal(getCachedValue(cache, key, create), expected); assert.equal(getCachedValue(cache, key, create), expected); assert.equal(calls, 1);
      }
    }
    console.log('PDF pages, text, outlines, cached metadata and HTTP Range pass without Map/WeakMap.getOrInsertComputed in either realm.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
