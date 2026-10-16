import { mountIcons } from './icons.js';
import { renderAnswer } from './richtext.js';
const categories = { mathematics:'数学与应用数学', 'math-to-ai':'数学到人工智能', competition:'数学竞赛', general:'学习交流' };
const errors = { invalid_discussion:'请填写标题与正文，标题最多 120 字，正文最多 12000 字。', discussion_forbidden:'只能修改或删除自己的内容。', discussion_changed:'内容已在其他页面修改。请复制当前内容，刷新后重新编辑。', discussion_locked:'此话题已关闭回复，请刷新查看。', not_found:'话题或关联文献已不存在。', request_too_large:'内容太长，请缩短后重试。' };
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const glyph=name=>{const n=el('span');n.dataset.icon=name;n.setAttribute('aria-hidden','true');return n;};
const link=(text,href,cls)=>{const a=el('a',text,cls);a.href=href;return a;};
function button(text,action,cls='button compact',icon){const b=el('button',null,cls);b.type='button';if(icon)b.append(glyph(icon));b.append(el('span',text));b.onclick=action;return b;}
function date(value){const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
function badge(category){const b=el('span',categories[category],'discussion-tag');b.dataset.category=category;return b;}
function message(error){return errors[error.code]||(error instanceof TypeError?'连接失败，请检查连接后重试。':error.message)||'连接失败，请重试。';}
// Original mathematical linework; decorative geometry never carries post information.
const cardMotifs=[
  ['M18 126H146M30 142V26','M35 108C61 108 59 48 88 48S116 113 142 34','M54 87H126'],
  ['M30 91L91 29L151 91L91 152ZM30 91H151M91 29V152','M61 60L122 121M61 121L122 60'],
  ['M32 91A58 58 0 1 0 148 91A58 58 0 1 0 32 91','M90 33V150M32 91H148','M90 91L137 57M117 91A27 27 0 0 0 112 76'],
  ['M24 91C24 29 156 29 156 91S24 153 24 91Z','M36 122C-6 65 101-13 143 45S78 180 36 122Z','M90 29V152'],
  ['M35 43L90 91L143 38M35 43L43 143L90 91L143 142L143 38M43 143H143','M35 43H143M90 91V153'],
  ['M23 137H151M29 145V25','M39 121C55 102 67 76 72 32M84 130C89 95 115 69 146 55','M41 45C62 54 108 94 143 128'],
  ['M24 126L89 27L151 126ZM24 126L90 91L151 126M89 27L90 91','M90 91V153M24 126L90 153L151 126'],
  ['M31 126A72 72 0 0 1 127 31','M46 140A72 72 0 0 1 142 46','M61 154A72 72 0 0 1 156 61','M36 120L95 61L144 110'],
  ['M90 90C58 26 12 43 21 90S67 141 90 90C122 26 168 43 159 90S113 141 90 90Z','M32 128C58 142 118 140 146 122','M32 52C62 37 117 38 146 56']
];
function cardArt(index){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 180 180');svg.setAttribute('class','discussion-card-art');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');for(const d of cardMotifs[index%cardMotifs.length]){const path=document.createElementNS(ns,'path');path.setAttribute('d',d);svg.append(path);}return svg;}

export function createDiscussion({api,write}) {
  const root=document.getElementById('discussion-view');
  let generation=0,owner=null,listHash='#/discussions',requests=new AbortController();
  const drafts=new Map();
  function close(){++generation;requests.abort();requests=new AbortController();root.setAttribute('aria-busy','false');}
  function setUser(user){if(owner!==user){owner=user;drafts.clear();listHash='#/discussions';close();root.replaceChildren();}}
  const get=url=>api(url,{signal:requests.signal});
  function status(text,cls='discussion-status'){const p=el('p',text,cls);p.setAttribute('role','status');return p;}
  function pager(body,change){const nav=el('nav',null,'discussion-pager');nav.setAttribute('aria-label','讨论分页');const prev=button('上一页',()=>change(body.offset-body.limit)),next=button('下一页',()=>change(body.offset+body.limit));prev.disabled=body.offset===0;next.disabled=body.offset+body.limit>=body.total;nav.append(prev,el('span',`第 ${Math.floor(body.offset/body.limit)+1} / ${body.total_pages} 页 · 共 ${body.total} 条`),next);return nav;}
  function metadata(item){const meta=el('div',null,'discussion-meta'),avatar=el('span',item.author.slice(0,1).toUpperCase(),'discussion-avatar');avatar.setAttribute('aria-hidden','true');const time=el('time',date(item.created_at));time.dateTime=item.created_at;time.title=new Date(item.created_at).toLocaleString();meta.append(avatar,el('span',item.author),time);if(item.version>1)meta.append(el('span','已编辑'));return meta;}
  function bookLink(doc){const a=link('',`#/library/preview/${doc.id}`,'discussion-book');a.append(glyph('book'),el('span',doc.title),el('span','预览','discussion-book-action'));return a;}
  function confirmDelete(host,action,topic=false){
    if(host.querySelector('.discussion-confirm'))return;
    const box=el('div',null,'discussion-confirm'),error=status(''),yes=button('确认删除',async()=>{yes.disabled=true;try{await action();}catch(e){error.textContent=message(e);yes.disabled=false;}},'button compact discussion-danger'),no=button('取消',()=>box.remove());
    box.append(el('span',topic?'删除话题及全部回复？':'删除这条回复？'),yes,no,error);host.append(box);yes.focus();
  }
  function contentEditor(initial,key,label){
    const box=el('div',null,'discussion-editor'),tabs=el('div',null,'discussion-editor-tabs'),textarea=el('textarea'),preview=el('div',null,'discussion-preview'),writing=button('编辑',()=>show(false)),reading=button('预览',()=>show(true));
    textarea.id='discussion-text-'+key.replace(/[^a-z0-9]/gi,'-');textarea.setAttribute('aria-label',label);textarea.maxLength=12000;textarea.rows=key.startsWith('reply-')?5:10;textarea.required=true;textarea.placeholder='写下问题、推导或你的思路…';textarea.value=drafts.get(key)?.content??initial;
    const hint=el('span','支持 Markdown 与 $公式$','discussion-editor-hint');tabs.append(writing,reading,hint);preview.hidden=true;
    function show(on){preview.hidden=!on;textarea.hidden=on;writing.setAttribute('aria-pressed',String(!on));reading.setAttribute('aria-pressed',String(on));if(on)preview.replaceChildren(textarea.value.trim()?renderAnswer(textarea.value):el('p','还没有正文。','muted'));}
    textarea.addEventListener('invalid',()=>{show(false);textarea.focus();});
    show(false);box.append(tabs,textarea,preview);return {box,textarea,preview};
  }
  async function topicForm(topic,version){
    const key=topic?'topic-'+topic.id:'topic-new',saved=drafts.get(key)||{},form=el('form',null,'discussion-compose');
    const heading=el('div',null,'discussion-heading');heading.append(link('← 返回讨论',topic?'#/discussions/'+topic.id:listHash,'back-link'),el('h1',topic?'编辑话题':'发起讨论'));
    const title=el('input');title.id='discussion-title';title.required=true;title.maxLength=120;title.placeholder='用一句话说明你想讨论的问题';title.value=saved.title??topic?.title??'';
    const titleLabel=el('label','话题标题');titleLabel.htmlFor=title.id;
    const category=el('select');category.id='discussion-category';for(const [value,name] of Object.entries(categories)){const option=el('option',name);option.value=value;category.append(option);}category.value=saved.category??topic?.category??'mathematics';
    const catLabel=el('label','讨论分类');catLabel.htmlFor=category.id;const field=el('div',null,'discussion-category-field');field.append(catLabel,category);
    const editor=contentEditor(topic?.content||'',key,'话题正文'),label=el('label','正文');label.htmlFor=editor.textarea.id;
    const association=el('details',null,'discussion-association'),summary=el('summary','关联教材（可选）'),chosen=el('div',null,'discussion-chosen');
    // Search is inside the topic form: use a div and explicit button, never nested forms.
    const searchBox=el('div',null,'discussion-book-search'),query=el('input'),find=button('查找',()=>loadBooks(0)),results=el('div',null,'discussion-book-results');
    query.type='search';query.setAttribute('aria-label','查找关联教材');query.placeholder='按文献名称搜索';query.maxLength=100;searchBox.append(query,find);
    let selected=Object.hasOwn(saved,'document')?saved.document:topic?.document??null,searchVersion=0;
    function retain(){drafts.set(key,{title:title.value,category:category.value,content:editor.textarea.value,document:selected});}
    function choice(){chosen.replaceChildren();if(selected){chosen.append(glyph('book'),el('span',selected.title),button('移除',()=>{selected=null;choice();retain();}));summary.textContent='更换关联教材';}else summary.textContent='关联教材（可选）';}
    async function loadBooks(offset){const mine=++searchVersion;find.disabled=true;results.replaceChildren(status('正在查找…'));try{const data=await get('/api/library/documents?'+new URLSearchParams({q:query.value.trim(),offset}));if(version!==generation||mine!==searchVersion)return;results.replaceChildren();for(const doc of data.documents){const b=button(doc.title,()=>{selected={id:doc.id,title:doc.title};choice();retain();association.open=false;},'discussion-book-option','book');results.append(b);}if(!data.documents.length)results.append(status('没有找到文献，试试其他关键词。'));if(data.total>20)results.append(pager(data,loadBooks));}catch(e){if(version===generation)results.replaceChildren(status(message(e)));}finally{if(version===generation&&mine===searchVersion)find.disabled=false;}}
    query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadBooks(0);}});association.append(summary,searchBox,results);choice();
    const alert=status(''),actions=el('div',null,'discussion-form-actions'),submit=el('button',topic?'保存修改':'发布话题','button primary');submit.type='submit';submit.append(glyph('send'));actions.append(link('取消',topic?'#/discussions/'+topic.id:listHash,'button'),submit);
    form.append(titleLabel,title,field,label,editor.box,chosen,association,alert,actions);form.addEventListener('input',retain);
    form.onsubmit=async event=>{event.preventDefault();if(submit.disabled)return;retain();submit.disabled=true;form.setAttribute('aria-busy','true');alert.textContent='正在保存…';try{const result=await write('/api/discussions'+(topic?'/'+topic.id:''),{title:title.value,content:editor.textarea.value,category:category.value,document_id:selected?.id??null,...(topic?{version:topic.version}:{})},topic?'PATCH':'POST');if(version!==generation)return;drafts.delete(key);location.hash='#/discussions/'+(topic?.id||result.id);}catch(e){if(version===generation)alert.textContent=message(e);}finally{if(version===generation){submit.disabled=false;form.setAttribute('aria-busy','false');}}};
    root.replaceChildren(heading,form);mountIcons();title.focus();
  }
  async function listing(params,version){
    listHash=location.hash;const category=params.get('category')||'',scope=params.get('scope')||'all',q=params.get('q')||'',offset=(Math.max(1,Number(params.get('page'))||1)-1)*9;
    const heading=el('div',null,'discussion-heading'),name=el('div',null,'discussion-title-group');name.append(glyph('chat'),el('h1','讨论'));const add=link('发起讨论','#/discussions/new','button primary');add.prepend(glyph('chat'));heading.append(name,add);
    const toolbar=el('div',null,'discussion-toolbar'),filters=el('nav',null,'discussion-categories');filters.setAttribute('aria-label','讨论分类');
    function href(changes){const p=new URLSearchParams(params);p.delete('page');for(const [key,val] of Object.entries(changes))val?p.set(key,val):p.delete(key);return '#/discussions'+(p.size?'?'+p:'');}
    for(const [value,label] of [['','全部讨论'],...Object.entries(categories)]){const a=link(label,href({category:value}),'discussion-category');a.setAttribute('aria-current',value===category?'page':'false');filters.append(a);}
    const controls=el('form',null,'discussion-filters'),query=el('input'),select=el('select');query.type='search';query.placeholder='搜索话题';query.maxLength=100;query.value=q;query.setAttribute('aria-label','搜索讨论');select.setAttribute('aria-label','筛选讨论');
    for(const [value,label] of [['all','最近讨论'],['unanswered','等待回复'],['mine','我发起的']]){const option=el('option',label);option.value=value;select.append(option);}select.value=scope;
    const submit=el('button','搜索','button compact');submit.type='submit';controls.append(query,submit,select);controls.onsubmit=e=>{e.preventDefault();location.hash=href({q:query.value.trim(),scope:select.value});};select.onchange=()=>{location.hash=href({q:query.value.trim(),scope:select.value});};toolbar.append(filters,controls);
    const list=el('div',null,'discussion-list'),info=status('正在加载讨论…');root.replaceChildren(heading,toolbar,info,list);mountIcons();
    try{
      const data=await get('/api/discussions?'+new URLSearchParams({category,scope,q,offset}));if(version!==generation)return;info.textContent='';
      for(const [index,topic] of data.topics.entries()){
        const row=link('','#/discussions/'+topic.id,'discussion-row'),body=el('div',null,'discussion-row-body'),labels=el('div',null,'discussion-row-labels'),categoryTag=badge(topic.category);categoryTag.prepend(glyph({mathematics:'compass','math-to-ai':'spark',competition:'trophy',general:'chat'}[topic.category]));labels.append(categoryTag);if(topic.pinned)labels.append(el('span','置顶','discussion-label'));if(topic.locked)labels.append(el('span','已关闭回复','discussion-label'));
        const h2=el('h2',topic.title),footer=el('div',null,'discussion-card-footer');h2.id='discussion-card-title-'+topic.id;footer.id='discussion-card-meta-'+topic.id;row.setAttribute('aria-labelledby',h2.id);row.setAttribute('aria-describedby',footer.id);row.title=topic.title;row.dataset.category=topic.category;
        const forward=glyph('forward');forward.className='discussion-card-open';body.append(labels,h2);
        const replies=el('span',null,'discussion-reply-count');replies.append(glyph('chat'),el('strong',String(topic.reply_count)),el('span','回复','sr-only'));footer.append(metadata(topic),replies,forward);row.append(cardArt(index),body,footer);list.append(row);
      }
      if(!data.topics.length){const empty=el('div',null,'discussion-empty');empty.append(glyph('chat'),el('h2',q?'没有找到相关讨论':'还没有'+(scope==='mine'?'你发起的':scope==='unanswered'?'等待回复的':'')+'话题'),el('p',q?'换个关键词，或发起一个新话题。':'从一道习题、一段证明或一本教材开始交流。'),link('发起讨论','#/discussions/new','button primary'));list.append(empty);}
      root.append(pager(data,value=>{location.hash=href({page:String(value/data.limit+1)});}));mountIcons();
    }catch(e){if(version===generation){info.textContent=message(e);info.append(button('重试',()=>navigate(location.hash)));}}
  }
  async function detail(id,params,version){
    const offset=(Math.max(1,Number(params.get('page'))||1)-1)*20;
    const [topic,replies]=await Promise.all([get('/api/discussions/'+id),get(`/api/discussions/${id}/replies?offset=${offset}`)]);if(version!==generation)return;
    const back=link('← 返回讨论',listHash,'back-link'),article=el('article',null,'discussion-topic'),top=el('div',null,'discussion-topic-category');top.append(badge(topic.category));if(topic.pinned)top.append(el('span','置顶','discussion-label'));if(topic.locked)top.append(el('span','已关闭回复','discussion-label'));
    const body=renderAnswer(topic.content);body.classList.add('discussion-prose');article.append(top,el('h1',topic.title),metadata(topic));if(topic.document)article.append(bookLink(topic.document));article.append(body);
    const actions=el('div',null,'discussion-topic-actions'),alert=status('');
    if(topic.can_edit)actions.append(link('编辑话题',`#/discussions/${id}/edit`,'button compact'));
    if(topic.can_delete)actions.append(button('删除话题',()=>confirmDelete(article,async()=>{await write('/api/discussions/'+id,{},'DELETE');if(version===generation)location.hash=listHash;},true),'button compact discussion-danger'));
    if(topic.can_moderate){for(const key of ['pinned','locked']){const b=button(key==='pinned'?(topic.pinned?'取消置顶':'置顶'):(topic.locked?'开放回复':'关闭回复'),async()=>{b.disabled=true;try{await write(`/api/discussions/${id}/moderation`,{pinned:topic.pinned,locked:topic.locked,[key]:!topic[key]},'PATCH');if(version===generation)navigate(location.hash);}catch(e){if(version===generation){alert.textContent=message(e);b.disabled=false;}}});actions.append(b);}}
    if(actions.children.length)article.append(actions,alert);
    const section=el('section',null,'discussion-replies'),replyTitle=el('h2',`回复 · ${replies.total}`),list=el('div',null,'discussion-reply-list');section.setAttribute('aria-label','话题回复');section.append(replyTitle,list);
    for(const reply of replies.replies){
      const row=el('article',null,'discussion-reply');row.id='discussion-reply-'+reply.id;const text=renderAnswer(reply.content);text.classList.add('discussion-prose');row.append(metadata(reply),text);
      const bar=el('div',null,'discussion-reply-actions');
      if(reply.can_edit)bar.append(button('编辑',()=>editReply(reply,row,text,bar)));
      if(reply.can_delete)bar.append(button('删除',()=>confirmDelete(row,async()=>{await write('/api/discussions/replies/'+reply.id,{},'DELETE');if(version===generation){const p=new URLSearchParams(params);if(replies.replies.length===1&&offset>0)p.set('page',String(offset/20));const target='#/discussions/'+id+(p.size?'?'+p:'');if(location.hash!==target)location.hash=target;else await navigate(target);}},false),'button compact discussion-danger'));
      row.append(bar);list.append(row);
    }
    if(!replies.total)list.append(status('还没有回复，写下你的思路吧。'));
    if(replies.total>20)section.append(pager(replies,value=>{location.hash=`#/discussions/${id}?page=${value/20+1}`;}));
    function editReply(reply,row,text,bar){
      if(row.querySelector('form'))return;const key='reply-'+reply.id,form=el('form',null,'discussion-reply-editor'),editor=contentEditor(reply.content,key,'编辑回复'),notice=status(''),save=el('button','保存回复','button primary compact');save.type='submit';text.hidden=true;bar.hidden=true;
      const controls=el('div',null,'discussion-form-actions');controls.append(button('取消',()=>{form.remove();text.hidden=false;bar.hidden=false;}),save);form.append(editor.box,notice,controls);row.append(form);editor.textarea.focus();editor.textarea.oninput=()=>drafts.set(key,{content:editor.textarea.value});
      form.onsubmit=async e=>{e.preventDefault();if(save.disabled)return;save.disabled=true;try{await write('/api/discussions/replies/'+reply.id,{content:editor.textarea.value,version:reply.version},'PATCH');if(version===generation){drafts.delete(key);await navigate(location.hash);}}catch(error){if(version===generation){notice.textContent=message(error);save.disabled=false;}}};
    }
    root.replaceChildren(back,article,section);
    if(!topic.locked){
      const form=el('form',null,'discussion-reply-compose'),editor=contentEditor('',`reply-new-${id}`,'回复正文'),notice=status(''),submit=el('button','发布回复','button primary');submit.type='submit';submit.append(glyph('send'));const actions=el('div',null,'discussion-form-actions');actions.append(submit);form.append(el('h2','参与讨论'),editor.box,notice,actions);
      editor.textarea.oninput=()=>drafts.set(`reply-new-${id}`,{content:editor.textarea.value});form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;try{const result=await write(`/api/discussions/${id}/replies`,{content:editor.textarea.value});if(version!==generation)return;drafts.delete(`reply-new-${id}`);const total=(await get(`/api/discussions/${id}/replies`)).total;if(version!==generation)return;const target=`#/discussions/${id}?page=${Math.max(1,Math.ceil(total/20))}`;history.replaceState(null,'',target);await navigate(target);if(root.querySelector('#discussion-reply-'+result.id))root.querySelector('#discussion-reply-'+result.id).scrollIntoView({block:'center'});}catch(error){if(version===generation){notice.textContent=message(error);submit.disabled=false;}}};root.append(form);
    }else root.append(status('此话题已关闭回复。'));
    mountIcons();
  }
  async function navigate(hash){
    close();const version=generation,[path,query='']=hash.split('?'),params=new URLSearchParams(query);root.hidden=false;root.setAttribute('aria-busy','true');root.replaceChildren(status('正在加载讨论…'));
    try{
      if(path==='#/discussions/new')await topicForm(null,version);
      else {const match=path.match(/^#\/discussions\/(\d+)(\/edit)?$/);if(match){if(match[2]){const topic=await get('/api/discussions/'+match[1]);if(version!==generation)return;if(!topic.can_edit)throw Object.assign(new Error(),{code:'discussion_forbidden'});await topicForm(topic,version);}else await detail(Number(match[1]),params,version);}else await listing(params,version);}
    }catch(error){if(version===generation)root.replaceChildren(link('← 返回讨论',listHash,'back-link'),status(message(error)),button('重新加载',()=>navigate(hash)));}
    finally{if(version===generation){root.setAttribute('aria-busy','false');mountIcons();}}
  }
  return {navigate,close,setUser};
}
