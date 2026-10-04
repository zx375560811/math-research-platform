import { mountIcons } from './icons.js';
const $=id=>document.getElementById(id);
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function icon(name){const n=el('span');n.dataset.icon=name;n.setAttribute('aria-hidden','true');return n;}
function button(text,callback,cls='button compact'){const n=el('button',text,cls);n.type='button';n.addEventListener('click',callback);return n;}
export function createAdminLibrary({api,write,editDocument,message,onChoose,refresh,paging}) {
  let folders=[],selected='',documents=[],generation=0,selectedIds=new Set(),task=null;const expanded=new Set(),known=new Set();
  const dialog=$('library-operation');
  function folderPath(id){const names=[],seen=new Set();let f=folders.find(f=>String(f.id)===String(id));while(f&&!seen.has(f.id)){seen.add(f.id);names.unshift(f.name);f=folders.find(p=>p.id===f.parent_id);}return names.join(' / ');}
  function destinations(exclude=null){
    const select=$('operation-destination');select.replaceChildren();const root=el('option',task==='move-documents'?'未归入目录':'顶层目录');root.value='';select.append(root);
    for(const f of folders){let p=f,invalid=false;const seen=new Set();while(p&&!seen.has(p.id)){if(p.id===exclude){invalid=true;break;}seen.add(p.id);p=folders.find(x=>x.id===p.parent_id);}if(invalid)continue;const option=el('option',folderPath(f.id));option.value=f.id;select.append(option);}
  }
  let operation=null;
  function open(kind,{doc=null,ids=null}={}) {
    task=kind;operation={doc,ids:ids||[doc?.id].filter(Boolean),folder:folders.find(f=>String(f.id)===selected)};
    $('operation-error').textContent='';$('operation-form').reset();$('operation-name-label').hidden=!['rename-document','rename-folder','create-folder'].includes(kind);$('operation-destination-label').hidden=!['move-documents','move-folder','create-folder'].includes(kind);
    $('operation-detach-label').hidden=kind!=='delete-documents';$('operation-description').hidden=!kind.startsWith('delete')&&kind!=='move-documents';
    const titles={'rename-document':'文献改名','rename-folder':'目录改名','create-folder':'新建目录','move-documents':'移动文献','move-folder':'移动目录','delete-documents':'删除文献','delete-folder':'删除目录'};
    $('operation-title').textContent=titles[kind];$('operation-submit').textContent=kind.startsWith('delete')?'确认删除':'保存';$('operation-submit').classList.toggle('danger',kind.startsWith('delete'));
    $('operation-name').required=['rename-document','rename-folder','create-folder'].includes(kind);$('operation-name').value=doc?.title||operation.folder?.name||'';if(kind==='create-folder')$('operation-name').value='';
    destinations(kind==='move-folder'?operation.folder?.id:null);$('operation-destination').value=kind==='move-folder'?String(operation.folder?.parent_id||''):kind==='create-folder'?selected==='unfiled'?'':selected:'';
    $('operation-description').textContent=kind==='delete-documents'?`将永久删除 ${operation.ids.length} 篇文献及其文件、阅读进度和高亮笔记。此操作无法撤销。`:kind==='delete-folder'?`删除「${operation.folder?.name}」？将移除该目录及其子目录。文献、文件、笔记和阅读进度保留，可从“全部文献”查看。`:'移动后仅保留目标目录归属，阅读进度和笔记保持不变。';
    dialog.showModal();mountIcons();
  }
  $('operation-cancel').addEventListener('click',()=>{if(dialog.getAttribute('aria-busy')!=='true')dialog.close();});
  dialog.addEventListener('cancel',event=>{if(dialog.getAttribute('aria-busy')==='true')event.preventDefault();});
  $('operation-form').addEventListener('submit',async event=>{
    event.preventDefault();if($('operation-submit').disabled)return;$('operation-submit').disabled=true;dialog.setAttribute('aria-busy','true');$('operation-error').textContent='';
    const kind=task,target=operation;
    try {
      const dest=$('operation-destination').value?Number($('operation-destination').value):null,name=$('operation-name').value.trim();let result;
      if(kind==='rename-document')await write(`/api/admin/documents/${target.doc.id}/name`,{name},'PATCH');
      if(kind==='rename-folder')await write(`/api/admin/collections/${target.folder.id}`,{name},'PATCH');
      if(kind==='create-folder'){result=await write('/api/admin/collections',{name,parent_id:dest});selected=String(result.id);}
      if(kind==='move-folder')await write(`/api/admin/collections/${target.folder.id}/parent`,{parent_id:dest},'PUT');
      if(kind==='move-documents')await write('/api/admin/documents/move',{document_ids:target.ids,collection_id:dest});
      if(kind==='delete-documents')result=await write('/api/admin/documents/batch-delete',{document_ids:target.ids,detach_books:$('operation-detach').checked});
      if(kind==='delete-folder'){await write(`/api/admin/collections/${target.folder.id}`,{},'DELETE');selected=target.folder.parent_id==null?'':String(target.folder.parent_id);}
      dialog.close();selectedIds.clear();await refresh();message(result?.cleanup_pending?'文献已删除，文件清理将在服务器重启后重试。':'操作已完成。');
    }catch(error){$('operation-error').textContent=error instanceof TypeError?'连接失败，请重试。':error.message;}
    finally{$('operation-submit').disabled=false;dialog.setAttribute('aria-busy','false');}
  });
  function choose(id){selected=id;selectedIds.clear();$('admin-folders').classList.remove('open');$('admin-folders-toggle').setAttribute('aria-expanded','false');onChoose();}
  function selection(){const count=selectedIds.size;$('admin-selection-count').textContent=count?`已选 ${count} 篇`:'选择文献';$('admin-batch-move').disabled=$('admin-batch-delete').disabled=count===0;const all=$('admin-select-all');all.checked=documents.length>0&&count===documents.length;all.indeterminate=count>0&&count<documents.length;}
  function tree(archive){
    const nav=$('admin-library-tree');nav.replaceChildren();
    const choice=(id,name,count)=>{const b=button('',()=>choose(id),'library-folder-select');b.dataset.collection=id;b.title=name;b.setAttribute('aria-current',selected===id?'page':'false');b.append(icon('book'),el('span',name,'library-folder-name'),el('span',String(count),'library-folder-count'));return b;};
    nav.append(choice('','全部文献',archive.total));const children=new Map();for(const f of folders){const key=f.parent_id==null?'':String(f.parent_id);if(!children.has(key))children.set(key,[]);children.get(key).push(f);}
    let parent=folders.find(f=>String(f.id)===selected);const seen=new Set();while(parent&&!seen.has(parent.id)){seen.add(parent.id);if(parent.parent_id!=null)expanded.add(String(parent.parent_id));parent=folders.find(f=>f.id===parent.parent_id);}
    function branch(id,depth=0){const ul=el('ul',null,'library-folder-list');if(depth>30)return ul;for(const f of children.get(id)||[]){const key=String(f.id),li=el('li'),row=el('div',null,'library-folder-row');if(f.parent_id==null&&!known.has(key)){known.add(key);expanded.add(key);}const nested=children.has(key),toggle=button('',()=>{const open=!expanded.has(key);if(open)expanded.add(key);else expanded.delete(key);toggle.setAttribute('aria-expanded',String(open));group.hidden=!open;},'library-folder-expand');toggle.append(icon('forward'));toggle.disabled=!nested;toggle.setAttribute('aria-label','展开或收起 '+f.name);toggle.setAttribute('aria-expanded',String(expanded.has(key)));row.append(toggle,choice(key,f.name,f.count));li.append(row);let group;if(nested){group=branch(key,depth+1);group.hidden=!expanded.has(key);group.id='admin-folder-'+key;toggle.setAttribute('aria-controls',group.id);li.append(group);}ul.append(li);}return ul;}
    nav.append(branch(''));nav.append(choice('unfiled','未归入目录',archive.unfiled));
    const current=folders.find(f=>String(f.id)===selected);$('admin-library-path').textContent=current?folderPath(current.id):selected==='unfiled'?'未归入目录':'全部文献';$('admin-library-path').title=$('admin-library-path').textContent;
    for(const id of ['admin-folder-rename','admin-folder-move','admin-folder-delete'])$(id).disabled=!current;mountIcons();
  }
  async function load({offset,query}) {
    const version=++generation;$('admin-library-browser').setAttribute('aria-busy','true');$('admin-library-status').textContent='正在加载…';
    try {
      const archive=await api('/api/admin/collections');if(version!==generation)return;folders=archive.collections;if(selected&&!['unfiled',...folders.map(f=>String(f.id))].includes(selected))selected='';tree(archive);
      const body=await api('/api/admin/documents?'+new URLSearchParams({offset,q:query,collection:selected}));if(version!==generation)return;documents=body.documents;selectedIds.clear();const list=$('document-list');list.replaceChildren();
      for(const doc of documents){const row=el('tr');row.dataset.document=doc.id;const cell=el('td'),check=el('input');check.type='checkbox';check.setAttribute('aria-label','选择 '+doc.title);check.dataset.selectDocument=doc.id;check.addEventListener('change',()=>{if(check.checked)selectedIds.add(doc.id);else selectedIds.delete(doc.id);selection();});cell.append(check);const title=el('td'),name=el('a',doc.title,'library-document-title');name.href='/#/library/read/'+doc.id;name.title=doc.title;title.append(name);const authors=el('td',doc.authors||'—','library-author-column');authors.title=doc.authors||'';const format=el('td',(doc.format||'pdf').toUpperCase(),'library-file-format'),actions=el('td',null,'admin-document-actions'),edit=button('编辑',()=>editDocument(doc)),more=button('更多',()=>openActions(doc));more.dataset.documentActions=doc.id;actions.append(edit,more);row.append(cell,title,authors,format,actions);list.append(row);}
      selection();$('admin-library-status').textContent=documents.length?'':query?'当前目录没有匹配文献。':'此目录暂无文献。';paging('documents',offset,documents.length);mountIcons();return body.documents;
    }catch(error){if(version===generation)$('admin-library-status').textContent=error instanceof TypeError?'连接失败，请刷新重试。':error.message;throw error;}
    finally{if(version===generation)$('admin-library-browser').setAttribute('aria-busy','false');}
  }
  function openActions(doc){const menu=$('document-actions-dialog');$('document-actions-title').textContent=doc.title;const download=$('document-download');download.href=doc.file_url;download.textContent='下载 '+(doc.format||'pdf').toUpperCase();for(const [id,kind]of [['document-rename','rename-document'],['document-move','move-documents'],['document-delete','delete-documents']])$(id).onclick=()=>{menu.close();open(kind,{doc});};menu.showModal();}
  $('document-actions-close').addEventListener('click',()=>$('document-actions-dialog').close());
  $('admin-select-all').addEventListener('change',()=>{selectedIds=$('admin-select-all').checked?new Set(documents.map(d=>d.id)):new Set();for(const check of document.querySelectorAll('[data-select-document]'))check.checked=selectedIds.has(Number(check.dataset.selectDocument));selection();});
  $('admin-batch-move').addEventListener('click',()=>open('move-documents',{ids:[...selectedIds]}));$('admin-batch-delete').addEventListener('click',()=>open('delete-documents',{ids:[...selectedIds]}));
  for(const [id,kind]of [['admin-folder-create','create-folder'],['admin-folder-rename','rename-folder'],['admin-folder-move','move-folder'],['admin-folder-delete','delete-folder']])$(id).addEventListener('click',()=>open(kind));
  $('admin-folders-toggle').addEventListener('click',()=>{const open=$('admin-folders').classList.toggle('open');$('admin-folders-toggle').setAttribute('aria-expanded',String(open));});
  return {load,collection:()=>selected};
}
