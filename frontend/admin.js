const $ = id => document.getElementById(id);
const state = { document: null, documents: [], subjects: [], books: [], docOffset: 0, inviteOffset: 0, query: '', ready: false };
const errors = { admin_required: '此账号没有管理员权限。', login_required: '请重新登录。', invalid_csrf: '登录状态已更新，请重新提交。', invalid_pdf: '请选择有效的 PDF 文件。', request_too_large: 'PDF 最大 20 MB，文字内容请适当缩短。', invalid_metadata: '标题或作者最多 500 个 UTF-8 字节，且不能包含换行等控制字符。', invalid_subject: '请选择有效的数学分类。', invalid_book: '请检查学习阶段与排序数字。', book_document_locked: '教材已关联 PDF，不能更换，以保护现有阅读进度和标注。', not_found: '记录不存在，请检查文献编号。', invitation_unavailable: '邀请码已使用或不存在，无法撤销。', invalid_expiry: '有效天数需为 1–365。', invalid_classification: '请检查模块、方向和语种。', classification_in_use: '此文献已作为推荐教材使用，请保留对应方向和语种。', document_direction_mismatch: '所选文献需属于此研究方向，并与推荐语种一致。', document_required: '新增推荐时，请先选择文献库中的 PDF。', invalid_source: '教材信息链接应以 http:// 或 https:// 开头。' };
function message(text, error = false) { $('admin-message').textContent = text; $('admin-message').hidden = !text; $('admin-message').classList.toggle('error', error); }
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options }); const body = await response.json();
  if (!response.ok) { if (response.status === 401) location.replace('/#/admin'); throw new Error(errors[body.error] || '操作失败，请检查连接后重试。'); }
  return body;
}
async function write(path, body, method = 'POST', pdf = false) {
  const csrf = await api('/api/auth/csrf');
  return api(path, { method, headers: { 'Content-Type': pdf ? 'application/pdf' : 'application/json', [csrf.header]: csrf.token }, body: pdf ? body : JSON.stringify(body) });
}
async function action(form, work) {
  const fields = [...form.querySelectorAll(form.tagName === 'FORM' ? 'button[type=submit],button:not([type])' : 'button')]; fields.forEach(field => field.disabled = true); message('正在处理…');
  try { await work(); } catch (error) { message(error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message, true); }
  finally { fields.forEach(field => field.disabled = false); }
}
function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
function button(text, callback) { const node = element('button', text, 'button compact'); node.type = 'button'; node.addEventListener('click', () => action(node.parentElement, callback)); return node; }
function record(title, lines) { const row = element('article', null, 'admin-record'), detail = element('div'), controls = element('div', null, 'record-actions'); detail.append(element('h3', title)); lines.forEach(line => detail.append(element('p', line))); row.append(detail, controls); return { row, detail, controls }; }
function empty(list, text) { if (!list.children.length) list.append(element('p', text, 'admin-empty')); }
function paging(prefix, offset, count) { $(prefix + '-prev').disabled = offset === 0; $(prefix + '-next').disabled = count < 20; $(prefix + '-page').textContent = `第 ${offset / 20 + 1} 页`; }
function resetDocument() { state.document = null; $('document-form').reset(); if (state.subjects.length) $('subject-options').querySelector('input').checked = true; $('document-language').value = 'und'; for (const input of $('document-directions').querySelectorAll('input')) input.checked = input.value === 'algebra'; $('document-file').required = true; $('document-file-label').hidden = false; $('document-cancel').hidden = true; $('document-form-title').textContent = '导入文献'; $('document-save').textContent = '导入文献'; }
function editDocument(doc) { state.document = doc.id; $('document-module').value = doc.module || 'mathematics'; $('document-language').value = doc.language || 'und'; for (const input of $('document-directions').querySelectorAll('input')) input.checked = (doc.directions || []).includes(input.value); $('document-title').value = doc.title; $('document-authors').value = doc.authors; for (const input of $('subject-options').querySelectorAll('input')) input.checked = doc.subject_ids.includes(Number(input.value)); $('document-file').required = false; $('document-file-label').hidden = true; $('document-cancel').hidden = false; $('document-form-title').textContent = `编辑文献 #${doc.id}`; $('document-save').textContent = '保存信息'; $('document-title').focus(); message(''); }
async function loadDocuments() {
  const body = await api(`/api/admin/documents?offset=${state.docOffset}&q=${encodeURIComponent(state.query)}`); state.documents = body.documents;
  const list = $('document-list'); list.replaceChildren();
  for (const doc of body.documents) { const names = state.subjects.filter(s => doc.subject_ids.includes(s.id)).map(s => s.name).join('、'); const { row, controls } = record(doc.title, [`文献 #${doc.id} · ${doc.authors || '作者未填写'}`, `${names} · ${(doc.file_size / 1024 / 1024).toFixed(2)} MB`]); const link = element('a', '下载 PDF', 'button compact'); link.href = doc.file_url; link.target = '_blank'; link.rel = 'noopener'; controls.append(link, button('编辑', () => editDocument(doc))); list.append(row); }
  empty(list, state.query ? '没有找到资料，试试其他标题或作者。' : '文献库暂无资料，请从左侧导入 PDF。'); paging('documents', state.docOffset, body.documents.length);
}
let bookDocGeneration = 0;
async function loadBookDocuments(selected = '') {
  const generation = ++bookDocGeneration; const book = state.newBook ? null : state.books.find(book => book.id === Number($('book-select').value));
  const locked = book?.document_id != null;
  $('book-document').disabled = true; $('book-document-query').disabled = locked; $('book-doc-search').disabled = locked;
  const pending = element('option','正在加载文献…'); pending.value = ''; $('book-document').replaceChildren(pending); state.bookDocuments = [];
  $('book-doc-prev').disabled = $('book-doc-next').disabled = true;
  $('book-binding-hint').textContent = locked ? '已关联 PDF，文件保持固定，以保护原有教材阅读记录。' : '仅列出此方向且语种匹配的文献；未标注语种的资料也可选择。';
  if (locked) {
    const doc = await api('/api/documents/' + book.document_id); if (generation !== bookDocGeneration) return;
    const option = element('option', doc.title); option.value = doc.id; $('book-document').replaceChildren(option); $('book-doc-prev').disabled = $('book-doc-next').disabled = true; $('book-doc-page').textContent = '已关联'; return;
  }
  const body = await api('/api/admin/documents?' + new URLSearchParams({ module: 'mathematics', direction: $('book-direction').value, q: $('book-document-query').value.trim(), offset: state.bookDocOffset || 0 })); if (generation !== bookDocGeneration) return;
  const docs = body.documents.filter(doc => !doc.language || doc.language === 'und' || doc.language === $('book-language').value); state.bookDocuments = docs;
  const first = element('option', state.newBook ? '请选择文献' : '暂不关联 PDF'); first.value = ''; $('book-document').replaceChildren(first);
  for (const doc of docs) { const option = element('option', `${doc.language === 'zh' ? '中文' : doc.language === 'en' ? '英文' : '未标语种'} / ${doc.title} / ${doc.authors || '作者未填写'}`); option.value = doc.id; $('book-document').append(option); }
  if (docs.some(doc => doc.id === Number(selected))) $('book-document').value = selected;
  $('book-document').disabled = false;
  $('book-doc-prev').disabled = !state.bookDocOffset; $('book-doc-next').disabled = body.documents.length < 20; $('book-doc-page').textContent = `第 ${(state.bookDocOffset || 0) / 20 + 1} 页`;
  if (!docs.length) $('book-binding-hint').textContent = '此页暂无匹配资料，可翻页、搜索，或先到文献库导入并分类。';
}
async function selectBook(id) {
  state.newBook = false; $('book-select').disabled = false; $('book-editor-title').textContent = '配置推荐教材'; $('book-select').value = String(id);
  const book = state.books.find(book => book.id === Number(id)); if (!book) return;
  $('book-authors').textContent = `${book.direction_name} / ${book.language === 'zh' ? '中文推荐' : '英文推荐'}`; $('book-direction').value = book.direction; $('book-language').value = book.language || 'en'; $('book-title').value = book.title; $('book-author-input').value = book.authors; $('book-source').value = book.source_url || '';
  $('book-stage').value = book.stage; $('book-prerequisites').value = book.prerequisites; $('book-order').value = book.sort_order; $('book-document-query').value = ''; state.bookDocOffset = 0;
  await loadBookDocuments(book.document_id || '');
}
async function loadBooks(selected = $('book-select').value) {
  const body = await api('/api/admin/books'); state.books = body.books; $('book-select').replaceChildren(); $('book-list').replaceChildren();
  for (const book of body.books) { const language = book.language === 'zh' ? '中文' : '英文'; const option = element('option', `${book.direction_name} / ${book.stage} / ${language} / ${book.title}`); option.value = book.id; $('book-select').append(option); const { row, detail, controls } = record(book.title, [`${book.direction_name} / ${book.stage} / ${language}推荐 / 排序 ${book.sort_order}`, book.document_id ? `已关联文献 #${book.document_id}` : 'PDF 尚未接入']); detail.append(element('span', book.document_id ? '可以学习' : '待关联', `badge${book.document_id ? '' : ' pending'}`)); controls.append(button('配置', async () => { await selectBook(book.id); $('book-select').focus(); message(''); })); $('book-list').append(row); }
  if (body.books.length) await selectBook(state.books.some(b => b.id === Number(selected)) ? selected : body.books[0].id);
  empty($('book-list'), '暂时没有教材，可从文献库中新增推荐。');
}
const date = value => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('zh-CN') : '未设置';
async function loadInvitations() {
  const body = await api(`/api/admin/invitations?offset=${state.inviteOffset}`); const list = $('invitation-list'); list.replaceChildren();
  for (const invite of body.invitations) { const status = { active: '可使用', used: '已使用', revoked: '已撤销', expired: '已过期' }[invite.status]; const { row, detail, controls } = record(`邀请码记录 ${invite.id.slice(0, 8)}`, [`创建：${date(invite.created_at)}`, `到期：${date(invite.expires_at)}`, ...(invite.used_by ? [`注册用户：${invite.used_by}`] : [])]); detail.append(element('span', status, `badge${invite.status === 'active' ? '' : ' pending'}`)); if (invite.status === 'active') controls.append(button('撤销', async () => { await write(`/api/admin/invitations/${invite.id}/revoke`, {}); await loadInvitations(); if (state.codeId === invite.id) { $('invitation-code').value = ''; $('created-invitation').hidden = true; } message('邀请码已撤销。'); })); list.append(row); }
  empty(list, '还没有邀请码，请先创建。'); paging('invitations', state.inviteOffset, body.invitations.length);
}
async function route() {
  if (!state.ready) return; const view = ['books', 'invitations'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'documents';
  for (const name of ['documents', 'books', 'invitations']) $(name + '-view').hidden = view !== name;
  for (const link of document.querySelectorAll('[data-view]')) { if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
  try { if (view === 'documents') await loadDocuments(); else if (view === 'books') await loadBooks(); else await loadInvitations(); } catch (error) { message(error.message, true); }
}
$('document-form').addEventListener('submit', event => { event.preventDefault(); action(event.currentTarget, async () => {
  const title = $('document-title').value.trim(), authors = $('document-authors').value.trim();
  const directions = [...$('document-directions').querySelectorAll('input:checked')].map(input => input.value), language = $('document-language').value, module = $('document-module').value;
  const ids = [...new Set(directions.map(direction => state.subjects.find(subject => subject.slug === direction)?.id || 5))]; if (!ids.length) ids.push(5);
  if (state.document) { await write(`/api/admin/documents/${state.document}`, { title, authors, subject_ids: ids, module, language, directions }, 'PATCH'); await loadDocuments(); resetDocument(); message('文献信息已保存。'); }
  else { const file = $('document-file').files[0]; if (!file || file.size > 20 * 1024 * 1024) throw new Error('请选择不超过 20 MB 的 PDF。'); const params = new URLSearchParams({ title, authors, subject_id: ids[0], module, language }); directions.forEach(direction => params.append('directions', direction)); const result = await write('/api/admin/documents?' + params, file, 'POST', true); state.docOffset = 0; state.query = ''; $('document-query').value = ''; await loadDocuments(); resetDocument(); message(`文献已导入，编号 #${result.id}。可在教材配置中选择此文献。`); }
}); });
$('document-cancel').addEventListener('click', resetDocument);
$('document-search').addEventListener('submit', event => { event.preventDefault(); state.docOffset = 0; state.query = $('document-query').value.trim(); action(event.currentTarget, async () => { await loadDocuments(); message(''); }); });
$('book-select').addEventListener('change', () => selectBook($('book-select').value).catch(error => message(error.message, true)));
$('new-book').addEventListener('click', () => action($('new-book').parentElement, async () => {
  state.newBook = true; $('book-select').disabled = true; $('book-editor-title').textContent = '新增推荐教材'; $('book-authors').textContent = '从本方向文献中选择一本，加入中文或英文推荐。'; $('book-title').value = ''; $('book-author-input').value = ''; $('book-source').value = ''; $('book-prerequisites').value = ''; $('book-order').value = '10'; state.bookDocOffset = 0; $('book-document-query').value = ''; message(''); await loadBookDocuments();
}));
for (const id of ['book-direction', 'book-language']) $(id).addEventListener('change', () => { state.bookDocOffset = 0; loadBookDocuments().catch(error => message(error.message, true)); });
$('book-document').addEventListener('change', () => { if (state.newBook) { const doc = state.bookDocuments.find(doc => doc.id === Number($('book-document').value)); if (doc) { $('book-title').value = doc.title; $('book-author-input').value = doc.authors; } } });
$('book-doc-search').addEventListener('click', () => { state.bookDocOffset = 0; loadBookDocuments().catch(error => message(error.message, true)); });
$('book-document-query').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('book-doc-search').click(); } });
for (const [id, delta] of [['book-doc-prev', -20], ['book-doc-next', 20]]) $(id).addEventListener('click', () => { state.bookDocOffset = Math.max(0, (state.bookDocOffset || 0) + delta); loadBookDocuments().catch(error => message(error.message, true)); });
$('book-form').addEventListener('submit', event => { event.preventDefault(); action(event.currentTarget, async () => {
  const id = $('book-select').value, body = { stage: $('book-stage').value, prerequisites: $('book-prerequisites').value, sort_order: Number($('book-order').value), document_id: $('book-document').value ? Number($('book-document').value) : null, direction: $('book-direction').value, language: $('book-language').value, title: $('book-title').value.trim(), authors: $('book-author-input').value.trim(), source_url: $('book-source').value.trim() };
  const result = await write(state.newBook ? '/api/admin/books' : `/api/admin/books/${id}`, body, state.newBook ? 'POST' : 'PUT'); await loadBooks(result.id || id); message('教材配置已保存，学习应用已同步更新。');
}); });
$('invitation-form').addEventListener('submit', event => { event.preventDefault(); action(event.currentTarget, async () => { const body = await write('/api/admin/invitations', { days: Number($('invitation-days').value) }); state.codeId = body.id; $('invitation-code').value = body.code; $('invitation-expiry').textContent = `到期：${date(body.expires_at)}`; $('created-invitation').hidden = false; state.inviteOffset = 0; await loadInvitations(); message('邀请码已生成。'); }); });
$('select-invitation').addEventListener('click', () => { $('invitation-code').focus(); $('invitation-code').select(); });
for (const [prefix, key, load] of [['documents', 'docOffset', loadDocuments], ['invitations', 'inviteOffset', loadInvitations]]) for (const [suffix, delta] of [['prev', -20], ['next', 20]]) $(prefix + '-' + suffix).addEventListener('click', () => { state[key] = Math.max(0, state[key] + delta); load().catch(error => message(error.message, true)); });
$('admin-logout').addEventListener('click', () => action($('admin-logout').parentElement, async () => { await write('/api/auth/logout', {}); location.replace('/#/login'); }));
window.addEventListener('hashchange', route);
async function init() {
  try { const me = await api('/api/auth/me'); if (!me.authenticated) { location.replace('/#/admin'); return; } if (me.user.role !== 'ADMIN') { message('此账号没有管理员权限，请返回应用工作台。', true); return; } $('admin-user').textContent = me.user.username; state.subjects = (await api('/api/subjects')).subjects; for (const subject of state.subjects) { const label = element('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = subject.id; label.append(input, document.createTextNode(subject.name)); $('subject-options').append(label); } const categories = (await api('/api/library/categories')).modules; state.directions = categories.flatMap(module => module.directions); for (const direction of state.directions) { const label = element('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = direction.slug; label.append(input, document.createTextNode(direction.name)); $('document-directions').append(label); const option = element('option', direction.name); option.value = direction.slug; $('book-direction').append(option); } resetDocument(); state.ready = true; $('admin-content').hidden = false; await route(); } catch (error) { message(error.message, true); }
}
init();
