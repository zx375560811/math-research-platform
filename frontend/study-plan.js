import { mountIcons } from './icons.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const sources={library:'文档库',mathematics:'数学与应用数学',series:'系列书籍','math-to-ai':'数学到人工智能',competition:'数学竞赛'};
const glyph=name=>{const n=el('span');n.dataset.icon=name;n.setAttribute('aria-hidden','true');return n;};

export function createStudyPlan({api,write}) {
 const root=document.getElementById('study-plan-view');
 let generation=0,request=0,accountEpoch=0,mutation=0,owner=null,known=new Set(),pending=new Set(),offsets={planned:0,progress:0},stop=null,reading=false,busy=false;
 function sync(id){for(const button of document.querySelectorAll(`[data-plan-document="${id}"]`)){const added=known.has(id);button.disabled=added||pending.has(id);button.classList.toggle('in-plan',added);button.replaceChildren(glyph(added?'check':'book'),el('span',added?'已加入计划':pending.has(id)?'加入中…':'加入计划'));button.setAttribute('aria-label',(added?'已加入学习计划：':'加入学习计划：')+button.dataset.planTitle);}mountIcons();}
 function setUser(user){if(owner===user)return;owner=user;++accountEpoch;known=new Set();pending=new Set();offsets={planned:0,progress:0};const mine=accountEpoch,startMutation=mutation;
  if(user)api('/api/study-plan/members').then(body=>{if(accountEpoch!==mine||mutation!==startMutation)return;known=new Set(body.document_ids);for(const id of new Set([...document.querySelectorAll('[data-plan-document]')].map(n=>Number(n.dataset.planDocument))))sync(id);}).catch(()=>{});
 }
 function button(document,source){const id=Number(document.id),b=el('button',null,'button compact plan-add');b.type='button';b.dataset.planDocument=id;b.dataset.planTitle=document.title;
  const added=known.has(id);b.disabled=added||pending.has(id);b.classList.toggle('in-plan',added);b.append(glyph(added?'check':'book'),el('span',added?'已加入计划':'加入计划'));b.setAttribute('aria-label',(added?'已加入学习计划：':'加入学习计划：')+document.title);
  b.onclick=async()=>{if(known.has(id)||pending.has(id))return;const mine=accountEpoch;let failed=null;pending.add(id);sync(id);try{await write('/api/study-plan/'+id,{source},'PUT');if(accountEpoch!==mine)return;++mutation;known.add(id);}catch(error){if(accountEpoch===mine)failed=error;}finally{if(accountEpoch===mine){pending.delete(id);sync(id);if(failed){b.title=failed.message;b.querySelector('span:last-child').textContent='加入失败，重试';b.setAttribute('aria-label','加入失败，请重试：'+document.title);}}}};return b;
 }
 function close(){++generation;++request;const flushed=stop?.();stop=null;root.hidden=true;if(reading){document.getElementById('reader-view').hidden=true;document.body.classList.remove('reading-page');}reading=false;return flushed;}
 async function navigate(hash){const flushed=close();const mine=generation;const match=hash.match(/^#\/study-plan\/read\/(\d+)$/);
  if(match){reading=true;document.getElementById('reader-view').hidden=false;document.body.classList.add('reading-page');const {openReader}=await import('./reader.js');if(mine!==generation)return;const reader=openReader(Number(match[1]),{api,write,basePath:'/api/library/documents',backHref:'#/study-plan',backLabel:'← 返回学习计划'});stop=reader.close;await reader.ready;return;}
  root.hidden=false;root.replaceChildren(el('p','正在加载学习计划…','muted'));await flushed;if(mine!==generation)return;await load(mine);
 }
 async function load(mine=generation){
  const currentRequest=++request;
  try{const results=await Promise.all(['planned','progress'].map(async scope=>{let body=await api(`/api/study-plan?scope=${scope}&offset=${offsets[scope]}`);if(offsets[scope]>0&&offsets[scope]>=body.total){offsets[scope]=Math.max(0,Number(body.total_pages)-1)*20;body=await api(`/api/study-plan?scope=${scope}&offset=${offsets[scope]}`);}return body;}));if(mine!==generation||currentRequest!==request)return;
   root.replaceChildren();const head=el('div',null,'study-plan-heading'),back=el('a','← 应用工作台','back-link');back.href='#/';head.append(back,el('h1','我的学习计划'));root.append(head);
   const counts=results[0].summary,total=counts.planned+counts.learning+counts.completed,overview=el('section',null,'study-plan-overview');overview.setAttribute('aria-label','学习概览');
   const ring=el('div',null,'study-plan-ring');ring.style.setProperty('--completion',total?Math.round(counts.completed/total*100)+'%':'0%');ring.append(el('strong',String(counts.completed)),el('span','已完成 / '+total+' 本'));overview.append(ring);
   for(const [key,label]of [['planned','待学习'],['learning','学习中'],['completed','已完成']]){const metric=el('div',null,'study-plan-metric '+key);metric.append(el('span',label),el('strong',String(counts[key])));overview.append(metric);}root.append(overview);
   const message=el('p',null,'study-plan-status');message.id='study-plan-status';message.setAttribute('role','status');root.append(message);
   const columns=el('div',null,'study-plan-columns');for(const [index,scope]of ['planned','progress'].entries()){const body=results[index],panel=el('section',null,'study-plan-panel '+scope),heading=el('div',null,'study-plan-panel-heading');heading.append(glyph(scope==='planned'?'book':'analysis'),el('h2',scope==='planned'?'待学书单':'学习进度'),el('span',body.total+' 本','study-plan-count'));panel.append(heading);
    for(const book of body.books)panel.append(row(book,mine));
    if(!body.books.length){const empty=el('div',null,'study-plan-empty');empty.append(glyph(scope==='planned'?'book':'compass'),el('p',scope==='planned'?'还没有待学书籍':'开始阅读后，在这里继续学习'));if(scope==='planned'){const link=el('a','去挑选书籍','button compact');link.href='#/library';empty.append(link);}panel.append(empty);}
    if(body.total>20){const pager=el('div',null,'study-plan-pager');for(const [label,delta]of [['上一页',-1],['下一页',1]]){const b=el('button',label,'button compact');b.disabled=busy||(delta<0?offsets[scope]===0:offsets[scope]+20>=body.total);b.onclick=()=>{offsets[scope]+=delta*20;load();};pager.append(b);if(delta<0)pager.append(el('span',`第 ${offsets[scope]/20+1} / ${body.total_pages} 页 · 共 ${body.total} 本`));}panel.append(pager);}columns.append(panel);
   }root.append(columns);mountIcons();
  }catch(error){if(mine===generation&&currentRequest===request){const retry=el('button','重新加载','button');retry.onclick=()=>load();root.replaceChildren(el('p',error.message,'notice error'),retry);}}
 }
 function row(book,mine){const row=el('article',null,'study-plan-book');row.dataset.studyDocument=book.id;const info=el('div',null,'study-plan-book-info'),meta=el('div',null,'study-plan-book-meta');meta.append(el('span',sources[book.source]||'文档库','study-plan-source'));if(book.state==='completed')meta.append(el('span','已完成','study-plan-completed'));info.append(meta,el('h3',book.title));if(book.authors)info.append(el('p',book.authors,'muted'));row.append(info);
  if(book.progress){const p=book.progress,position=el('div',null,'study-plan-position'),line=el('div');line.append(el('span','阅读位置'),el('span',`${p.page} / ${p.total_pages} 页`));const bar=el('progress');bar.max=p.total_pages;bar.value=p.page;bar.setAttribute('aria-label',`阅读位置：第 ${p.page} 页，共 ${p.total_pages} 页`);position.append(line,bar);row.append(position);}
  const actions=el('div',null,'study-plan-book-actions'),read=el('a',book.progress?'继续学习':'开始学习','button primary compact');read.href='#/study-plan/read/'+book.id;read.append(glyph('forward'));const complete=el('button',book.state==='completed'?'恢复学习':'标记学完','button compact');complete.type='button';complete.onclick=()=>act('/api/study-plan/'+book.id,{completed:book.state!=='completed'},'PATCH',mine);const remove=el('button','移出计划','button compact study-plan-remove');remove.type='button';remove.onclick=()=>act('/api/study-plan/'+book.id,{},'DELETE',mine,book.id);actions.append(read,complete,remove);row.append(actions);return row;
 }
 async function act(path,body,method,mine,removed){if(busy)return;busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;try{await write(path,body,method);if(mine!==generation)return;if(removed){++mutation;known.delete(removed);sync(removed);}busy=false;await load(mine);}catch(error){if(mine===generation){document.getElementById('study-plan-status').textContent=error.message;for(const b of root.querySelectorAll('.study-plan-book-actions button'))b.disabled=false;}}finally{busy=false;}}
 return {navigate,close,button,setUser};
}
