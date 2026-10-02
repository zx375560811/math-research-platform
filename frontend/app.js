import { icon, mountIcons } from './icons.js';
const $ = id => document.getElementById(id);
const state = { subjects: [], subject: null, offset: 0, generation: 0, loading: false, user: null, ready: false, returnTo: '#/apps/mathematics', authBusy: false };
const descriptions = { algebra: '结构、对称与运算', 'number-theory': '整数与算术结构', analysis: '极限、函数与变化', 'geometry-topology': '空间、形状与连续性', other: '更多数学研究方向' };
mountIcons();
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
const accountErrors = { invalid_username: '用户名需为 3–32 位字母、数字或下划线。', invalid_password: '密码至少 12 个字符，最多 72 个 UTF-8 字节。', username_taken: '这个用户名已被使用，请换一个。', invalid_credentials: '用户名或密码不正确。', invalid_csrf: '登录状态已更新，请重新提交。', too_many_attempts: '操作过于频繁，请稍后再试。', login_required: '请先登录。' };
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options }); const body = await response.json();
  if (!response.ok) {
    if (body.error === 'login_required') { state.user = null; accountDisplay(); if (location.hash.startsWith('#/apps/')) { state.returnTo = location.hash; location.hash = '#/login'; } }
    throw new Error(accountErrors[body.error] || '请求失败，请稍后重试。');
  }
  return body;
}
async function authPost(path, body) {
  const csrf = await api('/api/auth/csrf');
  return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.header]: csrf.token }, body: JSON.stringify(body || {}) });
}
function accountDisplay() {
  $('auth-link').hidden = !!state.user; $('account-name').hidden = !state.user; $('logout-button').hidden = !state.user;
  $('account-name').textContent = state.user ? state.user.username : '';
}
function friendly(error) { return error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message; }
function renderSubjects() {
  const tabs = $('subject-cards'); tabs.replaceChildren();
  const all = node('a', 'subject-card', '全部方向'); all.href = '#/apps/mathematics'; tabs.append(all);
  for (const subject of state.subjects) { const tab = node('a', 'subject-card', subject.name); tab.href = `#/apps/mathematics/subjects/${subject.id}`; tab.dataset.subjectId = subject.id; tabs.append(tab); }
}
function documentRows(documents) {
  const target = $('module-documents'); target.replaceChildren();
  if (!documents.length) { const box = node('div', 'empty-state'); box.append(node('strong', '', '这个方向的内容正在准备'), node('span', '', '可以先选择其他研究方向。')); target.append(box); return; }
  for (const doc of documents) {
    const row = node('article', 'document-row'); const info = node('div', 'document-info');
    info.append(node('h3', '', doc.title), node('p', '', doc.authors || '作者信息待补充'));
    const link = node('a', 'download-link'); link.append(icon('download'), node('span', '', '下载原文')); link.href = `/api/documents/${encodeURIComponent(doc.id)}/file`; link.setAttribute('download', `document-${doc.id}.pdf`);
    const badge = node('span', 'pdf-badge'); badge.append(icon('book')); row.append(badge, info, link); target.append(row);
  }
}
async function loadContent() {
  const generation = ++state.generation; state.loading = true;
  $('previous-page').disabled = true; $('next-page').disabled = true; $('refresh-documents').disabled = true;
  $('list-status').textContent = '正在加载参考资料…'; $('module-documents').replaceChildren();
  try {
    const query = new URLSearchParams({ offset: String(state.offset) }); if (state.subject) query.set('subject_id', state.subject.id);
    const data = await api(`/api/documents?${query}`); if (generation !== state.generation) return;
    documentRows(data.documents); $('page-label').textContent = `第 ${state.offset / 20 + 1} 页`;
    $('list-status').textContent = data.documents.length ? `本页 ${data.documents.length} 份参考资料` : '';
    $('previous-page').disabled = state.offset === 0; $('next-page').disabled = data.documents.length < 20;
  } catch (error) { if (generation === state.generation) { $('list-status').textContent = friendly(error); $('previous-page').disabled = state.offset === 0; } }
  finally { if (generation === state.generation) { state.loading = false; $('refresh-documents').disabled = false; } }
}
function route() {
  ++state.generation; state.loading = false; state.offset = 0;
  const match = location.hash.match(/^#\/apps\/mathematics(?:\/subjects\/(\d+))?$/);
  const subject = match && match[1] ? state.subjects.find(s => String(s.id) === match[1]) : null;
  state.subject = subject;
  const inApp = !!match;
  if (inApp && state.ready && !state.user) { state.returnTo = location.hash; location.hash = '#/login'; return; }
  const inAuth = ['#/login', '#/register'].includes(location.hash); const registering = location.hash === '#/register';
  $('auth-view').hidden = !inAuth; $('home-view').hidden = inApp || inAuth; $('module-view').hidden = !inApp;
  $('auth-title').textContent = registering ? '注册云数学账号' : '登录云数学'; $('account-submit').textContent = registering ? '注册账号' : '登录';
  $('confirm-label').hidden = !registering; $('account-confirm').hidden = !registering; $('account-confirm').required = registering; $('password-hint').hidden = !registering;
  $('account-password').autocomplete = registering ? 'new-password' : 'current-password'; $('account-password').minLength = registering ? 12 : 1;
  $('login-tab').classList.toggle('active', !registering); $('register-tab').classList.toggle('active', registering);
  $('breadcrumb').textContent = inApp ? '数学与应用数学' : '应用工作台';
  for (const [id, active] of [['home-link', !inApp], ['math-app-link', inApp]]) { $(id).classList.toggle('active', active); if (active) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current'); }
  for (const tab of $('subject-cards').querySelectorAll('a')) { const active = subject ? tab.dataset.subjectId === String(subject.id) : !tab.dataset.subjectId; tab.classList.toggle('active', active); if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current'); }
  $('topic-title').textContent = subject ? subject.name : '全部方向';
  $('topic-description').textContent = subject ? descriptions[subject.slug] || '阅读这个方向的研究资料，追溯原始文献。' : '从平台提供的研究资料中，选择感兴趣的内容开始阅读。';
  document.title = inApp ? `${subject ? subject.name + ' · ' : ''}数学与应用数学 · 云数学` : '云数学 · 数学研究平台';
  if (inApp && state.ready && state.user) loadContent(); window.scrollTo(0, 0);
}
async function init() {
  $('retry-subjects').hidden = true;
  const results = await Promise.allSettled([api('/api/auth/me'), api('/api/subjects')]);
  if (results[0].status === 'fulfilled') state.user = results[0].value.authenticated ? results[0].value.user : null;
  if (results[1].status === 'fulfilled') { state.subjects = results[1].value.subjects; renderSubjects(); }
  else { $('subject-cards').replaceChildren(node('p', 'muted', friendly(results[1].reason))); $('retry-subjects').hidden = false; }
  state.ready = true; accountDisplay(); route();
}
function authMessage(text, error = false) { $('account-message').textContent = text; $('account-message').classList.toggle('error', error); }
$('account-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.authBusy) return;
  const registering = location.hash === '#/register'; const username = $('account-username').value; const password = $('account-password').value;
  if (registering && password !== $('account-confirm').value) { authMessage('两次输入的密码不一致。', true); return; }
  state.authBusy = true; for (const field of $('account-form').elements) field.disabled = true;
  authMessage(registering ? '正在注册…' : '正在登录…');
  try {
    const body = await authPost(registering ? '/api/auth/register' : '/api/auth/login', { username, password });
    $('account-password').value = ''; $('account-confirm').value = '';
    if (registering) { authMessage('注册成功，请登录。'); location.hash = '#/login'; }
    else { state.user = body.user; accountDisplay(); authMessage(''); location.hash = state.returnTo; }
  } catch (error) { authMessage(friendly(error), true); }
  finally { state.authBusy = false; for (const field of $('account-form').elements) field.disabled = false; }
});
$('logout-button').addEventListener('click', async () => {
  $('logout-button').disabled = true;
  try { await authPost('/api/auth/logout'); state.user = null; ++state.generation; $('module-documents').replaceChildren(); accountDisplay(); location.hash = '#/'; route(); }
  catch (error) { $('notice').textContent = friendly(error); $('notice').hidden = false; }
  finally { $('logout-button').disabled = false; }
});
$('previous-page').addEventListener('click', () => { if (!state.loading && state.offset >= 20) { state.offset -= 20; loadContent(); } });
$('next-page').addEventListener('click', () => { if (!state.loading) { state.offset += 20; loadContent(); } });
$('refresh-documents').addEventListener('click', loadContent);
$('retry-subjects').addEventListener('click', init);
window.addEventListener('hashchange', route);
route(); init();
