import { Marked } from './vendor/marked/marked.esm.js';
import DOMPurify from './vendor/dompurify/purify.es.mjs';
import katex from './vendor/katex/katex.mjs';

const markdown = new Marked({ gfm: true, breaks: true });
const mathEnvironments = /^(?:equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|displaymath|aligned|gathered|cases|[pbBvV]?matrix)$/;
const escaped = (source, index) => {
  let count = 0; for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) count++;
  return count % 2 === 1;
};
function delimitedMath(source, start) {
  if (escaped(source, start)) return null;
  if (source[start] === '[' && (start === 0 || source[start - 1] === '\n')) {
    const bracket = /^\[\r?\n([\s\S]+?)\r?\n\](?=[ \t]*(?:\r?\n|$))/.exec(source.slice(start));
    if (bracket && /\\(?:frac|dfrac|tfrac|sum|int|lim|sqrt|begin|approx|mathbb|mathrm|left)\b/.test(bracket[1]))
      return { text:bracket[1],display:true,end:start + bracket[0].length };
  }
  const pairs = [['$$','$$',true],['\\[','\\]',true],['\\(','\\)',false],['$','$',false]];
  for (const [left,right,display] of pairs) {
    if (!source.startsWith(left, start)) continue;
    let depth = 0;
    for (let i = start + left.length; i < source.length; i++) {
      if (escaped(source, i)) continue;
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth = Math.max(0, depth - 1);
      if (depth === 0 && source.startsWith(right, i)) {
        const text = source.slice(start + left.length, i);
        if (!text.trim()) return null;
        return { text, display, end: i + right.length };
      }
    }
    return null;
  }
  const begin = source[start] === '\\' && /^\\begin\{([^}]+)\}/.exec(source.slice(start));
  if (begin && mathEnvironments.test(begin[1])) {
    const ending = '\\end{' + begin[1] + '}', end = source.indexOf(ending, start + begin[0].length);
    if (end >= 0) return { text:source.slice(start,end + ending.length),display:true,end:end + ending.length };
  }
  return null;
}
// Protect formulas before Markdown splits tables or consumes TeX punctuation.
// Other fenced code and inline code remain literal, even if they contain dollars.
function protectMath(source) {
  source = source.replace(/\r\n?/g, '\n');
  const prefix = 'AXIOMMATH' + Array.from(crypto.getRandomValues(new Uint8Array(8)), value => value.toString(16).padStart(2, '0')).join('') + 'TOKEN';
  const formulas = []; let output = '', i = 0;
  const marker = formula => { const value = prefix + formulas.length + 'END'; formulas.push({ ...formula, marker:value }); return value; };
  while (i < source.length) {
    const lineStart = i === 0 || source[i - 1] === '\n';
    if (lineStart) {
      const fence = /^ {0,3}(`{3,}|~{3,})([^\n]*)\n/.exec(source.slice(i));
      if (fence) {
        const bodyStart = i + fence[0].length;
        const closing = new RegExp('^ {0,3}' + fence[1][0] + '{' + fence[1].length + ',}[ \t]*$', 'm');
        const endFence = closing.exec(source.slice(bodyStart));
        if (endFence) {
          const end = bodyStart + endFence.index + endFence[0].length;
          const body = source.slice(bodyStart, bodyStart + endFence.index).trim();
          if (/^(math|latex|tex)$/i.test(fence[2].trim()) && body) {
            const wrapped = delimitedMath(body, 0);
            output += marker({ text:wrapped?.end === body.length ? wrapped.text : body,display:true });
          } else output += source.slice(i,end);
          i = end; continue;
        }
        output += source.slice(i); break;
      }
    }
    if (source[i] === '`' && !escaped(source, i)) {
      const ticks = /^`+/.exec(source.slice(i))[0]; let end = source.indexOf(ticks, i + ticks.length);
      while (end >= 0 && (source[end - 1] === '`' || source[end + ticks.length] === '`')) end = source.indexOf(ticks,end + ticks.length);
      if (end >= 0) { output += source.slice(i,end + ticks.length); i = end + ticks.length; continue; }
    }
    const formula = delimitedMath(source, i);
    if (formula) { output += marker(formula); i = formula.end; }
    else output += source[i++];
  }
  return { text:output, formulas };
}
export function renderAnswer(text) {
  const box = document.createElement('div'); box.className = 'ai-rich-text';
  const protectedText = protectMath(text);
  box.innerHTML = DOMPurify.sanitize(markdown.parse(protectedText.text), {
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
  const formulas = new Map(protectedText.formulas.map(formula => [formula.marker,formula]));
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); const nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('pre,code')) nodes.push(walker.currentNode);
  const pattern = /AXIOMMATH[a-f0-9]+TOKEN\d+END/g;
  for (const node of nodes) {
    const matches = [...node.textContent.matchAll(pattern)].filter(match => formulas.has(match[0]));
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment(); let offset = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(node.textContent.slice(offset,match.index)));
      const formula = formulas.get(match[0]), host = document.createElement('span'); host.className = 'ai-math-source';
      try { katex.render(formula.text,host,{ displayMode:formula.display,output:'htmlAndMathml',throwOnError:false,trust:false,maxExpand:1000,maxSize:100,strict:'ignore' }); }
      catch { host.textContent = formula.text; }
      fragment.append(host); offset = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(node.textContent.slice(offset))); node.replaceWith(fragment);
  }
  return box;
}
