import { mountIcons } from './icons.js';
import { createLearning } from './learning.js';
import { createLibrary } from './library.js';
const $ = id => document.getElementById(id);
const state = { generation: 0, user: null, ready: false, returnTo: '#/', authBusy: false };
mountIcons();
const accountErrors = { invalid_progress: '阅读位置无效，请重新打开教材。', invalid_annotation: '标注内容无效或过长，请缩短选中文字或笔记。', annotation_limit: '这本教材的标注已达上限，请整理后再添加。', textbook_unavailable: '这本教材的 PDF 尚未接入。', invalid_invitation: '邀请码无效、已使用或已过期，请联系管理员。', invalid_username: '用户名需为 3–32 位字母、数字或下划线。', invalid_password: '密码至少 12 个字符，最多 72 个 UTF-8 字节。', username_taken: '这个用户名已被使用，请换一个。', invalid_credentials: '用户名或密码不正确。', invalid_csrf: '登录状态已更新，请重新提交。', too_many_attempts: '操作过于频繁，请稍后再试。', login_required: '请先登录。' };
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options }); const body = await response.json();
  if (!response.ok) {
    if (body.error === 'login_required') { state.user = null; accountDisplay(); state.returnTo = location.hash; location.hash = '#/login'; route(); }
    throw new Error(accountErrors[body.error] || '请求失败，请稍后重试。');
  }
  return body;
}
async function authPost(path, body, method = 'POST') {
  const csrf = await api('/api/auth/csrf');
  return api(path, { method, headers: { 'Content-Type': 'application/json', [csrf.header]: csrf.token }, body: JSON.stringify(body || {}) });
}
function accountDisplay() {
  $('admin-link').hidden = state.user?.role !== 'ADMIN';
  $('auth-link').hidden = !!state.user; $('account-name').hidden = !state.user; $('logout-button').hidden = !state.user;
  $('account-name').textContent = state.user ? state.user.username : '';
}
function friendly(error) { return error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message; }
const learning = createLearning({ api, write: authPost });
const library = createLibrary({ api, write: authPost });
function route() {
  if (!state.ready) { document.body.classList.add('auth-page'); $('library-view').hidden = true; $('home-view').hidden = true; $('module-view').hidden = true; $('auth-view').hidden = true; $('reader-view').hidden = true; return; }
  ++state.generation;
  const inApp = location.hash.startsWith('#/apps/mathematics'); const inLibrary = location.hash.startsWith('#/library');
  if (!state.user && !['#/login', '#/register'].includes(location.hash)) { state.returnTo = location.hash || '#/'; location.replace('#/login'); route(); return; }
  if (location.hash === '#/admin' && state.user) { if (state.user.role === 'ADMIN') { location.replace('/admin'); return; } $('notice').textContent = '此账号没有管理员权限。'; $('notice').hidden = false; location.replace('#/'); return; }
  const inAuth = ['#/login', '#/register'].includes(location.hash); const registering = location.hash === '#/register';
  document.body.classList.toggle('auth-page', inAuth);
  $('auth-view').hidden = !inAuth; $('home-view').hidden = inApp || inLibrary || inAuth; $('library-view').hidden = !inLibrary || inAuth; $('module-view').hidden = !inApp;
  $('auth-title').textContent = registering ? '注册云数学账号' : '登录云数学'; $('account-submit').textContent = registering ? '注册账号' : '登录';
  $('invitation-label').hidden = !registering; $('account-invitation').hidden = !registering; $('account-invitation').required = registering;
  $('confirm-label').hidden = !registering; $('account-confirm').hidden = !registering; $('account-confirm').required = registering; $('password-hint').hidden = !registering;
  $('account-password').autocomplete = registering ? 'new-password' : 'current-password'; $('account-password').minLength = registering ? 12 : 1;
  $('login-tab').classList.toggle('active', !registering); $('register-tab').classList.toggle('active', registering);
  $('breadcrumb').textContent = inLibrary ? '文档库' : inApp ? '数学与应用数学' : '应用工作台';
  for (const [id, active] of [['home-link', !inApp && !inLibrary], ['library-link', inLibrary], ['math-app-link', inApp]]) { $(id).classList.toggle('active', active); if (active) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current'); }
  document.title = inAuth ? `${registering ? '注册' : '登录'} · 云数学` : inLibrary ? '文档库 · 云数学' : inApp ? '数学与应用数学 · 云数学' : '云数学 · 数学研究平台';
  if (inLibrary && state.user) { learning.close(); library.navigate(location.hash); } else { library.close(); if (inApp && state.user) learning.navigate(location.hash); else learning.close(); }
  window.scrollTo(0, 0);
}
async function loadDirections() { try { await learning.loadDirections(); } catch { $('notice').textContent = '研究方向加载失败，请进入模块后重试。'; $('notice').hidden = false; } }
async function init() {
  try { const me = await api('/api/auth/me'); state.user = me.authenticated ? me.user : null; }
  catch { state.user = null; }
  if (state.user) await loadDirections();
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
    const body = await authPost(registering ? '/api/auth/register' : '/api/auth/login', { username, password, ...(registering ? { invitation: $('account-invitation').value.trim() } : {}) });
    $('account-password').value = ''; $('account-confirm').value = '';
    if (registering) { $('account-invitation').value = ''; authMessage('注册成功，请登录。'); location.hash = '#/login'; }
    else { state.user = body.user; accountDisplay(); await loadDirections(); authMessage(''); location.hash = state.returnTo; }
  } catch (error) { authMessage(friendly(error), true); }
  finally { state.authBusy = false; for (const field of $('account-form').elements) field.disabled = false; }
});
$('logout-button').addEventListener('click', async () => {
  $('logout-button').disabled = true;
  try { await authPost('/api/auth/logout'); state.user = null; ++state.generation; learning.close(); library.close(); accountDisplay(); location.hash = '#/login'; route(); }
  catch (error) { $('notice').textContent = friendly(error); $('notice').hidden = false; }
  finally { $('logout-button').disabled = false; }
});
window.addEventListener('hashchange', route);
route(); init();
