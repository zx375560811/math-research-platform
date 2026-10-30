import { getDjvuDocument } from './reader-djvu.js';
import { createReaderAi } from './reader-ai.js';
import { getDocument, GlobalWorkerOptions, TextLayer } from './vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
const $ = id => document.getElementById(id);
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
export function openReader(id, { api, write, basePath = '/api/learning/books', backHref, backLabel = '← 返回教材', fullLoad = false, trackProgress = true }) {
  const endpoint = `${basePath}/${id}`;
  let closed = false, pdf = null, task = null, book = null, csrf = null, successor = null;
  const requests = new AbortController(), loadingWatchers = new Set();
  let received = 0;
  function activity() { for (const reset of loadingWatchers) reset(); }
  function waiting(operation, stage, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => { clearTimeout(timer); loadingWatchers.delete(reset); requests.signal.removeEventListener('abort', abort); };
      const fail = error => { cleanup(); reject(error); };
      const reset = () => { clearTimeout(timer); timer = setTimeout(() => { const error = new Error(stage + (timeoutMs >= 60000 ? '超过 60 秒没有响应，请重试或选择整本加载。' : '超时没有响应，请重试或选择整本加载。')); error.code = 'reader_timeout'; fail(error); }, timeoutMs); };
      const abort = () => fail(new DOMException('Reader closed', 'AbortError'));
      Promise.resolve(operation).then(value => { cleanup(); resolve(value); }, fail);
      if (requests.signal.aborted) abort(); else { requests.signal.addEventListener('abort', abort, { once: true }); loadingWatchers.add(reset); reset(); }
    });
  }
  let pageNumber = 1, zoom = 1, marks = [], selection = null, saveTimer, resizeTimer, scrollFrame, zoomTimer, pendingZoom = null;
  let saved = '', desired = null, saving = false, layingOut = false, generation = 0, queue = Promise.resolve(), layoutSignature = '';
  let baseWidth = 612, baseHeight = 792;
  let drag = null, dragFrame = null, pendingAnchor = null;
  let verticalDrag = null, noteRatio = .35, expandedMark = null, markersExpanded = false, inlineMark = null, inlineSaving = false;
  const heightKey = 'math.reader.panel-height.v1';
  try { const value = Number(localStorage.getItem(heightKey)); if (value >= .1 && value <= .75) noteRatio = value; } catch { /* Optional layout preference. */ }
  const layoutBox = $('reader-view'), widthKey = 'math.reader.panel-widths.v1';
  const preferredWidths = { outline: layoutBox.clientWidth <= 650 ? layoutBox.clientWidth * .2 : 220, notes: layoutBox.clientWidth <= 650 ? layoutBox.clientWidth * .26 : 380 };
  try { const stored = JSON.parse(localStorage.getItem(widthKey)); for (const name of ['outline', 'notes']) if (Number.isFinite(stored?.[name]) && stored[name] >= 64 && stored[name] <= 3000) preferredWidths[name] = stored[name]; } catch { /* Layout preferences are optional. */ }
  const pages = [], dimensions = new Map(), drafts = new Map(), events = [];
  const scroll = $('reader-scroll'), stack = $('pdf-pages');
  const on = (target, event, handler, options) => { target.addEventListener(event, handler, options); events.push(() => target.removeEventListener(event, handler, options)); };
  const ai = createReaderAi(() => ({ document_id: Number(book?.file_url?.match(/\/api\/documents\/(\d+)\/file/)?.[1]), title: book?.title, selection: selection ? { ...selection } : null }), () => {
    selection = null; $('selection-tools').hidden = true; $('reader-ask-ai').disabled = true; window.getSelection()?.removeAllRanges();
  });
  const divider = $('reader-ai-resize');
  function setNoteRatio(value) {
    noteRatio = Math.max(.1, Math.min(.75, value)); $('reader-notes').style.setProperty('--reader-note-height', `${noteRatio * 100}%`); divider.setAttribute('aria-valuenow', String(Math.round(noteRatio * 100)));
  }
  function saveNoteRatio() { try { localStorage.setItem(heightKey, String(noteRatio)); } catch { /* Optional preference. */ } }
  function stopVertical() {
    if (verticalDrag === null) return; const pointerId = verticalDrag; verticalDrag = null;
    divider.classList.remove('active'); $('reader-notes').classList.remove('reader-vertical-resizing');
    if (divider.hasPointerCapture(pointerId)) divider.releasePointerCapture(pointerId); saveNoteRatio();
  }
  on(divider, 'pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); verticalDrag = event.pointerId; divider.setPointerCapture(event.pointerId); divider.classList.add('active'); $('reader-notes').classList.add('reader-vertical-resizing'); });
  on(divider, 'pointermove', event => { if (verticalDrag !== event.pointerId) return; const box = $('reader-notes').getBoundingClientRect(); setNoteRatio((event.clientY - box.top - 5) / box.height); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) on(divider, name, stopVertical);
  on(window, 'blur', stopVertical);
  on(divider, 'keydown', event => { if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return; event.preventDefault(); setNoteRatio(event.key === 'Home' ? .1 : event.key === 'End' ? .75 : noteRatio + (event.key === 'ArrowDown' ? .05 : -.05)); saveNoteRatio(); });
  setNoteRatio(noteRatio); $('reader-ask-ai').disabled = true;
  const notesToggle = $('reader-notes-toggle'), notesKey = 'math.reader.notes-collapsed.v1';
  let notesCollapsed = false;
  try { notesCollapsed = localStorage.getItem(notesKey) === '1'; } catch { /* Optional layout preference. */ }
  function setNotesCollapsed(value) {
    notesCollapsed = Boolean(value);
    $('reader-notes').classList.toggle('notes-collapsed', notesCollapsed);
    notesToggle.textContent = notesCollapsed ? '展开' : '折叠';
    notesToggle.setAttribute('aria-expanded', String(!notesCollapsed));
    try { localStorage.setItem(notesKey, notesCollapsed ? '1' : '0'); } catch { /* Optional layout preference. */ }
  }
  on(notesToggle, 'click', () => setNotesCollapsed(!notesCollapsed));
  setNotesCollapsed(notesCollapsed);
  const errorText = error => error?.message || '文件加载失败，请重试。';
  function restart(whole = fullLoad) {
    if (closed) return;
    close(); successor = openReader(id, { api, write, basePath, backHref, backLabel, fullLoad: whole, trackProgress });
  }
  function failure(error, page = null, textOnly = false) {
    if (closed) return;
    const box = el('div', textOnly ? 'reader-load-error reader-text-error' : 'reader-load-error'); box.setAttribute('role', 'alert');
    box.append(el('strong', '', textOnly ? '页面已显示，文字层加载失败' : page ? `第 ${page.number} 页加载失败` : '无法打开教材：'));
    box.append(el('p', '', errorText(error)));
    const actions = el('div', 'reader-load-actions'), retry = el('button', 'button compact', '重新加载'); retry.type = 'button'; retry.addEventListener('click', () => restart()); actions.append(retry);
    if (book?.file_url && book.format !== 'djvu' && !fullLoad) { const whole = el('button', 'button compact', '整本加载'); whole.type = 'button'; whole.title = '下载完整 PDF 后阅读，耗时与内存用量可能增加'; whole.addEventListener('click', () => restart(true)); actions.append(whole); }
    if (book?.file_url) { const download = el('a', 'button compact', '下载原文件'); download.href = book.file_url; download.download = ''; actions.append(download); }
    box.append(actions);
    if (page) { page.errorBox?.remove(); page.errorBox = box; page.frame.dataset.error = 'true'; page.frame.append(box); }
    else stack.replaceChildren(box);
    $('reader-status').textContent = '无法打开教材：' + errorText(error);
  }
  function loading(message) { const label = el('p', 'reader-loading', message); stack.replaceChildren(label); return label; }
  async function wholeFile(response, label) {
    if (!response.ok) throw new Error(`文件请求失败（HTTP ${response.status}），请检查登录状态和文件接口。`);
    const reader = response.body.getReader(), chunks = []; let length = 0;
    try { for (;;) { const part = await waiting(reader.read(), '下载 PDF'); if (part.done) break; chunks.push(part.value); length += part.value.length; activity(); if (!closed) label.textContent = `正在整本加载 PDF，已读取 ${(length / 1048576).toFixed(1)} MB…`; } }
    catch (error) { reader.cancel().catch(() => {}); throw error; }
    const data = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; } return data;
  }
  async function pdfSource(label) {
    const response = await waiting(fetch(book.file_url, { credentials: 'same-origin', cache: 'no-store', signal: requests.signal, ...(!fullLoad ? { headers: { Range: 'bytes=0-0' } } : {}) }), '读取文件响应');
    if (fullLoad || response.status === 200) return { data: await wholeFile(response, label) };
    const range = /^bytes 0-0\/([1-9]\d*)$/.exec(response.headers.get('Content-Range') || '');
    if (response.status !== 206 || !range) { response.body?.cancel().catch(() => {}); throw new Error(`文件分段响应异常（HTTP ${response.status}，Content-Range: ${response.headers.get('Content-Range') || '缺失'}），请重试或选择整本加载。`); }
    // Verify the probe body as well as its headers before PDF.js starts requesting ranges.
    const reader = response.body.getReader(); let length = 0;
    try { for (;;) { const part = await waiting(reader.read(), '校验分段响应'); if (part.done) break; length += part.value.length; if (length > 1) break; } }
    finally { reader.cancel().catch(() => {}); }
    if (length !== 1) throw new Error('文件分段响应的字节数不正确，请选择整本加载。');
    // PDF.js also checks the initial response headers before enabling byte ranges.
    return { url: book.file_url, withCredentials: true, disableStream: true, disableAutoFetch: true };
  }
  stack.replaceChildren(); $('annotation-list').replaceChildren(); $('selection-tools').hidden = true;
  $('reader-save-status').textContent = trackProgress ? '' : '预览模式 · 不保存进度'; $('reader-save-status').classList.remove('save-error');
  $('reader-outline').replaceChildren(el('p', 'muted', '正在加载目录…'));
  $('reader-title').textContent = '正在打开教材…';
  $('reader-outline').hidden = true; $('reader-notes').hidden = false;
  $('reader-outline-toggle').setAttribute('aria-expanded', 'false');
  const top = frame => frame.offsetTop + stack.offsetTop;
  function currentPage() {
    let lo = 0, hi = pages.length - 1;
    const y = scroll.scrollTop + 24;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (top(pages[mid].frame) <= y) lo = mid; else hi = mid - 1; }
    return pages[lo];
  }
  function controls(number) {
    pageNumber = number; scroll.dataset.page = String(number);
    const pageInput = $('reader-page-input'); if (pageInput && document.activeElement !== pageInput) pageInput.value = String(number);
  }
  function snapshot() {
    const page = currentPage();
    return { page: page?.number || pageNumber, total_pages: pdf.numPages, position: page ? Math.min(1, Math.max(0, (scroll.scrollTop - top(page.frame)) / page.frame.clientHeight)) : 0, zoom };
  }
  async function drainSave() {
    if (!trackProgress || saving || !csrf) return; saving = true;
    try {
      while (desired) {
        const value = desired; desired = null; const json = JSON.stringify(value); if (json === saved) continue;
        if (!closed) $('reader-save-status').textContent = '正在保存阅读位置…';
        await api(`${endpoint}/progress`, { method: 'PUT', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json', [csrf.header]: csrf.token }, body: json });
        saved = json; if (!closed) $('reader-save-status').textContent = '阅读位置已保存';
      }
    } catch (error) { if (!closed) { $('reader-save-status').textContent = '阅读位置未保存：' + errorText(error); $('reader-save-status').classList.add('save-error'); } }
    finally { saving = false; }
  }
  let saveTask = Promise.resolve();
  function saveNow() { clearTimeout(saveTimer); if (trackProgress && pdf && book && currentPage()?.rendered && !layingOut) { desired = snapshot(); $('reader-save-status').classList.remove('save-error'); if (!saving) saveTask = drainSave(); } return saveTask; }
  function paintHighlights() {
    for (const page of pages) {
      if (!page.rendered) continue; page.highlights.replaceChildren();
      for (const mark of marks.filter(m => m.page === page.number)) for (const r of mark.rects) {
        const box = el('span', 'pdf-highlight ' + mark.color); box.style.left = r.x * 100 + '%'; box.style.top = r.y * 100 + '%'; box.style.width = r.width * 100 + '%'; box.style.height = r.height * 100 + '%'; box.dataset.annotation = mark.id; box.title = '点击编辑笔记'; box.addEventListener('click', () => openInlineNote(mark)); page.highlights.append(box);
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
    $('reader-' + name).hidden = !visible; $('reader-' + name + '-toggle')?.setAttribute('aria-expanded', String(visible)); applyPanelWidths();
    if (anchor) { const result = layout(anchor), version = generation; result.then(() => { if (chosen && selection === chosen && !closed && version === generation) { selection = chosen; $('reader-ask-ai').disabled = false; $('selection-quote').textContent = chosen.quote; $('selection-tools').hidden = false; } }); }
  }
  applyPanelWidths();
  function notes() {
    const list = $('annotation-list'); list.replaceChildren();
    if (!marks.length) { list.append(el('p', 'muted', '暂无高亮')); return; }
    for (const mark of marks) {
      const row = el('article', 'highlight-row'); row.dataset.annotation = mark.id;
      const dot = el('span', 'highlight-row-dot'); dot.dataset.highlight = mark.color; dot.setAttribute('aria-hidden', 'true');
      const body = el('div', 'highlight-row-body');
      body.append(el('blockquote', '', mark.quote), el('p', mark.note ? 'highlight-row-note' : 'highlight-row-note muted', mark.note || '点击写笔记'), el('span', 'highlight-row-meta', `第 ${mark.page} 页 · 点击编辑`));
      row.append(dot, body); row.addEventListener('click', () => openInlineNote(mark)); list.append(row);
    }
  }
  function closeInlineNote() {
    $('inline-note').hidden = true;
    $('inline-note').style.left = '';
    $('inline-note').style.top = '';
    inlineMark = null;
  }
  function openInlineNote(mark) {
    inlineMark = marks.find(item => item.id === mark.id) || mark;
    $('inline-note-quote').textContent = inlineMark.quote || '';
    $('inline-note-text').value = inlineMark.note || '';
    $('inline-note-status').textContent = '';
    const card = $('inline-note'); card.hidden = false; card.style.transform = '';
    const page = pages.find(item => item.number === inlineMark.page), frame = page?.frame?.getBoundingClientRect(), rect = inlineMark.rects?.[0];
    if (frame && rect) {
      const height = card.offsetHeight || 190;
      let left = frame.left + rect.x * frame.width;
      let top = frame.top + (rect.y + rect.height) * frame.height + 10;
      left = Math.max(12, Math.min(window.innerWidth - card.offsetWidth - 12, left));
      if (top + height > window.innerHeight - 12) top = Math.max(12, frame.top + rect.y * frame.height - height - 10);
      card.style.left = left + 'px'; card.style.top = top + 'px';
    } else {
      card.style.left = '50%'; card.style.top = '110px'; card.style.transform = 'translateX(-50%)';
    }
    $('inline-note-text').focus();
  }
  async function saveInlineNote() {
    if (!inlineMark || inlineSaving) return;
    inlineSaving = true; $('inline-note-save').disabled = true; $('inline-note-status').textContent = '正在保存…';
    const mark = inlineMark, note = $('inline-note-text').value.trim();
    try {
      await write(`${endpoint}/annotations/${mark.id}`, { note }, 'PATCH');
      if (closed) return;
      mark.note = note; drafts.delete(mark.id); $('reader-status').textContent = '笔记已保存'; closeInlineNote(); notes(mark.id);
    } catch (error) { if (!closed) $('inline-note-status').textContent = errorText(error); }
    finally { inlineSaving = false; $('inline-note-save').disabled = false; }
  }
  on($('inline-note-close'), 'click', closeInlineNote);
  on($('inline-note-save'), 'click', saveInlineNote);
  on(scroll, 'scroll', () => { if (!$('inline-note').hidden) closeInlineNote(); }, { passive: true });
  on(document, 'click', event => {
    if (closed) return;
    const frame = event.target.closest?.('.pdf-page'); if (!frame) return;
    const selected = window.getSelection(); if (selected && !selected.isCollapsed) return;
    const bounds = frame.getBoundingClientRect(), x = (event.clientX - bounds.left) / bounds.width, y = (event.clientY - bounds.top) / bounds.height;
    const page = Number(frame.dataset.page);
    const mark = marks.find(item => item.page === page && item.rects.some(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height));
    if (mark) openInlineNote(mark);
  });
  function captureSelection() {
    if (closed || layingOut) return;
    const selected = window.getSelection();
    const element = node => node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const frame = element(selected?.anchorNode)?.closest('.pdf-page');
    const layer = frame?.querySelector('.textLayer');
    // Keep the captured quote available while the user interacts with notes or the AI composer.
    if (!selected || selected.isCollapsed || !layer?.contains(selected.anchorNode) || !layer.contains(selected.focusNode)) return;
    const quote = selected.toString().trim(), bounds = frame.getBoundingClientRect(), rects = [];
    if (!quote) { selection = null; $('selection-tools').hidden = true; $('reader-ask-ai').disabled = true; return; }
    for (const r of selected.getRangeAt(0).getClientRects()) {
      const x = Math.max(bounds.left, r.left), y = Math.max(bounds.top, r.top), right = Math.min(bounds.right, r.right), bottom = Math.min(bounds.bottom, r.bottom);
      if (right > x && bottom > y) rects.push({ x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height, width: (right - x) / bounds.width, height: (bottom - y) / bounds.height });
    }
    if (!rects.length) { selection = null; $('selection-tools').hidden = true; $('reader-ask-ai').disabled = true; return; }
    expandedMark = null;
    for (const panel of $('annotation-list').querySelectorAll('.annotation-item')) panel.hidden = true;
    for (const button of $('annotation-list').querySelectorAll('.annotation-summary')) button.setAttribute('aria-expanded', 'false');
    selection = { page: Number(frame.dataset.page), quote, rects }; if (notesCollapsed) setNotesCollapsed(false); ai.updateContext(selection); $('reader-ask-ai').disabled = false; for (const button of document.querySelectorAll('[data-highlight]')) button.disabled = quote.length > 4000 || rects.length > 100; $('selection-quote').textContent = quote; $('selection-tools').hidden = false; panel('notes', true, selection);
  }
  function release(page) {
    try { page.renderTask?.cancel(); } catch {} try { page.textLayer?.cancel(); } catch {} page.renderTask = page.textLayer = null;
    page.canvas.width = page.canvas.height = 0; page.canvas.style.width = page.canvas.style.height = '0px'; page.text.replaceChildren(); page.highlights.replaceChildren(); page.rendered = false; page.rendering = false;
    page.failed = false; page.errorBox?.remove(); page.errorBox = null; delete page.frame.dataset.error; delete page.frame.dataset.painted; delete page.frame.dataset.loaded; delete page.frame.dataset.loadingMessage;
  }
  function endSpace() { const last = pages.at(-1); stack.style.paddingBottom = Math.max(0, scroll.clientHeight - (last?.frame.clientHeight || 0)) + 'px'; }
  function fitWidth() { return Math.max(80, scroll.clientWidth - (innerWidth <= 650 ? 16 : 32)) * zoom; }
  function size(page, width = fitWidth()) {
    const dim = dimensions.get(page.number) || [baseWidth, baseHeight];
    page.frame.style.width = width + 'px'; page.frame.style.height = width * dim[1] / dim[0] + 'px';
  }
  async function render(page, version) {
    if (closed || version !== generation || page.rendered || page.rendering || page.failed) return;
    page.rendering = true;
    try {
    page.frame.dataset.loadingMessage = `正在读取第 ${page.number} 页内容…`;
    const proxy = await waiting(pdf.getPage(page.number), `读取第 ${page.number} 页`, 25000); if (closed || version !== generation) return;
    const base = proxy.getViewport({ scale: 1 }); dimensions.set(page.number, [base.width, base.height]);
    // Changing an estimated page height must not move the passage being read.
    const anchor = snapshot(), active = pages[anchor.page - 1];
    size(page); endSpace(); if (active) scroll.scrollTop = top(active.frame) + anchor.position * active.frame.clientHeight;
    const viewport = proxy.getViewport({ scale: fitWidth() / base.width });
    const ratio = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
    page.canvas.width = Math.ceil(viewport.width * ratio); page.canvas.height = Math.ceil(viewport.height * ratio);
    page.canvas.style.width = viewport.width + 'px'; page.canvas.style.height = viewport.height + 'px';
    page.frame.style.setProperty('--scale-factor', String(viewport.scale)); page.frame.style.setProperty('--total-scale-factor', String(viewport.scale));
    page.frame.dataset.loadingMessage = `正在绘制第 ${page.number} 页…`;
    try { page.renderTask?.cancel(); } catch {} page.renderTask = proxy.render({ canvasContext: page.canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }); await waiting(page.renderTask.promise, `绘制第 ${page.number} 页`, 25000);
    if (closed || version !== generation) return;
    page.rendered = true; page.frame.dataset.painted = 'true'; delete page.frame.dataset.loadingMessage; paintHighlights();
    let text;
    try {
      text = await waiting(proxy.getTextContent(), `读取第 ${page.number} 页文字`, 15000); if (closed || version !== generation || !page.rendered) return;
      page.textLayer = pdf.createTextLayer ? pdf.createTextLayer({ textContentSource: text, container: page.text, viewport }) : new TextLayer({ textContentSource: text, container: page.text, viewport }); await waiting(page.textLayer.render(), `排版第 ${page.number} 页文字`, 15000);
    } catch (error) { if (!closed && version === generation && page.rendered && error.name !== 'RenderingCancelledException' && error.name !== 'AbortError' && error.name !== 'AbortException') { page.frame.dataset.loaded = 'true'; failure(error, page, true); } return; }
    if (closed || version !== generation || !page.rendered) return;
    page.frame.dataset.loaded = 'true';
    if (page.number === pageNumber) $('reader-status').textContent = text.items.some(item => item.str?.trim()) ? '上下滚动连续阅读，选中文字即可高亮。' : '本页为扫描页，需文字识别后才能高亮。';
    } finally {
      page.rendering = false;
      if (closed || version !== generation) {
        if (!page.rendered) release(page);
      }
    }
  }
  function scheduleVisible() {
    if (closed || !pages.length || layingOut) return Promise.resolve();
    const active = currentPage(); controls(active.number);
    const bottom = scroll.scrollTop + scroll.clientHeight;
    const wanted = pages.filter(p => top(p.frame) + p.frame.clientHeight >= scroll.scrollTop - scroll.clientHeight && top(p.frame) <= bottom + scroll.clientHeight);
    // Keep only nearby canvases; page shells preserve the full document scroll range.
    const keep = new Set(wanted);
    for (const page of pages) if (!keep.has(page) && (page.rendered || page.rendering)) { release(page); }
    const version = generation;
    const ordered = [...wanted].sort((a,b) => Math.abs(a.number-active.number) - Math.abs(b.number-active.number));
    queue = queue.catch(() => {}).then(async () => {
      for (const page of ordered) {
        if (closed || version !== generation) return;
        // A fast jump can make a previously queued page irrelevant.
        if (Math.abs(top(page.frame) - scroll.scrollTop) > scroll.clientHeight * 3 + page.frame.clientHeight) continue;
        try { await render(page, version); } catch (error) { if (!closed && version === generation && error.name !== 'RenderingCancelledException' && error.name !== 'AbortError' && error.name !== 'AbortException') { page.failed = true; try { page.renderTask?.cancel(); } catch {} try { page.textLayer?.cancel(); } catch {} failure(error, page); } else if (!page.rendered) { release(page); } }
      }
    });
    return queue;
  }
  async function showPage(number, position = 0, viewportY = 0) {
    if (!pdf || closed || !pages.length) return;
    const target = Math.max(1, Math.min(pdf.numPages, Math.floor(number))); const page = pages[target - 1];
    if (pendingAnchor) pendingAnchor = { page: target, position, viewportY };
    controls(target); scroll.scrollTop = Math.max(0, top(page.frame) + position * page.frame.clientHeight - viewportY);
    await scheduleVisible(); if (!closed) saveNow();
  }
  async function layout(anchor = snapshot()) {
    if (!pdf || closed) return;
    clearTimeout(resizeTimer); pendingAnchor = null;
    layingOut = true; const version = ++generation; layoutSignature = `${scroll.clientWidth}:${scroll.clientHeight}:${zoom}`; stack.dataset.layout = 'busy'; window.getSelection()?.removeAllRanges();
    for (const page of pages) { release(page); delete page.frame.dataset.loaded; size(page); }
    stack.style.width = Math.max(scroll.clientWidth - (innerWidth <= 650 ? 16 : 32), fitWidth()) + 'px';
    endSpace(); layingOut = false;
    if (anchor.x !== undefined) { const frame = pages[anchor.page - 1]?.frame; if (frame) { const bounds = frame.getBoundingClientRect(), view = scroll.getBoundingClientRect(); const origin = bounds.left - view.left + scroll.scrollLeft; scroll.scrollLeft = Math.max(0, origin + anchor.x * bounds.width - anchor.viewportX); } }
    else scroll.scrollLeft = Math.min(scroll.scrollLeft, Math.max(0, stack.scrollWidth - scroll.clientWidth));
    await showPage(anchor.page, anchor.position, anchor.viewportY || 0);
    if (!closed && version === generation) stack.dataset.layout = 'ready';
  }
  async function outline() {
    const items = await waiting(pdf.getOutline(), '加载目录'); if (closed) return; $('reader-outline').replaceChildren();
    const heading = el('div', 'reader-panel-heading'), closeButton = el('button', 'button compact', '×');
    closeButton.setAttribute('aria-label', '关闭教材目录'); closeButton.addEventListener('click', () => panel('outline', false)); heading.append(el('h2', '', '教材目录'), closeButton); $('reader-outline').append(heading);
    if (!items?.length) { $('reader-outline').append(el('p', 'muted', '暂无目录')); return; }
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
  function zoomControls() { scroll.dataset.zoom = String(Math.round(zoom * 100)); }
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
  on($('reader-fit-width'), 'click', () => setZoom(100));
  on(scroll, 'wheel', event => {
    if ((!event.ctrlKey && !event.metaKey) || !pdf || !pages.length) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1);
    pendingZoom = Math.max(25, Math.min(400, (pendingZoom ?? zoom * 100) * Math.exp(-Math.max(-200, Math.min(200, delta)) * .0015)));
    clearTimeout(zoomTimer); const point = { target: event.target, x: event.clientX, y: event.clientY };
    zoomTimer = setTimeout(() => setZoom(pendingZoom, point), 70);
  }, { passive: false });
  on($('reader-outline-toggle'), 'click', () => panel('outline', $('reader-outline').hidden));
  on($('reader-fullscreen'), 'click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('reader-view').requestFullscreen(); } catch { $('reader-status').textContent = '当前浏览器不支持全屏阅读。'; } });
  on(document, 'fullscreenchange', () => { $('reader-fullscreen-label').textContent = document.fullscreenElement ? '退出全屏' : '全屏'; const anchor = pdf && pages.length ? snapshot() : null; applyPanelWidths(); if (anchor) layout(anchor); });
  for (const button of document.querySelectorAll('[data-highlight]')) {
    on(button, 'pointerdown', event => event.preventDefault());
    on(button, 'click', async () => {
      if (!selection) { $('reader-status').textContent = '请先选中 PDF 中的文字，再点颜色高亮。'; return; } const value = { ...selection, color: button.dataset.highlight, note: '' }; button.disabled = true;
      try { const created = await write(`${endpoint}/annotations`, value); if (closed) return; const createdMark = { ...value, id: created.id }; marks.push(createdMark); notes(created.id); paintHighlights(); selection = null; $('selection-tools').hidden = true; $('reader-ask-ai').disabled = true; window.getSelection()?.removeAllRanges(); $('reader-status').textContent = '高亮已保存，可在原文处添加笔记。'; openInlineNote(createdMark); }
      catch (error) { if (!closed) $('reader-status').textContent = errorText(error); } finally { button.disabled = false; }
    });
  }
  on($('reader-ask-ai'), 'pointerdown', event => event.preventDefault());
  on($('reader-ask-ai'), 'click', () => { if (selection) ai.setContext({ ...selection }); });
  if ($('reader-page-form')) on($('reader-page-form'), 'submit', event => { event.preventDefault(); showPage(Number($('reader-page-input')?.value) || pageNumber); $('reader-page-input')?.blur(); });
  if ($('reader-page-input')) on($('reader-page-input'), 'change', () => showPage(Number($('reader-page-input').value) || pageNumber));
  on(window, 'keydown', event => {
    if (closed || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.key === 'g' || event.key === 'G') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); $('reader-page-input')?.focus(); $('reader-page-input')?.select(); }
  });
  if ($('selection-discuss')) {
    on($('selection-discuss'), 'pointerdown', event => event.preventDefault());
    on($('selection-discuss'), 'click', () => {
      if (!selection || !book) return;
      const docId = Number(book.file_url?.match(/\/api\/documents\/(\d+)\/file/)?.[1]);
      const category = location.hash.startsWith('#/apps/math-to-ai') ? 'math-to-ai' : location.hash.startsWith('#/apps/competition') ? 'competition' : 'mathematics';
      try {
        sessionStorage.setItem('axiom.discussion.prefill', JSON.stringify({
          title: `${book.title} 第 ${selection.page} 页问题`,
          category,
          content: `> 摘自《${book.title}》第 ${selection.page} 页：\n> ${selection.quote.replace(/\n/g, '\n> ')}\n\n关于这段内容，我想讨论的问题是：\n`,
          document: docId ? { id: docId, title: book.title } : null
        }));
      } catch { /* Ignore sessionStorage errors. */ }
      selection = null; $('selection-tools').hidden = true; $('reader-ask-ai').disabled = true; window.getSelection()?.removeAllRanges();
      location.hash = '#/discussions/new';
    });
  }
  on(scroll, 'pointerdown', event => {
    if (event.button !== 0 || !event.target.closest('.textLayer')) return;
    selection = null; $('selection-tools').hidden = true; $('reader-ask-ai').disabled = true;
  });
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
      const label = loading('正在读取文献信息…');
      book = await waiting(api(`${endpoint}`, { signal: requests.signal }), '读取文献信息'); if (closed) return;
      const progress = trackProgress ? book.progress : null;
      $('reader-title').textContent = book.title; $('reader-back').href = backHref || `#/apps/mathematics/directions/${book.direction}`; $('reader-back').textContent = backLabel;
      if (!book.available) throw new Error('这本教材的 文档尚未接入，请先选择其他教材。');
      csrf = await waiting(api('/api/auth/csrf', { signal: requests.signal }), '读取登录状态'); if (closed) return;
      label.textContent = book.format === 'djvu' ? '正在加载 DJVU…' : '正在校验 PDF 分段读取…';
      const source = book.format === 'djvu' ? null : await pdfSource(label); if (closed) return;
      label.textContent = source?.data ? '正在解析 PDF…' : book.format === 'djvu' ? '正在打开 DJVU…' : '正在读取 PDF 页面信息…';
      task = book.format === 'djvu' ? getDjvuDocument(book.file_url) : getDocument({ ...source, isEvalSupported: false, useWasm: true, wasmUrl: '/vendor/pdfjs/wasm/', cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/' });
      task.onProgress = progress => { if (Number.isFinite(progress.loaded) && progress.loaded > received) { received = progress.loaded; activity(); } };
      pdf = await (book.format === 'djvu' ? task.promise : waiting(task.promise, '打开文档')); if (closed) return;
      if (pdf.numPages > 100000) throw new Error('教材页数超出支持范围。');
      pdf.pageSizes?.forEach((size, index) => dimensions.set(index + 1, size));
      const first = await waiting(pdf.getPage(1), '读取第一页信息'); if (closed) return; const viewport = first.getViewport({ scale: 1 }); baseWidth = viewport.width; baseHeight = viewport.height;
      scroll.dataset.totalPages = String(pdf.numPages);
      if ($('reader-page-input')) $('reader-page-input').max = String(pdf.numPages);
      if ($('reader-page-total')) $('reader-page-total').textContent = '/ ' + pdf.numPages;
      marks = (await waiting(api(`${endpoint}/annotations`, { signal: requests.signal }), '读取高亮笔记')).annotations; if (closed) return;
      notes(); zoom = progress?.zoom || 1; if (!Number.isFinite(zoom) || zoom < .25 || zoom > 4) zoom = 1; zoomControls();
      const fragment = document.createDocumentFragment();
      for (let number = 1; number <= pdf.numPages; number++) {
        const frame = el('div', 'pdf-page'), canvas = el('canvas', 'pdf-canvas'), highlights = el('div', 'pdf-highlights'), text = el('div', 'textLayer');
        frame.dataset.page = String(number); frame.dataset.loadingMessage = `正在加载第 ${number} 页…`; frame.setAttribute('role', 'region'); frame.setAttribute('aria-label', `${book.format === 'djvu' ? 'DJVU' : 'PDF'} 第 ${number} 页`); highlights.setAttribute('aria-hidden', 'true'); canvas.setAttribute('aria-label', `${book.format === 'djvu' ? 'DJVU' : 'PDF'} 第 ${number} 页`);
        frame.append(canvas, highlights, text); fragment.append(frame); pages.push({ number, frame, canvas, highlights, text, rendered: false, rendering: false });
      }
      const jumpPage = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('pdf_page'));
      stack.replaceChildren(fragment); await layout({ page: (jumpPage >= 1 && jumpPage <= pdf.numPages ? jumpPage : progress?.page) || 1, position: jumpPage ? 0 : (progress?.position || 0) });
      if (!closed) {
        try { await outline(); }
        catch (error) { if (!closed) $('reader-outline').replaceChildren(el('p', 'muted', '目录加载失败：' + errorText(error))); }
      }
    } catch (error) {
      if (!closed) {
        const message = '无法打开教材：' + errorText(error);
        $('reader-status').textContent = message;
        $('reader-outline').replaceChildren(el('p', 'muted', message));
        failure(error, currentPage() || null);
        requests.abort(); task?.destroy().catch(() => {});
      }
    }
  })();
  function close() {
    if (successor) return successor.close();
    if (closed) return saveTask; stopVertical(); if (drag) finishDrag(); const flushed = saveNow(); closed = true; ai.close(); ++generation; observer.disconnect(); clearTimeout(saveTimer); clearTimeout(resizeTimer); clearTimeout(zoomTimer); cancelAnimationFrame(scrollFrame); cancelAnimationFrame(dragFrame); events.forEach(remove => remove()); pages.forEach(release);
    if (document.fullscreenElement === $('reader-view')) document.exitFullscreen().catch(() => {});
    requests.abort(); if (task) task.destroy().catch(() => {}); stack.replaceChildren(); $('annotation-list').replaceChildren(); return flushed;
  }
  return { ready, close };
}
