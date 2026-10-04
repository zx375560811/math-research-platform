import { mountIcons } from './icons.js';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const option=(text,value)=>{const node=el('option',text);node.value=value;return node;};
export function createAdminBooks({api,write,message,directions}) {
  let books=[],courses={},direction='',course='',editing=null,documents=[],folders=[],offset=0,generation=0,loading=false,saving=false,failed=false,chosen='';
  const dialog=$('book-editor');
  const stages=slug=>courses[slug]||['基础入门','核心理论','进阶学习'];
  const name=slug=>directions().find(d=>d.slug===slug)?.name||slug;
  function control(text,callback,iconName) { const node=el('button',null,'button compact');node.type='button';if(iconName){const icon=el('span');icon.dataset.icon=iconName;icon.setAttribute('aria-hidden','true');node.append(icon);}node.append(document.createTextNode(text));node.addEventListener('click',callback);return node; }
  function render() {
    const filter=$('books-direction-filter');filter.replaceChildren(...directions().map(d=>option(d.name,d.slug)));filter.value=direction;
    const tabs=$('book-courses');tabs.replaceChildren();
    const extra=[...new Set(books.filter(b=>b.direction===direction&&!stages(direction).includes(b.stage)).map(b=>b.stage))];
    const values=[...stages(direction),...extra];if(!values.includes(course))course=values[0];
    for(const value of values){const tab=control(extra.includes(value)?'待归类 · '+value:value,()=>{course=value;render();});tab.dataset.course=value;tab.setAttribute('aria-pressed',String(value===course));tabs.append(tab);}
    $('book-course-title').textContent=course;$('book-list').replaceChildren();
    for(const language of ['zh','en']) {
      const column=el('section',null,'book-language-column'),heading=el('div',null,'book-language-heading');heading.append(el('h3',language==='zh'?'中文推荐':'英文推荐'),control('添加',()=>open(null,language),'book'));column.append(heading);
      const items=books.filter(b=>b.direction===direction&&b.stage===course&&(b.language||'en')===language).sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id);
      for(const book of items){const row=el('article',null,'book-recommendation'),detail=el('div',null,'book-recommendation-info');detail.append(el('h4',book.title),el('p',book.authors||'作者未填写'),el('span',book.document_id?'已接入文档':'待接入文档',`badge${book.document_id?'':' pending'}`));const edit=control('配置',()=>open(book), 'settings');edit.dataset.bookId=book.id;edit.setAttribute('aria-label','配置 '+book.title);row.append(detail,edit);column.append(row);}
      if(!items.length)column.append(el('p','尚未配置推荐教材','admin-empty'));$('book-list').append(column);
    }
    mountIcons();
  }
  async function load() {
    const body=await api('/api/admin/books');books=body.books;courses=body.courses||{};
    courses.analysis=body.analysis_courses||courses.analysis||['数学分析','高等代数','复分析','实分析与测度论','常微分方程','泛函分析','偏微分方程'];
    if(!direction)direction=directions().some(d=>d.slug==='analysis')?'analysis':directions()[0]?.slug;render();
  }
  function updateStages(selected) {
    const values=stages($('book-direction').value);$('book-stage-label').textContent=$('book-direction').value==='analysis'?'对应课程':'学习阶段';$('book-stage').replaceChildren(...values.map(v=>option(v,v)));
    if(selected&&!values.includes(selected)){const pending=option('请选择新的课程','');pending.disabled=true;$('book-stage').prepend(pending);$('book-stage').value='';}else $('book-stage').value=selected||values[0];
  }
  function path(folder) { const names=[],seen=new Set();while(folder&&!seen.has(folder.id)){seen.add(folder.id);names.unshift(folder.name);folder=folders.find(f=>f.id===folder.parent_id);}return names.join(' / '); }
  function syncSave() { $('book-save').disabled=loading||saving||failed;$('book-editor').setAttribute('aria-busy',String(loading||saving)); }
  function context() { $('book-context').textContent=`${name($('book-direction').value)} / ${$('book-stage').selectedOptions[0]?.textContent||course} / ${$('book-language').selectedOptions[0].textContent}`; }
  async function loadDocuments() {
    const version=++generation;loading=true;failed=false;syncSave();$('book-editor-error').textContent='';$('book-document').disabled=true;$('book-doc-prev').disabled=$('book-doc-next').disabled=true;$('book-document').replaceChildren(option('正在加载文献…',''));
    try {
      const body=await api('/api/admin/documents?'+new URLSearchParams({module:'mathematics',direction:$('book-direction').value,q:$('book-document-query').value.trim(),collection:$('book-folder').value,offset}));
      if(version!==generation)return;documents=body.documents.filter(d=>!d.language||d.language==='und'||d.language===$('book-language').value);
      let current=documents.find(d=>String(d.id)===chosen);
      if(chosen&&!current){try{current=await api('/api/documents/'+chosen);}catch(error){if(error.code!=='not_found')throw error;chosen='';}}
      if(version!==generation)return;
      const choices=[...(current&&!documents.some(d=>d.id===current.id)?[current]:[]),...documents];documents=choices;
      $('book-document').replaceChildren(option(editing?'暂不关联文档':'请选择文献',''),...choices.map(d=>option(`${d.title}${d.authors?' · '+d.authors:''}`,d.id)));$('book-document').value=chosen;
      $('book-doc-prev').disabled=offset===0;$('book-doc-next').disabled=body.documents.length<20;$('book-doc-page').textContent=`第 ${offset/20+1} 页`;
      $('book-binding-hint').hidden=documents.length!==0;$('book-binding-hint').textContent=body.documents.length?'本页没有符合推荐语种的文献，可翻页或搜索。':'此目录暂无当前方向的匹配文献。';
    } catch(error){if(version===generation){failed=true;$('book-editor-error').textContent=error.message;$('book-document').replaceChildren(option('加载失败，请重新搜索',''));}}
    finally{if(version===generation){loading=false;$('book-document').disabled=false;syncSave();}}
  }
  async function open(book,language='zh') {
    if(saving)return;const version=++generation;loading=true;failed=false;syncSave();editing=book;chosen=String(book?.document_id||'');offset=0;$('book-form').reset();$('book-editor-error').textContent='';
    $('book-editor-title').textContent=book?'配置推荐教材':'添加推荐教材';$('book-direction').value=book?.direction||direction;$('book-language').value=book?.language||language;updateStages(book?.stage||course);
    $('book-title').value=book?.title||'';$('book-author-input').value=book?.authors||'';$('book-source').value=book?.source_url||'';$('book-prerequisites').value=book?.prerequisites||'';$('book-order').value=book?.sort_order??10;
    $('book-document').required=!book;context();
    dialog.showModal();$('book-title').focus();
    try { const body=await api('/api/admin/collections');if(version!==generation)return;folders=body.collections;$('book-folder').replaceChildren(option('全部目录',''),...folders.map(f=>option(path(f),f.id)),option('未归入目录','unfiled'));await loadDocuments(); }
    catch(error){if(version===generation){failed=true;loading=false;syncSave();$('book-editor-error').textContent=error.message;}}
  }
  $('books-direction-filter').addEventListener('change',()=>{direction=$('books-direction-filter').value;course='';render();});
  $('book-editor-close').addEventListener('click',()=>{if(!saving){generation++;dialog.close();}});
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();else generation++;});
  for(const id of ['book-direction','book-language','book-folder'])$(id).addEventListener('change',()=>{if(id!=='book-folder'){chosen='';if(id==='book-direction')updateStages();context();}offset=0;loadDocuments();});
  $('book-stage').addEventListener('change',context);
  $('book-document').addEventListener('change',()=>{chosen=$('book-document').value;const doc=documents.find(d=>String(d.id)===chosen);if(doc){$('book-title').value=doc.title;$('book-author-input').value=doc.authors||'';$('book-source').value='';}});
  $('book-doc-search').addEventListener('click',()=>{offset=0;loadDocuments();});
  $('book-document-query').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('book-doc-search').click();}});
  for(const [id,delta]of [['book-doc-prev',-20],['book-doc-next',20]])$(id).addEventListener('click',()=>{offset=Math.max(0,offset+delta);loadDocuments();});
  $('book-form').addEventListener('submit',async event=>{
    event.preventDefault();if(loading||saving||failed)return;
    const body={direction:$('book-direction').value,stage:$('book-stage').value,language:$('book-language').value,title:$('book-title').value.trim(),authors:$('book-author-input').value.trim(),source_url:$('book-source').value.trim(),prerequisites:$('book-prerequisites').value,sort_order:Number($('book-order').value),document_id:chosen?Number(chosen):null};
    saving=true;syncSave();$('book-editor-error').textContent='';const fields=[...$('book-form').querySelectorAll('input,select,button')],disabled=fields.map(f=>f.disabled);fields.forEach(f=>f.disabled=true);
    try { await write(editing?'/api/admin/books/'+editing.id:'/api/admin/books',body,editing?'PUT':'POST');direction=body.direction;course=body.stage;dialog.close();await load();message('教材配置已保存，学习应用已同步更新。'); }
    catch(error){$('book-editor-error').textContent=error instanceof TypeError?'连接失败，请重试。':error.message;}
    finally{saving=false;fields.forEach((f,i)=>f.disabled=disabled[i]);syncSave();}
  });
  return {load};
}
