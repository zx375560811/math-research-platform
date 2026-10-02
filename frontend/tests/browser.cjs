'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const frontend = path.resolve(__dirname, '..');
const repo = path.resolve(frontend, '..');
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
const subjects = [{ id: 1, slug: 'algebra', name: '代数' }, { id: 2, slug: 'number-theory', name: '数论' }, { id: 3, slug: 'analysis', name: '分析' }, { id: 4, slug: 'geometry-topology', name: '几何与拓扑' }, { id: 5, slug: 'other', name: '其他数学方向' }];
async function main() {
  let browser, server, child, temp; let logs = '';
  try {
    let port;
    const documents = Array.from({ length: 21 }, (_, index) => ({ id: index + 1, title: index === 20 ? '定理 "A" <img src=x onerror=alert(1)>' : `研究资料 ${index + 1}`, authors: '平台维护的参考资料', subject_ids: [1], file_size: pdf.length }));
    if (process.env.MATH_BROWSER_MOCK === '1') {
      const users = new Map(); const sessions = new Map();
      server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const json = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        const sessionId = (req.headers.cookie || '').match(/TESTSESSION=([^;]+)/)?.[1]; let session = sessions.get(sessionId);
        if (url.pathname === '/api/auth/csrf') {
          if (!session) { const id = String(sessions.size + 1); session = { token: 'token' + id }; sessions.set(id, session); res.setHeader('Set-Cookie', `TESTSESSION=${id}; Path=/; HttpOnly; SameSite=Lax`); }
          return json({ header: 'X-CSRF-TOKEN', token: session.token });
        }
        if (url.pathname === '/api/auth/me') return json(session?.user ? { authenticated: true, user: session.user } : { authenticated: false });
        if (req.method === 'POST' && ['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(url.pathname)) {
          if (!session || req.headers['x-csrf-token'] !== session.token) return json({ error: 'invalid_csrf' }, 403);
          const parts = []; for await (const part of req) parts.push(part); const body = JSON.parse(Buffer.concat(parts));
          const name = (body.username || '').toLowerCase();
          if (url.pathname.endsWith('/register')) { if (users.has(name)) return json({ error: 'username_taken' }, 409); users.set(name, body.password); return json({ user: { username: name, role: 'USER' } }, 201); }
          if (url.pathname.endsWith('/logout')) { delete session.user; return json({ status: 'ok' }); }
          if (users.get(name) !== body.password) return json({ error: 'invalid_credentials' }, 401);
          session.user = { username: name, role: 'USER' }; return json({ user: session.user });
        }
        if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
        if (url.pathname.startsWith('/api/documents') && !session?.user) return json({ error: 'login_required' }, 401);
        if (url.pathname === '/api/health') return json({ status: 'ok' });
        if (url.pathname === '/api/subjects') return json({ subjects });
        if (url.pathname === '/api/documents') {
          const id = Number(url.searchParams.get('subject_id')); const offset = Number(url.searchParams.get('offset') || 0);
          return json({ documents: documents.filter(d => !id || d.subject_ids.includes(id)).slice().reverse().slice(offset, offset + 20), limit: 20, offset });
        }
        if (/^\/api\/documents\/\d+\/file$/.test(url.pathname)) { res.writeHead(200, { 'Content-Type': 'application/pdf' }); return res.end(pdf); }
        const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
        for (const name of ['icons.js', 'vendor/morphicons/dom.js', 'vendor/morphicons/spring-CFHloqPP.js', 'vendor/morphicons/normalize-CYnN3Npw.js']) assets['/' + name] = [name, 'text/javascript'];
        const asset = assets[url.pathname]; if (!asset) return json({ error: 'not_found' }, 404);
        res.writeHead(200, { 'Content-Type': asset[1], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'" }); res.end(fs.readFileSync(path.join(frontend, asset[0])));
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
    } else {
      const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); port = probe.address().port; await new Promise(resolve => probe.close(resolve));
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'math-ui-'));
      child = spawn('java', ['-jar', path.join(repo, 'backend/target/math-server.jar')], { cwd: temp, env: { ...process.env, MATH_PORT: String(port), MATH_WEB_DIR: frontend } });
      child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk); child.on('error', error => logs += error.message);
    }
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; ; i++) {
      try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
      if (i >= 300) throw new Error(`Server did not start: ${logs}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (temp) {
      fs.writeFileSync(path.join(temp, 'source.pdf'), pdf);
      for (const doc of documents) {
        const result = spawnSync('python3', [path.join(repo, 'backend/admin/import_document.py'), 'source.pdf', '--title', doc.title, '--authors', doc.authors, '--subject-id', '1'], { cwd: temp, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      }
    }
    assert.equal((await fetch(base + '/api/documents', { method: 'POST', body: pdf })).status, 405);
    const options = { headless: true }; if (process.env.MATH_BROWSER_EXECUTABLE) options.executablePath = process.env.MATH_BROWSER_EXECUTABLE;
    browser = await chromium.launch(options);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.locator('#subject-cards a').first().waitFor({ state: 'attached' });
    assert.equal(await page.locator('input[type=file], #upload-form, #recent-documents').count(), 0);
    assert.equal(await page.locator('.application-card').count(), 1);
    assert.equal(await page.locator('#home-link').getAttribute('aria-current'), 'page');
    const shots = path.join(frontend, 'tests/artifacts'); fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'home-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'home-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.locator('.application-card').click();
    await page.locator('#auth-view').waitFor();
    await page.locator('#register-tab').click();
    await page.locator('#account-username').fill('browser_reader'); await page.locator('#account-password').fill('BrowserPass123!'); await page.locator('#account-confirm').fill('DifferentPass123!');
    await page.locator('#account-submit').click(); await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('不一致'));
    await page.locator('#account-confirm').fill('BrowserPass123!'); await page.locator('#account-submit').click();
    await page.waitForFunction(() => location.hash === '#/login');
    await page.screenshot({ path: path.join(shots, 'login-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('#account-password').fill('WrongPassword123!'); await page.locator('#account-submit').click();
    await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('不正确'));
    await page.locator('#account-password').fill('BrowserPass123!'); await page.locator('#account-submit').click();
    await page.locator('#module-documents h3').first().waitFor();
    assert.equal(await page.locator('#module-title').textContent(), '数学与应用数学');
    assert.equal(await page.locator('#math-app-link').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#module-documents h3').first().textContent(), documents[20].title);
    assert.equal(await page.locator('#module-documents img').count(), 0);
    const downloadPromise = page.waitForEvent('download'); await page.locator('.download-link').first().click();
    assert.deepEqual(fs.readFileSync(await (await downloadPromise).path()), pdf);
    await page.locator('#next-page').click(); await page.waitForFunction(() => document.getElementById('page-label').textContent === '第 2 页');
    assert.equal(await page.locator('.document-row').count(), 1);
    await page.locator('#previous-page').click(); await page.waitForFunction(() => document.getElementById('page-label').textContent === '第 1 页');
    await page.locator('[data-subject-id="1"]').click();
    await page.waitForFunction(() => document.getElementById('topic-title').textContent === '代数');
    await page.locator('#module-documents h3').first().waitFor();
    assert.equal(await page.locator('#topic-title').textContent(), '代数');
    await page.screenshot({ path: path.join(shots, 'module-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'module-mobile.png'), fullPage: true });
    for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    await page.locator('[data-subject-id="2"]').click(); await page.locator('.empty-state').waitFor();
    assert.doesNotMatch(await page.locator('.empty-state').textContent(), /上传|添加文献/);
    await page.route('**/api/documents?*', route => route.fulfill({ status: 500, body: '{}' }));
    await page.locator('#refresh-documents').click(); await page.waitForFunction(() => document.getElementById('list-status').textContent.includes('失败'));
    await page.unroute('**/api/documents?*'); await page.locator('#refresh-documents').click(); await page.locator('.empty-state').waitFor();
    await page.reload(); await page.waitForFunction(() => document.getElementById('account-name').textContent === 'browser_reader');
    await page.locator('#logout-button').click(); await page.waitForFunction(() => location.hash === '#/');
    assert.equal(await page.locator('#auth-link').isVisible(), true);
    assert.equal((await page.request.get(base + '/api/documents')).status(), 401);
    assert.equal((await page.request.get(base + '/api/documents/1/file')).status(), 401);
    await page.locator('.application-card').click(); await page.locator('#auth-view').waitFor();
    assert.deepEqual(errors, []); console.log('Application entry, read-only reading, source retrieval, filtering, pagination and mobile checks passed.');
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    if (child && child.exitCode === null && child.signalCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stopped; }
    if (temp) { const resolved = path.resolve(temp); if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('math-ui-')) throw new Error('Unexpected test directory'); fs.rmSync(resolved, { recursive: true, force: true }); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
