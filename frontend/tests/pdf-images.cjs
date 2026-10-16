'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { fixtureScannedPdf } = require('./fixture-scanned.cjs');

async function main() {
  const root = path.resolve(__dirname, '..'), external = process.env.MATH_TEST_SCAN_PDF;
  const content = external ? fs.readFileSync(external) : fixtureScannedPdf(), ranges = [];
  const boundary = fs.readFileSync(path.join(root, '../backend/src/main/java/org/mathplatform/PublicBoundary.java'), 'utf8');
  const policy = boundary.match(/setHeader\("Content-Security-Policy", "([^"]+)"\)/)[1];
  assert.ok(policy.includes("'wasm-unsafe-eval'")); assert.ok(!policy.includes("'unsafe-eval'"));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('Content-Security-Policy', policy);
    const json = body => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); };
    if (name === '/api/auth/csrf') return json({ header: 'X-CSRF-TOKEN', token: 'fixture' });
    if (name === '/api/ai/settings') return json({ source: 'default', enabled: false, default: { available: false }, custom: { available: false, has_key: false } });
    if (name === '/api/library/documents/1') return json({ id: 1, title: 'JPEG cover / JPEG 2000 scans', available: true, format: 'pdf', file_url: '/book.pdf' });
    if (name === '/api/library/documents/1/annotations') return json({ annotations: [] });
    if (name === '/book.pdf') {
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
      const start = match ? Number(match[1]) : 0, end = match && match[2] ? Math.min(Number(match[2]), content.length - 1) : content.length - 1;
      const headers = { 'Content-Type': 'application/pdf', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 };
      if (match) { ranges.push([start, end]); headers['Content-Range'] = `bytes ${start}-${end}/${content.length}`; }
      response.writeHead(match ? 206 : 200, headers); return response.end(content.subarray(start, end + 1));
    }
    if (name === '/') { response.setHeader('Content-Type', 'text/html'); return response.end(html); }
    const file = path.resolve(root, name.slice(1));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end(); }
    response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : /\.(?:mjs|js)$/.test(name) ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.MATH_BROWSER_EXECUTABLE ? { executablePath: process.env.MATH_BROWSER_EXECUTABLE } : {}) });
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }), errors = [], warnings = [], decoders = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.text().includes('Warning:')) warnings.push(message.text()); });
      page.on('request', request => { if (request.url().includes('/vendor/pdfjs/wasm/')) decoders.push(path.basename(request.url())); });
      if (fallback) await page.route('**/openjpeg.wasm', route => route.fulfill({ status: 503, body: 'Wasm unavailable in this regression' }));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(async () => {
        document.querySelectorAll('main > section').forEach(section => { section.hidden = true; });
        document.body.classList.remove('auth-page'); document.body.classList.add('reading-page'); document.getElementById('reader-view').hidden = false;
        const { openReader } = await import('/reader.js');
        window.testReader = openReader(1, { api: async (url, options) => { const response = await fetch(url, options); if (!response.ok) throw new Error('Fixture API failed'); return response.json(); }, write: async () => {}, basePath: '/api/library/documents', trackProgress: false });
        await window.testReader.ready;
      });
      const count = Number(await page.locator('#reader-scroll').getAttribute('data-total-pages'));
      if (!external) assert.equal(count, 6);
      const checks = external ? [1, 2, 3, 100, Math.ceil(count / 2), count, 2].filter(number => number <= count) : [1, 2, 3, 6, 1];
      for (const number of checks) {
        await page.locator('#reader-scroll').evaluate((scroll, number) => { const frame = document.querySelector(`.pdf-page[data-page="${number}"]`); scroll.scrollTop = document.getElementById('pdf-pages').offsetTop + frame.offsetTop; scroll.dispatchEvent(new Event('scroll')); }, number);
        await page.waitForFunction(number => document.querySelector(`.pdf-page[data-page="${number}"][data-loaded]`), number);
        const pixels = await page.locator(`.pdf-page[data-page="${number}"] canvas`).evaluate(canvas => { const ctx = canvas.getContext('2d'), data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let ink = 0; for (let i = 0; i < data.length; i += 4) if (data[i] < 180 && data[i + 3] > 0) ink++; return { ink, center: [...ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data], corner: [...ctx.getImageData(1, 1, 1, 1).data] }; });
        assert.ok(pixels.ink > 100, `Page ${number} must display its scanned image (fallback=${fallback})`);
        if (!external) { assert.ok(pixels.center[0] < 20 && pixels.center[3] === 255); assert.ok(pixels.corner[0] > 240, 'The fixture must retain its white margin'); }
        assert.equal(await page.locator('.reader-load-error').count(), 0);
      }
      assert.ok(decoders.includes('openjpeg.wasm'), 'The reader must request its local JPEG 2000 decoder');
      assert.equal(decoders.includes('openjpeg_nowasm_fallback.js'), fallback);
      assert.ok(!warnings.some(message => /Unable to decode image|OpenJPEG failed|Dependent image/.test(message)), warnings.join('\n'));
      assert.deepEqual(errors, []);
      fs.mkdirSync(path.join(__dirname, 'artifacts'), { recursive: true });
      await page.screenshot({ path: path.join(__dirname, `artifacts/pdf-scanned-${fallback ? 'fallback' : 'wasm'}.png`) });
      await page.evaluate(() => window.testReader.close()); await page.close();
    }
    assert.ok(ranges.some(([start, end]) => start > 0 && end > start && end - start < content.length));
    console.log('JPEG covers and JPEG 2000 scans render through the real continuous reader, HTTP Range and local Wasm/JavaScript fallback decoders.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
