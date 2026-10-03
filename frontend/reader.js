import { getDocument, GlobalWorkerOptions, TextLayer } from './vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
const $ = id => document.getElementById(id);
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
export function openReader(id, { api, write }) {
  let closed = false, pdf = null, task = null, book = null, csrf = null;
  let pageNumber = 1, zoom = 1, marks = [], selection = null, saveTimer, resizeTimer, scrollFrame, zoomTimer, pendingZoom = null;
  let saved = '', desired = null, saving = false, layingOut = false, generation = 0, queue = Promise.resolve(), layoutSignature = '';
  let baseWidth = 612, baseHeight = 792;
  let drag = null, dragFrame = null, pendingAnchor = null;
  let editingPage = false;
  const layoutBox = $('reader-scroll').parentElement, widthKey = 'math.reader.panel-widths.v1';
  const preferredWidths = { outline: layoutBox.clientWidth <= 650 ? layoutBox.clientWidth * .2 : 220, notes: layoutBox.clientWidth <= 650 ? layoutBox.clientWidth * .26 : 280 };
  try { const stored = JSON.parse(localStorage.getItem(widthKey)); for (const name of ['outline', 'notes']) if (Number.isFinite(stored?.[name]) && stored[name] >= 64 && stored[name] <= 3000) preferredWidths[name] = stored[name]; } catch { /* Layout preferences are optional. */ }
  const pages = [], dimensions = new Map(), drafts = new Map(), events = [];
  const scroll = $('reader-scroll'), stack = $('pdf-pages');
  const on = (target, event, handler, options) => { target.addEventListener(event, handler, options); events.push(() => target.removeEventListener(event, handler, options)); };
  const errorText = error => error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message;
  stack.replaceChildren(); $('annotation-list').replaceChildren(); $('selection-tools').hidden = true;
  $('reader-outline').replaceChildren(el('p', 'muted', '正在加载目录…'));
  $('reader-title').textContent = '正在打开教材…'; $('reader-pages').textContent = '—';
  $('reader-fullscreen').textContent = '全屏';
  $('reader-outline').hidden = $('reader-notes').hidden = false;
  $('reader-outline-toggle').setAttribute('aria-expanded', 'true'); $('reader-notes-toggle').setAttribute('aria-expanded', 'true');
  const top = frame => frame.offsetTop + stack.offsetTop;
  function currentPage() {
    let lo = 0, hi = pages.length - 1;
    const y = scroll.scrollTop + 24;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (top(pages[mid].frame) <= y) lo = mid; else hi = mid - 1; }
    return pages[lo];
  }
  function controls(number, force = false) {
    pageNumber = number; if (force || !editingPage) $('reader-page').value = String(number);
    $('reader-prev').disabled = number === 1; $('reader-next').disabled = number === pdf.numPages;
  }
  function snapshot() {
    const page = currentPage();
    return { page: page?.number || pageNumber, total_pages: pdf.numPages, position: page ? Math.min(1, Math.max(0, (scroll.scrollTop - top(page.frame)) / page.frame.clientHeight)) : 0, zoom };
  }
  async function drainSave() {
    if (saving || !csrf) return; saving = true;
    try {
      while (desired) {
        const value = desired; desired = null; const json = JSON.stringify(value); if (json === saved) continue;
        if (!closed) $('reader-save-status').textContent = '正在保存阅读位置…';
        await api(`/api/learning/books/${id}/progress`, { method: 'PUT', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json', [csrf.header]: csrf.token }, body: json });
        saved = json; if (!closed) $('reader-save-status').textContent = '阅读位置已保存';
      }
    } catch (error) { if (!closed) { $('reader-save-status').textContent = '阅读位置未保存：' + errorText(error); $('reader-save-status').classList.add('save-error'); } }
    finally { saving = false; }
  }
  function saveNow() { clearTimeout(saveTimer); if (pdf && book && pages.length && !layingOut) { desired = snapshot(); $('reader-save-status').classList.remove('save-error'); drainSave(); } }
  function paintHighlights() {
    for (const page of pages) {
      if (!page.rendered) continue; page.highlights.replaceChildren();
      for (const mark of marks.filter(m => m.page === page.number)) for (const r of mark.rects) {
        const box = el('span', 'pdf-highlight ' + mark.color); box.style.left = r.x * 100 + '%'; box.style.top = r.y * 100 + '%'; box.style.width = r.width * 100 + '%'; box.style.height = r.height * 100 + '%'; box.dataset.annotation = mark.id; page.highlights.append(box);
      }
    }
  }
  function limits() { const small = layoutBox.clientWidth <= 650; return { outline: small ? 64 : 140, notes: small ? 86 : 180, pdf: small ? 120 : 240 }; }
  function applyPanelWidths() {
    const visible = ['outline', 'notes'].filter(name => !$('reader-' + name).hidden), min = limits();
    const budget = Math.max(0, layoutBox.clientWidth - min.pdf - visible.length * 6), minimum = visible.reduce((sum,name) => sum + min[name], 0);
    const extra = visible.reduce((sum,name) => sum + Math.max(0, preferredWidths[name] - min[name]), 0), available = Math.max(0, budget - minimum);
    for (const name of ['outline', 'notes']) {
      const handle = $('reader-' + name + '-resize'); handle.hidden = $('reader-' + name).hidden;
      if (handle.hidden) continue;
      const surplus = Math.max(0, preferredWidths[name] - min[name]);
      const width = min[name] + (extra > available ? surplus * available / Math.max(1, extra) : surplus);
      layoutBox.style.setProperty('--reader-' + name + '-width', width + 'px');
      handle.setAttribute('aria-valuemin', String(min[name])); handle.setAttribute('aria-valuenow', String(Math.round(width)));
    }
    for (const name of visible) { const other = visible.filter(value => value !== name).reduce((sum,value) => sum + $('reader-' + value).getBoundingClientRect().width, 0); $('reader-' + name + '-resize').setAttribute('aria-valuemax', String(Math.floor(Math.max(min[name], budget - other)))); }
  }
  function storeWidths() { try { localStorage.setItem(widthKey, JSON.stringify(preferredWidths)); } catch { /* Reading still works without local storage. */ } }
  function changeWidth(name, width) {
    const handle = $('reader-' + name + '-resize'), other = name === 'outline' ? 'notes' : 'outline';
    if (!$('reader-' + other).hidden) preferredWidths[other] = $('reader-' + other).getBoundingClientRect().width;
    preferredWidths[name] = Math.max(Number(handle.getAttribute('aria-valuemin')), Math.min(Number(handle.getAttribute('aria-valuemax')), width)); applyPanelWidths();
  }
  function panel(name, visible, chosen = null) {
    if ($('reader-' + name).hidden === !visible) return;
    const anchor = pdf && pages.length ? snapshot() : null;
    $('reader-' + name).hidden = !visible; $('reader-' + name + '-toggle').setAttribute('aria-expanded', String(visible)); applyPanelWidths();
    if (anchor) { const result = layout(anchor), version = generation; result.then(() => { if (chosen && !closed && version === generation) { selection = chosen; $('selection-quote').textContent = chosen.quote; $('selection-tools').hidden = false; } }); }
  }
  applyPanelWidths();
  function notes() {
    const list = $('annotation-list'); list.replaceChildren();
    if (!marks.length) { list.append(el('p', 'muted', '还没有标注。选中正文开始高亮。')); return; }
    for (const mark of marks) {
      const row = el('article', 'annotation-item'); row.dataset.annotation = mark.id;
      const jump = el('button', 'annotation-jump', `第 ${mark.page} 页 · 跳转`); jump.type = 'button'; jump.addEventListener('click', () => showPage(mark.page));
      const quote = el('blockquote', '', mark.quote), note = el('textarea', 'annotation-note');
      note.value = drafts.get(mark.id) ?? mark.note; note.maxLength = 4000; note.rows = 3; note.setAttribute('aria-label', '高亮笔记'); note.placeholder = '写下你的理解…'; note.addEventListener('input', () => drafts.set(mark.id, note.value));
      const actions = el('div', 'annotation-actions'), save = el('button', 'button compact', '保存笔记'), remove = el('button', 'annotation-delete', '删除'); save.type = remove.type = 'button';
      save.addEventListener('click', async () => { save.disabled = true; try { await write(`/api/learning/books/${id}/annotations/${mark.id}`, { note: note.value }, 'PATCH'); if (closed) return; mark.note = note.value; drafts.delete(mark.id); $('reader-status').textContent = '笔记已保存'; } catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } finally { save.disabled = false; } });
      remove.addEventListener('click', async () => { remove.disabled = true; try { await write(`/api/learning/books/${id}/annotations/${mark.id}`, undefined, 'DELETE'); if (closed) return; marks = marks.filter(m => m.id !== mark.id); drafts.delete(mark.id); notes(); paintHighlights(); $('reader-status').textContent = '标注已删除'; } catch (error) { if (!closed) $('reader-status').textContent = errorText(error); remove.disabled = false; } });
      actions.append(save, remove); row.append(jump, quote, note, actions); list.append(row);
    }
  }
  function captureSelection() {
    if (closed || layingOut) return;
    const selected = window.getSelection();
    const element = node => node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const frame = element(selected?.anchorNode)?.closest('.pdf-page');
    const layer = frame?.querySelector('.textLayer');
    if (!selected || selected.isCollapsed || !layer?.contains(selected.anchorNode) || !layer.contains(selected.focusNode)) { selection = null; $('selection-tools').hidden = true; return; }
    const quote = selected.toString().trim(), bounds = frame.getBoundingClientRect(), rects = [];
    if (!quote || quote.length > 4000) { selection = null; $('selection-tools').hidden = true; return; }
    for (const r of selected.getRangeAt(0).getClientRects()) {
      const x = Math.max(bounds.left, r.left), y = Math.max(bounds.top, r.top), right = Math.min(bounds.right, r.right), bottom = Math.min(bounds.bottom, r.bottom);
      if (right > x && bottom > y) rects.push({ x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height, width: (right - x) / bounds.width, height: (bottom - y) / bounds.height });
    }
    if (!rects.length || rects.length > 100) { selection = null; $('selection-tools').hidden = true; return; }
    selection = { page: Number(frame.dataset.page), quote, rects }; $('selection-quote').textContent = quote; $('selection-tools').hidden = false; panel('notes', true, selection);
  }
  function release(page) {
    page.renderTask?.cancel(); page.textLayer?.cancel(); page.renderTask = page.textLayer = null;
    page.canvas.width = page.canvas.height = 0; page.text.replaceChildren(); page.highlights.replaceChildren(); page.rendered = false;
  }
  function endSpace() { const last = pages.at(-1); stack.style.paddingBottom = Math.max(0, scroll.clientHeight - (last?.frame.clientHeight || 0)) + 'px'; }
  function fitWidth() { return Math.max(80, scroll.clientWidth - (innerWidth <= 650 ? 16 : 32)) * zoom; }
  function size(page, width = fitWidth()) {
    const dim = dimensions.get(page.number) || [baseWidth, baseHeight];
    page.frame.style.width = width + 'px'; page.frame.style.height = width * dim[1] / dim[0] + 'px';
  }
  async function render(page, version) {
    if (closed || version !== generation || page.rendered) return;
    const proxy = await pdf.getPage(page.number); if (closed || version !== generation) return;
    const base = proxy.getViewport({ scale: 1 }); dimensions.set(page.number, [base.width, base.height]);
    // Changing an estimated page height must not move the passage being read.
    const anchor = snapshot(), active = pages[anchor.page - 1];
    size(page); endSpace(); if (active) scroll.scrollTop = top(active.frame) + anchor.position * active.frame.clientHeight;
    const viewport = proxy.getViewport({ scale: fitWidth() / base.width });
    const ratio = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
    page.canvas.width = Math.ceil(viewport.width * ratio); page.canvas.height = Math.ceil(viewport.height * ratio);
    page.canvas.style.width = viewport.width + 'px'; page.canvas.style.height = viewport.height + 'px';
    page.frame.style.setProperty('--scale-factor', String(viewport.scale)); page.frame.style.setProperty('--total-scale-factor', String(viewport.scale));
    page.renderTask = proxy.render({ canvasContext: page.canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }); await page.renderTask.promise;
    if (closed || version !== generation) return;
    const text = await proxy.getTextContent(); if (closed || version !== generation) return;
    page.textLayer = new TextLayer({ textContentSource: text, container: page.text, viewport }); await page.textLayer.render();
    if (closed || version !== generation) return;
    page.rendered = true; page.frame.dataset.loaded = 'true'; paintHighlights();
    if (page.number === pageNumber) $('reader-status').textContent = text.items.some(item => item.str?.trim()) ? '上下滚动连续阅读，选中文字即可高亮。' : '本页为扫描页，需文字识别后才能高亮。';
  }
  function scheduleVisible() {
    if (closed || !pages.length || layingOut) return Promise.resolve();
    const active = currentPage(); controls(active.number);
    const bottom = scroll.scrollTop + scroll.clientHeight;
    const wanted = pages.filter(p => top(p.frame) + p.frame.clientHeight >= scroll.scrollTop - scroll.clientHeight && top(p.frame) <= bottom + scroll.clientHeight);
    // Keep only nearby canvases; page shells preserve the full document scroll range.
    const keep = new Set(wanted);
    for (const page of pages) if (!keep.has(page) && page.rendered) { release(page); delete page.frame.dataset.loaded; }
    const version = generation;
    const ordered = [...wanted].sort((a,b) => Math.abs(a.number-active.number) - Math.abs(b.number-active.number));
    queue = queue.catch(() => {}).then(async () => {
      for (const page of ordered) {
        if (closed || version !== generation) return;
        // A fast jump can make a previously queued page irrelevant.
        if (Math.abs(top(page.frame) - scroll.scrollTop) > scroll.clientHeight * 3 + page.frame.clientHeight) continue;
        try { await render(page, version); } catch (error) { if (!closed && version === generation && error.name !== 'RenderingCancelledException') { $('reader-status').textContent = '页面加载失败：' + errorText(error); } }
      }
    });
    return queue;
  }
  async function showPage(number, position = 0, viewportY = 0) {
    if (!pdf || closed || !pages.length) return;
    const target = Math.max(1, Math.min(pdf.numPages, Math.floor(number))); const page = pages[target - 1];
    if (pendingAnchor) pendingAnchor = { page: target, position, viewportY };
    editingPage = false; controls(target, true); scroll.scrollTop = Math.max(0, top(page.frame) + position * page.frame.clientHeight - viewportY);
    await scheduleVisible(); if (!closed) saveNow();
  }
  async function layout(anchor = snapshot()) {
    if (!pdf || closed) return;
    clearTimeout(resizeTimer); pendingAnchor = null;
    layingOut = true; const version = ++generation; layoutSignature = `${scroll.clientWidth}:${scroll.clientHeight}:${zoom}`; stack.dataset.layout = 'busy'; selection = null; $('selection-tools').hidden = true; window.getSelection()?.removeAllRanges();
    for (const page of pages) { release(page); delete page.frame.dataset.loaded; size(page); }
    stack.style.width = Math.max(scroll.clientWidth - (innerWidth <= 650 ? 16 : 32), fitWidth()) + 'px';
    endSpace(); layingOut = false;
    if (anchor.x !== undefined) { const frame = pages[anchor.page - 1]?.frame; if (frame) scroll.scrollLeft = Math.max(0, frame.offsetLeft + anchor.x * frame.clientWidth - anchor.viewportX); }
    else scroll.scrollLeft = Math.min(scroll.scrollLeft, Math.max(0, stack.scrollWidth - scroll.clientWidth));
    await showPage(anchor.page, anchor.position, anchor.viewportY || 0);
    if (!closed && version === generation) stack.dataset.layout = 'ready';
  }
  async function outline() {
    const items = await pdf.getOutline(); if (closed) return; $('reader-outline').replaceChildren();
    const heading = el('div', 'reader-panel-heading'), closeButton = el('button', 'button compact', '×');
    closeButton.setAttribute('aria-label', '关闭教材目录'); closeButton.addEventListener('click', () => panel('outline', false)); heading.append(el('h2', '', '教材目录'), closeButton); $('reader-outline').append(heading);
    if (!items?.length) { $('reader-outline').append(el('p', 'muted', '这份 PDF 没有内置目录，可输入页码跳转。')); return; }
    let count = 0;
    function append(items, depth = 0) {
      if (depth > 8) return;
      for (const item of items) {
        if (++count > 1000) return;
        const button = el('button', 'outline-entry', item.title); button.style.paddingLeft = 12 + depth * 12 + 'px';
        button.addEventListener('click', async () => { try { const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest; if (!dest || closed) return; const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]); if (!closed) await showPage(index + 1); } catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } });
        $('reader-outline').append(button); if (item.items?.length) append(item.items, depth + 1);
      }
    }
    append(items);
  }
  on($('reader-prev'), 'click', () => showPage(pageNumber - 1));
  on($('reader-next'), 'click', () => showPage(pageNumber + 1));
  const inputPage = () => { const number = $('reader-page').valueAsNumber; if (Number.isFinite(number)) showPage(number); else { editingPage = false; controls(pageNumber, true); } };
  on($('reader-page'), 'input', () => { editingPage = true; });
  on($('reader-page'), 'change', inputPage);
  on($('reader-page'), 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); inputPage(); } });
  on($('reader-page'), 'blur', () => { editingPage = false; controls(pageNumber, true); });
  function zoomControls() { $('reader-zoom').value = String(Math.round(zoom * 100)); $('reader-zoom-out').disabled = zoom <= .25; $('reader-zoom-in').disabled = zoom >= 4; }
  function setZoom(percent, point) {
    if (!pdf || !pages.length || !Number.isFinite(percent)) { zoomControls(); return; }
    clearTimeout(zoomTimer); pendingZoom = null;
    const value = Math.max(25, Math.min(400, Math.round(percent))) / 100;
    if (value === zoom) { zoomControls(); return; }
    const anchor = snapshot();
    if (point) {
      const frame = point.target?.closest?.('.pdf-page'), rect = frame?.getBoundingClientRect(), view = scroll.getBoundingClientRect();
      if (rect) { anchor.page = Number(frame.dataset.page); anchor.position = Math.max(0, Math.min(1, (point.y - rect.top) / rect.height)); anchor.viewportY = point.y - view.top; anchor.x = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width)); anchor.viewportX = point.x - view.left; }
    }
    zoom = value; zoomControls(); layout(anchor);
  }
  const inputZoom = () => setZoom($('reader-zoom').valueAsNumber);
  on($('reader-zoom'), 'change', inputZoom);
  on($('reader-zoom'), 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); inputZoom(); } });
  on($('reader-zoom-out'), 'click', () => setZoom(zoom * 100 - 10));
  on($('reader-zoom-in'), 'click', () => setZoom(zoom * 100 + 10));
  on($('reader-fit-width'), 'click', () => setZoom(100));
  on(scroll, 'wheel', event => {
    if ((!event.ctrlKey && !event.metaKey) || !pdf || !pages.length) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1);
    pendingZoom = Math.max(25, Math.min(400, (pendingZoom ?? zoom * 100) * Math.exp(-Math.max(-200, Math.min(200, delta)) * .0015)));
    clearTimeout(zoomTimer); const point = { target: event.target, x: event.clientX, y: event.clientY };
    zoomTimer = setTimeout(() => setZoom(pendingZoom, point), 70);
  }, { passive: false });
  for (const name of ['outline', 'notes']) on($('reader-' + name + '-toggle'), 'click', () => panel(name, $('reader-' + name).hidden));
  on($('reader-notes-close'), 'click', () => panel('notes', false));
  on($('reader-fullscreen'), 'click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('reader-view').requestFullscreen(); } catch { $('reader-status').textContent = '当前浏览器不支持全屏阅读。'; } });
  on(document, 'fullscreenchange', () => { $('reader-fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏'; const anchor = pdf && pages.length ? snapshot() : null; applyPanelWidths(); if (anchor) layout(anchor); });
  for (const button of document.querySelectorAll('[data-highlight]')) {
    on(button, 'pointerdown', event => event.preventDefault());
    on(button, 'click', async () => {
      if (!selection) return; const value = { ...selection, color: button.dataset.highlight, note: '' }; button.disabled = true;
      try { const created = await write(`/api/learning/books/${id}/annotations`, value); if (closed) return; marks.push({ ...value, id: created.id }); notes(); paintHighlights(); selection = null; $('selection-tools').hidden = true; window.getSelection()?.removeAllRanges(); $('reader-status').textContent = '高亮已保存，可在笔记面板添加笔记。'; }
      catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } finally { button.disabled = false; }
    });
  }
  on(document, 'selectionchange', captureSelection);
  on(scroll, 'scroll', () => {
    if (layingOut || closed) return;
    if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = null; scheduleVisible(); });
    clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600);
  }, { passive: true });
  function queueLayout(anchor) {
    if (closed || drag || !pdf || !pages.length || layoutSignature === `${scroll.clientWidth}:${scroll.clientHeight}:${zoom}`) return;
    const previous = layoutSignature.split(':');
    if (Number(previous[0]) === scroll.clientWidth && Number(previous[2]) === zoom) { layoutSignature = `${scroll.clientWidth}:${scroll.clientHeight}:${zoom}`; endSpace(); scheduleVisible(); return; }
    pendingAnchor ??= anchor || snapshot(); clearTimeout(resizeTimer); stack.dataset.layout = 'pending'; resizeTimer = setTimeout(() => { const target = pendingAnchor; pendingAnchor = null; layout(target || snapshot()); }, 100);
  }
  const observer = new ResizeObserver(() => queueLayout()); observer.observe(scroll);
  on(window, 'resize', () => { const anchor = pdf && pages.length ? snapshot() : null; applyPanelWidths(); queueLayout(anchor); });
  function previewDrag() {
    if (!drag) return;
    changeWidth(drag.name, drag.startWidth + (drag.x - drag.startX) * (drag.name === 'outline' ? 1 : -1));
    if (!pdf || !pages.length) return;
    // Scale existing canvases immediately while dragging; rerender sharply on release.
    layingOut = true; stack.dataset.layout = 'pending';
    for (const page of pages) { size(page); page.canvas.style.width = page.frame.style.width; page.canvas.style.height = page.frame.style.height; }
    stack.style.width = Math.max(scroll.clientWidth - (innerWidth <= 650 ? 16 : 32), fitWidth()) + 'px'; endSpace();
    const page = pages[drag.anchor.page - 1]; if (page) scroll.scrollTop = top(page.frame) + drag.anchor.position * page.frame.clientHeight;
  }
  function finishDrag() {
    if (!drag) return; cancelAnimationFrame(dragFrame); dragFrame = null; previewDrag();
    const value = drag; drag = null; value.handle.classList.remove('active'); layoutBox.classList.remove('reader-resizing');
    if (value.handle.hasPointerCapture(value.pointerId)) value.handle.releasePointerCapture(value.pointerId);
    layingOut = false; storeWidths(); if (pdf && pages.length) layout(value.anchor);
  }
  for (const name of ['outline', 'notes']) {
    const handle = $('reader-' + name + '-resize');
    on(handle, 'pointerdown', event => {
      if (event.button !== 0 || drag) return; event.preventDefault(); clearTimeout(resizeTimer);
      drag = { name, handle, pointerId: event.pointerId, startX: event.clientX, x: event.clientX, startWidth: $('reader-' + name).getBoundingClientRect().width, anchor: pdf && pages.length ? snapshot() : { page: 1, position: 0 } };
      ++generation; layingOut = true; selection = null; $('selection-tools').hidden = true; for (const page of pages) { page.renderTask?.cancel(); page.textLayer?.cancel(); }
      handle.setPointerCapture(event.pointerId); handle.classList.add('active'); layoutBox.classList.add('reader-resizing');
    });
    on(handle, 'pointermove', event => { if (!drag || drag.handle !== handle || event.pointerId !== drag.pointerId) return; drag.x = event.clientX; if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame = null; previewDrag(); }); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) on(handle, event, finishDrag);
    on(handle, 'keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const anchor = pdf && pages.length ? snapshot() : null;
      const delta = (event.key === 'ArrowRight' ? 20 : -20) * (name === 'outline' ? 1 : -1);
      const width = event.key === 'Home' ? Number(handle.getAttribute('aria-valuemin')) : event.key === 'End' ? Number(handle.getAttribute('aria-valuemax')) : $('reader-' + name).getBoundingClientRect().width + delta;
      changeWidth(name, width); storeWidths(); if (anchor) layout(anchor);
    });
  }
  on(window, 'blur', finishDrag);
  on(window, 'pagehide', saveNow);
  const ready = (async () => {
    try {
      book = await api(`/api/learning/books/${id}`); if (closed) return;
      $('reader-title').textContent = book.title; $('reader-back').href = `#/apps/mathematics/directions/${book.direction}`;
      if (!book.available) throw new Error('这本教材的 PDF 尚未接入，请先选择其他教材。');
      csrf = await api('/api/auth/csrf'); if (closed) return;
      task = getDocument({ url: book.file_url, withCredentials: true, isEvalSupported: false, useWasm: false, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/' }); pdf = await task.promise; if (closed) return;
      if (pdf.numPages > 100000) throw new Error('教材页数超出支持范围。');
      const first = await pdf.getPage(1); if (closed) return; const viewport = first.getViewport({ scale: 1 }); baseWidth = viewport.width; baseHeight = viewport.height;
      $('reader-pages').textContent = String(pdf.numPages); $('reader-page').max = String(pdf.numPages);
      marks = (await api(`/api/learning/books/${id}/annotations`)).annotations; if (closed) return;
      notes(); zoom = book.progress?.zoom || 1; if (!Number.isFinite(zoom) || zoom < .25 || zoom > 4) zoom = 1; zoomControls();
      const fragment = document.createDocumentFragment();
      for (let number = 1; number <= pdf.numPages; number++) {
        const frame = el('div', 'pdf-page'), canvas = el('canvas', 'pdf-canvas'), highlights = el('div', 'pdf-highlights'), text = el('div', 'textLayer');
        frame.dataset.page = String(number); frame.setAttribute('role', 'region'); frame.setAttribute('aria-label', `PDF 第 ${number} 页`); highlights.setAttribute('aria-hidden', 'true'); canvas.setAttribute('aria-label', `PDF 第 ${number} 页`);
        frame.append(canvas, highlights, text); fragment.append(frame); pages.push({ number, frame, canvas, highlights, text, rendered: false });
      }
      stack.append(fragment); await layout({ page: book.progress?.page || 1, position: book.progress?.position || 0 });
      if (!closed) await outline();
    } catch (error) { if (!closed) $('reader-status').textContent = '无法打开教材：' + errorText(error); }
  })();
  function close() {
    if (closed) return; if (drag) finishDrag(); saveNow(); closed = true; ++generation; observer.disconnect(); clearTimeout(saveTimer); clearTimeout(resizeTimer); clearTimeout(zoomTimer); cancelAnimationFrame(scrollFrame); cancelAnimationFrame(dragFrame); events.forEach(remove => remove()); pages.forEach(release);
    if (document.fullscreenElement === $('reader-view')) document.exitFullscreen().catch(() => {});
    if (task) task.destroy().catch(() => {}); stack.replaceChildren(); $('annotation-list').replaceChildren();
  }
  return { ready, close };
}
