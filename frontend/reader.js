import { getDocument, GlobalWorkerOptions, TextLayer } from './vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
const $ = id => document.getElementById(id);
function el(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
export function openReader(id, { api, write }) {
  let closed = false, pdf = null, task = null, renderTask = null, textLayer = null, book = null;
  let pageNumber = 1, zoom = 1, marks = [], selection = null, saveTimer = null, resizeTimer = null, csrf = null;
  let saved = '', desired = null, saving = false, rendering = false, renderQueue = Promise.resolve();
  const events = [];
  const on = (target, event, handler, options) => { target.addEventListener(event, handler, options); events.push(() => target.removeEventListener(event, handler, options)); };
  const scroll = $('reader-scroll');
  $('pdf-text').replaceChildren(); $('pdf-highlights').replaceChildren(); $('annotation-list').replaceChildren(); $('selection-tools').hidden = true;
  $('reader-title').textContent = '正在打开教材…'; $('reader-pages').textContent = '—'; $('reader-outline').hidden = true; $('reader-notes').hidden = false;
  $('reader-outline-toggle').setAttribute('aria-expanded', 'false'); $('reader-notes-toggle').setAttribute('aria-expanded', 'true');
  const errorText = error => error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message;
  function snapshot() { return { page: pageNumber, total_pages: pdf.numPages, position: Math.min(1, Math.max(0, scroll.scrollTop / Math.max(1, scroll.scrollHeight - scroll.clientHeight))), zoom }; }
  async function drainSave() {
    if (saving || !csrf) return;
    saving = true;
    try {
      while (desired) {
        const value = desired; desired = null;
        const json = JSON.stringify(value); if (json === saved) continue;
        if (!closed) $('reader-save-status').textContent = '正在保存阅读位置…';
        await api(`/api/learning/books/${id}/progress`, { method: 'PUT', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json', [csrf.header]: csrf.token }, body: json });
        saved = json; if (!closed) $('reader-save-status').textContent = '阅读位置已保存';
      }
    } catch (error) { if (!closed) { $('reader-save-status').textContent = '阅读位置未保存：' + errorText(error); $('reader-save-status').classList.add('save-error'); } }
    finally { saving = false; }
  }
  function saveNow() { clearTimeout(saveTimer); if (pdf && book && !rendering) { desired = snapshot(); $('reader-save-status').classList.remove('save-error'); drainSave(); } }
  function paintHighlights() {
    $('pdf-highlights').replaceChildren();
    for (const mark of marks.filter(m => m.page === pageNumber)) for (const r of mark.rects) {
      const box = el('span', 'pdf-highlight ' + mark.color); box.style.left = r.x * 100 + '%'; box.style.top = r.y * 100 + '%'; box.style.width = r.width * 100 + '%'; box.style.height = r.height * 100 + '%'; box.dataset.annotation = mark.id; $('pdf-highlights').append(box);
    }
  }
  function notes() {
    const list = $('annotation-list'); list.replaceChildren();
    if (!marks.length) { list.append(el('p', 'muted', '还没有标注。选中正文开始高亮。')); return; }
    for (const mark of marks) {
      const row = el('article', 'annotation-item'); row.dataset.annotation = mark.id;
      const jump = el('button', 'annotation-jump', `第 ${mark.page} 页 · 跳转`); jump.type = 'button'; jump.addEventListener('click', () => { saveNow(); showPage(mark.page); });
      const quote = el('blockquote', '', mark.quote); const note = el('textarea', 'annotation-note'); note.value = mark.note; note.maxLength = 4000; note.rows = 3; note.setAttribute('aria-label', '高亮笔记'); note.placeholder = '写下你的理解…';
      const actions = el('div', 'annotation-actions'); const save = el('button', 'button compact', '保存笔记'), remove = el('button', 'annotation-delete', '删除');
      save.type = remove.type = 'button';
      save.addEventListener('click', async () => { save.disabled = true; try { await write(`/api/learning/books/${id}/annotations/${mark.id}`, { note: note.value }, 'PATCH'); if (closed) return; mark.note = note.value; $('reader-status').textContent = '笔记已保存'; } catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } finally { save.disabled = false; } });
      remove.addEventListener('click', async () => { remove.disabled = true; try { await write(`/api/learning/books/${id}/annotations/${mark.id}`, undefined, 'DELETE'); if (closed) return; marks = marks.filter(m => m.id !== mark.id); notes(); paintHighlights(); $('reader-status').textContent = '标注已删除'; } catch (error) { if (!closed) $('reader-status').textContent = errorText(error); remove.disabled = false; } });
      actions.append(save, remove); row.append(jump, quote, note, actions); list.append(row);
    }
  }
  function captureSelection() {
    if (closed || rendering) return;
    const selected = window.getSelection(); const layer = $('pdf-text');
    if (!selected || selected.isCollapsed || !layer.contains(selected.anchorNode) || !layer.contains(selected.focusNode)) { selection = null; $('selection-tools').hidden = true; return; }
    const quote = selected.toString().trim(); if (!quote || quote.length > 4000) { selection = null; $('selection-tools').hidden = true; return; }
    const bounds = $('pdf-page').getBoundingClientRect(); const rects = [];
    for (const r of selected.getRangeAt(0).getClientRects()) {
      const x = Math.max(bounds.left, r.left), y = Math.max(bounds.top, r.top), right = Math.min(bounds.right, r.right), bottom = Math.min(bounds.bottom, r.bottom);
      if (right > x && bottom > y) rects.push({ x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height, width: (right - x) / bounds.width, height: (bottom - y) / bounds.height });
    }
    if (!rects.length || rects.length > 100) return;
    selection = { page: pageNumber, quote, rects }; $('selection-quote').textContent = quote; $('selection-tools').hidden = false;
  }
  function showPage(number, position = 0) {
    if (!pdf || closed) return Promise.resolve();
    const target = Math.max(1, Math.min(pdf.numPages, Math.floor(number))); const targetZoom = zoom;
    renderQueue = renderQueue.catch(() => {}).then(async () => {
      if (closed) return;
      rendering = true; selection = null; $('selection-tools').hidden = true; window.getSelection()?.removeAllRanges();
      $('reader-status').textContent = '正在加载页面…';
      try {
        const page = await pdf.getPage(target); if (closed) return;
        const base = page.getViewport({ scale: 1 }); const fit = Math.min(1000, Math.max(240, scroll.clientWidth - 32)) / base.width;
        const viewport = page.getViewport({ scale: fit * targetZoom }); const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
        const canvas = $('pdf-canvas'); canvas.width = Math.ceil(viewport.width * ratio); canvas.height = Math.ceil(viewport.height * ratio); canvas.style.width = viewport.width + 'px'; canvas.style.height = viewport.height + 'px';
        const frame = $('pdf-page'); frame.style.width = viewport.width + 'px'; frame.style.height = viewport.height + 'px'; frame.style.setProperty('--scale-factor', String(viewport.scale)); frame.style.setProperty('--total-scale-factor', String(viewport.scale));
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }); await renderTask.promise; if (closed) return;
        const text = await page.getTextContent(); if (closed) return;
        $('pdf-text').replaceChildren(); textLayer = new TextLayer({ textContentSource: text, container: $('pdf-text'), viewport }); await textLayer.render(); if (closed) return;
        pageNumber = target; $('reader-page').value = String(target); $('reader-page').max = String(pdf.numPages); $('reader-prev').disabled = target === 1; $('reader-next').disabled = target === pdf.numPages;
        paintHighlights(); scroll.scrollTop = position * Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        $('reader-status').textContent = text.items.some(item => item.str?.trim()) ? '选中文字即可高亮，标注不会修改原 PDF。' : '本页没有可选择的文字；扫描页需文字识别后才能高亮。';
      } catch (error) { if (!closed) $('reader-status').textContent = '页面加载失败：' + errorText(error); }
      finally { rendering = false; if (!closed) saveNow(); }
    });
    return renderQueue;
  }
  async function outline() {
    const items = await pdf.getOutline(); if (closed) return;
    $('reader-outline').replaceChildren();
    if (!items?.length) { $('reader-outline').append(el('p', 'muted', '这份 PDF 没有内置目录，可输入页码跳转。')); return; }
    let count = 0;
    function append(items, depth = 0) {
      if (depth > 8) return;
      for (const item of items) {
        if (++count > 1000) return;
        const button = el('button', 'outline-entry', item.title); button.style.paddingLeft = 12 + depth * 12 + 'px';
        button.addEventListener('click', async () => { try { const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest; if (!dest || closed) return; const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]); if (!closed) { saveNow(); showPage(index + 1); } } catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } });
        $('reader-outline').append(button); if (item.items?.length) append(item.items, depth + 1);
      }
    }
    append(items);
  }
  on($('reader-prev'), 'click', () => { saveNow(); showPage(pageNumber - 1); });
  on($('reader-next'), 'click', () => { saveNow(); showPage(pageNumber + 1); });
  on($('reader-page'), 'change', () => { const number = Number($('reader-page').value); if (Number.isFinite(number)) { saveNow(); showPage(number); } });
  on($('reader-zoom'), 'change', () => { if (!pdf) return; const position = snapshot().position; zoom = Number($('reader-zoom').value); showPage(pageNumber, position); });
  on($('reader-outline-toggle'), 'click', () => { $('reader-outline').hidden = !$('reader-outline').hidden; $('reader-outline-toggle').setAttribute('aria-expanded', String(!$('reader-outline').hidden)); if (pdf) showPage(pageNumber, snapshot().position); });
  on($('reader-notes-toggle'), 'click', () => { $('reader-notes').hidden = !$('reader-notes').hidden; $('reader-notes-toggle').setAttribute('aria-expanded', String(!$('reader-notes').hidden)); if (pdf) showPage(pageNumber, snapshot().position); });
  for (const button of document.querySelectorAll('[data-highlight]')) {
    on(button, 'pointerdown', event => event.preventDefault());
    on(button, 'click', async () => {
      if (!selection) return; const value = { ...selection, color: button.dataset.highlight, note: '' }; button.disabled = true;
      try { const created = await write(`/api/learning/books/${id}/annotations`, value); if (closed) return; marks.push({ ...value, id: created.id }); notes(); paintHighlights(); selection = null; $('selection-tools').hidden = true; window.getSelection()?.removeAllRanges(); $('reader-status').textContent = '高亮已保存，可在右侧添加笔记。'; }
      catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } finally { button.disabled = false; }
    });
  }
  on(document, 'selectionchange', captureSelection);
  on(scroll, 'scroll', () => { if (!rendering) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); } }, { passive: true });
  on(window, 'resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdf) showPage(pageNumber, snapshot().position); }, 200); });
  on(window, 'pagehide', saveNow);
  const ready = (async () => {
    try {
      book = await api(`/api/learning/books/${id}`); if (closed) return;
      $('reader-title').textContent = book.title; $('reader-back').href = `#/apps/mathematics/directions/${book.direction}`;
      if (!book.available) throw new Error('这本教材的 PDF 尚未接入，请先选择其他教材。');
      csrf = await api('/api/auth/csrf'); if (closed) return;
      task = getDocument({ url: book.file_url, withCredentials: true, isEvalSupported: false, useWasm: false, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/' });
      pdf = await task.promise; if (closed) return;
      if (pdf.numPages > 100000) throw new Error('教材页数超出支持范围。');
      $('reader-pages').textContent = String(pdf.numPages); marks = (await api(`/api/learning/books/${id}/annotations`)).annotations; if (closed) return;
      notes(); zoom = book.progress?.zoom || 1; if (![.75, 1, 1.25, 1.5, 2].includes(zoom)) zoom = 1; $('reader-zoom').value = String(zoom);
      await outline(); if (closed) return; await showPage(book.progress?.page || 1, book.progress?.position || 0);
    } catch (error) { if (!closed) $('reader-status').textContent = '无法打开教材：' + errorText(error); }
  })();
  function close() { if (closed) return; saveNow(); closed = true; clearTimeout(saveTimer); clearTimeout(resizeTimer); events.forEach(remove => remove()); renderTask?.cancel(); textLayer?.cancel(); if (task) task.destroy().catch(() => {}); $('pdf-canvas').width = 0; $('pdf-text').replaceChildren(); $('pdf-highlights').replaceChildren(); $('annotation-list').replaceChildren(); }
  return { ready, close };
}
