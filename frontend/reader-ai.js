import { renderAnswer } from './richtext.js';
const $ = id => document.getElementById(id);
const errors = {
  ai_not_configured: '请先配置个人 API，或选择已启用的管理员默认 API。',
  ai_invalid_url: '请输入公网 HTTPS API 地址，例如 https://api.example.com/v1。',
  ai_invalid_settings: '请填写 API 地址、模型和密钥；留空密钥会保留原密钥。',
  ai_provider_auth: 'API 密钥无效或权限不足，请检查设置。', ai_provider_limit: '服务商额度不足或请求过多，请稍后重试。',
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
export function createReaderAi(getDocumentContext) {
  let closed = false, config = null, context = null, history = [], busy = false, saving = false;
  const requests = new Set(), events = [];
  const on = (target, name, handler) => { target.addEventListener(name, handler); events.push(() => target.removeEventListener(name, handler)); };
  const status = text => { if (!closed) $('ai-status').textContent = text; };
  async function request(path, method, body) {
    const controller = new AbortController(); requests.add(controller);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (method) { const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', signal: controller.signal }); const csrf = await response.json(); if (!response.ok) throw new Error('登录已失效，请重新登录。'); headers[csrf.header] = csrf.token; }
      const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal, ...(method ? { method, headers, body: JSON.stringify(body) } : {}) });
      const result = await response.json(); if (!response.ok) throw new Error(errors[result.error] || 'AI 操作失败，请稍后重试。'); return result;
    } finally { requests.delete(controller); }
  }
  function controls() {
    if (closed) return;
    const provider = config?.[config.source];
    $('ai-send').disabled = busy || saving || !provider?.available;
    $('ai-source').disabled = busy || saving || !config;
    $('ai-settings-save').disabled = busy || saving || !config;
    $('ai-clear-key').disabled = busy || saving || !config?.custom.has_key;
    $('ai-clear').disabled = busy || !history.length;
    $('ai-question').disabled = busy;
    $('ai-send').textContent = busy ? '正在思考…' : '发送';
    $('ai-provider-label').textContent = provider?.available ? provider.model : '尚未配置';
  }
  function populate() {
    $('ai-source').value = config.source;
    $('ai-base-url').value = config.custom.base_url || ''; $('ai-model').value = config.custom.model || '';
    $('ai-api-key').value = ''; $('ai-api-key').placeholder = config.custom.has_key ? '已保存，留空保持原密钥' : '请输入 API 密钥';
    $('ai-default-info').textContent = config.default.available ? `默认模型：${config.default.model}；每日最多 ${config.default.daily_limit} 次提问。` : '管理员尚未启用默认 API，可在此配置个人 API。';
    controls();
  }
  const payload = (source, custom = config.custom) => ({ source, enabled: custom.enabled, base_url: custom.base_url || '', model: custom.model || '', api_key: '' });
  async function save(body) {
    if (saving || busy || closed) return; saving = true; controls(); status('正在保存 API 设置…');
    try { const value = await request('/api/ai/settings', 'PUT', body); if (closed) return; config = value; populate(); status('API 设置已保存。'); }
    catch (error) { if (!closed) { if (config) $('ai-source').value = config.source; status(error.message); } }
    finally { saving = false; controls(); }
  }
  on($('ai-settings-toggle'), 'click', () => { const form = $('ai-settings'); form.hidden = !form.hidden; $('ai-settings-toggle').setAttribute('aria-expanded', String(!form.hidden)); });
  on($('ai-source'), 'change', async () => {
    const source = $('ai-source').value; if (source === 'custom' && !config.custom.available) { $('ai-settings').hidden = false; $('ai-settings-toggle').setAttribute('aria-expanded', 'true'); }
    await save(payload(source));
  });
  on($('ai-settings'), 'submit', async event => {
    event.preventDefault(); if (!config) return;
    await save({ source: 'custom', enabled: true, base_url: $('ai-base-url').value.trim(), model: $('ai-model').value.trim(), api_key: $('ai-api-key').value.trim() });
  });
  on($('ai-clear-key'), 'click', () => save({ ...payload(config.source), enabled: false, clear_key: true }));
  function setContext(value) {
    if (closed) return;
    const document = getDocumentContext();
    if (!document?.document_id) { status('这份 PDF 尚未关联文献库，无法附加选段。'); return; }
    context = { document_id: document.document_id, page: value.page, quote: value.quote };
    $('ai-context').hidden = false; $('ai-context-label').textContent = `第 ${value.page} 页选段`; $('ai-context-quote').textContent = value.quote;
    status('选段已附加，发送问题时会一并提供给所选模型。'); $('ai-question').focus();
  }
  on($('ai-context-remove'), 'click', () => { context = null; $('ai-context').hidden = true; });
  on($('ai-clear'), 'click', () => { history = []; $('ai-messages').replaceChildren(node('p', '可以讨论概念、推导，或选中 PDF 文字后点击“问 AI”。', 'ai-empty')); controls(); });
  on($('ai-chat-form'), 'submit', async event => {
    event.preventDefault(); const question = $('ai-question').value.trim();
    if (!question || !config || busy || saving || !config[config.source]?.available) return;
    const attached = context ? { ...context } : null; const source = config.source;
    const messages = [...history, { role: 'user', content: question }];
    const list = $('ai-messages'); list.querySelector('.ai-empty')?.remove();
    const user = node('article', null, 'ai-message ai-user'); user.append(node('span', '你', 'ai-speaker'), node('p', question));
    if (attached) user.append(node('small', `附带第 ${attached.page} 页选段`)); list.append(user); list.scrollTop = list.scrollHeight;
    busy = true; controls(); status('正在向模型提问…');
    try {
      const result = await request('/api/ai/chat', 'POST', { source, messages, context: attached }); if (closed) return;
      const assistant = node('article', null, 'ai-message ai-assistant'); assistant.append(node('span', 'AI', 'ai-speaker'), renderAnswer(result.reply)); list.append(assistant);
      const remembered = attached ? `PDF 第 ${attached.page} 页选段：\n${attached.quote}\n问题：${question}` : question;
      history.push({ role: 'user', content: remembered }, { role: 'assistant', content: result.reply });
      $('ai-question').value = ''; status(result.warning || '回答仅基于当前对话和附带选段，请核对数学推导。'); list.scrollTop = list.scrollHeight;
    } catch (error) { if (!closed) { user.remove(); if (!history.length) list.append(node('p', '提问未完成，输入内容已保留，可以重试。', 'ai-empty')); status(error.message); } }
    finally { busy = false; controls(); }
  });
  on($('ai-question'), 'keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $('ai-chat-form').requestSubmit(); } });
  $('ai-messages').replaceChildren(node('p', '可以讨论概念、推导，或选中 PDF 文字后点击“问 AI”。', 'ai-empty'));
  $('ai-context').hidden = true; $('ai-settings').hidden = true; $('ai-settings-toggle').setAttribute('aria-expanded', 'false'); $('ai-question').value = ''; $('ai-api-key').value = ''; controls(); status('正在加载 AI 设置…');
  request('/api/ai/settings').then(value => { if (closed) return; config = value; populate(); status(value.enabled ? '选择文字后可附加选段提问。' : '选择 API 来源，或点击“设置”接入个人 API。'); }).catch(error => status(error.message));
  return { setContext, close() { closed = true; requests.forEach(controller => controller.abort()); events.forEach(remove => remove()); history = []; context = null; config = null; $('ai-api-key').value = ''; $('ai-messages').replaceChildren(); } };
}
