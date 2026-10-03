'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const { fixturePdf } = require('./fixture.cjs');
const frontend = path.resolve(__dirname, '..'), backend = path.resolve(frontend, '../backend');
const pdf = fixturePdf(2);
async function main() {
  let server, browser, child, temp, logs = '';
  try {
    const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    if (process.env.MATH_BROWSER_MOCK === '1') {
      const docs = [], invites = []; let session = null;
      const books = [{ id: 7, title: 'Linear Algebra Done Right', authors: 'Sheldon Axler', direction: 'algebra', direction_name: '代数', stage: '基础入门', prerequisites: 'Proofs', sort_order: 0, document_id: null }];
      server = http.createServer(async (req, res) => {
        const url = new URL(req.url, base), p = url.pathname;
        const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
        if (p === '/api/health') return json({ status: 'ok' });
        if (p === '/api/auth/csrf') return json({ header: 'X-CSRF-TOKEN', token: 'test-token' });
        if (p === '/api/auth/me') return json(session ? { authenticated: true, user: session } : { authenticated: false });
        const chunks = []; for await (const chunk of req) chunks.push(chunk); const bytes = Buffer.concat(chunks); const body = req.headers['content-type'] === 'application/json' ? JSON.parse(bytes.toString() || '{}') : {};
        if (p === '/api/auth/login') { session = { username: body.username, role: body.username === 'owner_one' ? 'ADMIN' : 'USER' }; return json({ user: session }); }
        if (p === '/api/auth/logout') { session = null; return json({ status: 'ok' }); }
        if (p === '/api/library/categories') return json({modules:[{slug:'mathematics',name:'数学与应用数学',directions:[{slug:'algebra',name:'代数'}]}]});
        if (/^\/api\/documents\/\d+$/.test(p)) return json(docs.find(d=>d.id===Number(p.split('/').pop())));
        if (p === '/api/subjects') return json({ subjects: [{ id: 1, name: '代数', slug: 'algebra' }] });
        if (p.startsWith('/api/admin')) {
          if (session?.role !== 'ADMIN') return json({ error: session ? 'admin_required' : 'login_required' }, session ? 403 : 401);
          if (p === '/api/admin/documents' && req.method === 'POST') { const id = docs.length + 1; docs.unshift({ id, title: url.searchParams.get('title'), authors: url.searchParams.get('authors'), subject_ids: [1], module:'mathematics', directions:url.searchParams.getAll('directions'), language:url.searchParams.get('language')||'und', file_size: bytes.length, file_url: `/api/documents/${id}/file` }); return json({ id }, 201); }
          if (p === '/api/admin/documents') return json({ documents: docs.filter(d => d.title.includes(url.searchParams.get('q') || '')), offset: 0, limit: 20 });
          if (/^\/api\/admin\/documents\/\d+$/.test(p)) { Object.assign(docs.find(d => d.id === Number(p.split('/').pop())), body); return json({ status: 'ok' }); }
          if (p === '/api/admin/books' && req.method === 'POST') {const id=Math.max(...books.map(b=>b.id))+1;books.push({...body,id,direction_name:'代数'});return json({id},201);}
          if (p === '/api/admin/books') return json({ books });
          if (p === '/api/admin/books/7') { Object.assign(books[0], body); return json({ status: 'ok' }); }
          if (p === '/api/admin/invitations' && req.method === 'POST') { const id = 'a'.repeat(64); invites.unshift({ id, created_at: new Date().toISOString(), expires_at: Math.floor(Date.now()/1000) + body.days * 86400, status: 'active' }); return json({ code: 'C'.repeat(43), id, expires_at: invites[0].expires_at }, 201); }
          if (p === '/api/admin/invitations') return json({ invitations: invites });
          if (p.endsWith('/revoke')) { invites[0].status = 'revoked'; return json({ status: 'ok' }); }
        }
        if (p === '/api/learning/books/7') return json({ ...books[0], available: !!books[0].document_id });
        if (p === '/admin' && session?.role !== 'ADMIN') return json({ error: 'admin_required' }, 403);
        const assets = { '/admin': 'admin.html', '/admin.js': 'admin.js', '/admin.css': 'admin.css', '/style.css': 'style.css' }; const name = assets[p];
        if (!name) return json({ error: 'not_found' }, 404); res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'" }); res.end(fs.readFileSync(path.join(frontend, name)));
      });
      await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    } else {
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'math-admin-ui-'));
      child = spawn('java', ['-jar', path.join(backend, 'target/math-server.jar')], { cwd: temp, env: { ...process.env, MATH_PORT: String(port), MATH_WEB_DIR: frontend } }); child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk);
    }
    for (let i = 0; ; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} if (i >= 300) throw new Error(logs); await new Promise(resolve => setTimeout(resolve, 100)); }
    const options = { headless: true }; if (process.env.MATH_BROWSER_EXECUTABLE) options.executablePath = process.env.MATH_BROWSER_EXECUTABLE;
    browser = await chromium.launch(options); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', error => errors.push(error.message));
    const apiWrite = async (endpoint, data) => { const csrf = await (await page.request.get(base + '/api/auth/csrf')).json(); return page.request.post(base + endpoint, { data, headers: { [csrf.header]: csrf.token } }); };
    if (temp) {
      const issue = spawnSync('python3', [path.join(backend, 'admin/create_invitation.py')], { cwd: temp, encoding: 'utf8' }); assert.equal(issue.status, 0, issue.stderr);
      assert.equal((await apiWrite('/api/auth/register', { username: 'owner_one', password: 'AdministratorPass123!', invitation: issue.stdout.trim() })).status(), 201);
      const grant = spawnSync('python3', [path.join(backend, 'admin/grant_admin.py'), 'owner_one'], { cwd: temp, encoding: 'utf8' }); assert.equal(grant.status, 0, grant.stderr);
    }
    assert.equal((await apiWrite('/api/auth/login', { username: 'owner_one', password: 'AdministratorPass123!' })).status(), 200);
    await page.goto(base + '/admin'); await page.locator('#admin-content').waitFor();
    await page.locator('#document-title').fill('教材 <img src=x onerror=alert(1)>'); await page.locator('#document-authors').fill('Test author'); await page.locator('#document-file').setInputFiles({ name: 'textbook.pdf', mimeType: 'application/pdf', buffer: pdf }); await page.locator('#document-save').click();
    await page.waitForFunction(() => document.getElementById('admin-message').textContent.includes('文献已导入'));
    assert.equal(await page.locator('#document-list img').count(), 0); assert.match(await page.locator('#document-list').textContent(), /<img src=x/);
    const doc = (await (await page.request.get(base + '/api/admin/documents')).json()).documents[0];
    await page.locator('#document-list button').first().click(); await page.locator('#document-title').fill('线性代数学习资料'); await page.locator('#document-save').click(); await page.waitForFunction(() => document.getElementById('admin-message').textContent.includes('文献信息已保存'));
    await page.locator('#document-query').fill('线性代数'); await page.locator('#document-search button').click(); await page.waitForFunction(() => document.getElementById('document-list').textContent.includes('线性代数学习资料'));
    const shots = path.join(frontend, 'tests/artifacts'); fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, 'admin-library.png'), fullPage: true });
    await page.locator('[data-view="books"]').click(); await page.locator('#book-select').selectOption('7'); await page.locator('#book-document').selectOption(String(doc.id)); await page.locator('#book-order').fill('25'); await page.locator('#book-form button[type="submit"]').click();
    await page.waitForFunction(() => document.getElementById('admin-message').textContent.includes('教材配置已保存'));
    assert.equal(await page.locator('#book-document').isDisabled(), true); assert.equal((await (await page.request.get(base + '/api/learning/books/7')).json()).available, true);
    await page.locator('#new-book').click(); await page.locator('#book-direction').selectOption('algebra'); await page.locator('#book-language').selectOption('zh'); await page.locator('#book-document').selectOption(String(doc.id)); await page.locator('#book-title').fill('中文推荐教材'); await page.locator('#book-stage').selectOption('核心理论'); await page.locator('#book-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('admin-message').textContent.includes('教材配置已保存') && document.getElementById('book-list').textContent.includes('中文推荐教材'));
    const configured=(await(await page.request.get(base+'/api/admin/books')).json()).books.find(b=>b.title==='中文推荐教材'); assert.equal(configured.language,'zh'); assert.equal(configured.document_id,doc.id); assert.equal(configured.direction,'algebra');
    await page.screenshot({ path: path.join(shots, 'admin-books.png'), fullPage: true });
    await page.locator('[data-view="invitations"]').click(); await page.locator('#invitation-form button').click(); await page.locator('#created-invitation').waitFor(); assert.equal((await page.locator('#invitation-code').inputValue()).length, 43);
    await page.locator('#invitation-list button').first().click(); await page.waitForFunction(() => document.getElementById('admin-message').textContent.includes('邀请码已撤销'));
    assert.match(await page.locator('#invitation-list').textContent(), /已撤销/); await page.screenshot({ path: path.join(shots, 'admin-invitations.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'admin-mobile.png'), fullPage: true }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 320, height: 568 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []); console.log('Admin PDF import, metadata, textbook binding, invitation revocation and mobile UI passed.');
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    if (child && child.exitCode === null) { const stop = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stop; }
    if (temp) { const resolved = path.resolve(temp); if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('math-admin-ui-')) throw new Error('Unexpected test directory'); fs.rmSync(resolved, { recursive: true, force: true }); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
