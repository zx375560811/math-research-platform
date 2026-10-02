import { icon, mountIcons } from './icons.js';
const $ = id => document.getElementById(id);
const state = { subjects: [], subject: null, offset: 0, generation: 0, loading: false };
const descriptions = { algebra: '结构、对称与运算', 'number-theory': '整数与算术结构', analysis: '极限、函数与变化', 'geometry-topology': '空间、形状与连续性', other: '更多数学研究方向' };
mountIcons();
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
async function api(path) { const response = await fetch(path); if (!response.ok) throw new Error('研究资料读取失败，请稍后重试。'); return response.json(); }
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
  const inApp = !!match; $('home-view').hidden = inApp; $('module-view').hidden = !inApp;
  $('breadcrumb').textContent = inApp ? '数学与应用数学' : '应用工作台';
  for (const [id, active] of [['home-link', !inApp], ['math-app-link', inApp]]) { $(id).classList.toggle('active', active); if (active) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current'); }
  for (const tab of $('subject-cards').querySelectorAll('a')) { const active = subject ? tab.dataset.subjectId === String(subject.id) : !tab.dataset.subjectId; tab.classList.toggle('active', active); if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current'); }
  $('topic-title').textContent = subject ? subject.name : '全部方向';
  $('topic-description').textContent = subject ? descriptions[subject.slug] || '阅读这个方向的研究资料，追溯原始文献。' : '从平台提供的研究资料中，选择感兴趣的内容开始阅读。';
  document.title = inApp ? `${subject ? subject.name + ' · ' : ''}数学与应用数学 · 云数学` : '云数学 · 数学研究平台';
  if (inApp) loadContent(); window.scrollTo(0, 0);
}
async function init() {
  $('retry-subjects').hidden = true;
  try { state.subjects = (await api('/api/subjects')).subjects; renderSubjects(); route(); }
  catch (error) { $('subject-cards').replaceChildren(node('p', 'muted', friendly(error))); $('retry-subjects').hidden = false; route(); }
}
$('previous-page').addEventListener('click', () => { if (!state.loading && state.offset >= 20) { state.offset -= 20; loadContent(); } });
$('next-page').addEventListener('click', () => { if (!state.loading) { state.offset += 20; loadContent(); } });
$('refresh-documents').addEventListener('click', loadContent);
$('retry-subjects').addEventListener('click', init);
window.addEventListener('hashchange', route);
route(); init();
