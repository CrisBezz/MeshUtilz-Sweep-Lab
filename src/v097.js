(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const status=document.querySelector('#status');
    const storageKey='meshutilz-balloon-names-v097';
    let names=[];
    try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))names=saved.map(x=>String(x||''))}catch{}
    const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(names))}catch{}};
    const defaults=items=>items.map((item,i)=>item.name||`${item.kind==='outline'?'Outline':'Tube'} Balloon ${i+1}`);
    const clearNames=()=>{names=[];save()};

    function install(){
      const api=window.MeshUtilzOutlinerAPI;
      if(!api||api.__v097Naming)return false;
      const baseList=api.list.bind(api),baseDuplicate=api.duplicateIndex.bind(api),baseDelete=api.deleteIndex.bind(api);
      api.list=()=>{
        const items=baseList(),fallback=defaults(items);
        while(names.length<items.length)names.push(fallback[names.length]);
        if(names.length>items.length)names.length=items.length;
        return items.map((item,i)=>({...item,name:names[i]||fallback[i]}));
      };
      api.renameIndex=(index,name)=>{
        const items=baseList(),clean=String(name||'').trim();
        if(!items[index]||!clean)return false;
        while(names.length<items.length)names.push(`${items[names.length].kind==='outline'?'Outline':'Tube'} Balloon ${names.length+1}`);
        names[index]=clean;save();
        if(status)status.textContent=`Renamed to ${clean}`;
        return true;
      };
      api.duplicateIndex=index=>{
        const before=api.list(),source=before[index],ok=baseDuplicate(index);
        if(ok){const after=baseList();while(names.length<after.length)names.push('');names[after.length-1]=`${source?.name||'Balloon'} Copy`;save()}
        return ok;
      };
      api.deleteIndex=index=>{
        const ok=baseDelete(index);if(ok){names.splice(index,1);save()}return ok;
      };
      api.__v097Naming=true;

      // The main Edit-panel Duplicate button bypasses api.duplicateIndex. Capture the
      // selected name before the validated core duplicates it, then name the new item.
      const duplicateBtn=document.querySelector('#duplicateBtn');
      let directDuplicate=null;
      duplicateBtn?.addEventListener('click',()=>{
        const list=api.list(),source=list.find(x=>x.selected);
        directDuplicate=source?{name:source.name,count:list.length}:null;
      },true);
      duplicateBtn?.addEventListener('click',()=>{
        if(!directDuplicate)return;
        const pending=directDuplicate;directDuplicate=null;
        queueMicrotask(()=>{
          const after=baseList();
          if(after.length<=pending.count)return;
          while(names.length<after.length)names.push('');
          names[after.length-1]=`${pending.name||'Balloon'} Copy`;
          save();
        });
      });

      if(status)status.textContent='v0.9.7 • Persistent Outliner naming enabled';
      return true;
    }
    if(!install()){let tries=0;const timer=setInterval(()=>{if(install()||++tries>50)clearInterval(timer)},100)}

    // Embed names into the existing .meshutilz download without touching the modelling core
    // or globally intercepting Blob creation.
    document.addEventListener('click',async e=>{
      const a=e.target?.closest?.('a');
      if(!a||a.dataset.v097Names==='1'||!String(a.download||'').toLowerCase().endsWith('.meshutilz')||!String(a.href||'').startsWith('blob:'))return;
      const api=window.MeshUtilzOutlinerAPI;if(!api)return;
      e.preventDefault();e.stopImmediatePropagation();
      try{
        const data=JSON.parse(await (await fetch(a.href)).text());
        data.objectNames=api.list().map(x=>x.name||'');
        data.namingVersion=1;
        const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),out=document.createElement('a');
        out.href=url;out.download=a.download;out.dataset.v097Names='1';document.body.appendChild(out);out.click();out.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
        if(status)status.textContent=`Project saved • ${data.objectNames.length} persistent name${data.objectNames.length===1?'':'s'}`;
      }catch(err){
        if(status)status.textContent=`Name persistence save failed: ${err.message}`;
      }
    },true);

    // Read names from a project file alongside the core loader. The core ignores this extra field;
    // after it finishes loading we reapply the names to the Outliner layer.
    const projectFile=document.querySelector('#projectFile');
    projectFile?.addEventListener('change',e=>{
      const file=e.target.files?.[0];if(!file)return;
      file.text().then(text=>{
        let data;try{data=JSON.parse(text)}catch{return}
        const incoming=Array.isArray(data.objectNames)?data.objectNames.map(x=>String(x||'')):null;
        if(!incoming)return;
        let tries=0;
        const apply=()=>{
          const api=window.MeshUtilzOutlinerAPI,items=api?.list?.()||[];
          if(items.length===data.items?.length||tries++>30){
            names=incoming.slice(0,items.length);
            while(names.length<items.length)names.push(`${items[names.length]?.kind==='outline'?'Outline':'Tube'} Balloon ${names.length+1}`);
            save();
            if(status)status.textContent=`Project loaded • ${items.length} balloon${items.length===1?'':'s'} • names restored`;
            return;
          }
          setTimeout(apply,50);
        };
        setTimeout(apply,20);
      }).catch(()=>{});
    },true);

    // New/Clear deliberately starts a fresh naming set. Project Load does not pass through these.
    for(const id of ['newProjectBtn','clearBtn'])document.querySelector('#'+id)?.addEventListener('click',()=>setTimeout(()=>{
      const api=window.MeshUtilzOutlinerAPI;if(api?.list?.().length===0)clearNames();
    },50));

    addEventListener('pagehide',save);
  });
})();
