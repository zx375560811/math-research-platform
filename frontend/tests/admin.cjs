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
// A real PDF with trailing padding exercises the browser's former 20 MiB upload boundary.
const pdf = Buffer.concat([fixturePdf(2), Buffer.alloc(21 * 1024 * 1024)]);
async function main() {
  let server, browser, child, temp, logs = '';
  try {
    const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    if (process.env.MATH_BROWSER_MOCK === '1') {
      const docs = [], invites = [], folders=[{id:100,name:'大学数学基础',parent_id:null}]; let folderId=100, organizer={state:'idle'}, organizerGets=0; const memberships=new Map(); let session = null; let ai={base_url:'',model:'',enabled:false,available:false,has_key:false,daily_limit:50};
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
        if (p === '/api/library/categories') return json({modules:[{slug:'mathematics',name:'数学与应用数学',directions:[{slug:'algebra',name:'代数'},{slug:'analysis',name:'分析'}]}]});
        if (/^\/api\/documents\/\d+$/.test(p)) return docs.some(d=>d.id===Number(p.split('/').pop()))?json(docs.find(d=>d.id===Number(p.split('/').pop()))):json({error:'not_found'},404);
        if(p==='/api/ai/settings')return json({custom:{available:true},default:{available:false}});
        if (p === '/api/subjects') return json({ subjects: [{ id: 1, name: '代数', slug: 'algebra' }] });
        if (p.startsWith('/api/admin')) {
          if (session?.role !== 'ADMIN') return json({ error: session ? 'admin_required' : 'login_required' }, session ? 403 : 401);
          if(p==='/api/admin/library-ai'){if(req.method==='POST'){organizer={id:'job-one',source:body.source,state:'running',done:0,total:docs.length,applied:0,review:0,skipped:0,failed:0,error:''};organizerGets=0;}else if(organizer.state==='running'&&++organizerGets>1)organizer={...organizer,state:'completed',done:docs.length,applied:docs.length};return json(organizer);}
          if(p==='/api/admin/library-ai/job-one/control'){organizer={...organizer,state:{pause:'paused',resume:'running',undo:'undone'}[body.action]};organizerGets=0;return json(organizer);}
          if(p==='/api/admin/collections' && req.method==='GET')return json({collections:folders.map(f=>({...f,count:docs.filter(d=>(memberships.get(d.id)||[]).includes(f.id)).length})),total:docs.length,unfiled:docs.filter(d=>!(memberships.get(d.id)||[]).length).length});
          if(p==='/api/admin/collections' && req.method==='POST'){const id=++folderId;folders.push({id,name:body.name,parent_id:body.parent_id});return json({id});}
          if(/^\/api\/admin\/collections\/\d+(?:\/parent)?$/.test(p)){const id=Number(p.split('/')[4]),folder=folders.find(f=>f.id===id);if(req.method==='DELETE')folders.splice(folders.indexOf(folder),1);else Object.assign(folder,body);return json({status:'ok'});}
          if(p==='/api/admin/documents/move'){for(const id of body.document_ids)memberships.set(id,body.collection_id==null?[]:[body.collection_id]);return json({status:'ok'});}
          if(p==='/api/admin/documents/batch-delete'){for(const id of body.document_ids){const at=docs.findIndex(d=>d.id===id);if(at>=0)docs.splice(at,1);memberships.delete(id);}return json({status:'ok',cleanup_pending:0});}
          if(/^\/api\/admin\/documents\/\d+\/name$/.test(p)){docs.find(d=>d.id===Number(p.split('/')[4])).title=body.name;return json({status:'ok'});}
          if(p==='/api/admin/ai/settings'){if(req.method==='PUT')ai={...ai,base_url:body.base_url,model:body.model,enabled:body.enabled,daily_limit:body.daily_limit,has_key:body.clear_key?false:!!body.api_key||ai.has_key};return json(ai);}
          if (p === '/api/admin/documents' && req.method === 'POST') { const id = docs.length + 1; docs.unshift({ id, title: url.searchParams.get('title'), authors: url.searchParams.get('authors'), subject_ids: [1], module:'mathematics', directions:url.searchParams.getAll('directions'), language:url.searchParams.get('language')||'und', file_size: bytes.length, format: req.headers['content-type']==='image/vnd.djvu'?'djvu':'pdf', file_url: `/api/documents/${id}/file` }); return json({ id }, 201); }
          if (p === '/api/admin/documents') return json({ documents: docs.filter(d => d.title.includes(url.searchParams.get('q') || '') && (!url.searchParams.get('collection') || url.searchParams.get('collection')==='unfiled'&&!(memberships.get(d.id)||[]).length || (memberships.get(d.id)||[]).includes(Number(url.searchParams.get('collection'))))), offset: 0, limit: 20 });
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
        const assets = { '/admin': 'admin.html', '/admin.js': 'admin.js', '/admin.css': 'admin.css', '/style.css': 'style.css' }; const name = assets[p] || (['/admin-library.js','/admin-organizer.js','/icons.js'].includes(p)||p.startsWith('/vendor/morphicons/')?p.slice(1):null);
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
    await page.goto(base + '/admin'); await page.locator('#admin-content').waitFor(); await page.locator('#document-import').click();
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
    await page.route('**/api/admin/documents?**',async route=>{await new Promise(resolve=>setTimeout(resolve,150));await route.continue();});
    await page.locator('#new-book').click(); await page.locator('#book-direction').selectOption('analysis'); assert.equal(await page.locator('#book-stage-label').textContent(),'对应课程'); assert.equal(await page.locator('#book-stage option').count(),7); await page.locator('#book-stage').selectOption('复分析'); await page.locator('#book-direction').selectOption('algebra'); await page.locator('#book-language').selectOption('zh'); await page.locator('#book-document').selectOption(String(doc.id)); await page.locator('#book-title').fill('中文推荐教材'); await page.locator('#book-stage').selectOption('核心理论'); await page.locator('#book-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('admin-message').textContent.includes('教材配置已保存') && document.getElementById('book-list').textContent.includes('中文推荐教材'));
    const configured=(await(await page.request.get(base+'/api/admin/books')).json()).books.find(b=>b.title==='中文推荐教材'); assert.equal(configured.language,'zh'); assert.equal(configured.document_id,doc.id); assert.equal(configured.direction,'algebra');
    await page.screenshot({ path: path.join(shots, 'admin-books.png'), fullPage: true });
    await page.locator('[data-view="ai"]').click(); await page.locator('#admin-ai-form').waitFor(); await page.locator('#admin-ai-enabled').check(); await page.locator('#admin-ai-url').fill('https://api.openai.com/v1'); await page.locator('#admin-ai-model').fill('math-model'); await page.locator('#admin-ai-key').fill('default-test-secret'); await page.locator('#admin-ai-limit').fill('30'); await page.locator('#admin-ai-form button[type=submit]').click();
    await page.waitForFunction(()=>document.getElementById('admin-message').textContent.includes('API 设置已保存'));
    assert.equal(await page.locator('#admin-ai-key').inputValue(),''); assert.match(await page.locator('#admin-ai-key-state').textContent(),/密钥已保存/); await page.reload(); await page.waitForFunction(()=>document.getElementById('admin-ai-model').value==='math-model'); assert.equal(await page.locator('#admin-ai-limit').inputValue(),'30'); assert.equal(await page.locator('#admin-ai-enabled').isChecked(),true);
    const aiMeta=await(await page.request.get(base+'/api/admin/ai/settings')).json(); assert.equal(aiMeta.has_key,true); assert.equal(aiMeta.api_key,undefined);
    await page.screenshot({path:path.join(shots,'admin-ai.png'),fullPage:true}); await page.locator('#admin-ai-remove').click(); await page.waitForFunction(()=>document.getElementById('admin-message').textContent.includes('默认密钥已删除')); assert.equal(await page.locator('#admin-ai-enabled').isChecked(),false);
    await page.locator('[data-view="invitations"]').click(); await page.locator('#invitation-form button').click(); await page.locator('#created-invitation').waitFor(); assert.equal((await page.locator('#invitation-code').inputValue()).length, 43);
    await page.locator('#invitation-list button').first().click(); await page.waitForFunction(() => document.getElementById('admin-message').textContent.includes('邀请码已撤销'));
    assert.match(await page.locator('#invitation-list').textContent(), /已撤销/); await page.screenshot({ path: path.join(shots, 'admin-invitations.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'admin-mobile.png'), fullPage: true }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 320, height: 568 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({width:1440,height:1000});await page.locator('[data-view="documents"]').click();await page.locator('#document-import').click();
    await page.locator('#document-title').fill('Native DjVu upload');await page.locator('#document-file').setInputFiles({name:'textbook.djvu',mimeType:'image/vnd.djvu',buffer:require('./fixture-djvu.cjs').fixtureDjvu()});await page.locator('#document-save').click();
    await page.waitForFunction(()=>document.getElementById('admin-message').textContent.includes('文献已导入'));
    const native=(await(await page.request.get(base+'/api/admin/documents')).json()).documents.find(d=>d.title==='Native DjVu upload');assert.equal(native.format,'djvu');assert.match(await page.locator('#document-list').textContent(),/DJVU/);
    await page.locator('#admin-folder-create').click();await page.locator('#operation-name').fill('数学资料');await page.locator('#operation-submit').click();
    await page.waitForFunction(()=>document.getElementById('admin-library-path').textContent==='数学资料' && document.getElementById('admin-library-browser').getAttribute('aria-busy')==='false');
    const archive=await(await page.request.get(base+'/api/admin/collections')).json(),folder=archive.collections.find(f=>f.name==='数学资料');
    async function chooseFolder(id){await page.locator(`[data-collection="${id}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-collection="${id}"]`)?.getAttribute('aria-current')==='page' && document.getElementById('admin-library-browser').getAttribute('aria-busy')==='false',String(id));}
    await chooseFolder('');await page.locator(`[data-select-document="${doc.id}"]`).check();await page.locator('#admin-batch-move').click();await page.locator('#operation-destination').selectOption(String(folder.id));await page.locator('#operation-submit').click();await page.waitForFunction(()=>!document.getElementById('library-operation').open && document.getElementById('admin-library-browser').getAttribute('aria-busy')==='false');
    await chooseFolder(folder.id);assert.equal(await page.locator('#document-list tr').count(),1);
    await page.locator(`[data-document-actions="${doc.id}"]`).click();await page.locator('#document-rename').click();await page.locator('#operation-name').fill('数学分析学习资料');await page.locator('#operation-submit').click();await page.waitForFunction(()=>document.getElementById('document-list').textContent.includes('数学分析学习资料') && document.getElementById('admin-library-browser').getAttribute('aria-busy')==='false');
    await page.locator('#admin-folder-rename').click();await page.locator('#operation-name').fill('分析教材');await page.locator('#operation-submit').click();await page.waitForFunction(()=>document.getElementById('admin-library-path').textContent==='分析教材' && document.getElementById('admin-library-browser').getAttribute('aria-busy')==='false');
    await page.screenshot({path:path.join(shots,'admin-library.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.locator('#admin-folders-toggle').click();await page.screenshot({path:path.join(shots,'admin-library-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:320,height:568});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1000});
    await chooseFolder('');await page.locator(`[data-document-actions="${native.id}"]`).click();await page.locator('#document-delete').click();await page.locator('#operation-cancel').click();assert.equal((await page.request.get(base+'/api/documents/'+native.id)).status(),200);
    await page.locator(`[data-document-actions="${native.id}"]`).click();await page.locator('#document-delete').click();await page.locator('#operation-submit').click();await page.waitForFunction(()=>!document.getElementById('library-operation').open && document.getElementById('admin-library-browser').getAttribute('aria-busy')==='false');assert.equal((await page.request.get(base+'/api/documents/'+native.id)).status(),404);
    await page.locator('#library-ai-open').click();await page.waitForFunction(()=>document.getElementById('library-ai-source').value==='custom' && !document.getElementById('library-ai-start').disabled);await page.locator('#library-ai-start').click();await page.waitForFunction(()=>document.getElementById('library-ai-summary').textContent.includes('正在后台整理') && !document.getElementById('library-ai-pause').disabled);
    await page.locator('#library-ai-pause').click();await page.waitForFunction(()=>document.getElementById('library-ai-summary').textContent.includes('已暂停') && !document.getElementById('library-ai-resume').disabled);await page.locator('#library-ai-resume').click();await page.waitForFunction(()=>document.getElementById('library-ai-summary').textContent.includes('整理完成'),null,{timeout:20000});
    await page.screenshot({path:path.join(shots,'admin-ai-organizer.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(shots,'admin-ai-organizer-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1000});
    page.once('dialog',dialog=>dialog.accept());await page.locator('#library-ai-undo').click();await page.waitForFunction(()=>document.getElementById('library-ai-summary').textContent.includes('已撤销'));await page.locator('#library-ai-close').click();
    assert.deepEqual(errors, []); console.log('Directory tree, rename, move, confirmed deletion and responsive library passed.'); console.log('Admin PDF/DJVU import, metadata, textbook binding, invitation revocation and mobile UI passed.');
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    if (child && child.exitCode === null) { const stop = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stop; }
    if (temp) { const resolved = path.resolve(temp); if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('math-admin-ui-')) throw new Error('Unexpected test directory'); fs.rmSync(resolved, { recursive: true, force: true }); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
