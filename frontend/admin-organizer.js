const $=id=>document.getElementById(id);
const issues={
  ai_not_configured:'所选 API 尚未配置。请先在阅读器保存“我的 API”，或在管理平台的 API 设置中配置默认接口。',
  ai_job_empty:'所选范围内没有文献。',ai_job_busy:'已有整理任务正在运行，请先暂停该任务。',ai_job_restarted:'服务器已重启，任务已暂停。点击继续处理剩余文献。',
  ai_job_owner_required:'此任务使用其他管理员的个人 API，请由该管理员继续。',ai_classification_invalid:'模型返回的分类格式不正确，任务已暂停。可更换普通对话模型后继续。',
  ai_connection_failed:'连接模型失败，任务已暂停。检查 API 设置后可继续。',ai_provider_auth:'API 密钥无效或接口拒绝访问，请检查设置后继续。',
  ai_provider_limit:'第三方接口额度或频率受限，任务已暂停。恢复额度后可继续。',ai_daily_limit:'管理员默认 API 的今日调用次数已用完，之后可继续剩余任务。',
  ai_response_budget:'模型输出未完成，任务已暂停。可换用普通对话模型后继续。',ai_response_invalid:'模型回复格式不受支持，请使用 OpenAI 兼容接口。',
  ai_job_failed:'整理遇到错误，任务已暂停。可以继续重试。',admin_required:'管理员权限已失效，任务已暂停。',not_found:'记录已不存在，请刷新后重试。'
};
export function createOrganizer({api,write,collection,refresh}) {
  let job={state:'idle'},timer=null,busy=false,refreshed='';const dialog=$('library-ai-dialog');
  function error(value){$('library-ai-error').textContent=issues[value?.code||value?.message]||value?.message||'';}
  function display(value){
    job=value;const running=job.state==='running';$('library-ai-progress').hidden=job.state==='idle';$('library-ai-start').disabled=running||busy;$('library-ai-pause').hidden=!running;$('library-ai-resume').hidden=!(job.state==='paused'||job.state==='completed'&&job.failed>0);$('library-ai-undo').hidden=!['running','paused','completed'].includes(job.state)||!(job.applied+job.review);
    for(const id of ['library-ai-pause','library-ai-resume','library-ai-undo'])$(id).disabled=busy;
    const names={running:'正在后台整理',paused:'已暂停',completed:'整理完成',undone:'已撤销'};$('library-ai-summary').textContent=job.state==='idle'?'':`${names[job.state]||job.state} · ${job.done} / ${job.total} 篇`;
    $('library-ai-bar').max=Math.max(1,job.total||0);$('library-ai-bar').value=job.done||0;$('library-ai-counts').textContent=job.state==='idle'?'':`已归类 ${job.applied||0} · 待确认 ${job.review||0} · 跳过 ${job.skipped||0} · 失败 ${job.failed||0}`;
    $('library-ai-error').textContent=job.error?issues[job.error]||'任务已暂停，请检查接口后继续。':'';
  }
  function poll(){clearTimeout(timer);if(!dialog.open||job.state!=='running')return;timer=setTimeout(async()=>{
    try{const value=await api('/api/admin/library-ai');display(value);const stamp=value.id+':'+value.state;if(value.state!=='running'&&refreshed!==stamp){refreshed=stamp;await refresh();}}
    catch(e){error(e);}finally{poll();}
  },3000);}
  $('library-ai-open').addEventListener('click',async()=>{
    dialog.showModal();$('library-ai-error').textContent='';$('library-ai-start').disabled=true;
    try{
      const [status,settings]=await Promise.all([api('/api/admin/library-ai'),api('/api/ai/settings')]);
      for(const option of $('library-ai-source').options)option.disabled=!settings[option.value]?.available;
      $('library-ai-source').value=settings.custom?.available?'custom':'default';const current=collection();$('library-ai-scope').querySelector('[value=current]').disabled=!current||current==='unfiled';$('library-ai-scope').value='all';display(status);if(!settings.custom?.available&&!settings.default?.available){$('library-ai-start').disabled=true;error(new Error('ai_not_configured'));}poll();
    }catch(e){error(e);}
  });
  $('library-ai-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;display(job);let failure=null;
    try{display(await write('/api/admin/library-ai',{source:$('library-ai-source').value,collection_id:$('library-ai-scope').value==='current'?Number(collection()):null}));}
    catch(e){failure=e;}finally{busy=false;display(job);if(failure)error(failure);poll();}
  });
  async function control(action){
    if(busy)return;if(action==='undo'&&!window.confirm('撤销本次 AI 分类？原文献、笔记和进度不变；整理后手动修改过的分类会保留。'))return;
    busy=true;display(job);let failure=null;
    try{job=await write(`/api/admin/library-ai/${job.id}/control`,{action});await refresh();}
    catch(e){failure=e;}finally{busy=false;display(job);if(failure)error(failure);poll();}
  }
  for(const action of ['pause','resume','undo'])$('library-ai-'+action).addEventListener('click',()=>control(action));
  $('library-ai-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>clearTimeout(timer));
}
