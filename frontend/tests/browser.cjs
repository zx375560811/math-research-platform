'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const frontend = path.resolve(__dirname, '..');
const repo = path.resolve(frontend, '..');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const subjects = [{ id: 1, slug: 'algebra', name: '代数' }, { id: 2, slug: 'number-theory', name: '数论' }, { id: 3, slug: 'analysis', name: '分析' }, { id: 4, slug: 'geometry-topology', name: '几何与拓扑' }, { id: 5, slug: 'other', name: '其他数学方向' }];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  let browser, server, child, temp;
  let logs = '';
  try {
    let port;
    if (process.env.MATH_BROWSER_MOCK === '1') {
      const documents = [];
      server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const json = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (url.pathname === '/api/health') return json({ status: 'ok' });
        if (url.pathname === '/api/subjects') return json({ subjects });
        if (url.pathname === '/api/documents' && req.method === 'POST') {
          const parts = []; for await (const part of req) parts.push(part);
          const data = Buffer.concat(parts); const subject = Number(url.searchParams.get('subject_id'));
          assert.equal(req.headers['content-type'], 'application/pdf');
          assert.equal(data.subarray(0, 5).toString(), '%PDF-');
          const id = documents.length + 1;
          documents.push({ id, title: url.searchParams.get('title'), authors: url.searchParams.get('authors'), file_size: data.length, subject_ids: [subject], created_at: new Date().toISOString(), file_url: `/api/documents/${id}/file` });
          return json({ id, file_url: `/api/documents/${id}/file` }, 201);
        }
        if (url.pathname === '/api/documents') {
          const id = Number(url.searchParams.get('subject_id')); const offset = Number(url.searchParams.get('offset') || 0);
          return json({ documents: documents.filter(d => !id || d.subject_ids.includes(id)).slice().reverse().slice(offset, offset + 20), limit: 20, offset });
        }
        if (/^\/api\/documents\/\d+\/file$/.test(url.pathname)) {
          res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="document.pdf"' }); return res.end(pdf);
        }
        const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
        const asset = assets[url.pathname];
        if (!asset) return json({ error: 'not_found' }, 404);
        res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'" });
        res.end(fs.readFileSync(path.join(frontend, asset[0])));
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
    } else {
      const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
      port = probe.address().port; await new Promise(resolve => probe.close(resolve));
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'math-ui-'));
      child = spawn(path.join(repo, 'backend/build/math-server'), [], { cwd: temp, env: { ...process.env, MATH_PORT: String(port), MATH_WEB_DIR: frontend } });
      child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk);
      child.on('error', error => logs += error.message);
    }
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; ; i++) {
      try { const response = await fetch(`${base}/api/health`); if (response.ok) break; } catch {}
      if (i >= 100) throw new Error(`Server did not start: ${logs}`);
      await delay(50);
    }
    async function seed(title, subject = 1) {
      const query = new URLSearchParams({ title, authors: '测试作者', subject_id: String(subject) });
      const response = await fetch(`${base}/api/documents?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: pdf });
      assert.equal(response.status, 201); return response.json();
    }
    await seed('已有研究文献');
    const options = { headless: true };
    if (process.env.MATH_BROWSER_EXECUTABLE) options.executablePath = process.env.MATH_BROWSER_EXECUTABLE;
    browser = await chromium.launch(options);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('.subject-card').first().waitFor();
    assert.equal(await page.locator('.subject-card').count(), 5);
    assert.match(await page.locator('#recent-documents').textContent(), /已有研究文献/);
    const shots = path.join(frontend, 'tests/artifacts'); fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'home-desktop.png'), fullPage: true });
    await page.locator('.subject-card').filter({ hasText: '代数' }).click();
    await page.locator('#module-documents h3').first().waitFor();
    assert.equal(await page.locator('#module-title').textContent(), '代数');
    await page.locator('#pdf-file').setInputFiles({ name: '新论文.pdf', mimeType: 'application/pdf', buffer: pdf });
    assert.equal(await page.locator('#document-title').inputValue(), '新论文');
    const title = '定理 "A" <img src=x onerror=alert(1)>';
    await page.locator('#document-title').fill(title); await page.locator('#document-authors').fill('作者甲，作者乙');
    await page.locator('#upload-submit').click();
    await page.waitForFunction(() => document.getElementById('notice').textContent.includes('文献已保存'));
    await page.waitForFunction(() => !document.getElementById('upload-submit').disabled);
    assert.equal(await page.locator('#module-documents h3').first().textContent(), title);
    assert.equal(await page.locator('#module-documents img').count(), 0);
    const downloadPromise = page.waitForEvent('download'); await page.locator('#module-documents .download-link').first().click();
    const download = await downloadPromise; assert.deepEqual(fs.readFileSync(await download.path()), pdf);
    await page.locator('#pdf-file').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('wrong') });
    await page.locator('#document-title').fill('无效 PDF'); await page.locator('#upload-submit').click();
    await page.waitForFunction(() => document.getElementById('upload-message').textContent.includes('不是有效'));
    assert.equal(await page.locator('#upload-submit').isEnabled(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(shots, 'module-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: path.join(shots, 'module-desktop.png'), fullPage: true });
    for (let i = 0; i < 19; i++) await seed(`分页文献 ${i}`);
    await page.locator('#refresh-documents').click();
    await page.waitForFunction(() => !document.getElementById('next-page').disabled);
    await page.locator('#next-page').click(); await page.waitForFunction(() => document.getElementById('page-label').textContent === '第 2 页');
    assert.equal(await page.locator('#module-documents .document-row').count(), 1);
    await page.locator('#previous-page').click(); await page.waitForFunction(() => document.getElementById('page-label').textContent === '第 1 页');
    await page.locator('.back-link').click(); await page.locator('.subject-card').filter({ hasText: '数论' }).click();
    await page.locator('#module-documents .empty-state').waitFor();
    assert.equal(await page.locator('#document-subject').inputValue(), '2');
    await page.route('**/api/documents?subject_id=2*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"database_error"}' }));
    await page.locator('#refresh-documents').click(); await page.waitForFunction(() => document.getElementById('list-status').textContent.includes('失败'));
    await page.unroute('**/api/documents?subject_id=2*'); await page.locator('#refresh-documents').click(); await page.locator('#module-documents .empty-state').waitFor();
    assert.deepEqual(errors, []);
    console.log(process.env.MATH_BROWSER_MOCK === '1' ? 'Browser UI checks passed using mock API.' : 'Browser UI checks passed with real C backend.');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stopped;
    }
    if (temp) {
      const resolved = path.resolve(temp);
      if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('math-ui-')) throw new Error('Unexpected temporary test directory');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
