(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const status=document.querySelector('#status');
    const storageKey='meshutilz-balloon-names-v097';
    let names=[];
    try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))names=saved.map(x=>String(x||''))}catch{}
    let lastCount=-1;
    const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(names))}catch{}};
    const defaults=items=>items.map((item,i)=>item.name||`${item.kind==='outline'?'Outline':'Tube'} Balloon ${i+1}`);
    function install(){
      const api=window.MeshUtilzOutlinerAPI;
      if(!api||api.__v097Naming)return false;
      const baseList=api.list.bind(api),baseDuplicate=api.duplicateIndex.bind(api),baseDelete=api.deleteIndex.bind(api);
      api.list=()=>{
        const items=baseList();
        if(lastCount>0&&items.length===0){names=[];save()}
        const fallback=defaults(items);
        while(names.length<items.length)names.push(fallback[names.length]);
        if(names.length>items.length)names.length=items.length;
        lastCount=items.length;
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
      if(status)status.textContent='v0.9.7 • Safe Outliner naming enabled';
      return true;
    }
    if(!install()){let tries=0;const timer=setInterval(()=>{if(install()||++tries>50)clearInterval(timer)},100)}
  });
})();
