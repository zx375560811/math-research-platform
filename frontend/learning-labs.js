import { mountIcons } from './icons.js';

const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const normalized=text=>String(text||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const icon=(node,name)=>{const glyph=el('span');glyph.dataset.icon=name;glyph.setAttribute('aria-hidden','true');node.append(glyph);return node;};
function external(label,url,glyph){const link=el('a',label,'button compact');link.href=url;link.target='_blank';link.rel='noopener noreferrer';return icon(link,glyph);}
function matches(source,book){
 const title=normalized(book.title);
 if(!source.aliases.some(alias=>title.includes(normalized(alias))))return false;
 if(source.id==='pcc-1e'&&/(第[二三四234]版|(?:2nd|3rd|second|third)edition)/i.test(title))return false;
 if(source.id==='pydata-2e'&&/(第[一三四134]版|(?:1st|3rd|first|third)edition)/i.test(title))return false;
 if(source.id==='nlpia-2e'&&/(第[一三134]版|(?:1st|3rd|first|third)edition)/i.test(title))return false;
 if(source.id==='d2l-pytorch-2e'&&/(第[一三134]版|(?:1st|3rd|first|third)edition)/i.test(title))return false;
 if(source.id==='scratch-1e'&&/(fromscratch[234]|深度学习入门[234])/.test(title))return false;
 return true;
}

export function createLearningLabs({api,write}){
 let catalogue=[],progress={},catalogueError=false,progressError=false,version=0;
 const choices=new Map(),chapters=new Map(),previews=new Map(),saving=new Set();
 const path=(book,chapter)=>'/api/learning-labs/'+book+'/chapters/'+chapter;
 async function load(){
  const mine=++version;catalogue=[];progress={};catalogueError=false;progressError=false;
  const results=await Promise.allSettled([api('/api/learning-labs/catalog'),api('/api/learning-labs/progress')]);
  if(mine!==version)return;
  if(results[0].status==='fulfilled')catalogue=results[0].value.books||[];else catalogueError=true;
  if(results[1].status==='fulfilled')progress=results[1].value.progress||{};else progressError=true;
 }
 function renderSection(course){
  const available=catalogue.filter(book=>book.courses.includes(course.slug));
  if(!available.length&&!catalogueError)return null;
  if(!available.length&&!['python','machine-learning','deep-learning','pytorch','nlp','llm'].includes(course.slug))return null;
  const section=el('section',null,'learning-labs');section.append(el('h3','教材配套实验'));
  if(catalogueError){const error=el('div',null,'lab-load-error'),retry=el('button','重试','button compact');error.append(el('p','配套实验暂时无法加载。'),retry);retry.onclick=async()=>{retry.disabled=true;await load();const replacement=renderSection(course);if(replacement)section.replaceWith(replacement);else section.remove();};section.append(error);return section;}
  const matched=available.find(source=>course.books.some(book=>matches(source,book)));
  let selected=choices.get(course.slug);if(!available.some(book=>book.id===selected))selected=matched?.id||available[0].id;
  const tabs=el('div',null,'lab-book-tabs');tabs.setAttribute('aria-label','选择实验教材');
  const content=el('div',null,'textbook-companion');section.append(tabs,content);
  for(const source of available){const button=el('button',source.title,'lab-book-tab');button.type='button';button.dataset.labBook=source.id;button.onclick=()=>showBook(source.id);tabs.append(button);}
  function showBook(id){
   selected=id;choices.set(course.slug,id);const book=available.find(item=>item.id===id);
   for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.labBook===id));
   content.dataset.book=id;content.replaceChildren();
   const heading=el('div',null,'companion-heading'),meta=el('div'),count=el('span',null,'lab-count');
   meta.append(el('h4',book.title),el('p',book.authors+' · '+book.edition,'companion-edition'));heading.append(meta,count);
   const tools=el('div',null,'companion-tools');tools.append(external('原始仓库',book.repository,'book'),external('下载配套代码',book.download_url,'download'));
   const linked=course.books.find(document=>matches(book,document));
   if(linked){const read=icon(el('a','阅读这本教材','button compact'),'book');read.href=`#/apps/math-to-ai/read/${linked.id}?course=${course.slug}`;tools.prepend(read);}
   else tools.append(el('span','教材 PDF 待关联','companion-unlinked'));
   const grid=el('div',null,'companion-grid'),nav=el('nav',null,'companion-chapters'),detail=el('div',null,'companion-detail');nav.setAttribute('aria-label',book.title+'实验章节');
   const status=el('p',progressError?'进度暂时无法读取，请刷新后重试。':'','lab-status');status.setAttribute('aria-live','polite');
   const attribution=el('details',null,'companion-source'),summary=el('summary','来源与版本');attribution.append(summary);
   const license=el('a',book.license);license.href=book.license_url;license.target='_blank';license.rel='noopener noreferrer';
   attribution.append(el('span',book.repository+'\n固定版本 '+book.commit+'\n'),license,el('p',book.mirror?'预览仅提取原始代码，保留代码顺序，不加载 Notebook 输出。':'本书实验由作者或出版社仓库提供。'));
   content.append(heading,tools,grid,status,attribution);grid.append(nav,detail);
   const update=()=>{if(content.dataset.book!==id)return;const completed=progress[id]||[];content.querySelector('.lab-count').textContent=progressError?'进度未读取':`完成 ${completed.filter(ch=>book.chapters.some(item=>item.id===ch)).length} / ${book.chapters.length} 章`;for(const button of content.querySelectorAll('.companion-chapter')){const done=completed.includes(button.dataset.chapter);button.classList.toggle('completed',done);button.querySelector('.companion-done').textContent=done?'✓':'';}const current=content.querySelector('.companion-detail'),input=current?.querySelector('.companion-completion input');if(input){input.checked=completed.includes(current.dataset.chapter);input.disabled=progressError||saving.has(id+'/'+current.dataset.chapter);}};
   let active=chapters.get(id);if(!book.chapters.some(ch=>ch.id===active))active=book.chapters[0].id;
   for(const chapter of book.chapters){
    const button=el('button',null,'companion-chapter');button.type='button';button.dataset.chapter=chapter.id;
    const title=el('span');title.append(el('small',chapter.label),el('strong',chapter.title));button.append(title,el('span','','companion-done'));button.onclick=()=>showChapter(chapter.id);nav.append(button);
   }
   function showChapter(chapterId){
    active=chapterId;chapters.set(id,chapterId);const chapter=book.chapters.find(item=>item.id===chapterId);
    for(const button of nav.children){if(button.dataset.chapter===chapterId)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
    detail.replaceChildren();detail.dataset.chapter=chapterId;
    const title=el('div',null,'companion-chapter-heading'),label=el('div');label.append(el('span',chapter.label,'companion-chapter-label'),el('h4',chapter.title));
    const complete=el('label',null,'companion-completion'),check=el('input');check.type='checkbox';check.checked=(progress[id]||[]).includes(chapterId);check.disabled=progressError||saving.has(id+'/'+chapterId);check.setAttribute('aria-label','完成 '+chapter.label+' '+chapter.title);complete.append(check,el('span','已完成'));title.append(label,complete);
    check.onchange=async()=>{
     const wanted=check.checked,mine=version,key=id+'/'+chapterId;saving.add(key);check.disabled=true;status.textContent='正在保存…';
     try{await write(path(id,chapterId)+'/progress',{completed:wanted},'PUT');if(mine!==version)return;const saved=new Set(progress[id]||[]);if(wanted)saved.add(chapterId);else saved.delete(chapterId);progress[id]=[...saved];update();status.textContent='本章进度已保存。';}
     catch(error){if(mine===version){check.checked=(progress[id]||[]).includes(chapterId);status.textContent=error.message||'保存失败，请重试。';}}
     finally{saving.delete(key);if(mine===version){update();if(content.dataset.book===id)content.querySelector('.lab-status').textContent=status.textContent;}}
    };
    const intro=el('p',chapter.description,'companion-description'),actions=el('div',null,'companion-chapter-actions');actions.append(external('打开原始实验',chapter.source_url,'forward'),el('span',chapter.runtime,'companion-runtime'));
    const views=el('div',null,'companion-view-tabs'),body=el('div',null,'companion-view');detail.append(title,intro,actions,views,body);
    const code=el('button',chapter.preview?'代码预览':'实验文件','companion-view-tab'),guide=el('button','运行说明','companion-view-tab');code.type=guide.type='button';views.append(code,guide);
    function display(mode){code.setAttribute('aria-pressed',String(mode==='code'));guide.setAttribute('aria-pressed',String(mode==='guide'));body.replaceChildren();
     if(mode==='guide'){body.append(el('h5','按教材顺序运行'));for(const note of book.notes)body.append(el('p',note));body.append(el('p','下载后在自己的电脑或教材推荐的环境运行。完成实验后，在这里勾选本章。'));return;}
     if(!chapter.preview){const card=el('div',null,'companion-original');icon(card,'book');card.append(el('strong',chapter.label+' · '+chapter.title),el('p','本章代码、数据与辅助文件位于原始仓库。'),external('查看本章实验',chapter.source_url,'forward'));body.append(card);return;}
     const loading=el('p','正在读取原始代码…','muted');body.append(loading);
     const key=id+'/'+chapterId;const request=previews.has(key)?Promise.resolve(previews.get(key)):api(path(id,chapterId)+'/preview');
     request.then(result=>{previews.set(key,result);if(active!==chapterId||selected!==id||code.getAttribute('aria-pressed')!=='true'||!body.isConnected)return;body.replaceChildren();
      const files=el('select',null,'companion-file');files.setAttribute('aria-label','选择原始代码文件');for(const file of result.files){const option=el('option',file.path);option.value=file.path;files.append(option);}
      const cells=el('div',null,'companion-code');cells.tabIndex=0;cells.setAttribute('aria-label','原始代码预览');
      const showFile=()=>{cells.replaceChildren();const file=result.files.find(item=>item.path===files.value);for(const [index,source]of file.cells.entries()){const cell=el('div',null,'companion-code-cell');cell.append(el('span',String(index+1),'companion-cell-number'));const pre=el('pre');pre.append(el('code',source));cell.append(pre);cells.append(cell);}};
      files.onchange=showFile;body.append(files,cells);showFile();
     }).catch(()=>{if(active!==chapterId||selected!==id||code.getAttribute('aria-pressed')!=='true'||!body.isConnected)return;body.replaceChildren(el('p','代码预览暂时不可用，可打开原始实验。','muted'));const retry=el('button','重试预览','button compact');retry.onclick=()=>display('code');body.append(retry);});
    }
    code.onclick=()=>display('code');guide.onclick=()=>display('guide');display('code');mountIcons();
   }
   update();showChapter(active);mountIcons();
  }
  showBook(selected);return section;
 }
 return {load,section:renderSection};
}
