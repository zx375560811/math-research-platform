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
const {fixtureDjvuBundle} = require('./fixture-djvu.cjs');
const djvu = fixtureDjvuBundle(3);
let nativeId;
const directions = [['analysis','分析',true],['geometry-topology','几何与拓扑',true],['algebra','代数',true],['number-theory','数论',false],['probability-statistics','概率与统计',false],['computational','计算数学与数值方法',false],['optimization','优化与数学建模',false],['discrete-foundations','离散数学与数学基础',false]].map(([slug,name,featured]) => ({slug,name,featured,description:'研究结构与数学问题'}));
const mockBooks = [{id:7,direction:'algebra',title:'Linear Algebra Done Right',authors:'Sheldon Axler',stage:'基础入门',prerequisites:'基本证明方法',source_url:'https://linear.axler.net/',available:true,file_url:'/api/documents/1/file'}, {id:8,direction:'algebra',title:'Abstract Algebra: Theory and Applications',authors:'Thomas W. Judson',stage:'核心理论',prerequisites:'线性代数',source_url:'https://scholarworks.sfasu.edu/ebooks/23/',available:false,file_url:null}, {id:9,direction:'algebra',title:'Representation Theory: A First Course',authors:'William Fulton, Joe Harris',stage:'进阶学习',prerequisites:'群论与线性代数',source_url:'https://link.springer.com/book/10.1007/978-1-4612-0979-9',available:false,file_url:null}];
for (const [i, stage] of ['基础入门','核心理论','进阶学习'].entries()) mockBooks.push({id:106+i,direction:'algebra',title:['高等代数','近世代数基础','交换代数基础'][i],authors:'中文推荐作者',stage,language:'zh',prerequisites:'前一阶段基础',source_url:'https://2d.hep.com.cn/585562293/3',available:false,file_url:null});
const analysisCourses=['数学分析','高等代数','复分析','实分析与测度论','常微分方程','泛函分析','偏微分方程'];
for(const [i,course] of analysisCourses.entries()) for(const [j,language] of ['zh','en'].entries()) mockBooks.push({id:400+i*2+j,direction:'analysis',title:course+' · '+(language==='zh'?'中文教材':'English textbook'),authors:'Course author',stage:course,language,prerequisites:'',source_url:'',available:false,file_url:null});
const subjects = [{ id: 1, slug: 'algebra', name: '代数' }, { id: 2, slug: 'number-theory', name: '数论' }, { id: 3, slug: 'analysis', name: '分析' }, { id: 4, slug: 'geometry-topology', name: '几何与拓扑' }, { id: 5, slug: 'other', name: '其他数学方向' }];
async function readerControl(page, id) { await page.locator('#' + id).click(); }
async function assertTransparentSelection(page, selector) {
  const style=await page.locator(selector).first().evaluate(node=>{const selected=getComputedStyle(node,'::selection');return {color:selected.color,shadow:selected.textShadow,background:selected.backgroundColor,normal:getComputedStyle(node).color};});
  assert.equal(style.normal,'rgba(0, 0, 0, 0)');
  assert.equal(style.color,'rgba(0, 0, 0, 0)','Selected text must not duplicate the canvas glyphs');
  assert.equal(style.shadow,'none');
  const channels=style.background.match(/[\d.]+/g).map(Number);assert.equal(channels.length,4);assert.ok(channels[3]>0&&channels[3]<1,'The selection tint must leave the document visible');
}

async function scrollToPage(page, number) {
  await page.locator('#reader-scroll').evaluate((node,n)=>{const frame=document.querySelector(`.pdf-page[data-page="${n}"]`);node.scrollTop=document.getElementById('pdf-pages').offsetTop+frame.offsetTop;node.dispatchEvent(new Event('scroll'));},number);
  await page.waitForFunction(n=>document.getElementById('reader-scroll').dataset.page===String(n)&&document.querySelector(`.pdf-page[data-page="${n}"][data-loaded]`),number);
}
async function chooseCollection(page,id) {
  await page.locator(`[data-collection="${id}"]`).click();
  await page.waitForFunction(id=>document.querySelector(`[data-collection="${id}"]`)?.getAttribute('aria-current')==='page' && document.getElementById('library-view').getAttribute('aria-busy')==='false',String(id));
}
async function zoomTo(page, percent) {
  for(let i=0;i<30;i++) {
    const current=Number(await page.locator('#reader-scroll').getAttribute('data-zoom')); if(current===percent)return;
    await page.locator('#reader-scroll').evaluate((node,p)=>node.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-Math.log(p.target/p.current)/.0015})),{target:percent,current});
    await page.waitForFunction(old=>Number(document.getElementById('reader-scroll').dataset.zoom)!==old&&document.getElementById('pdf-pages').dataset.layout==='ready',current);
  }
  throw new Error('Wheel zoom did not reach target');
}
async function main() {
  let browser, server, child, temp; let logs = '';
  try {
    let port; let invitation = 'I'.repeat(43); let invitationUsed = false;
    const documents = Array.from({ length: 21 }, (_, index) => ({ id: index + 1, title: index === 20 ? '定理 "A" <img src=x onerror=alert(1)>' : index === 0 ? 'Test textbook' : `研究资料 ${index + 1}`, authors: '平台维护的参考资料', subject_ids: [1], file_size: pdf.length, module:'mathematics', language:index === 0 ? 'en' : 'und', directions:['algebra'], file_url:`/api/documents/${index+1}/file` }));
    if (process.env.MATH_BROWSER_MOCK === '1') {
      nativeId = 22; const nativeDocument = {id:nativeId,title:'Native DjVu',authors:'Test',subject_ids:[1],file_size:djvu.length,module:'mathematics',language:'en',directions:['algebra'],format:'djvu',file_url:'/api/documents/22/file'};
      const users = new Map(); const sessions = new Map(); const progress = new Map(); const annotations = new Map(); const selections = new Map(); let annotationId = 0;
      const bookValue = (book,user) => {
        const selected = selections.get(user+':'+book.id), doc = documents.find(doc=>doc.id===selected);
        return {...book,...(doc ? {title:doc.title,authors:doc.authors,source_url:'',available:true,file_url:doc.file_url} : {}),selected_document_id:selected||null,progress:progress.get(user+':doc:'+(selected||1))||null};
      };
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
          if (url.pathname==='/api/library/documents/22' && !documents.some(d=>d.id===22)) documents.push(nativeDocument);
          if(url.pathname==='/api/library/collections')return json({collections:[{id:100,parent_id:null,name:'大学数学基础',count:21},{id:101,parent_id:100,name:'分析',count:1},{id:102,parent_id:101,name:'复分析',count:1},{id:103,parent_id:100,name:'代数',count:21},{id:104,parent_id:100,name:'读书笔记',count:0}],total:documents.length,unfiled:documents.filter(d=>d.id>21).length});
          if (url.pathname==='/api/library/categories') return json({modules:[{slug:'mathematics',name:'数学与应用数学',directions}]});
          if (url.pathname==='/api/library/documents') {const collection=url.searchParams.get('collection')||'', q=url.searchParams.get('q')||'', direction=url.searchParams.get('direction')||'', language=url.searchParams.get('language')||'', offset=Number(url.searchParams.get('offset')||0);return json({documents:documents.filter(d=>(!collection||collection==='100'&&d.id<=21||collection==='103'&&d.id<=21||['101','102'].includes(collection)&&d.id===1||collection==='unfiled'&&d.id>21)&&(!q||d.title.includes(q)||d.authors.includes(q))&&(!direction||d.directions.includes(direction))&&(!language||d.language===language)).slice().reverse().slice(offset,offset+20).map(d=>({...d,progress:progress.get(user+':doc:'+d.id)||null})),limit:20,offset});}
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
          const user = session.user.username; const bookPath = url.pathname.match(/^\/api\/learning\/books\/(\d+)(?:\/(progress|annotations|selection)(?:\/(\d+))?)?$/);
          if (req.method === 'GET') {
            if (url.pathname === '/api/learning/directions') return json({directions});
            if (url.pathname.startsWith('/api/learning/directions/')) { const slug = url.pathname.split('/').pop(); const direction = directions.find(d => d.slug === slug); return direction ? json({...direction,introduction:{research_object:'研究运算规则，以及群、环、域和向量空间等结构中的关系与对称性。',core_content:'线性代数、群论、环与域、表示论、交换代数。',prerequisites:'高中代数、集合与映射、基本证明方法。'},books:mockBooks.filter(b => b.direction === slug).map(b => bookValue(b,user))}) : json({error:'not_found'},404); }
          }
          if (bookPath) {
            const book = mockBooks.find(b => b.id === Number(bookPath[1])); if (!book) return json({error:'not_found'},404);
            const key = user+':doc:'+(selections.get(user+':'+book.id)||1);
            if (req.method === 'GET' && !bookPath[2]) return json(bookValue(book,user));
            if (req.method === 'GET' && bookPath[2] === 'annotations') return json({annotations:annotations.get(key)||[]});
            if (req.headers['x-csrf-token'] !== session.token) return json({error:'invalid_csrf'},403);
            const parts=[];for await(const part of req)parts.push(part);const raw=Buffer.concat(parts).toString();const body=raw?JSON.parse(raw):{};
            if (req.method === 'PUT' && bookPath[2] === 'selection') {
              if(body.document_id==null)selections.delete(user+':'+book.id);
              else {const doc=documents.find(d=>d.id===body.document_id);if(!doc)return json({error:'not_found'},404);if(!doc.directions.includes(book.direction)||(doc.language!=='und'&&doc.language!==(book.language||'en')))return json({error:'document_direction_mismatch'},400);selections.set(user+':'+book.id,doc.id);}
              return json(bookValue(book,user));
            }
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
        if (/^\/api\/documents\/\d+\/file$/.test(url.pathname)) { const native = Number(url.pathname.split('/')[3])===nativeId; res.writeHead(200, { 'Content-Type': native?'image/vnd.djvu':'application/pdf' }); return res.end(native?djvu:pdf); }
        const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/learning.js': ['learning.js', 'text/javascript'], '/library.js':['library.js','text/javascript'], '/reader.js': ['reader.js', 'text/javascript'], '/reader-ai.js': ['reader-ai.js', 'text/javascript'], '/richtext.js':['richtext.js','text/javascript'], '/vendor/marked/marked.esm.js':['vendor/marked/marked.esm.js','text/javascript'], '/vendor/dompurify/purify.es.mjs':['vendor/dompurify/purify.es.mjs','text/javascript'], '/vendor/katex/katex.mjs':['vendor/katex/katex.mjs','text/javascript'], '/vendor/katex/katex.min.css':['vendor/katex/katex.min.css','text/css'], '/style.css': ['style.css', 'text/css'] };
        for (const name of ['reader-djvu.js','vendor/djvu/djvu.js','icons.js', 'vendor/morphicons/dom.js', 'vendor/morphicons/spring-CFHloqPP.js', 'vendor/morphicons/normalize-CYnN3Npw.js']) assets['/' + name] = [name, 'text/javascript'];
        if (/^\/vendor\/pdfjs\/(pdf(?:\.worker)?\.mjs|text_layer\.css|cmaps\/[A-Za-z0-9_-]+\.bcmap|standard_fonts\/[A-Za-z0-9_-]+\.(?:pfb|ttf))$/.test(url.pathname)) assets[url.pathname] = [url.pathname.slice(1), url.pathname.endsWith('.mjs')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'application/octet-stream'];
        if (/^\/vendor\/katex\/fonts\/[A-Za-z0-9_-]+\.woff2$/.test(url.pathname)) assets[url.pathname]=[url.pathname.slice(1),'font/woff2'];
        const asset = assets[url.pathname]; if (!asset) return json({ error: 'not_found' }, 404);
        res.writeHead(200, { 'Content-Type': asset[1], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; worker-src 'self'; object-src 'none'" }); res.end(fs.readFileSync(path.join(frontend, asset[0])));
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
      const collections=spawnSync('python3',['-c',`import sqlite3,json;db=sqlite3.connect('data/math.db');rows=[(100,None,'大学数学基础'),(101,100,'分析'),(102,101,'复分析'),(103,100,'代数'),(104,100,'读书笔记')];db.executemany('INSERT INTO library_collections(id,parent_id,name,source,path_key,sort_order) VALUES(?,?,?,?,?,?)',[(i,parent,name,'browser.rdf',str(i),i) for i,parent,name in rows]);db.executemany('INSERT INTO document_collections VALUES(?,?)',[(1,102),(1,103)]);db.commit();db.close()`],{cwd:temp,encoding:'utf8'});assert.equal(collections.status,0,collections.stderr);
      const linked = spawnSync('python3', [path.join(repo, 'backend/admin/link_textbook.py'),'7',String(JSON.parse(imported.stdout).id)],{cwd:temp,encoding:'utf8'});assert.equal(linked.status,0,linked.stderr);
    }
    assert.equal((await fetch(base + '/api/documents', { method: 'POST', body: pdf })).status, 405);
    const options = { headless: true }; if (process.env.MATH_BROWSER_EXECUTABLE) options.executablePath = process.env.MATH_BROWSER_EXECUTABLE;
    browser = await chromium.launch(options);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const chatCalls=[]; let aiConfig={source:'default',enabled:true,custom:{base_url:'',model:'',enabled:false,available:false,has_key:false,daily_limit:50},default:{model:'Platform math',enabled:true,available:true,has_key:true,daily_limit:50}};
    await page.route('**/api/ai/**',async route=>{
      const req=route.request(),path=new URL(req.url()).pathname;let body;
      if(path==='/api/ai/chat'){body=req.postDataJSON();chatCalls.push(body);return route.fulfill({contentType:'application/json',body:JSON.stringify({reply:String.raw`## 基于选段
**先明确概念**，再检查推导。行内公式 $x^2+y^2=z^2$。

$$\int_0^1 x^2\,dx=\frac{1}{3}$$

另一种公式 \(a_1+a_2\)。

| 项目 | 说明 |
| --- | --- |
| 定义 | 保持准确 |

- 核对假设
- 检查结论

<img src=x onerror=alert(1)><a href="javascript:alert(1)">危险链接</a>`})});}
      if(req.method()==='PUT'){body=req.postDataJSON();aiConfig.source=body.source;aiConfig.custom={...aiConfig.custom,base_url:body.base_url,model:body.model,enabled:body.enabled,available:body.enabled,has_key:body.clear_key?false:!!body.api_key||aiConfig.custom.has_key};}
      return route.fulfill({contentType:'application/json',body:JSON.stringify(aiConfig)});
    });
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
    const libraryIcon = page.locator('#library-link [data-icon]');
    await page.locator('#library-link').hover();
    assert.equal(await libraryIcon.getAttribute('data-icon'),'book');
    const duringMorph = await libraryIcon.locator('path').getAttribute('d');
    await page.waitForFunction(previous=>document.querySelector('#library-link path').getAttribute('d')!==previous,duringMorph);
    await page.locator('#home-view h1').hover(); assert.equal(await libraryIcon.getAttribute('data-icon'),'workspace');

    const mathCases = await page.evaluate(async () => {
      const {renderAnswer}=await import('/richtext.js');
      const inputs=[
        String.raw`行内 $x_n^2$ 与 \(\frac{1}{2}\)`,
        String.raw`\[\sum_{n=1}^{\infty}\frac1{n^2}\]`,
        String.raw`\begin{align}x&=1\\y&=2\end{align}`,
        '```latex\n\\frac{S_n}{n}=\\frac12+\\frac{3}{2n}\n```',
        String.raw`| 公式 | 含义 |
| --- | --- |
| $\left|x\right|$ | 绝对值 |`,
        '[\n\\frac{S_n}{n}\n\\approx\n\\frac{3+(n-3)/2}{n}\n\\frac12+\\frac{3}{2n}.\n]',
        '`$x$`\n\n```js\nconst cost = "$5";\n```\n\n[普通文字]\n\n\\$5'
      ];
      inputs.push(inputs[5].replaceAll('\n', '\r\n'));
      return inputs.map(text=>{const node=renderAnswer(text);return {formulas:node.querySelectorAll('.katex').length,errors:node.querySelectorAll('.katex-error').length,cells:node.querySelectorAll('td').length,code:node.querySelectorAll('code').length,text:node.textContent};});
    });
    assert.deepEqual(mathCases.map(row=>row.formulas),[2,1,1,1,1,1,0,1]);
    assert.ok(mathCases.every(row=>row.errors===0));assert.equal(mathCases[4].cells,2);
    assert.equal(mathCases[6].code,2);assert.match(mathCases[6].text,/\[普通文字\]/);
    await page.screenshot({ path: path.join(shots, 'home-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'home-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.locator('.application-card[href="#/apps/mathematics"]').click();
    await page.screenshot({ path: path.join(shots, 'module-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'module-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 568 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('[data-direction="analysis"]').click();
    await page.locator('.analysis-roadmap svg').waitFor();
    assert.equal(await page.locator('.analysis-course').count(),7);
    assert.equal(await page.locator('.analysis-textbooks .textbook-stage:visible').count(),7);
    assert.equal(await page.locator('.course-book-preview:visible').count(),6);
    assert.equal(await page.locator('.textbook-stage:not(.course-collapsed)').count(),1);
    assert.equal(await page.locator('.textbook-stage:not(.course-collapsed)').getAttribute('data-stage'),'数学分析');
    assert.equal(await page.locator('.textbook-stage:not(.course-collapsed) .textbook-row').count(),2);
    await page.locator('.analysis-course[data-course="复分析"]').click();
    assert.equal(await page.locator('.textbook-stage:not(.course-collapsed)').getAttribute('data-stage'),'复分析');
    assert.equal(await page.locator('.analysis-course[data-course="复分析"]').getAttribute('aria-pressed'),'true');
    await page.locator('.analysis-course[data-course="泛函分析"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('.textbook-stage:not(.course-collapsed)').getAttribute('data-stage'),'泛函分析');
    await page.locator('.course-heading-button').filter({hasText:'高等代数'}).click();
    assert.equal(await page.locator('.textbook-stage:not(.course-collapsed)').getAttribute('data-stage'),'高等代数');
    await page.locator('.analysis-course[data-course="数学分析"]').click();

    assert.equal(await page.locator('.analysis-roadmap path[stroke-dasharray]').count(),1);
    assert.match(await page.locator('.analysis-roadmap svg').getAttribute('aria-label'),/实分析与测度论.*泛函分析/);
    await page.screenshot({path:path.join(shots,'analysis-roadmap.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(shots,'analysis-roadmap-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1100});
    await page.locator('.direction-heading .back-link').click();
    await page.locator('[data-direction="algebra"]').click(); await page.locator('.textbook-row').first().waitFor();
    assert.equal(await page.locator('#direction-introduction dt').count(),3); assert.match(await page.locator('#direction-introduction').textContent(),/研究对象.*核心内容.*需要基础/); assert.equal(await page.locator('#direction-questions').count(),0);
    assert.equal(await page.locator('.textbook-row').count(),6); assert.equal(await page.locator('.textbook-stage').count(),3); for(const stage of ['基础入门','核心理论','进阶学习']) for(const language of ['zh','en']) assert.equal(await page.locator(`.textbook-stage[data-stage="${stage}"] .recommendation-language[data-language="${language}"] .textbook-row`).count(),1);
    assert.equal(await page.locator('[data-book="7"]').textContent(),'开始学习');
    assert.equal(await page.locator('input[type=file],#upload-form').count(),0);
    await page.setViewportSize({width:1366,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
    await page.screenshot({ path: path.join(shots, 'direction-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(shots, 'direction-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const choiceRow = page.locator('[data-recommendation="8"]');
    await choiceRow.locator('.book-library-choice').click();
    await choiceRow.locator('.book-picker input').fill('Test textbook'); await choiceRow.locator('.book-picker-search button').click();
    await choiceRow.locator('.book-picker-select option[value="1"]').waitFor({state:'attached'});
    await page.screenshot({path:path.join(shots,'textbook-picker-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(shots,'textbook-picker-mobile.png'),fullPage:true}); await page.setViewportSize({width:1440,height:1100});
    await choiceRow.locator('.book-picker-select').selectOption('1'); await choiceRow.locator('h3').filter({hasText:'Test textbook'}).waitFor();
    assert.match(page.url(),/directions\/algebra$/); assert.equal(await choiceRow.locator('[data-book="8"]').textContent(),'开始学习');
    await page.reload(); await choiceRow.locator('h3').filter({hasText:'Test textbook'}).waitFor();
    await choiceRow.locator('[data-book="8"]').click(); await page.waitForFunction(()=>document.querySelector('.pdf-page[data-loaded]'));
    await readerControl(page, 'reader-back'); await choiceRow.locator('.book-restore').click(); await choiceRow.locator('h3').filter({hasText:'Abstract Algebra'}).waitFor();
    assert.equal(await choiceRow.locator('.book-unavailable').textContent(),'文档待接入');
    await page.locator('[data-book="7"]').click();
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"] .textLayer span')?.textContent.includes('Mathematics'));
    assert.equal(await page.locator('#reader-scroll').getAttribute('data-total-pages'),'12');
    assert.equal(await page.locator('.pdf-page').count(),12);
    assert.equal(await page.locator('#reader-notes').isVisible(),true); assert.equal(await page.locator('#reader-outline').isVisible(),false); assert.equal(await page.locator('#reader-outline-toggle').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('.topbar').isVisible(),false);
    assert.equal(await page.locator('#reader-heading').isVisible(),true);
    assert.equal(await page.locator('#reader-tools-toggle').count(),0);
    assert.equal(await page.locator('.reader-note-pane h2').count(),0);
    const header=await page.locator('#reader-heading').boundingBox(), notes=await page.locator('#reader-notes').boundingBox(), pdfArea=await page.locator('#reader-scroll').boundingBox();
    assert.equal(header.y,0);assert.ok(Math.abs(header.x+header.width-notes.x-notes.width)<1);
    const bottom=await page.locator('#reader-bottom-bar').boundingBox();
    assert.equal(bottom.height,8);assert.ok(header.height>=54 && header.height<=60);
    assert.ok(Math.abs(bottom.x-header.x)<1 && Math.abs(bottom.width-header.width)<1);

    assert.ok(Math.abs(pdfArea.y-header.height)<1 && Math.abs(notes.y-header.height)<1);
    await page.evaluate(() => {const area=document.getElementById('reader-scroll'),stack=document.getElementById('pdf-pages'),next=document.querySelector('.pdf-page[data-page="2"]');area.scrollTop=stack.offsetTop+next.offsetTop+120;});
    await page.waitForFunction(() => document.getElementById('reader-scroll').dataset.page==='2' && document.querySelector('.pdf-page[data-page="2"][data-loaded]'));
    assert.equal(await page.locator('.reader-toolbar,#reader-page,#reader-zoom,#reader-notes-toggle').count(),0); assert.deepEqual(await page.locator('.reader-heading-actions button').allTextContents(),['目录','适合宽度','全屏']); await scrollToPage(page,1); await page.waitForFunction(() => document.getElementById('reader-scroll').dataset.page==='1');
    await scrollToPage(page,10);
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="10"] .textLayer span')?.textContent==='Mathematics 10');
    assert.ok(await page.locator('.pdf-page[data-loaded]').count()<=8);
    assert.equal(await page.locator('.pdf-page[data-page="1"] canvas').evaluate(canvas=>canvas.width),0);
    await scrollToPage(page,1);
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"][data-loaded]'));
    await page.evaluate(() => {const area=document.getElementById('reader-scroll'),next=document.querySelector('.pdf-page[data-page="2"]');area.scrollTop=document.getElementById('pdf-pages').offsetTop+next.offsetTop-area.clientHeight*.4;});
    await page.screenshot({path:path.join(shots,'reader-continuous.png'),fullPage:true});
    await scrollToPage(page,1);
    await page.waitForFunction(() => document.getElementById('reader-scroll').scrollTop<30);
    assert.ok(await page.locator('#reader-scroll').evaluate(node=>node.clientHeight/innerHeight)>.8);
    await readerControl(page, 'reader-fullscreen'); await page.waitForFunction(()=>!!document.fullscreenElement);
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await readerControl(page, 'reader-fullscreen'); await page.waitForFunction(()=>!document.fullscreenElement);
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.waitForFunction(()=>!!document.querySelector('.pdf-page[data-page="1"][data-loaded]'));

    await page.locator('.pdf-page[data-page="1"] .textLayer span').first().waitFor({state:'attached'});
    await page.evaluate(() => {const span=document.querySelector('.pdf-page[data-page="1"] .textLayer span');const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    await page.locator('#selection-tools').waitFor();
    await assertTransparentSelection(page,'.pdf-page[data-page="1"] .textLayer span');
    await page.locator('.pdf-page[data-page="1"]').screenshot({path:path.join(shots,'pdf-text-selection.png')});
    await page.locator('#reader-ask-ai').click();
    assert.equal(await page.locator('#ai-context').isVisible(),true); assert.match(await page.locator('#ai-context-quote').textContent(),/Mathematics/);
    const naturalWrap=await page.evaluate(()=>['selection-quote','ai-context-quote'].map(id=>{const node=document.getElementById(id),original=node.textContent;node.textContent='measure\nintegral';const range=document.createRange();range.selectNodeContents(node);const lines=range.getClientRects().length;node.textContent=original;return lines===1;})); assert.ok(naturalWrap.every(Boolean));

    await page.locator('#ai-question').fill('解释这个选段 <img src=x onerror=alert(1)>'); await page.locator('#ai-send').click();
    assert.equal(await page.locator('#ai-context').isVisible(),false); assert.equal(await page.locator('#selection-tools').isVisible(),false);
    await page.locator('.ai-assistant').waitFor(); assert.match(await page.locator('.ai-assistant').textContent(),/基于选段/); assert.equal(await page.locator('#ai-messages img').count(),0); assert.ok(await page.locator('.ai-assistant .katex').count()>=3); assert.ok(await page.locator('.ai-assistant .katex-display').count()>0); assert.equal(await page.locator('.ai-assistant table').count(),1); assert.equal(await page.locator('.ai-assistant strong').count(),1); assert.equal(await page.locator('.ai-assistant a[href^="javascript:"]').count(),0);
    assert.equal(chatCalls.at(-1).context.document_id,1); assert.equal(chatCalls.at(-1).context.page,1); assert.match(chatCalls.at(-1).context.quote,/Mathematics/);
    assert.equal(chatCalls.at(-1).source,'default'); assert.equal(chatCalls.at(-1).api_key,undefined);
    const compose = await page.evaluate(()=>{const a=document.getElementById('reader-ask-ai'),b=document.getElementById('ai-send');return {same:a.parentElement===b.parentElement,left:Math.abs(a.getBoundingClientRect().left-b.getBoundingClientRect().left)<1 && b.getBoundingClientRect().top-a.getBoundingClientRect().bottom<=3};}); assert.equal(compose.same,true);assert.equal(compose.left,true);
    assert.ok(await page.locator('#reader-scroll').evaluate(node=>Math.abs(node.getBoundingClientRect().bottom-document.getElementById('reader-bottom-bar').getBoundingClientRect().top)<1));
    const readerChrome=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect(),ask=rect('reader-ask-ai'),input=rect('ai-question'),source=rect('ai-source'),title=document.querySelector('.reader-ai-pane h2').getBoundingClientRect();return {top:Math.abs(rect('reader-notes').top-rect('reader-heading').bottom),sameLine:Math.abs(source.top+source.height/2-title.top-title.height/2),gap:ask.left-input.right,askColor:getComputedStyle(document.getElementById('reader-ask-ai')).backgroundColor};});
    assert.ok(readerChrome.top<1 && readerChrome.sameLine<2 && readerChrome.gap>=0 && readerChrome.gap<=13); assert.notEqual(readerChrome.askColor,'rgb(52, 88, 212)');
    const beforeVertical=await page.locator('.reader-note-pane').evaluate(node=>node.clientHeight); const split=await page.locator('#reader-ai-resize').boundingBox();
    await page.mouse.move(split.x+split.width/2,split.y+5);await page.mouse.down();await page.mouse.move(split.x+split.width/2,split.y+75,{steps:6});await page.mouse.up();
    assert.ok(await page.locator('.reader-note-pane').evaluate(node=>node.clientHeight)>beforeVertical+50);
    await page.locator('#reader-ai-resize').focus();await page.keyboard.press('ArrowUp');assert.ok(await page.locator('.reader-note-pane').evaluate(node=>node.clientHeight)>beforeVertical+10);
    const sizes=await page.evaluate(()=>['ai-question','ai-status','ai-provider-label','reader-ask-ai'].map(id=>parseFloat(getComputedStyle(document.getElementById(id)).fontSize)));assert.ok(sizes.every(size=>size>=14));
    const panes=await page.evaluate(()=>{const a=document.querySelector('.reader-note-pane').getBoundingClientRect(),b=document.querySelector('.reader-ai-pane').getBoundingClientRect();return {above:a.bottom<=b.top+1,sameWidth:Math.abs(a.width-b.width)<1};}); assert.equal(panes.above,true); assert.equal(panes.sameWidth,true);
    await page.locator('#ai-settings-toggle').click(); await page.locator('#ai-base-url').fill('https://api.example.com/v1'); await page.locator('#ai-model').fill('math-model'); await page.locator('#ai-api-key').fill('personal-secret'); await page.locator('#ai-settings-save').click();
    await page.waitForFunction(()=>document.getElementById('ai-status').textContent.includes('设置已保存'));
    assert.equal(await page.locator('#ai-api-key').inputValue(),''); assert.equal(await page.locator('#ai-source').inputValue(),'custom');
    await page.locator('#ai-settings-toggle').click(); assert.equal(await page.locator('#ai-context').isVisible(),false); await page.locator('#ai-question').fill('继续解释'); await page.locator('#ai-send').click();
    await page.waitForFunction(()=>document.querySelectorAll('.ai-assistant').length===2); assert.equal(chatCalls.at(-1).source,'custom'); assert.equal(chatCalls.at(-1).context,null);
    await page.screenshot({path:path.join(frontend,'tests/artifacts/reader-ai.png'),fullPage:true});
    await page.locator('#ai-source').selectOption('default'); await page.waitForFunction(()=>document.getElementById('ai-status').textContent.includes('设置已保存'));
    // API settings and pane changes can trigger PDF reflow after the first text span attaches.
    // Select only in a ready layout, and retry if a later reflow clears the native selection.
    await page.waitForFunction(() => {
      if (!document.getElementById('selection-tools').hidden) return true;
      if (document.getElementById('pdf-pages').dataset.layout !== 'ready') return false;
      const span=document.querySelector('.pdf-page[data-page="1"] .textLayer span');
      if (!span) return false;
      const range=document.createRange();range.selectNodeContents(span);
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      return false;
    });
    await page.locator('#selection-tools').waitFor(); await page.locator('[data-highlight="yellow"]').click();
    await page.locator('.annotation-item').waitFor(); assert.ok(await page.locator('.pdf-highlight').count()>0);
    const noteText='My proof <img src=x onerror=alert(1)>';
    assert.equal(await page.locator('.annotation-summary').textContent(),'1');
    await page.locator('.annotation-summary').click(); assert.equal(await page.locator('.annotation-note').isVisible(),false); await page.locator('.annotation-summary').click();
    await page.locator('.annotation-note').fill(noteText); await page.locator('.annotation-actions .button').click();
    await page.waitForFunction(() => document.getElementById('reader-status').textContent==='笔记已保存');
    assert.equal(await page.locator('.annotation-item').evaluate(node=>!node.hidden),false); await page.locator('.annotation-summary').click(); assert.equal(await page.locator('.annotation-note').isVisible(),true);
    const newQuote=await page.evaluate(() => {const spans=document.querySelectorAll('.pdf-page[data-page="1"] .textLayer span'),span=spans[spans.length-1];const range=document.createRange();range.selectNodeContents(span);const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);return span.textContent;});
    await page.locator('#selection-tools').waitFor(); assert.equal(await page.locator('#selection-quote').textContent(),newQuote); assert.equal(await page.locator('.annotation-note').isVisible(),false);
    await page.locator('#reader-ask-ai').click(); assert.equal(await page.locator('#ai-context-quote').textContent(),newQuote);
    await page.locator('.pdf-page[data-page="1"] .textLayer span').first().waitFor({state:'attached'});
    await page.evaluate(() => {const span=document.querySelector('.pdf-page[data-page="1"] .textLayer span');const range=document.createRange();range.selectNodeContents(span);const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);});
    await page.waitForFunction(()=>document.getElementById('selection-quote').textContent==='Mathematics 1'); assert.equal(await page.locator('#ai-context-quote').textContent(),'Mathematics 1');
    await page.locator('[data-highlight="blue"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.annotation-summary').length===2);
    assert.deepEqual(await page.locator('.annotation-summary').allTextContents(),['1','2']);
    const numbered=await page.locator('.annotation-summary').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top)); assert.ok(Math.abs(numbered[0]-numbered[1])<1);
    await page.locator('.annotation-note').nth(1).fill('Unsaved second note'); await page.locator('.annotation-summary').first().click();
    assert.equal(await page.locator('.annotation-note').first().isVisible(),true); assert.equal(await page.locator('.annotation-note').nth(1).isVisible(),false);
    await page.locator('.annotation-summary').nth(1).click(); assert.equal(await page.locator('.annotation-note').nth(1).inputValue(),'Unsaved second note');
    await page.screenshot({path:path.join(shots,'reader-numbered-notes.png'),fullPage:true});
    await page.locator('.annotation-delete').nth(1).click(); await page.waitForFunction(()=>document.querySelectorAll('.annotation-summary').length===1);
    await readerControl(page, 'reader-outline-toggle'); await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const dimensions=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect();return {outline:rect('reader-outline').width,notes:rect('reader-notes').width,pdf:rect('reader-scroll').width};});
    const handle=await page.locator('#reader-outline-resize').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+100);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+70,handle.y+100,{steps:6});
    assert.ok(await page.locator('#reader-outline').evaluate(node=>node.clientWidth)>dimensions.outline+50);
    assert.ok(await page.locator('.pdf-page[data-page="1"]').evaluate(node=>node.clientWidth)<dimensions.pdf-50);
    await page.mouse.up();await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    assert.equal(await page.locator('#reader-scroll').getAttribute('data-page'),'1');assert.ok(await page.locator('.pdf-highlight').count()>0);
    const notesHandle=await page.locator('#reader-notes-resize').boundingBox();
    await page.mouse.move(notesHandle.x+notesHandle.width/2,notesHandle.y+100);await page.mouse.down();await page.mouse.move(notesHandle.x+notesHandle.width/2-60,notesHandle.y+100,{steps:6});await page.mouse.up();
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');assert.ok(await page.locator('#reader-notes').evaluate(node=>node.clientWidth)>dimensions.notes+40);
    await page.locator('#reader-outline-resize').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const threeColumns=await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();return {left:r('reader-outline').right,pdfLeft:r('reader-scroll').left,pdfRight:r('reader-scroll').right,right:r('reader-notes').left};});
    assert.ok(threeColumns.left<=threeColumns.pdfLeft && threeColumns.pdfRight<=threeColumns.right);
    await page.screenshot({path:path.join(shots,'reader-resizable.png'),fullPage:true});

    await zoomTo(page,137);
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const point=await page.locator('.pdf-page[data-page="1"]').evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.left+Math.min(150,r.width*.4),y:r.top+150};});
    const fraction=await page.locator('.pdf-page[data-page="1"]').evaluate((node,p)=>{const r=node.getBoundingClientRect();return {x:(p.x-r.left)/r.width,y:(p.y-r.top)/r.height};},point);
    await page.mouse.move(point.x,point.y);await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');
    await page.waitForFunction(()=>Number(document.getElementById('reader-scroll').dataset.zoom)>137 && document.getElementById('pdf-pages').dataset.layout==='ready');
    const scaledFraction=await page.locator('.pdf-page[data-page="1"]').evaluate((node,p)=>{const r=node.getBoundingClientRect();return {x:(p.x-r.left)/r.width,y:(p.y-r.top)/r.height};},point);
    assert.ok(Math.abs(fraction.x-scaledFraction.x)<.02 && Math.abs(fraction.y-scaledFraction.y)<.02,JSON.stringify({fraction,scaledFraction}));
    for (const percent of [400,25]) {await zoomTo(page,percent);await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');}
    await readerControl(page, 'reader-fit-width');assert.equal(await page.locator('#reader-scroll').getAttribute('data-zoom'),'100');
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await zoomTo(page,137);
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"][data-loaded]'));
    assert.ok(await page.locator('.pdf-highlight').count()>0);
    await page.screenshot({path:path.join(shots,'reader-desktop.png'),fullPage:true});
    assert.equal(await page.locator('#reader-notes-close').count(),0);
    await page.locator('.pdf-page[data-page="1"] .textLayer span').first().waitFor({state:'attached'});
    await page.evaluate(() => {const span=document.querySelector('.pdf-page[data-page="1"] .textLayer span');const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    await page.locator('#selection-tools').waitFor();await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    assert.equal(await page.locator('#reader-notes').isVisible(),true);assert.ok(await page.locator('#selection-quote').textContent());
    await page.evaluate(()=>window.getSelection().removeAllRanges());

    await page.locator('.outline-entry').last().click();
    await page.waitForFunction(()=>document.getElementById('reader-scroll').dataset.page==='2' && document.getElementById('pdf-pages').dataset.layout==='ready');
    await page.evaluate(()=>{const scroll=document.getElementById('reader-scroll'),frame=document.querySelector('.pdf-page[data-page="2"]');scroll.scrollTop=document.getElementById('pdf-pages').offsetTop+frame.offsetTop+frame.clientHeight*.35;});
    const beforeDrag=await page.evaluate(()=>{const area=document.getElementById('reader-scroll'),frame=document.querySelector('.pdf-page[data-page="2"]');return (area.scrollTop-document.getElementById('pdf-pages').offsetTop-frame.offsetTop)/frame.clientHeight;});
    const boundary=await page.locator('#reader-notes-resize').boundingBox();await page.mouse.move(boundary.x+3,boundary.y+80);await page.mouse.down();await page.mouse.move(boundary.x+43,boundary.y+80,{steps:5});await page.mouse.up();
    await page.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready');
    const afterDrag=await page.evaluate(()=>{const area=document.getElementById('reader-scroll'),frame=document.querySelector('.pdf-page[data-page="2"]');return (area.scrollTop-document.getElementById('pdf-pages').offsetTop-frame.offsetTop)/frame.clientHeight;});
    assert.equal(await page.locator('#reader-scroll').getAttribute('data-page'),'2');assert.ok(Math.abs(beforeDrag-afterDrag)<.02);

    await page.waitForFunction(() => document.getElementById('reader-scroll').dataset.page==='2');
    await page.waitForFunction(async () => (await (await fetch('/api/learning/books/7')).json()).progress?.page===2);
    const preferredNotesWidth=await page.locator('#reader-notes').evaluate(node=>node.clientWidth); await page.reload(); await page.waitForFunction(() => document.getElementById('reader-scroll').dataset.page==='2' && document.querySelector('.pdf-page[data-page="2"] .textLayer span')?.textContent==='Mathematics 2');
    assert.ok(Math.abs(await page.locator('#reader-notes').evaluate(node=>node.clientWidth)-preferredNotesWidth)<2); assert.ok(Number(await page.locator('#reader-ai-resize').getAttribute('aria-valuenow'))>35); assert.equal(await page.locator('.annotation-note').inputValue(),noteText);assert.equal(await page.locator('#annotation-list img').count(),0);
    const secondContext=await browser.newContext({viewport:{width:390,height:844}});const second=await secondContext.newPage();
    await second.goto(base+'/#/apps/mathematics/read/7');await second.waitForFunction(()=>location.hash==='#/login');
    await second.locator('#account-username').fill('browser_reader');await second.locator('#account-password').fill('BrowserPass123!');await second.locator('#account-submit').click();
    await second.waitForFunction(()=>document.getElementById('reader-scroll').dataset.page==='2' && document.querySelector('.pdf-page[data-page="2"] .textLayer span')?.textContent==='Mathematics 2');
    assert.equal(await second.locator('#reader-scroll').getAttribute('data-zoom'),'137'); await scrollToPage(second,12);
    await second.waitForFunction(()=>document.getElementById('reader-scroll').dataset.page==='12' && document.querySelector('.pdf-page[data-page="12"][data-loaded]'));
    await scrollToPage(second,2);
    await second.waitForFunction(()=>document.getElementById('reader-scroll').dataset.page==='2');
    assert.equal(await second.locator('.annotation-note').inputValue(),noteText);
    assert.equal(await second.locator('.annotation-item').evaluate(node=>!node.hidden),false); await second.locator('.annotation-summary').click();
    await second.locator('.annotation-jump').click();await second.waitForFunction(()=>document.getElementById('reader-scroll').dataset.page==='1' && document.querySelector('.pdf-highlight'));
    await second.waitForFunction(()=>document.getElementById('pdf-pages').dataset.layout==='ready'); assert.equal(await second.locator('#reader-scroll').getAttribute('data-page'),'1'); await second.screenshot({path:path.join(shots,'reader-mobile.png'),fullPage:true});
    await second.setViewportSize({width:320,height:568});assert.equal(await second.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await second.locator('.annotation-delete').click();await second.waitForFunction(()=>!document.querySelector('.annotation-item'));
    await secondContext.close();
    await readerControl(page, 'reader-back');await page.locator('[data-book="7"]').waitFor();assert.match(await page.locator('[data-book="7"]').textContent(),/继续学习/);
    await page.reload(); await page.waitForFunction(() => document.getElementById('account-name').textContent === 'browser_reader');
    await page.locator('#library-link').click(); await page.locator('#library-view').waitFor(); await page.locator('.library-document').first().waitFor();
    assert.equal(await page.locator('#library-documents img').count(),0);
    await page.screenshot({path:path.join(shots,'library-collections-desktop.png'),fullPage:true});
    await page.locator('[aria-controls="library-folder-101"]').click();await chooseCollection(page,'102');await page.locator('[data-document="1"]').waitFor();
    assert.equal(await page.locator('.library-document').count(),1);assert.match(await page.locator('#library-breadcrumbs').textContent(),/大学数学基础.*分析.*复分析/);assert.equal(await page.locator('[data-collection="102"]').getAttribute('aria-current'),'page');
    await chooseCollection(page,'104');await page.waitForFunction(()=>document.getElementById('library-status').textContent.includes('暂无文献'));assert.equal(await page.locator('.library-document').count(),0);
    await chooseCollection(page,'101');await page.locator('[data-document="1"]').waitFor();assert.equal(await page.locator('.library-document').count(),1);
    await chooseCollection(page,'102');await page.locator('[data-document="1"]').waitFor();

    await page.locator('#library-query').fill('Test textbook'); await page.locator('#library-filter button').click(); await page.locator('[data-document="1"]').waitFor();
    await page.screenshot({path:path.join(shots,'library-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); await page.screenshot({path:path.join(shots,'library-mobile.png'),fullPage:true});await page.locator('#library-folders-toggle').click();assert.equal(await page.locator('#library-folders').isVisible(),true);await page.screenshot({path:path.join(shots,'library-collections-mobile.png'),fullPage:true});await chooseCollection(page,'102');await page.locator('[data-document="1"]').waitFor();assert.equal(await page.locator('#library-folders').isVisible(),false);await page.setViewportSize({width:320,height:844});await page.locator('.library-extra-filters summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('.library-extra-filters summary').click(); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false); await page.setViewportSize({width:1440,height:1100});
    await page.locator('[data-document="1"]').click(); await page.waitForFunction(()=>document.querySelector('.pdf-page[data-loaded]')); assert.match(await page.locator('#reader-back').textContent(),/文档库/);
    await scrollToPage(page,3); await page.waitForFunction(()=>document.getElementById('reader-scroll').dataset.page==='3');
    await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="3"] .textLayer span')?.textContent==='Mathematics 3');
    let libraryProgress;
    for(let attempt=0;attempt<100;attempt++){libraryProgress=(await(await page.request.get(base+'/api/library/documents/1')).json()).progress;if(libraryProgress?.page===3)break;await page.waitForTimeout(100);}
    assert.equal(libraryProgress.page,3); assert.deepEqual((await(await page.request.get(base+'/api/learning/books/7')).json()).progress,libraryProgress);
    await readerControl(page, 'reader-back'); await page.locator('#library-view').waitFor();assert.match(page.url(),/collection=102/);await page.locator('[data-collection="102"]').waitFor(); await page.locator('#math-app-link').click(); await page.locator('[data-direction="algebra"]').click(); await page.locator('[data-book="7"]').waitFor(); assert.match(await page.locator('[data-book="7"]').textContent(),/第 3 页/);
    const noteCsrf=await(await page.request.get(base+'/api/auth/csrf')).json();
    for(let i=1;i<=31;i++){const created=await page.request.post(base+'/api/learning/books/7/annotations',{headers:{[noteCsrf.header]:noteCsrf.token},data:{page:1,quote:`Marker ${i}`,note:`Note ${i}`,color:'blue',rects:[{x:.1,y:.1,width:.1,height:.02}]}});assert.ok(created.ok());assert.ok((await created.json()).id);}
    await page.locator('[data-book="7"]').click();await page.waitForFunction(()=>document.querySelectorAll('.annotation-summary').length===31);
    assert.equal(await page.locator('#reader-outline').isVisible(),false);assert.equal(await page.locator('.annotation-summary:visible').count(),30);
    assert.equal(await page.locator('.annotation-summary').nth(29).evaluate(node=>node.nextElementSibling.className),'annotation-more');
    const foldPosition=await page.locator('.annotation-more').evaluate(node=>{const a=node.previousElementSibling.getBoundingClientRect(),b=node.getBoundingClientRect();return Math.abs(a.top-b.top)<1&&b.left>=a.right;});assert.equal(foldPosition,true);
    await page.locator('.annotation-more').click();assert.equal(await page.locator('.annotation-summary:visible').count(),31);
    await page.locator('.annotation-summary').nth(30).click();assert.equal(await page.locator('.annotation-note').nth(30).isVisible(),true);
    await page.screenshot({path:path.join(shots,'reader-folded-markers.png'),fullPage:true});
    await page.locator('.annotation-more').click();assert.equal(await page.locator('.annotation-summary:visible').count(),30);assert.equal(await page.locator('.annotation-note').nth(30).isVisible(),false);
    await readerControl(page, 'reader-back'); await page.locator('[data-book="7"]').waitFor();
    if(process.env.MATH_BROWSER_MOCK !== '1'){fs.writeFileSync(path.join(temp,'source.djvu'),djvu);const nativeImport=spawnSync('python3',[path.join(repo,'backend/admin/import_document.py'),'source.djvu','--title','Native DjVu','--subject-id','1'],{cwd:temp,encoding:'utf8'});assert.equal(nativeImport.status,0,nativeImport.stderr);nativeId=JSON.parse(nativeImport.stdout).id;}
    await page.goto(base + '/#/library/read/' + nativeId);
    await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="1"][data-loaded] .djvu-text-layer span')?.textContent==='Native DjVu mathematics');
    assert.equal(await page.locator('.pdf-page').count(),3);
    assert.equal(await page.locator('.pdf-page[data-page="1"] canvas').evaluate(c=>c.getContext('2d').getImageData(10,10,1,1).data[3]),255);
    await scrollToPage(page,2); await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="2"] .djvu-text-layer span'));
    await page.evaluate(()=>{const span=document.querySelector('.pdf-page[data-page="2"] .djvu-text-layer span');const range=document.createRange();range.selectNodeContents(span);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
    await page.locator('#selection-tools').waitFor(); assert.equal(await page.locator('#selection-quote').textContent(),'Native DjVu mathematics');
    await assertTransparentSelection(page,'.pdf-page[data-page="2"] .djvu-text-layer span');
    await page.locator('#reader-ask-ai').click();await page.locator('#ai-question').fill('Explain this native DjVu passage');await page.locator('#ai-send').click();await page.locator('.ai-assistant').waitFor();
    assert.equal(chatCalls.at(-1).context.document_id,nativeId);assert.equal(chatCalls.at(-1).context.page,2);assert.equal(chatCalls.at(-1).context.quote,'Native DjVu mathematics');
    await page.evaluate(()=>{const span=document.querySelector('.pdf-page[data-page="2"] .djvu-text-layer span');const range=document.createRange();range.selectNodeContents(span);getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));});await page.locator('#selection-tools').waitFor();
    await page.locator('[data-highlight="yellow"]').click();await page.waitForFunction(()=>document.querySelector('.annotation-summary'));
    await page.locator('.annotation-note').fill('Native note');await page.locator('.annotation-actions button').first().click();
    await zoomTo(page,125);await page.waitForTimeout(650);await page.reload();
    await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="2"][data-loaded]'));
    assert.equal(await page.locator('#reader-scroll').getAttribute('data-zoom'),'125');
    await page.locator('.annotation-summary').click();assert.equal(await page.locator('.annotation-note').inputValue(),'Native note');
    await page.screenshot({path:path.join(shots,'reader-djvu.png'),fullPage:true});
    await readerControl(page,'reader-back'); await page.locator('#library-view').waitFor();
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
