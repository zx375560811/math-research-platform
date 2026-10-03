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
const { fixturePdf } = require('./fixture.cjs');
const pdf = fixturePdf(12);
const directions = [['analysis','分析',true],['geometry-topology','几何与拓扑',true],['algebra','代数',true],['number-theory','数论',false],['probability-statistics','概率与统计',false],['computational','计算数学与数值方法',false],['optimization','优化与数学建模',false],['discrete-foundations','离散数学与数学基础',false]].map(([slug,name,featured]) => ({slug,name,featured,description:'研究结构与数学问题'}));
const mockBooks = [{id:7,direction:'algebra',title:'Linear Algebra Done Right',authors:'Sheldon Axler',stage:'基础入门',prerequisites:'基本证明方法',source_url:'https://linear.axler.net/',available:true,file_url:'/api/documents/1/file'}, {id:8,direction:'algebra',title:'Abstract Algebra: Theory and Applications',authors:'Thomas W. Judson',stage:'核心理论',prerequisites:'线性代数',source_url:'https://scholarworks.sfasu.edu/ebooks/23/',available:false,file_url:null}, {id:9,direction:'algebra',title:'Representation Theory: A First Course',authors:'William Fulton, Joe Harris',stage:'进阶学习',prerequisites:'群论与线性代数',source_url:'https://link.springer.com/book/10.1007/978-1-4612-0979-9',available:false,file_url:null}];
for (const [i, stage] of ['基础入门','核心理论','进阶学习'].entries()) mockBooks.push({id:106+i,direction:'algebra',title:['高等代数','近世代数基础','交换代数基础'][i],authors:'中文推荐作者',stage,language:'zh',prerequisites:'前一阶段基础',source_url:'https://2d.hep.com.cn/585562293/3',available:false,file_url:null});
const subjects = [{ id: 1, slug: 'algebra', name: '代数' }, { id: 2, slug: 'number-theory', name: '数论' }, { id: 3, slug: 'analysis', name: '分析' }, { id: 4, slug: 'geometry-topology', name: '几何与拓扑' }, { id: 5, slug: 'other', name: '其他数学方向' }];
async function main() {
  let browser, server, child, temp; let logs = '';
  try {
    let port; let invitation = 'I'.repeat(43); let invitationUsed = false;
    const documents = Array.from({ length: 21 }, (_, index) => ({ id: index + 1, title: index === 20 ? '定理 "A" <img src=x onerror=alert(1)>' : index === 0 ? 'Test textbook' : `研究资料 ${index + 1}`, authors: '平台维护的参考资料', subject_ids: [1], file_size: pdf.length, module:'mathematics', language:index === 0 ? 'en' : 'und', directions:['algebra'], file_url:`/api/documents/${index+1}/file` }));
    if (process.env.MATH_BROWSER_MOCK === '1') {
      const users = new Map(); const sessions = new Map(); const progress = new Map(); const annotations = new Map(); let annotationId = 0;
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
          if (url.pathname.endsWith('/register')) { if (body.invitation !== invitation || invitationUsed) return json({ error: 'invalid_invitation' }, 400); if (users.has(name)) return json({ error: 'username_taken' }, 409); users.set(name, body.password); invitationUsed = true; return json({ user: { username: name, role: 'USER' } }, 201); }
          if (url.pathname.endsWith('/logout')) { delete session.user; return json({ status: 'ok' }); }
          if (users.get(name) !== body.password) return json({ error: 'invalid_credentials' }, 401);
          session.user = { username: name, role: 'USER' }; return json({ user: session.user });
        }
        if (url.pathname.startsWith('/api/library')) {
          if (!session?.user) return json({error:'login_required'},401);
          const user=session.user.username, docPath=url.pathname.match(/^\/api\/library\/documents\/(\d+)(?:\/(progress|annotations)(?:\/(\d+))?)?$/);
          if (url.pathname==='/api/library/categories') return json({modules:[{slug:'mathematics',name:'数学与应用数学',directions}]});
          if (url.pathname==='/api/library/documents') {const q=url.searchParams.get('q')||'', direction=url.searchParams.get('direction')||'', language=url.searchParams.get('language')||'', offset=Number(url.searchParams.get('offset')||0);return json({documents:documents.filter(d=>(!q||d.title.includes(q)||d.authors.includes(q))&&(!direction||d.directions.includes(direction))&&(!language||d.language===language)).slice().reverse().slice(offset,offset+20).map(d=>({...d,progress:progress.get(user+':doc:'+d.id)||null})),limit:20,offset});}
          if(docPath){const doc=documents.find(d=>d.id===Number(docPath[1]));if(!doc)return json({error:'not_found'},404);const key=user+':doc:'+doc.id;
            if(req.method==='GET'&&!docPath[2])return json({...doc,available:true,progress:progress.get(key)||null});
            if(req.method==='GET'&&docPath[2]==='annotations')return json({annotations:annotations.get(key)||[]});
            if(req.headers['x-csrf-token']!==session.token)return json({error:'invalid_csrf'},403);
            const parts=[];for await(const part of req)parts.push(part);const raw=Buffer.concat(parts).toString();const body=raw?JSON.parse(raw):{};
            if(req.method==='PUT'&&docPath[2]==='progress'){progress.set(key,body);return json({status:'ok'});}
            if(req.method==='POST'&&docPath[2]==='annotations'){const mark={...body,id:++annotationId};annotations.set(key,[...(annotations.get(key)||[]),mark]);return json({id:mark.id});}
            const marks=annotations.get(key)||[],mark=marks.find(m=>m.id===Number(docPath[3]));if(!mark)return json({error:'not_found'},404);
            if(req.method==='PATCH'){mark.note=body.note;return json({status:'ok'});}if(req.method==='DELETE'){annotations.set(key,marks.filter(m=>m.id!==mark.id));return json({status:'ok'});}
          }
          return json({error:'not_found'},404);
        }
        if (url.pathname.startsWith('/api/learning')) {
          if (!session?.user) return json({error:'login_required'},401);
          const user = session.user.username; const bookPath = url.pathname.match(/^\/api\/learning\/books\/(\d+)(?:\/(progress|annotations)(?:\/(\d+))?)?$/);
          if (req.method === 'GET') {
            if (url.pathname === '/api/learning/directions') return json({directions});
            if (url.pathname.startsWith('/api/learning/directions/')) { const slug = url.pathname.split('/').pop(); const direction = directions.find(d => d.slug === slug); return direction ? json({...direction,questions:['如何研究运算与代数结构？','如何描述和理解对称性？','如何分类与表示代数结构？'],books:mockBooks.filter(b => b.direction === slug).map(b => ({...b,progress:progress.get(user+':doc:1')||null}))}) : json({error:'not_found'},404); }
          }
          if (bookPath) {
            const book = mockBooks.find(b => b.id === Number(bookPath[1])); if (!book) return json({error:'not_found'},404);
            const key = user+':doc:1';
            if (req.method === 'GET' && !bookPath[2]) return json({...book,progress:progress.get(key)||null});
            if (req.method === 'GET' && bookPath[2] === 'annotations') return json({annotations:annotations.get(key)||[]});
            if (req.headers['x-csrf-token'] !== session.token) return json({error:'invalid_csrf'},403);
            const parts=[];for await(const part of req)parts.push(part);const raw=Buffer.concat(parts).toString();const body=raw?JSON.parse(raw):{};
            if (req.method === 'PUT' && bookPath[2] === 'progress') {progress.set(key,body);return json({status:'ok'});}
            if (req.method === 'POST' && bookPath[2] === 'annotations') {const mark={...body,id:++annotationId};annotations.set(key,[...(annotations.get(key)||[]),mark]);return json({id:mark.id});}
            const marks=annotations.get(key)||[];const mark=marks.find(m=>m.id===Number(bookPath[3]));if(!mark)return json({error:'not_found'},404);
            if(req.method==='PATCH'){mark.note=body.note;return json({status:'ok'});}if(req.method==='DELETE'){annotations.set(key,marks.filter(m=>m.id!==mark.id));return json({status:'ok'});}
          }
          return json({error:'not_found'},404);
        }
        if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
        if ((url.pathname.startsWith('/api/documents') || url.pathname === '/api/subjects') && !session?.user) return json({ error: 'login_required' }, 401);
        if (url.pathname === '/api/health') return json({ status: 'ok' });
        if (url.pathname === '/api/subjects') return json({ subjects });
        if (url.pathname === '/api/documents') {
          const id = Number(url.searchParams.get('subject_id')); const offset = Number(url.searchParams.get('offset') || 0);
          return json({ documents: documents.filter(d => !id || d.subject_ids.includes(id)).slice().reverse().slice(offset, offset + 20), limit: 20, offset });
        }
        if (/^\/api\/documents\/\d+\/file$/.test(url.pathname)) { res.writeHead(200, { 'Content-Type': 'application/pdf' }); return res.end(pdf); }
        const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/learning.js': ['learning.js', 'text/javascript'], '/library.js':['library.js','text/javascript'], '/reader.js': ['reader.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
        for (const name of ['icons.js', 'vendor/morphicons/dom.js', 'vendor/morphicons/spring-CFHloqPP.js', 'vendor/morphicons/normalize-CYnN3Npw.js']) assets['/' + name] = [name, 'text/javascript'];
        if (/^\/vendor\/pdfjs\/(pdf(?:\.worker)?\.mjs|text_layer\.css|cmaps\/[A-Za-z0-9_-]+\.bcmap|standard_fonts\/[A-Za-z0-9_-]+\.(?:pfb|ttf))$/.test(url.pathname)) assets[url.pathname] = [url.pathname.slice(1), url.pathname.endsWith('.mjs')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'application/octet-stream'];
        const asset = assets[url.pathname]; if (!asset) return json({ error: 'not_found' }, 404);
        res.writeHead(200, { 'Content-Type': asset[1], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'" }); res.end(fs.readFileSync(path.join(frontend, asset[0])));
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
      const issued = spawnSync('python3', [path.join(repo, 'backend/admin/create_invitation.py')], { cwd: temp, encoding: 'utf8' }); assert.equal(issued.status, 0, issued.stderr); invitation = issued.stdout.trim();
      fs.writeFileSync(path.join(temp, 'source.pdf'), pdf);
      const imported = spawnSync('python3', [path.join(repo, 'backend/admin/import_document.py'), 'source.pdf', '--title', 'Test textbook', '--authors', 'Test author', '--subject-id', '1'], { cwd: temp, encoding: 'utf8' }); assert.equal(imported.status,0,imported.stderr);
      const linked = spawnSync('python3', [path.join(repo, 'backend/admin/link_textbook.py'),'7',String(JSON.parse(imported.stdout).id)],{cwd:temp,encoding:'utf8'});assert.equal(linked.status,0,linked.stderr);
    }
    assert.equal((await fetch(base + '/api/documents', { method: 'POST', body: pdf })).status, 405);
    const options = { headless: true }; if (process.env.MATH_BROWSER_EXECUTABLE) options.executablePath = process.env.MATH_BROWSER_EXECUTABLE;
    browser = await chromium.launch(options);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.waitForFunction(() => location.hash === '#/login');
    for (const selector of ['#home-view', '#module-view', '.sidebar', '.topbar', '.auth-intro', '.workspace>footer']) assert.equal(await page.locator(selector).isVisible(), false);
    assert.equal((await fetch(base + '/api/subjects')).status, 401);
    await page.goto(base + '/#/apps/mathematics'); await page.waitForFunction(() => location.hash === '#/login');
    assert.equal(await page.locator('#module-view').isVisible(), false);
    const shots = path.join(frontend, 'tests/artifacts'); fs.mkdirSync(shots, { recursive: true });
    await page.locator('#register-tab').click();
    await page.waitForFunction(() => document.body.classList.contains('auth-page'));
    for (const selector of ['.sidebar', '.topbar', '.auth-intro', '.workspace>footer']) assert.equal(await page.locator(selector).isVisible(), false);
    await page.screenshot({ path: path.join(shots, 'register-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'register-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 568 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('#account-invitation').fill(invitation);
    await page.locator('#account-username').fill('browser_reader'); await page.locator('#account-password').fill('BrowserPass123!'); await page.locator('#account-confirm').fill('DifferentPass123!');
    await page.locator('#account-submit').click(); await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('不一致'));
    await page.locator('#account-confirm').fill('BrowserPass123!');
    await page.locator('#account-invitation').fill('invalid-code'); await page.locator('#account-submit').click();
    await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('邀请码无效'));
    await page.locator('#account-invitation').fill(invitation); await page.locator('#account-submit').click();
    await page.waitForFunction(() => location.hash === '#/login');
    await page.screenshot({ path: path.join(shots, 'login-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('#account-password').fill('WrongPassword123!'); await page.locator('#account-submit').click();
    await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('不正确'));
    await page.locator('#account-password').fill('BrowserPass123!'); await page.locator('#account-submit').click();
    await page.locator('#featured-directions .direction-card').first().waitFor();
    assert.equal(await page.locator('#featured-directions .direction-card').count(),3);
    assert.equal(await page.locator('#more-directions .direction-small').count(),5);
    await page.locator('#home-link').click(); await page.locator('#home-view').waitFor();
    assert.equal(await page.locator('#admin-link').isVisible(), false);
    await page.screenshot({ path: path.join(shots, 'home-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'home-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.locator('.application-card[href="#/apps/mathematics"]').click();
    await page.screenshot({ path: path.join(shots, 'module-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'module-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 568 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('[data-direction="algebra"]').click(); await page.locator('.textbook-row').first().waitFor();
    assert.equal(await page.locator('#direction-questions li').count(),3);
    assert.equal(await page.locator('.textbook-row').count(),6); assert.equal(await page.locator('.textbook-stage').count(),3); for(const stage of ['基础入门','核心理论','进阶学习']) for(const language of ['zh','en']) assert.equal(await page.locator(`.textbook-stage[data-stage="${stage}"] .recommendation-language[data-language="${language}"] .textbook-row`).count(),1);
    assert.equal(await page.locator('[data-book="7"]').textContent(),'开始学习');
    assert.equal(await page.locator('input[type=file],#upload-form').count(),0);
    await page.screenshot({ path: path.join(shots, 'direction-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'direction-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.locator('[data-book="7"]').click();
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"] .textLayer span')?.textContent.includes('Mathematics'));
    assert.equal(await page.locator('#reader-pages').textContent(),'12');
    assert.equal(await page.locator('.pdf-page').count(),12);
    assert.equal(await page.locator('#reader-notes').isVisible(),true); assert.equal(await page.locator('#reader-outline').isVisible(),true);
    assert.equal(await page.locator('.topbar').isVisible(),false);
    await page.evaluate(() => {const area=document.getElementById('reader-scroll'),stack=document.getElementById('pdf-pages'),next=document.querySelector('.pdf-page[data-page="2"]');area.scrollTop=stack.offsetTop+next.offsetTop+120;});
    await page.waitForFunction(() => document.getElementById('reader-page').value==='2' && document.querySelector('.pdf-page[data-page="2"][data-loaded]'));
    await page.locator('#reader-prev').click(); await page.waitForFunction(() => document.getElementById('reader-page').value==='1');
    await page.locator('#reader-page').fill('10');
    await page.evaluate(async()=>{document.getElementById('reader-scroll').dispatchEvent(new Event('scroll'));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    assert.equal(await page.locator('#reader-page').inputValue(),'10');await page.locator('#reader-page').press('Enter');
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="10"] .textLayer span')?.textContent==='Mathematics 10');
    assert.ok(await page.locator('.pdf-page[data-loaded]').count()<=8);
    assert.equal(await page.locator('.pdf-page[data-page="1"] canvas').evaluate(canvas=>canvas.width),0);
    await page.locator('#reader-page').fill('1'); await page.locator('#reader-page').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"][data-loaded]'));
    await page.evaluate(() => {const area=document.getElementById('reader-scroll'),next=document.querySelector('.pdf-page[data-page="2"]');area.scrollTop=document.getElementById('pdf-pages').offsetTop+next.offsetTop-area.clientHeight*.4;});
    await page.screenshot({path:path.join(shots,'reader-continuous.png'),fullPage:true});
    await page.locator('#reader-page').fill('1'); await page.locator('#reader-page').dispatchEvent('change');
    await page.waitForFunction(() => document.getElementById('reader-scroll').scrollTop<30);
    assert.ok(await page.locator('#reader-scroll').evaluate(node=>node.clientHeight/innerHeight)>.8);
    await page.locator('#reader-fullscreen').click(); await page.waitForFunction(()=>!!document.fullscreenElement);
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.locator('#reader-fullscreen').click(); await page.waitForFunction(()=>!document.fullscreenElement);
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.waitForFunction(()=>!!document.querySelector('.pdf-page[data-page="1"][data-loaded]'));

    await page.evaluate(() => {const span=document.querySelector('.pdf-page[data-page="1"] .textLayer span');const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    await page.locator('#selection-tools').waitFor(); await page.locator('[data-highlight="yellow"]').click();
    await page.locator('.annotation-item').waitFor(); assert.ok(await page.locator('.pdf-highlight').count()>0);
    const noteText='My proof <img src=x onerror=alert(1)>';
    await page.locator('.annotation-note').fill(noteText); await page.locator('.annotation-actions .button').click();
    await page.waitForFunction(() => document.getElementById('reader-status').textContent==='笔记已保存');
    const dimensions=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect();return {outline:rect('reader-outline').width,notes:rect('reader-notes').width,pdf:rect('reader-scroll').width};});
    const handle=await page.locator('#reader-outline-resize').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+100);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+70,handle.y+100,{steps:6});
    assert.ok(await page.locator('#reader-outline').evaluate(node=>node.clientWidth)>dimensions.outline+50);
    assert.ok(await page.locator('.pdf-page[data-page="1"]').evaluate(node=>node.clientWidth)<dimensions.pdf-50);
    await page.mouse.up();await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    assert.equal(await page.locator('#reader-page').inputValue(),'1');assert.ok(await page.locator('.pdf-highlight').count()>0);
    const notesHandle=await page.locator('#reader-notes-resize').boundingBox();
    await page.mouse.move(notesHandle.x+notesHandle.width/2,notesHandle.y+100);await page.mouse.down();await page.mouse.move(notesHandle.x+notesHandle.width/2-60,notesHandle.y+100,{steps:6});await page.mouse.up();
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');assert.ok(await page.locator('#reader-notes').evaluate(node=>node.clientWidth)>dimensions.notes+40);
    await page.locator('#reader-outline-resize').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const threeColumns=await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();return {left:r('reader-outline').right,pdfLeft:r('reader-scroll').left,pdfRight:r('reader-scroll').right,right:r('reader-notes').left};});
    assert.ok(threeColumns.left<=threeColumns.pdfLeft && threeColumns.pdfRight<=threeColumns.right);
    await page.screenshot({path:path.join(shots,'reader-resizable.png'),fullPage:true});

    await page.locator('#reader-zoom').fill('137'); await page.locator('#reader-zoom').press('Enter');
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.locator('#reader-zoom-in').click(); assert.equal(await page.locator('#reader-zoom').inputValue(),'147');
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.locator('#reader-zoom-out').click(); assert.equal(await page.locator('#reader-zoom').inputValue(),'137');
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const point=await page.locator('.pdf-page[data-page="1"]').evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.left+Math.min(150,r.width*.4),y:r.top+150};});
    const fraction=await page.locator('.pdf-page[data-page="1"]').evaluate((node,p)=>{const r=node.getBoundingClientRect();return {x:(p.x-r.left)/r.width,y:(p.y-r.top)/r.height};},point);
    await page.mouse.move(point.x,point.y);await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');
    await page.waitForFunction(()=>Number(document.getElementById('reader-zoom').value)>137 && document.getElementById('pdf-pages').dataset.layout==='ready');
    const scaledFraction=await page.locator('.pdf-page[data-page="1"]').evaluate((node,p)=>{const r=node.getBoundingClientRect();return {x:(p.x-r.left)/r.width,y:(p.y-r.top)/r.height};},point);
    assert.ok(Math.abs(fraction.x-scaledFraction.x)<.02 && Math.abs(fraction.y-scaledFraction.y)<.02);
    for (const percent of ['400','25']) {await page.locator('#reader-zoom').fill(percent);await page.locator('#reader-zoom').press('Enter');await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');}
    assert.equal(await page.locator('#reader-zoom-out').isDisabled(),true);
    await page.locator('#reader-fit-width').click();assert.equal(await page.locator('#reader-zoom').inputValue(),'100');
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.locator('#reader-zoom').fill('137'); await page.locator('#reader-zoom').press('Enter');
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"][data-loaded]'));
    assert.ok(await page.locator('.pdf-highlight').count()>0);
    await page.screenshot({path:path.join(shots,'reader-desktop.png'),fullPage:true});
    const expandedPdfWidth=await page.locator('#reader-scroll').evaluate(node=>node.clientWidth);
    await page.locator('#reader-notes-close').click();await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    assert.ok(await page.locator('#reader-scroll').evaluate(node=>node.clientWidth)>expandedPdfWidth+150);
    await page.evaluate(() => {const span=document.querySelector('.pdf-page[data-page="1"] .textLayer span');const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    await page.locator('#selection-tools').waitFor();await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    assert.equal(await page.locator('#reader-notes').isVisible(),true);assert.ok(await page.locator('#selection-quote').textContent());
    await page.evaluate(()=>window.getSelection().removeAllRanges());

    await page.locator('.outline-entry').last().click();
    await page.waitForFunction(()=>document.getElementById('reader-page').value==='2' && document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.evaluate(()=>{const scroll=document.getElementById('reader-scroll'),frame=document.querySelector('.pdf-page[data-page="2"]');scroll.scrollTop=document.getElementById('pdf-pages').offsetTop+frame.offsetTop+frame.clientHeight*.35;});
    const beforeDrag=await page.evaluate(()=>{const area=document.getElementById('reader-scroll'),frame=document.querySelector('.pdf-page[data-page="2"]');return (area.scrollTop-document.getElementById('pdf-pages').offsetTop-frame.offsetTop)/frame.clientHeight;});
    const boundary=await page.locator('#reader-notes-resize').boundingBox();await page.mouse.move(boundary.x+3,boundary.y+80);await page.mouse.down();await page.mouse.move(boundary.x+43,boundary.y+80,{steps:5});await page.mouse.up();
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const afterDrag=await page.evaluate(()=>{const area=document.getElementById('reader-scroll'),frame=document.querySelector('.pdf-page[data-page="2"]');return (area.scrollTop-document.getElementById('pdf-pages').offsetTop-frame.offsetTop)/frame.clientHeight;});
    assert.equal(await page.locator('#reader-page').inputValue(),'2');assert.ok(Math.abs(beforeDrag-afterDrag)<.02);

    await page.waitForFunction(() => document.getElementById('reader-page').value==='2');
    await page.waitForFunction(async () => (await (await fetch('/api/learning/books/7')).json()).progress?.page===2);
    const preferredNotesWidth=await page.locator('#reader-notes').evaluate(node=>node.clientWidth); await page.reload(); await page.waitForFunction(() => document.getElementById('reader-page').value==='2' && document.querySelector('.pdf-page[data-page="2"] .textLayer span')?.textContent==='Mathematics 2');
    assert.ok(Math.abs(await page.locator('#reader-notes').evaluate(node=>node.clientWidth)-preferredNotesWidth)<2); assert.equal(await page.locator('.annotation-note').inputValue(),noteText);assert.equal(await page.locator('#annotation-list img').count(),0);
    const secondContext=await browser.newContext({viewport:{width:390,height:844}});const second=await secondContext.newPage();
    await second.goto(base+'/#/apps/mathematics/read/7');await second.waitForFunction(()=>location.hash==='#/login');
    await second.locator('#account-username').fill('browser_reader');await second.locator('#account-password').fill('BrowserPass123!');await second.locator('#account-submit').click();
    await second.waitForFunction(()=>document.getElementById('reader-page').value==='2' && document.querySelector('.pdf-page[data-page="2"] .textLayer span')?.textContent==='Mathematics 2');
    assert.equal(await second.locator('#reader-zoom').inputValue(),'137'); await second.locator('#reader-page').fill('12');await second.locator('#reader-page').dispatchEvent('change');
    await second.waitForFunction(()=>document.getElementById('reader-page').value==='12' && document.querySelector('.pdf-page[data-page="12"][data-loaded]'));
    await second.locator('#reader-page').fill('2');await second.locator('#reader-page').dispatchEvent('change');
    await second.waitForFunction(()=>document.getElementById('reader-page').value==='2');
    assert.equal(await second.locator('.annotation-note').inputValue(),noteText);
    await second.locator('.annotation-jump').click();await second.waitForFunction(()=>document.getElementById('reader-page').value==='1' && document.querySelector('.pdf-highlight'));
    await second.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready'); assert.equal(await second.locator('#reader-page').inputValue(),'1'); await second.screenshot({path:path.join(shots,'reader-mobile.png'),fullPage:true});
    await second.setViewportSize({width:320,height:568});assert.equal(await second.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await second.locator('.annotation-delete').click();await second.waitForFunction(()=>!document.querySelector('.annotation-item'));
    await secondContext.close();
    await page.locator('#reader-back').click();await page.locator('[data-book="7"]').waitFor();assert.match(await page.locator('[data-book="7"]').textContent(),/继续学习/);
    await page.reload(); await page.waitForFunction(() => document.getElementById('account-name').textContent === 'browser_reader');
    await page.locator('.book-library-choice').first().click(); await page.locator('#library-view').waitFor();
    assert.equal(await page.locator('#library-direction').inputValue(),'algebra'); await page.locator('.library-document').first().waitFor();
    assert.equal(await page.locator('#library-documents img').count(),0);
    await page.locator('#library-query').fill('Test textbook'); await page.locator('#library-filter button').click(); await page.locator('[data-document="1"]').waitFor();
    await page.screenshot({path:path.join(shots,'library-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); await page.screenshot({path:path.join(shots,'library-mobile.png'),fullPage:true}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false); await page.setViewportSize({width:1440,height:1100});
    await page.locator('[data-document="1"]').click(); await page.waitForFunction(()=>document.querySelector('.pdf-page[data-loaded]')); assert.match(await page.locator('#reader-back').textContent(),/文档库/);
    await page.locator('#reader-page').fill('3'); await page.locator('#reader-page').dispatchEvent('change'); await page.waitForFunction(()=>document.getElementById('reader-page').value==='3');
    await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="3"] .textLayer span')?.textContent==='Mathematics 3');
    let libraryProgress;
    for(let attempt=0;attempt<100;attempt++){libraryProgress=(await(await page.request.get(base+'/api/library/documents/1')).json()).progress;if(libraryProgress?.page===3)break;await page.waitForTimeout(100);}
    assert.equal(libraryProgress.page,3); assert.deepEqual((await(await page.request.get(base+'/api/learning/books/7')).json()).progress,libraryProgress);
    await page.locator('#reader-back').click(); await page.locator('#library-view').waitFor(); await page.locator('#math-app-link').click(); await page.locator('[data-direction="algebra"]').click(); await page.locator('[data-book="7"]').waitFor(); assert.match(await page.locator('[data-book="7"]').textContent(),/第 3 页/);
    await page.locator('#logout-button').click(); await page.waitForFunction(() => location.hash === '#/login');
    assert.equal(await page.locator('#home-view').isVisible(), false);
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    assert.equal((await page.request.get(base + '/api/documents')).status(), 401);
    assert.equal((await page.request.get(base + '/api/documents/1/file')).status(), 401);
    await page.goto(base + '/#/'); await page.waitForFunction(() => location.hash === '#/login'); await page.locator('#auth-view').waitFor();
    assert.deepEqual(errors, []); console.log('Invitation login, direction hierarchy, staged textbooks, PDF rendering, highlighter, note editing/deletion, reload, cross-device progress and mobile checks passed.');
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    if (child && child.exitCode === null && child.signalCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stopped; }
    if (temp) { const resolved = path.resolve(temp); if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('math-ui-')) throw new Error('Unexpected test directory'); fs.rmSync(resolved, { recursive: true, force: true }); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
