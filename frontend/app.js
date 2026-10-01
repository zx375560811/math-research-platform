'use strict';
const $ = (id) => document.getElementById(id);
const state = { subjects: [], subject: null, offset: 0, loading: false, upload: false, generation: 0 };
const symbols = { algebra: 'G', 'number-theory': 'ℤ', analysis: '∫', 'geometry-topology': '∂', other: '∞' };
const errors = { invalid_metadata: '请填写有效标题和作者，每项最多 500 个 UTF-8 字节。', unknown_subject: '所选专业不存在，请刷新页面。', pdf_too_large: 'PDF 不能超过 20 MB。', invalid_pdf_header: '文件不是有效的 PDF，请重新选择。', empty_or_invalid_length: '请选择一份非空 PDF。', use_application_pdf: '请选择 PDF 文件。', database_busy: '系统正在处理其他请求，请稍后重试。', file_storage_error: '文件保存失败，请稍后重试。', database_error: '资料读取或保存失败，请稍后重试。' };
function node(tag, className, content) { const el = document.createElement(tag); if (className) el.className = className; if (content !== undefined) el.textContent = content; return el; }
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
async function api(path) { const response = await fetch(path); const body = await response.json(); if (!response.ok) throw new Error(errors[body.error] || '请求失败，请稍后重试。'); return body; }
function friendly(error) { return error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message; }
function formatSize(bytes) { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function documentRows(target, documents, empty) {
  target.replaceChildren();
  if (!documents.length) { const box = node('div', 'empty-state'); box.append(node('strong', '', '还没有文献'), node('span', '', empty)); target.append(box); return; }
  for (const doc of documents) {
    const row = node('article', 'document-row'); const info = node('div', 'document-info');
    const date = new Date(doc.created_at); const day = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN');
    info.append(node('h3', '', doc.title), node('p', '', [doc.authors || '作者未填写', formatSize(doc.file_size), day].filter(Boolean).join(' · ')));
    const link = node('a', 'download-link', '下载 PDF ↓'); link.href = `/api/documents/${encodeURIComponent(doc.id)}/file`; link.setAttribute('download', `document-${doc.id}.pdf`);
    row.append(node('span', 'pdf-badge', 'PDF'), info, link); target.append(row);
  }
}
function renderSubjects() {
  $('subject-cards').replaceChildren(); $('document-subject').replaceChildren();
  for (const subject of state.subjects) {
    const card = node('a', 'subject-card'); card.href = `#/subjects/${subject.id}`;
    const bottom = node('span', 'card-bottom'); bottom.append(node('span', '', '进入专业'), node('span', '', '↗'));
    card.append(node('span', 'subject-symbol', symbols[subject.slug] || '∞'), node('strong', '', subject.name), bottom); $('subject-cards').append(card);
    const option = node('option', '', subject.name); option.value = subject.id; $('document-subject').append(option);
  }
}
async function recent() {
  const target = $('recent-documents'); target.replaceChildren(node('p', 'muted', '正在加载文献…'));
  try { const data = await api('/api/documents'); documentRows(target, data.documents.slice(0, 5), '进入一个专业模块，加入你的第一份研究资料。'); }
  catch (error) { target.replaceChildren(node('p', 'muted', friendly(error))); }
}
async function loadDocuments() {
  if (!state.subject) return;
  const generation = ++state.generation; state.loading = true;
  $('previous-page').disabled = true; $('next-page').disabled = true; $('refresh-documents').disabled = true;
  $('list-status').textContent = '正在加载文献…'; $('module-documents').replaceChildren();
  try {
    const data = await api(`/api/documents?subject_id=${state.subject.id}&offset=${state.offset}`);
    if (generation !== state.generation) return;
    documentRows($('module-documents'), data.documents, '用右侧表单上传一份 PDF，开始积累这个方向的文献。');
    $('page-label').textContent = `第 ${state.offset / 20 + 1} 页`;
    $('list-status').textContent = data.documents.length ? `本页 ${data.documents.length} 份文献` : '';
    $('previous-page').disabled = state.offset === 0; $('next-page').disabled = data.documents.length < 20;
  } catch (error) { if (generation === state.generation) { $('list-status').textContent = friendly(error); $('previous-page').disabled = state.offset === 0; } }
  finally { if (generation === state.generation) { state.loading = false; $('refresh-documents').disabled = false; } }
}
function route() {
  ++state.generation; state.loading = false;
  const match = location.hash.match(/^#\/subjects\/(\d+)$/);
  const subject = match ? state.subjects.find((s) => String(s.id) === match[1]) : null;
  state.subject = subject; state.offset = 0;
  $('home-view').hidden = !!subject; $('module-view').hidden = !subject;
  if (subject) { $('module-title').textContent = subject.name; if (!state.upload) $('document-subject').value = subject.id; document.title = `${subject.name} · 云数学`; loadDocuments(); window.scrollTo(0, 0); }
  else { document.title = '云数学 · 数学研究平台'; if (match) notice('这个专业暂不可用，请选择已有方向。', true); recent(); }
}
async function init() {
  $('retry-subjects').hidden = true;
  try { const data = await api('/api/subjects'); state.subjects = data.subjects; renderSubjects(); notice(''); route(); }
  catch (error) { $('subject-cards').replaceChildren(node('p', 'muted', friendly(error))); $('retry-subjects').hidden = false; }
}
function formMessage(message, error = false) { $('upload-message').textContent = message; $('upload-message').classList.toggle('error', error); }
$('pdf-file').addEventListener('change', () => {
  const file = $('pdf-file').files[0];
  $('file-label').textContent = file ? file.name : '选择一份 PDF'; $('file-detail').textContent = file ? formatSize(file.size) : '最大 20 MB';
  if (file && !$('document-title').value) $('document-title').value = file.name.replace(/\.pdf$/i, '');
  formMessage('');
});
$('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (state.upload) return;
  const file = $('pdf-file').files[0]; const title = $('document-title').value.trim(); const authors = $('document-authors').value.trim(); const subject = $('document-subject').value;
  if (!file || !file.size || file.size > 20 * 1024 * 1024) { formMessage('请选择一份非空 PDF，大小不超过 20 MB。', true); return; }
  if (!title || new TextEncoder().encode(title).length > 500 || new TextEncoder().encode(authors).length > 500 || /[\x00-\x1f\x7f]/.test(title + authors)) { formMessage('请填写有效标题和作者，每项最多 500 个 UTF-8 字节。', true); return; }
  const header = await file.slice(0, 5).text();
  if (header !== '%PDF-') { formMessage('文件不是有效的 PDF，请重新选择。', true); return; }
  if (state.upload) return; state.upload = true;
  for (const field of $('upload-form').elements) field.disabled = true;
  $('upload-submit').textContent = '正在上传…'; $('upload-progress').hidden = false; $('upload-progress').value = 0; formMessage('正在上传，请保持页面打开。');
  const xhr = new XMLHttpRequest();
  try {
    const result = await new Promise((resolve, reject) => {
      const query = new URLSearchParams({ title, authors, subject_id: subject });
      xhr.open('POST', `/api/documents?${query}`); xhr.setRequestHeader('Content-Type', 'application/pdf'); xhr.timeout = 180000;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) { $('upload-progress').value = Math.round(e.loaded / e.total * 100); if (e.loaded === e.total) formMessage('上传完成，正在保存…'); } };
      xhr.onload = () => { let body; try { body = JSON.parse(xhr.responseText); } catch { reject(new Error('服务器响应异常，请刷新文献列表确认是否保存。')); return; } if (xhr.status === 201) resolve(body); else reject(new Error(errors[body.error] || '上传失败，请稍后重试。')); };
      xhr.onerror = () => reject(new Error('连接中断，请刷新文献列表确认是否保存。')); xhr.ontimeout = () => reject(new Error('上传超时，请刷新文献列表确认是否保存。')); xhr.send(file);
    });
    $('upload-form').reset(); $('file-label').textContent = '选择一份 PDF'; $('file-detail').textContent = '最大 20 MB';
    notice(`文献已保存，编号 ${result.id}。`); formMessage('保存成功。');
    if (state.subject && String(state.subject.id) === subject) { state.offset = 0; await loadDocuments(); }
    else if (!$('home-view').hidden) await recent();
  } catch (error) { formMessage(friendly(error), true); }
  finally { state.upload = false; for (const field of $('upload-form').elements) field.disabled = false; $('upload-submit').textContent = '保存到文献库 ↗'; $('upload-progress').hidden = true; if (state.subject) $('document-subject').value = state.subject.id; }
});
$('previous-page').addEventListener('click', () => { if (!state.loading && state.offset >= 20) { state.offset -= 20; loadDocuments(); } });
$('next-page').addEventListener('click', () => { if (!state.loading) { state.offset += 20; loadDocuments(); } });
$('refresh-documents').addEventListener('click', () => loadDocuments());
$('retry-subjects').addEventListener('click', init);
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (event) => { if (state.upload) { event.preventDefault(); event.returnValue = ''; } });
init();
