import { createAdminBooks } from './admin-books.js';
import { createOrganizer } from './admin-organizer.js';
import { createAdminLibrary } from './admin-library.js';
const $ = id => document.getElementById(id);
const state = { document: null, documents: [], subjects: [], books: [], docOffset: 0, inviteOffset: 0, query: '', ready: false };
const errors = { invalid_documents: '请选择 1–100 篇有效文献。', document_in_use: '文献被推荐教材使用，请勾选解除推荐教材关联后再删除。', collection_name_exists: '该位置已有同名目录。', invalid_collection_parent: '不能移动到自身或子目录中，目录层级最多 30 层。', file_unavailable: '文献文件路径无效，请检查存储记录。', ai_invalid_url: '请输入公网 HTTPS API 地址。', ai_invalid_settings: '启用默认 API 时，请填写地址、模型和密钥；每日次数为 1–1000。', ai_key_unavailable: '服务器加密密钥不可用，请检查 data/ai-secret.key。', admin_required: '此账号没有管理员权限。', login_required: '请重新登录。', invalid_csrf: '登录状态已更新，请重新提交。', invalid_pdf: '请选择有效的 PDF 文件。', invalid_document: '请选择有效的 PDF 或 DJVU 文件。', request_too_large: '请求被服务器拒绝，请检查服务配置。', invalid_metadata: '标题或作者最多 500 个 UTF-8 字节，且不能包含换行等控制字符。', invalid_subject: '请选择有效的数学分类。', invalid_book: '请检查课程与排序信息。', recommendation_exists: '这本文献已在该课程中。', recommendations_changed: '课程教材已更新，请刷新后重新排序。', not_found: '记录不存在，请检查文献编号。', invitation_unavailable: '邀请码已使用或不存在，无法撤销。', invalid_expiry: '有效天数需为 1–365。', invalid_classification: '请检查模块、方向和语种。', classification_in_use: '此文献已作为推荐教材使用，请保留对应方向和语种。', document_direction_mismatch: '所选文献需属于此研究方向，并与推荐语种一致。', document_required: '新增推荐时，请先选择文献库中的文档。', invalid_source: '教材信息链接应以 http:// 或 https:// 开头。' };
function message(text, error = false) { $('document-editor-status').textContent=$('document-editor').open && error ? text : '';  $('admin-message').textContent = text; $('admin-message').hidden = !text; $('admin-message').classList.toggle('error', error); }
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options }); const body = await response.json();
  if (!response.ok) { if (response.status === 401) location.replace('/#/admin'); const failure=new Error(errors[body.error] || '操作失败，请检查连接后重试。'); failure.code=body.error; throw failure; }
  return body;
}
async function write(path, body, method = 'POST', pdf = false) {
  const csrf = await api('/api/auth/csrf');
  return api(path, { method, headers: { 'Content-Type': pdf ? (/\.djvu?$/i.test(body.name || '') ? 'image/vnd.djvu' : 'application/pdf') : 'application/json', [csrf.header]: csrf.token }, body: pdf ? body : JSON.stringify(body) });
}
async function action(form, work) {
  const fields = [...form.querySelectorAll(form.tagName === 'FORM' ? 'button[type=submit],button:not([type])' : 'button')]; form.setAttribute('aria-busy', 'true'); fields.forEach(field => field.disabled = true); message('正在处理…');
  try { await work(); } catch (error) { message(error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message, true); }
  finally { form.setAttribute('aria-busy', 'false'); fields.forEach(field => field.disabled = false); }
}
function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
function button(text, callback) { const node = element('button', text, 'button compact'); node.type = 'button'; node.addEventListener('click', () => action(node.parentElement, callback)); return node; }
function record(title, lines) { const row = element('article', null, 'admin-record'), detail = element('div'), controls = element('div', null, 'record-actions'); detail.append(element('h3', title)); lines.forEach(line => detail.append(element('p', line))); row.append(detail, controls); return { row, detail, controls }; }
function empty(list, text) { if (!list.children.length) list.append(element('p', text, 'admin-empty')); }
function paging(prefix, offset, count) { $(prefix + '-prev').disabled = offset === 0; $(prefix + '-next').disabled = count < 20; $(prefix + '-page').textContent = `第 ${offset / 20 + 1} 页`; }
function resetDocument() { state.document = null; $('document-form').reset(); if (state.subjects.length) $('subject-options').querySelector('input').checked = true; $('document-language').value = 'und'; for (const input of $('document-directions').querySelectorAll('input')) input.checked = input.value === 'algebra'; $('document-file').required = true; $('document-file-label').hidden = false; $('document-cancel').hidden = true; $('document-form-title').textContent = '导入文献'; $('document-save').textContent = '导入文献'; }
function editDocument(doc) { $('document-editor').showModal();  state.document = doc.id; $('document-module').value = doc.module || 'mathematics'; $('document-language').value = doc.language || 'und'; for (const input of $('document-directions').querySelectorAll('input')) input.checked = (doc.directions || []).includes(input.value); $('document-title').value = doc.title; $('document-authors').value = doc.authors; for (const input of $('subject-options').querySelectorAll('input')) input.checked = doc.subject_ids.includes(Number(input.value)); $('document-file').required = false; $('document-file-label').hidden = true; $('document-cancel').hidden = false; $('document-form-title').textContent = `编辑文献 #${doc.id}`; $('document-save').textContent = '保存信息'; $('document-title').focus(); message(''); }
const adminLibrary=createAdminLibrary({api,write,editDocument,message,paging,onChoose:()=>{state.docOffset=0;loadDocuments().catch(error=>message(error.message,true));},refresh:async()=>{state.docOffset=0;await loadDocuments();}});
createOrganizer({api,write,collection:()=>adminLibrary.collection(),refresh:()=>loadDocuments()});
async function loadDocuments() { state.documents=await adminLibrary.load({offset:state.docOffset,query:state.query})||[]; }
$('document-import').addEventListener('click',()=>{resetDocument();$('document-editor-status').textContent='';$('document-editor').showModal();$('document-title').focus();});
$('document-editor-close').addEventListener('click',()=>{if($('document-form').getAttribute('aria-busy')!=='true')$('document-editor').close();});
$('document-editor').addEventListener('cancel',event=>{if($('document-form').getAttribute('aria-busy')==='true')event.preventDefault();});
const adminBooks=createAdminBooks({api,write,message,directions:()=>state.directions||[]});
const loadBooks=()=>adminBooks.load();
const date = value => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('zh-CN') : '未设置';
async function loadInvitations() {
  const body = await api(`/api/admin/invitations?offset=${state.inviteOffset}`); const list = $('invitation-list'); list.replaceChildren();
  for (const invite of body.invitations) { const status = { active: '可使用', used: '已使用', revoked: '已撤销', expired: '已过期' }[invite.status]; const { row, detail, controls } = record(`邀请码记录 ${invite.id.slice(0, 8)}`, [`创建：${date(invite.created_at)}`, `到期：${date(invite.expires_at)}`, ...(invite.used_by ? [`注册用户：${invite.used_by}`] : [])]); detail.append(element('span', status, `badge${invite.status === 'active' ? '' : ' pending'}`)); if (invite.status === 'active') controls.append(button('撤销', async () => { await write(`/api/admin/invitations/${invite.id}/revoke`, {}); await loadInvitations(); if (state.codeId === invite.id) { $('invitation-code').value = ''; $('created-invitation').hidden = true; } message('邀请码已撤销。'); })); list.append(row); }
  empty(list, '还没有邀请码，请先创建。'); paging('invitations', state.inviteOffset, body.invitations.length);
}
let aiSettings = null;
function showAi(value) {
  aiSettings = value; $('admin-ai-enabled').checked = value.enabled; $('admin-ai-url').value = value.base_url; $('admin-ai-model').value = value.model; $('admin-ai-limit').value = value.daily_limit;
  $('admin-ai-key').value = ''; $('admin-ai-key').placeholder = value.has_key ? '已保存，留空保持原密钥' : '请输入 API 密钥';
  $('admin-ai-key-state').textContent = value.has_key ? '密钥已保存，不回显原文' : '尚未设置密钥'; $('admin-ai-remove').disabled = !value.has_key;
}
async function loadAi() { showAi(await api('/api/admin/ai/settings')); }
$('admin-ai-form').addEventListener('submit', event => { event.preventDefault(); action(event.currentTarget, async () => {
  showAi(await write('/api/admin/ai/settings', { enabled: $('admin-ai-enabled').checked, base_url: $('admin-ai-url').value.trim(), model: $('admin-ai-model').value.trim(), api_key: $('admin-ai-key').value.trim(), daily_limit: Number($('admin-ai-limit').value) }, 'PUT'));
  message('默认 API 设置已保存。');
}); });
$('admin-ai-remove').addEventListener('click', () => action($('admin-ai-form'), async () => {
  if (!aiSettings?.has_key) return;
  showAi(await write('/api/admin/ai/settings', { ...aiSettings, enabled: false, clear_key: true }, 'PUT')); message('默认密钥已删除，默认 API 已停用。');
}));
async function route() {
  if (!state.ready) return; const view = ['books', 'invitations', 'ai'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'documents';
  for (const name of ['documents', 'books', 'invitations', 'ai']) $(name + '-view').hidden = view !== name;
  for (const link of document.querySelectorAll('[data-view]')) { if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
  try { if (view === 'documents') await loadDocuments(); else if (view === 'books') await loadBooks(); else if (view === 'ai') await loadAi(); else await loadInvitations(); } catch (error) { message(error.message, true); }
}
$('document-form').addEventListener('submit', event => { event.preventDefault(); action(event.currentTarget, async () => {
  const title = $('document-title').value.trim(), authors = $('document-authors').value.trim();
  const directions = [...$('document-directions').querySelectorAll('input:checked')].map(input => input.value), language = $('document-language').value, module = $('document-module').value;
  const ids = [...new Set(directions.map(direction => state.subjects.find(subject => subject.slug === direction)?.id || 5))]; if (!ids.length) ids.push(5);
  if (state.document) { await write(`/api/admin/documents/${state.document}`, { title, authors, subject_ids: ids, module, language, directions }, 'PATCH'); await loadDocuments(); resetDocument(); $('document-editor').close(); message('文献信息已保存。'); }
  else { const file = $('document-file').files[0]; if (!file) throw new Error('请选择 PDF 或 DJVU 文件。'); const params = new URLSearchParams({ title, authors, subject_id: ids[0], module, language }); directions.forEach(direction => params.append('directions', direction)); const result = await write('/api/admin/documents?' + params, file, 'POST', true); if(adminLibrary.collection() && adminLibrary.collection()!=='unfiled')await write('/api/admin/documents/move',{document_ids:[result.id],collection_id:Number(adminLibrary.collection())}); state.docOffset = 0; state.query = ''; $('document-query').value = ''; await loadDocuments(); resetDocument(); $('document-editor').close(); message(`文献已导入，编号 #${result.id}。可在推荐教材中关联到课程。`); }
}); });
$('document-cancel').addEventListener('click', resetDocument);
$('document-search').addEventListener('submit', event => { event.preventDefault(); state.docOffset = 0; state.query = $('document-query').value.trim(); action(event.currentTarget, async () => { await loadDocuments(); message(''); }); });
$('invitation-form').addEventListener('submit', event => { event.preventDefault(); action(event.currentTarget, async () => { const body = await write('/api/admin/invitations', { days: Number($('invitation-days').value) }); state.codeId = body.id; $('invitation-code').value = body.code; $('invitation-expiry').textContent = `到期：${date(body.expires_at)}`; $('created-invitation').hidden = false; state.inviteOffset = 0; await loadInvitations(); message('邀请码已生成。'); }); });
$('select-invitation').addEventListener('click', () => { $('invitation-code').focus(); $('invitation-code').select(); });
for (const [prefix, key, load] of [['documents', 'docOffset', loadDocuments], ['invitations', 'inviteOffset', loadInvitations]]) for (const [suffix, delta] of [['prev', -20], ['next', 20]]) $(prefix + '-' + suffix).addEventListener('click', () => { state[key] = Math.max(0, state[key] + delta); load().catch(error => message(error.message, true)); });
$('admin-logout').addEventListener('click', () => action($('admin-logout').parentElement, async () => { await write('/api/auth/logout', {}); location.replace('/#/login'); }));
window.addEventListener('hashchange', route);
async function init() {
  try { const me = await api('/api/auth/me'); if (!me.authenticated) { location.replace('/#/admin'); return; } if (me.user.role !== 'ADMIN') { message('此账号没有管理员权限，请返回应用工作台。', true); return; } $('admin-user').textContent = me.user.username; state.subjects = (await api('/api/subjects')).subjects; for (const subject of state.subjects) { const label = element('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = subject.id; label.append(input, document.createTextNode(subject.name)); $('subject-options').append(label); } const categories = (await api('/api/library/categories')).modules; state.directions = categories.flatMap(module => module.directions); for (const direction of state.directions) { const label = element('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = direction.slug; label.append(input, document.createTextNode(direction.name)); $('document-directions').append(label); } resetDocument(); state.ready = true; $('admin-content').hidden = false; await route(); } catch (error) { message(error.message, true); }
}
init();
