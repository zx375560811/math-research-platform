import { Marked } from './vendor/marked/marked.esm.js';
import DOMPurify from './vendor/dompurify/purify.es.mjs';
import katex from './vendor/katex/katex.mjs';

const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const markup = token => `<span class="ai-math-source" data-display="${token.display ? 'true' : 'false'}">${escape(token.text)}</span>`;
// Tokenize math before Markdown escapes its backslashes or treats LaTeX underscores as emphasis.
const markdown = new Marked({ gfm: true, breaks: true, extensions: [
  { name: 'mathBlock', level: 'block', start: source => source.search(/\$\$|\\\[/),
    tokenizer(source) { const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])(?:\n|$)/.exec(source); if (match) return { type: 'mathBlock', raw: match[0], text: match[1] ?? match[2], display: true }; }, renderer: markup },
  { name: 'mathInline', level: 'inline', start: source => source.search(/\$|\\[([]/),
    tokenizer(source) {
      const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$)/.exec(source);
      if (match) return { type: 'mathInline', raw: match[0], text: match[1] ?? match[2] ?? match[3] ?? match[4], display: match[1] != null || match[2] != null };
    }, renderer: markup }
] });
export function renderAnswer(text) {
  const box = document.createElement('div'); box.className = 'ai-rich-text';
  box.innerHTML = DOMPurify.sanitize(markdown.parse(text), {
    ALLOWED_TAGS: ['p','br','strong','em','del','s','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','pre','code','table','thead','tbody','tr','th','td','a','hr','span','div','sup','sub'],
    ALLOWED_ATTR: ['href','title','class','data-display'], ALLOW_DATA_ATTR: false
  });
  for (const link of box.querySelectorAll('a')) {
    const href = link.getAttribute('href');
    if (!href) continue;
    try { const url = new URL(href, location.href); if (!['https:','http:'].includes(url.protocol)) { link.removeAttribute('href'); continue; } }
    catch { link.removeAttribute('href'); continue; }
    link.target = '_blank'; link.rel = 'noopener noreferrer';
  }
  for (const formula of box.querySelectorAll('.ai-math-source')) {
    const tex = formula.textContent; const display = formula.dataset.display === 'true';
    try { katex.render(tex, formula, { displayMode: display, output: 'htmlAndMathml', throwOnError: false, trust: false, maxExpand: 1000, maxSize: 100, strict: 'ignore' }); }
    catch { formula.textContent = tex; }
  }
  return box;
}
