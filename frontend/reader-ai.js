import { renderAnswer } from './richtext.js';
const $ = id => document.getElementById(id);
const errors = {
  ai_not_configured: '请先配置个人 API，或选择已启用的管理员默认 API。',
  ai_invalid_url: '请输入公网 HTTPS API 地址，例如 https://api.example.com/v1。',
  ai_invalid_settings: '请填写 API 地址、模型和密钥；留空密钥会保留原密钥。',
  ai_provider_auth: 'API 密钥无效或权限不足，请检查设置。', ai_provider_limit: '服务商额度不足或请求过多，请稍后重试。',
  ai_provider_payment: '模型账户余额不足，请充值或更换 API。', ai_provider_not_found: '模型名称或接口地址不存在，请检查模型名和 Base URL。',
  ai_provider_rejected: '模型拒绝了请求参数，常见原因是推理档位不被该模型支持。请把推理强度留空后重试。',
  ai_connection_failed: '连接模型失败或等待超时，请检查地址后重试。', ai_provider_error: '模型服务返回错误，请检查模型名称和接口地址。',
  ai_response_invalid: '服务返回的数据缺少可读取的回答字段，请联系管理员查看 AI 诊断日志。',
  ai_response_non_json: '服务返回的不是 JSON 回答，请确认填写的是 API 调用地址。', ai_response_too_large: '服务返回的数据过大，请缩短问题或更换模型。',
  ai_response_empty: '模型返回了空回答，请重试或更换模型。', ai_response_budget: '模型服务达到自身输出或上下文上限，未生成正式回答。请检查所选模型及服务商参数。',
  ai_response_refused: '模型拒绝了本次请求，请换个问法后重试。', ai_response_reasoning_only: '模型只返回了推理内容，没有正式回答。请简化问题或更换模型。',
  ai_response_tool_call: '模型要求调用工具，当前阅读助手仅支持文字回答，请更换模型。', ai_invalid_chat: '对话内容无效，请刷新后重试。',
  ai_busy: '当前正在处理其他提问，请稍后再试。', ai_rate_limit: '提问较频繁，请一分钟后再试。',
  ai_daily_limit: '今天的默认 API 额度已用完，可以切换个人 API。', ai_key_unavailable: '服务器密钥暂时不可用，请联系管理员。',
  login_required: '登录已失效，请重新登录。', invalid_csrf: '登录状态已变化，请刷新后重试。', request_too_large: '对话过长，请清空对话后重试。',
  not_found: '所选文献不存在，请重新打开 PDF。', ai_invalid_context: '选段无效，请重新选择 PDF 中的文字。'
};
function node(tag, text, cls) { const value = document.createElement(tag); if (text != null) value.textContent = text; if (cls) value.className = cls; return value; }
const promptActions = ['gap', 'counterexample', 'intuition', 'translate', 'summary', 'practice'];
const promptIds = { gap: 'ai-prompt-gap', counterexample: 'ai-prompt-counterexample', intuition: 'ai-prompt-intuition', translate: 'ai-prompt-translate', summary: 'ai-prompt-summary', practice: 'ai-prompt-practice' };
export function createReaderAi(getDocumentContext, onContextSent = () => {}, highlightActions = null) {
  let closed = false, config = null, context = null, history = [], turns = [], busy = false, saving = false, selectionAvailable = false, promptTexts = {}, promptDefaults = {}, promptSaving = false, reasoningEffort = '';
  try { reasoningEffort = localStorage.getItem('axiom.ai.reasoning') || ''; } catch { /* Optional preference. */ }
  const storageKey = 'axiom.ai.chat:' + (location.hash.split('?')[0] || 'default');
  const requests = new Set(), events = [];
  const on = (target, name, handler) => { target.addEventListener(name, handler); events.push(() => target.removeEventListener(name, handler)); };
  const status = text => { if (!closed) $('ai-status').textContent = text; };
  function addSaveAction(article, text) {
    if (!highlightActions?.saveReply || article.querySelector('.ai-message-actions')) return;
    const actions = node('div', null, 'ai-message-actions');
    const save = node('button', '保存到高亮', 'ai-save-highlight'); save.type = 'button'; save.title = '把这条 AI 回答追加到某条高亮的笔记';
    save.addEventListener('click', () => { if (!closed) highlightActions.saveReply(text); });
    actions.append(save); article.append(actions);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const area = document.createElement('textarea'); area.value = text;
      area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
      try { return document.execCommand('copy'); } catch { return false; } finally { area.remove(); }
    }
  }
  function openWebBridge(prompt = '') {
    if (closed) return;
    const selected = getDocumentContext()?.selection, question = $('ai-question').value.trim();
    const text = [prompt, question, selected?.quote ? `选中内容：\n${selected.quote}` : ''].filter(Boolean).join('\n\n');
    const opened = window.open('https://chat.deepseek.com/', '_blank'); if (opened) opened.opener = null;
    copyText(text).then(ok => {
      if (!text) status('已打开 DeepSeek 网页版；输入问题后点网页版可复制。');
      else status(ok ? '已复制问题/选段，粘贴到 DeepSeek 网页即可。' : '网页已打开，但剪贴板不可用，请手动复制。');
    });
  }
  function closeWebPaste() { $('ai-web-paste').hidden = true; $('ai-web-answer').value = ''; }
  function openWebPaste() { if (closed) return; $('ai-web-paste').hidden = false; $('ai-web-answer').focus(); }
  function addWebAnswer() {
    if (closed) return;
    const answer = $('ai-web-answer').value.trim(); if (!answer) { $('ai-web-answer').focus(); return; }
    const list = $('ai-messages'); list.querySelector('.ai-empty')?.remove();
    const question = $('ai-question').value.trim();
    if (question) {
      const user = node('article', null, 'ai-message ai-user'); user.append(node('span', '你', 'ai-speaker'), node('p', question));
      list.append(user); history.push({ role: 'user', content: question });
    }
    const assistant = node('article', null, 'ai-message ai-assistant');
    assistant.append(node('span', 'AI · 网页版', 'ai-speaker'), renderAnswer(answer)); addSaveAction(assistant, answer);
    list.append(assistant); history.push({ role: 'assistant', content: answer }); turns.push({ question: question || '网页版回答', page: null, remembered: question || '', reply: answer }); saveSession();
    $('ai-question').value = ''; closeWebPaste(); list.scrollTop = list.scrollHeight; status('网页版回答已加入，可保存到高亮。');
  }
  function saveSession() {
    try {
      if (turns.length) sessionStorage.setItem(storageKey, JSON.stringify(turns));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Ignore storage quota errors. */ }
  }
  function loadSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(saved) || !saved.length) return;
      const list = $('ai-messages');
      for (const item of saved) {
        if (!item?.question || !item?.reply || !item?.remembered) continue;
        turns.push(item);
        history.push({ role: 'user', content: item.remembered }, { role: 'assistant', content: item.reply });
        const user = node('article', null, 'ai-message ai-user'); user.append(node('span', '你', 'ai-speaker'), node('p', item.question));
        if (item.page) user.append(node('small', `附带第 ${item.page} 页选段`));
        const assistant = node('article', null, 'ai-message ai-assistant'); assistant.append(node('span', 'AI', 'ai-speaker'), renderAnswer(item.reply)); addSaveAction(assistant, item.reply);
        list.append(user, assistant);
      }
    } catch { /* Ignore malformed cache. */ }
  }
  async function request(path, method, body, onDelta) {
    const controller = new AbortController(); requests.add(controller);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (method) { const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', signal: controller.signal }); const csrf = await response.json(); if (!response.ok) throw new Error('登录已失效，请重新登录。'); headers[csrf.header] = csrf.token; }
      const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal, ...(method ? { method, headers, body: JSON.stringify(body) } : {}) });
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('text/event-stream') && response.body && onDelta) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let buffer = '', finalResult = { reply: '', warning: '' };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.reply !== undefined) { finalResult.reply = payload.reply; onDelta(payload.reply); }
            if (payload.done) finalResult = { reply: payload.reply || finalResult.reply, warning: payload.warning || '' };
          }
        }
        return finalResult;
      }
      const result = await response.json(); if (!response.ok) throw new Error(errors[result.error] || 'AI 操作失败，请稍后重试。'); return result;
    } finally { requests.delete(controller); }
  }
  function controls() {
    if (closed) return;
    const provider = config?.[config.source];
    $('ai-send').disabled = busy || saving;
    $('ai-source').disabled = busy || saving || !config;
    $('ai-settings-save').disabled = busy || saving || !config;
    $('ai-clear-key').disabled = busy || saving || !config?.custom.has_key;
    $('ai-prompts-save').disabled = busy || saving || promptSaving;
    $('ai-prompts-reset').disabled = busy || saving || promptSaving;
    $('ai-clear').disabled = busy || !history.length;
    $('ai-question').disabled = busy;
    for (const btn of document.querySelectorAll('[data-ai-prompt]')) btn.disabled = busy || saving || !selectionAvailable;
    $('ai-send-label').textContent = busy ? '正在思考…' : '发送';
    $('ai-provider-label').textContent = provider?.available ? provider.model : '尚未配置';
    $('ai-source').title = provider?.available ? `当前模型：${provider.model}` : '选择 API 来源';
  }
  function refreshReasoningTiers() {
    const provider = config?.[config.source] || {};
    const model = String(provider.model || '').toLowerCase(), base = String(provider.base_url || '');
    let tiers, note;
    if (base.includes('api.deepseek.com') || model.startsWith('deepseek-')) {
      tiers = ['low', 'high', 'max'];
      note = '已识别 DeepSeek：可选 low / high / max，默认是 high。';
    } else if (/^gpt-5|^o[1-4]/.test(model)) {
      tiers = ['minimal', 'low', 'medium', 'high'];
      note = '已识别推理模型：档位以服务商实际支持为准。';
    } else {
      tiers = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
      note = '未识别具体模型：可选择常用档位，也可以直接填写服务商档位。';
    }
    $('ai-reasoning-levels').replaceChildren(...tiers.map(value => { const option = document.createElement('option'); option.value = value; return option; }));
    $('ai-reasoning-note').textContent = note;
  }
  function populate() {
    $('ai-source').value = config.source;
    $('ai-base-url').value = config.custom.base_url || ''; $('ai-model').value = config.custom.model || '';
    $('ai-api-key').value = ''; $('ai-api-key').placeholder = config.custom.has_key ? '已保存，留空保持原密钥' : '请输入 API 密钥';
    $('ai-default-info').textContent = config.default.available ? `默认模型：${config.default.model}；每日最多 ${config.default.daily_limit} 次提问。` : '管理员尚未启用默认 API，可在此配置个人 API。';
    refreshReasoningTiers(); controls();
  }
  const payload = (source, custom = config.custom) => ({ source, enabled: custom.enabled, base_url: custom.base_url || '', model: custom.model || '', api_key: '' });
  async function save(body) {
    if (saving || busy || closed) return; saving = true; controls(); status('正在保存 API 设置…');
    try { const value = await request('/api/ai/settings', 'PUT', body); if (closed) return; config = value; populate(); $('ai-settings').hidden = true; $('ai-settings-toggle').setAttribute('aria-expanded', 'false'); status('API 设置已保存。'); }
    catch (error) { if (!closed) { if (config) $('ai-source').value = config.source; status(error.message); } }
    finally { saving = false; controls(); }
  }
  function fillPromptFields(values = promptTexts) {
    for (const action of promptActions) $(promptIds[action]).value = values[action] || '';
  }
  function promptValues() {
    const values = {}; for (const action of promptActions) values[action] = $(promptIds[action]).value;
    return values;
  }
  async function savePrompts(values = promptValues()) {
    if (promptSaving || busy || saving || closed) return;
    promptSaving = true; controls(); $('ai-prompts-status').textContent = '正在保存提示词…';
    try {
      const value = await request('/api/ai/prompts', 'PUT', { prompts: values });
      if (closed) return;
      promptTexts = { ...value.prompts }; promptDefaults = { ...value.defaults }; fillPromptFields(); $('ai-prompts-status').textContent = '提示词已保存。';
    } catch (error) { if (!closed) $('ai-prompts-status').textContent = error.message; }
    finally { promptSaving = false; controls(); }
  }
  function loadPrompts() {
    request('/api/ai/prompts').then(value => { if (closed) return; promptTexts = { ...value.prompts }; promptDefaults = { ...value.defaults }; fillPromptFields(); })
      .catch(error => { if (!closed) { fillPromptFields(promptTexts); $('ai-prompts-status').textContent = error.message; } });
  }
  on($('ai-prompts-save'), 'click', () => savePrompts());
  on($('ai-prompts-reset'), 'click', () => { fillPromptFields(promptDefaults); savePrompts(promptDefaults); });
  on($('ai-web'), 'click', () => openWebBridge());
  on($('ai-web-paste'), 'click', openWebPaste);
  on($('ai-web-add'), 'click', addWebAnswer);
  on($('ai-web-close'), 'click', closeWebPaste);
  on($('ai-web-cancel'), 'click', closeWebPaste);
  on($('ai-settings-toggle'), 'click', () => { const form = $('ai-settings'); form.hidden = !form.hidden; $('ai-settings-toggle').setAttribute('aria-expanded', String(!form.hidden)); });
  on($('ai-reasoning'), 'input', () => {
    reasoningEffort = $('ai-reasoning').value;
    try { localStorage.setItem('axiom.ai.reasoning', reasoningEffort); } catch { /* Optional preference. */ }
  });
  on($('ai-source'), 'change', async () => {
    const source = $('ai-source').value; if (source === 'custom' && !config.custom.available) { $('ai-settings').hidden = false; $('ai-settings-toggle').setAttribute('aria-expanded', 'true'); }
    await save(payload(source));
  });
  on($('ai-settings'), 'submit', async event => {
    event.preventDefault(); if (!config) return;
    await save({ source: 'custom', enabled: true, base_url: $('ai-base-url').value.trim(), model: $('ai-model').value.trim(), api_key: $('ai-api-key').value.trim() });
  });
  on($('ai-clear-key'), 'click', () => save({ ...payload(config.source), enabled: false, clear_key: true }));
  function setContext(value, focus = true) {
    if (closed) return;
    const document = getDocumentContext();
    if (!document?.document_id) { status('这份 PDF 尚未关联文献库，无法附加选段。'); return; }
    context = { document_id: document.document_id, page: value.page, quote: value.quote };
    $('ai-context').hidden = false; $('ai-context-label').textContent = `第 ${value.page} 页选段`; $('ai-context-quote').textContent = value.quote;
    status(''); if (focus) $('ai-question').focus();
  }
  on($('ai-context-remove'), 'click', () => { context = null; $('ai-context').hidden = true; });
  on($('ai-clear'), 'click', () => { history = []; turns = []; saveSession(); $('ai-messages').replaceChildren(); status(''); controls(); });
  on($('ai-chat-form'), 'submit', async event => {
    event.preventDefault(); const question = $('ai-question').value.trim();
    if (!question || busy || saving) return;
    if (!config) { status('AI 设置仍在加载，请稍后再点发送。'); return; }
    if (!config[config.source]?.available) {
      $('ai-settings').hidden = false;
      $('ai-settings-toggle').setAttribute('aria-expanded', 'true');
      status(errors.ai_not_configured);
      $('ai-api-key').focus();
      return;
    }
    const attached = context ? { ...context } : null; const source = config.source;
    const messages = [...history, { role: 'user', content: question }];
    const list = $('ai-messages'); list.querySelector('.ai-empty')?.remove();
    const user = node('article', null, 'ai-message ai-user'); user.append(node('span', '你', 'ai-speaker'), node('p', question));
    if (attached) user.append(node('small', `附带第 ${attached.page} 页选段`)); list.append(user); list.scrollTop = list.scrollHeight;
    if (attached) { context = null; $('ai-context').hidden = true; $('ai-context-quote').textContent = ''; onContextSent(); }
    busy = true; controls(); status('正在向模型提问…');
    let assistant = null;
    try {
      const result = await request('/api/ai/chat', 'POST', { source, messages, context: attached, reasoning: reasoningEffort.trim() }, partial => {
        if (closed) return;
        if (!assistant) { assistant = node('article', null, 'ai-message ai-assistant'); list.append(assistant); }
        assistant.replaceChildren(node('span', 'AI', 'ai-speaker'), renderAnswer(partial));
      });
      if (closed) return;
      if (!assistant) { assistant = node('article', null, 'ai-message ai-assistant'); list.append(assistant); }
      assistant.replaceChildren(node('span', 'AI', 'ai-speaker'), renderAnswer(result.reply));
      addSaveAction(assistant, result.reply);
      const remembered = attached ? `PDF 第 ${attached.page} 页选段：\n${attached.quote}\n问题：${question}` : question;
      history.push({ role: 'user', content: remembered }, { role: 'assistant', content: result.reply });
      turns.push({ question, page: attached?.page || null, remembered, reply: result.reply });
      saveSession();
      $('ai-question').value = ''; status(result.warning || '');
      list.scrollTop += assistant.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop;
    } catch (error) { if (!closed) { user.remove(); assistant?.remove(); if (attached && !context) setContext(attached); if (!history.length) list.append(node('p', '提问未完成，输入内容已保留，可以重试。', 'ai-empty')); status(error.message); } }
    finally { busy = false; controls(); }
  });
  on($('ai-question'), 'keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $('ai-chat-form').requestSubmit(); } });
  const mathPrompts = {
    gap: { text: '请严格补全这段推导中省略的中间步骤（如“显然”、“易知”或跳过的计算），明确写出每一步所依据的定义、引理或定理及其适用条件。', autoSubmit: true },
    counterexample: { text: '如果减弱或去掉这段命题/定理中的关键假设条件，结论是否仍然成立？请逐一分析关键条件的作用，并构造具体的数学反例说明为什么不能省略。', autoSubmit: true },
    intuition: { text: '请跳出纯符号形式化推导，用几何直观、低维特例（如 ℝ²、ℝ³ 或有限维情形）或具体例子解释这段抽象概念/定理背后的核心数学动机与图像。', autoSubmit: true },
    translate: { text: '请把选中的这段内容翻译成中文。保留数学符号、公式、定理编号、人名、书名和术语；公式用 LaTeX 表示；只输出译文，不要解释或总结。\n\n', autoSubmit: true },
    summary: { text: '请用中文简洁总结这段内容的核心定义、主要结论和关键条件，分点列出，不补充原文没有的内容。', autoSubmit: true },
    practice: { text: '请根据这段内容设计 2 道由易到难的练习题，覆盖关键概念和方法；先只给题目，不要给答案。', autoSubmit: true }
  };
  for (const action of promptActions) { promptDefaults[action] = mathPrompts[action].text; promptTexts[action] = mathPrompts[action].text; }
  fillPromptFields(); loadPrompts();
  for (const btn of document.querySelectorAll('[data-ai-prompt]')) {
    on(btn, 'pointerdown', event => event.preventDefault());
    on(btn, 'click', () => {
      if (busy || saving || closed) return;
      const preset = mathPrompts[btn.dataset.aiPrompt]; if (!preset) return;
      if (!config?.[config.source]?.available) { openWebBridge(preset.text); return; }
      if (!context) { const activeSelection = getDocumentContext()?.selection; if (activeSelection) setContext(activeSelection, false); }
      const input = $('ai-question'); input.value = promptTexts[btn.dataset.aiPrompt] || preset.text;
      if (preset.autoSubmit) $('ai-chat-form').requestSubmit();
      else { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }
  $('ai-messages').replaceChildren();
  loadSession();
  $('ai-context').hidden = true; $('ai-settings').hidden = true; $('ai-settings-toggle').setAttribute('aria-expanded', 'false'); $('ai-question').value = ''; $('ai-api-key').value = ''; $('ai-reasoning').value = reasoningEffort; controls(); status('正在加载 AI 设置…');
  request('/api/ai/settings').then(value => { if (closed) return; config = value; populate(); status(value[value.source]?.available ? '' : '请先配置 API，再点发送。'); }).catch(error => status(error.message));
  return { setContext, setSelectionAvailable(value) { selectionAvailable = Boolean(value); controls(); }, updateContext(value) { if (context) setContext(value, false); }, close() { closed = true; requests.forEach(controller => controller.abort()); events.forEach(remove => remove()); history = []; turns = []; context = null; config = null; $('ai-api-key').value = ''; $('ai-messages').replaceChildren(); } };
}
