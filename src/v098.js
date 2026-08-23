(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),status=$('#status');
    const build=window.BALLOON_BUILD||'0.9.8';

    // Keep named Balloons named in OBJ without touching the validated geometry/export core.
    // The core still builds the OBJ; this layer only rewrites each `o ...` header before download.
    $('#exportBtn')?.addEventListener('click',async e=>{
      const a=e.currentTarget;
      if(a.dataset.v098Busy==='1'||a.classList.contains('disabled')||!String(a.href||'').startsWith('blob:'))return;
      const api=window.MeshUtilzOutlinerAPI;
      if(!api?.list)return;
      e.preventDefault();e.stopImmediatePropagation();
      a.dataset.v098Busy='1';
      try{
        const names=api.list().map((x,i)=>String(x.name||`${x.kind==='outline'?'Outline':'Tube'} Balloon ${i+1}`).trim());
        let obj=await (await fetch(a.href)).text(),i=0;
        obj=obj.replace(/^o\s+.*$/gm,()=>{
          const raw=names[i++]||`Balloon_${i}`;
          const clean=raw.replace(/\s+/g,'_').replace(/[^A-Za-z0-9_.-]/g,'_')||`Balloon_${i}`;
          return `o ${clean}`;
        });
        const url=URL.createObjectURL(new Blob([obj],{type:'text/plain;charset=utf-8'})),out=document.createElement('a');
        out.href=url;out.download='MeshUtilz-Balloon-v0.9.8.obj';out.dataset.v098Obj='1';document.body.appendChild(out);out.click();out.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
        if(status)status.textContent=`OBJ ready • ${names.length} named balloon${names.length===1?'':'s'}`;
      }catch(err){
        if(status)status.textContent=`Named OBJ export failed: ${err.message}`;
      }finally{delete a.dataset.v098Busy}
    },true);

    // Lightweight keyboard polish for desktop / iPad hardware keyboards.
    addEventListener('keydown',e=>{
      const t=e.target,tag=t?.tagName?.toLowerCase?.();
      if(tag==='input'||tag==='select'||tag==='textarea'||t?.isContentEditable)return;
      const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
      if(mod&&key==='z'){
        e.preventDefault();(e.shiftKey?$('#redoBtn'):$('#undoBtn'))?.click();return;
      }
      if(mod&&key==='y'){
        e.preventDefault();$('#redoBtn')?.click();return;
      }
      if(e.key==='Escape'){
        e.preventDefault();$('#deselectBtn')?.disabled||$('#deselectBtn')?.click();return;
      }
      if(!mod&&!e.altKey&&!e.shiftKey&&key==='d'){
        e.preventDefault();$('#drawBtn')?.click();return;
      }
      if(!mod&&!e.altKey&&!e.shiftKey&&key==='o'){
        e.preventDefault();$('#orbitBtn')?.click();
      }
    });

    // Keep the selected Outliner row visible when selection changes.
    let lastSelected='';
    setInterval(()=>{
      const api=window.MeshUtilzOutlinerAPI;if(!api?.list)return;
      const s=api.list().find(x=>x.selected),key=s?`${s.index}:${s.name||''}`:'';
      if(key===lastSelected)return;lastSelected=key;
      if(!s)return;
      setTimeout(()=>document.querySelector(`.outliner-row[data-index="${s.index}"]`)?.scrollIntoView?.({block:'nearest'}),0);
    },250);

    document.title=`MeshUtilz Balloon v${build}`;
    const h=$('header span');if(h)h.textContent=`Balloon v${build}`;
    if(status)status.textContent=`v${build} • Named OBJ export + keyboard polish`;
  });
})();
