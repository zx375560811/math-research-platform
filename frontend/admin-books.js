import { mountIcons } from './icons.js';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const option=(text,value)=>{const node=el('option',text);node.value=value;return node;};
export function createAdminBooks({api,write,message,directions}) {
  const areas=()=>directions().filter(d=>['analysis','algebra'].includes(d.slug)).map(d=>({...d,name:d.slug==='geometry-topology'?'几何':d.name}));
  let books=[],courses={},direction='',course='',documents=[],folders=[],offset=0,generation=0,loading=false,saving=false,failed=false,chosen='',targetDirection='',targetCourse='';
  const dialog=$('book-editor'),stages=slug=>courses[slug]||['基础入门','核心理论','进阶学习'];
  const items=()=>books.filter(b=>b.direction===direction&&b.stage===course).sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id);
  function control(text,callback,iconName){const button=el('button',null,'button compact');button.type='button';if(iconName){const icon=el('span');icon.dataset.icon=iconName;icon.setAttribute('aria-hidden','true');button.append(icon);}button.append(document.createTextNode(text));button.addEventListener('click',callback);return button;}
  function render(){
    $('books-direction-filter').replaceChildren(...areas().map(d=>option(d.name,d.slug)));$('books-direction-filter').value=direction;
    const values=[...new Set([...stages(direction),...books.filter(b=>b.direction===direction).map(b=>b.stage)])];if(!values.includes(course))course=values[0]||'';
    $('book-courses').replaceChildren();for(const value of values){const button=control(value,()=>{course=value;render();});button.dataset.course=value;button.setAttribute('aria-pressed',String(course===value));button.disabled=saving;$('book-courses').append(button);}
    $('book-course-title').textContent=course||'课程';$('book-list').replaceChildren();const current=items();
    for(const [index,book]of current.entries()){
      const row=el('article',null,'book-recommendation'),info=el('div',null,'book-recommendation-info'),number=el('span',String(index+1).padStart(2,'0'),'book-order-number');
      info.append(el('h3',book.title));if(book.authors)info.append(el('p',book.authors));
      const actions=el('div',null,'book-row-actions');
      for(const [label,delta,icon]of [['上移',-1,'up'],['下移',1,'down']]){const button=control(label,()=>reorder(book.id,delta),icon);button.dataset.move=String(delta);button.setAttribute('aria-label',label+' '+book.title);button.disabled=saving||index+delta<0||index+delta>=current.length;actions.append(button);}
      const remove=control('移除',()=>removeBook(book.id),'close');remove.dataset.removeBook=book.id;remove.setAttribute('aria-label','移除推荐 '+book.title);remove.disabled=saving;actions.append(remove);row.dataset.bookId=book.id;row.append(number,info,actions);$('book-list').append(row);
    }
    if(!current.length)$('book-list').append(el('p','暂无推荐教材','admin-empty'));
    $('book-add').disabled=saving||!course;$('books-direction-filter').disabled=saving;mountIcons();
  }
  async function load(){const body=await api('/api/admin/books');books=body.books.filter(b=>b.document_id&&areas().some(d=>d.slug===b.direction));courses=body.courses||{};courses.analysis=courses.analysis||body.analysis_courses;if(!direction)direction=areas().find(d=>d.slug==='analysis')?.slug||areas()[0]?.slug||'';render();}
  async function reorder(id,delta){if(saving)return;const ordered=items(),index=ordered.findIndex(b=>b.id===id),next=index+delta;if(index<0||next<0||next>=ordered.length)return;[ordered[index],ordered[next]]=[ordered[next],ordered[index]];saving=true;render();try{await write('/api/admin/books/order',{ids:ordered.map(b=>b.id)});await load();message('教材顺序已保存。');}catch(error){message(error.message,true);try{await load();}catch{}}finally{saving=false;render();}}
  async function removeBook(id){if(saving)return;saving=true;render();try{await write('/api/admin/books/'+id,{},'DELETE');await load();message('已移除推荐，文献、文件与阅读笔记保留。');}catch(error){message(error.message,true);}finally{saving=false;render();}}
  function path(folder){const names=[],seen=new Set();while(folder&&!seen.has(folder.id)){seen.add(folder.id);names.unshift(folder.name);folder=folders.find(f=>f.id===folder.parent_id);}return names.join(' / ');}
  function syncSave(){$('book-save').disabled=loading||saving||failed||!chosen;dialog.setAttribute('aria-busy',String(loading||saving));}
  function preview(){const doc=documents.find(d=>String(d.id)===chosen);$('book-preview').hidden=!doc;$('book-preview').textContent=doc?doc.title+(doc.authors?' · '+doc.authors:''):'';syncSave();}
  async function loadDocuments(){
    const version=++generation;loading=true;failed=false;syncSave();$('book-editor-error').textContent='';$('book-document').disabled=true;$('book-doc-prev').disabled=$('book-doc-next').disabled=true;
    try{
      const body=await api('/api/admin/documents?'+new URLSearchParams({module:'mathematics',q:$('book-document-query').value.trim(),collection:$('book-folder').value,offset}));if(version!==generation)return;
      const attached=new Set(books.filter(b=>b.direction===targetDirection&&b.stage===targetCourse).map(b=>b.document_id));let selected=documents.find(d=>String(d.id)===chosen);documents=body.documents.filter(d=>!attached.has(d.id));
      if(chosen&&!documents.some(d=>String(d.id)===chosen)&&selected)documents.unshift(selected);
      if(chosen&&!documents.some(d=>String(d.id)===chosen))chosen='';
      $('book-document').replaceChildren(option('请选择文献',''),...documents.map(d=>option(d.title+(d.authors?' · '+d.authors:''),d.id)));$('book-document').value=chosen;
      $('book-doc-prev').disabled=offset===0;$('book-doc-next').disabled=body.documents.length<20;$('book-doc-page').textContent='第 '+(offset/20+1)+' 页';
      $('book-binding-hint').hidden=documents.length!==0;$('book-binding-hint').textContent=body.documents.length?'本页文献已在该课程中，可搜索或翻页。':'没有匹配文献，可更换目录或搜索。';
    }catch(error){if(version===generation){failed=true;$('book-editor-error').textContent=error.message;}}
    finally{if(version===generation){loading=false;$('book-document').disabled=failed;preview();}}
  }
  async function open(){if(saving)return;const version=++generation;loading=true;failed=false;chosen='';documents=[];offset=0;targetDirection=direction;targetCourse=course;$('book-form').reset();$('book-preview').hidden=true;$('book-editor-error').textContent='';$('book-context').textContent=(areas().find(d=>d.slug===direction)?.name||direction)+' / '+course;syncSave();dialog.showModal();$('book-document-query').focus();
    try{const body=await api('/api/admin/collections');if(version!==generation)return;folders=body.collections;$('book-folder').replaceChildren(option('全部文献',''),...folders.map(folder=>option(path(folder),folder.id)));await loadDocuments();}
    catch(error){if(version===generation){failed=true;loading=false;syncSave();$('book-editor-error').textContent=error.message;}}
  }
  $('books-direction-filter').addEventListener('change',()=>{direction=$('books-direction-filter').value;course='';render();});
  $('book-add').addEventListener('click',open);
  $('book-editor-close').addEventListener('click',()=>{if(!saving){generation++;dialog.close();}});dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();else generation++;});
  $('book-document').addEventListener('change',()=>{chosen=$('book-document').value;preview();});
  $('book-folder').addEventListener('change',()=>{offset=0;loadDocuments();});
  $('book-doc-search').addEventListener('click',()=>{offset=0;loadDocuments();});$('book-document-query').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('book-doc-search').click();}});
  for(const[id,delta]of [['book-doc-prev',-20],['book-doc-next',20]])$(id).addEventListener('click',()=>{offset=Math.max(0,offset+delta);loadDocuments();});
  $('book-form').addEventListener('submit',async event=>{
    event.preventDefault();if(loading||saving||failed||!chosen)return;const doc=documents.find(d=>String(d.id)===chosen);if(!doc)return;
    const current=books.filter(b=>b.direction===targetDirection&&b.stage===targetCourse),order=Math.min(10000,Math.max(-10,...current.map(b=>b.sort_order))+10);
    const body={direction:targetDirection,stage:targetCourse,language:doc.language==='zh'?'zh':'en',title:doc.title,authors:doc.authors||'',source_url:'',prerequisites:'',sort_order:order,document_id:doc.id,attach_direction:true};
    saving=true;syncSave();const fields=[...$('book-form').querySelectorAll('input,select,button')],disabled=fields.map(f=>f.disabled);fields.forEach(f=>f.disabled=true);$('book-editor-error').textContent='';
    try{await write('/api/admin/books',body);direction=targetDirection;course=targetCourse;dialog.close();await load();message('教材已添加，用户端已同步更新。');}
    catch(error){$('book-editor-error').textContent=error instanceof TypeError?'连接失败，请重试。':error.message;}
    finally{saving=false;fields.forEach((f,i)=>f.disabled=disabled[i]);syncSave();render();}
  });
  return {load};
}
