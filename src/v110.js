(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),status=$('#status'),aside=$('aside');
    const build=window.BALLOON_BUILD||'1.1.0';
    const nameKey='meshutilz-project-name-v110';
    let projectName='Untitled Project',pendingReferenceState=null;
    try{projectName=String(localStorage.getItem(nameKey)||projectName)}catch{}

    const cleanName=value=>String(value||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').slice(0,80)||'Untitled Project';
    const fileBase=()=>cleanName(projectName).replace(/\s+/g,'_');
    window.MeshUtilzWorkflowExportBaseName=fileBase;

    const sectionTitle=d=>d.querySelector(':scope > summary')?.textContent?.trim()||'';
    const findSection=title=>[...(aside?.querySelectorAll(':scope > details.ui-section')||[])].find(d=>sectionTitle(d)===title)||null;

    function installProjectName(){
      const project=findSection('Project'),body=project?.querySelector(':scope > .ui-section-body');
      if(!body)return false;
      let wrap=body.querySelector('.workflow-project-meta');
      if(!wrap){
        wrap=document.createElement('div');wrap.className='workflow-project-meta';
        wrap.innerHTML='<label>Project name <input id="workflowProjectName" type="text" maxlength="80" autocomplete="off"></label>';
        body.prepend(wrap);
        const style=document.createElement('style');style.textContent=`
          .workflow-project-meta{margin:2px 0 5px;padding-bottom:5px;border-bottom:1px solid rgba(255,255,255,.09)}
          .workflow-project-meta label{margin:0;font-size:10px}.workflow-project-meta input{width:100%;box-sizing:border-box;margin-top:3px}
          .workflow-about{font-size:10px;line-height:1.35;opacity:.86}.workflow-about p{margin:4px 0}.workflow-about strong{opacity:1}
        `;document.head.appendChild(style);
      }
      const input=$('#workflowProjectName');
      if(input&&!input.dataset.v110Bound){
        input.dataset.v110Bound='1';input.value=projectName;
        input.addEventListener('change',()=>{projectName=cleanName(input.value);input.value=projectName;try{localStorage.setItem(nameKey,projectName)}catch{};if(status)status.textContent=`Project name • ${projectName}`});
        input.addEventListener('blur',()=>{projectName=cleanName(input.value);input.value=projectName;try{localStorage.setItem(nameKey,projectName)}catch{}});
      }
      return !!input;
    }

    function installAbout(){
      if(!aside||findSection('About'))return true;
      const d=document.createElement('details');d.className='ui-section';
      const s=document.createElement('summary');s.textContent='About';
      const body=document.createElement('div');body.className='ui-section-body workflow-about';
      body.innerHTML=`<p><strong>MeshUtilz Balloon v${build}</strong> — Workflow release.</p><p>Project files now retain the project name and reference display/transform setup. Reference geometry itself remains external and is reloaded separately.</p><p>Keyboard: D Draw • O Orbit • Esc Deselect • Cmd/Ctrl+Z Undo.</p>`;
      d.append(s,body);
      const exportSection=findSection('Export');
      if(exportSection)aside.insertBefore(d,exportSection.nextSibling);else aside.appendChild(d);
      return true;
    }

    function captureReferenceState(){
      const r=window.__meshutilzReferenceRoot;
      return {
        position:r?r.position.toArray():null,
        quaternion:r?r.quaternion.toArray():null,
        scale:r?r.scale.toArray():null,
        opacity:Number.isFinite(+$ ('#referenceOpacity')?.value)?+$ ('#referenceOpacity').value:null,
        edges:!!$('#referenceEdges')?.checked,
        wireframe:!!$('#referenceWire')?.checked,
        isolate:!!$('#referenceIsolate')?.checked
      };
    }

    function applyReferenceState(state){
      if(!state)return false;
      const r=window.__meshutilzReferenceRoot;if(!r)return false;
      if(Array.isArray(state.position)&&state.position.length===3)r.position.fromArray(state.position);
      if(Array.isArray(state.quaternion)&&state.quaternion.length===4)r.quaternion.fromArray(state.quaternion);
      if(Array.isArray(state.scale)&&state.scale.length===3)r.scale.fromArray(state.scale);
      r.updateMatrixWorld(true);
      const opacity=$('#referenceOpacity');if(opacity&&Number.isFinite(state.opacity)){opacity.value=state.opacity;opacity.dispatchEvent(new Event('input',{bubbles:true}))}
      const wire=$('#referenceWire');if(wire){wire.checked=!!state.wireframe;wire.dispatchEvent(new Event('change',{bubbles:true}))}
      const edges=$('#referenceEdges');if(edges){edges.checked=!!state.edges;edges.dispatchEvent(new Event('change',{bubbles:true}))}
      const isolate=$('#referenceIsolate');if(isolate){isolate.checked=!!state.isolate;isolate.dispatchEvent(new Event('change',{bubbles:true}))}
      const xo=$('#referenceXOut'),yo=$('#referenceYOut'),zo=$('#referenceZOut'),so=$('#referenceScaleOut');
      if(xo)xo.value=r.position.x.toFixed(2);if(yo)yo.value=r.position.y.toFixed(2);if(zo)zo.value=r.position.z.toFixed(2);if(so)so.value=`${Math.round(r.scale.x*100)}%`;
      pendingReferenceState=null;
      if(status)status.textContent='Reference workflow state restored';
      return true;
    }

    addEventListener('meshutilz-reference-loaded',()=>setTimeout(()=>applyReferenceState(pendingReferenceState),80));

    // Save workflow metadata before the older naming layer sees the same click. This also
    // carries Outliner names, so the v0.9.7 save interceptor is deliberately bypassed.
    document.addEventListener('click',async e=>{
      const a=e.target?.closest?.('a');
      if(!a||a.dataset.v110Workflow==='1'||!String(a.download||'').toLowerCase().endsWith('.meshutilz')||!String(a.href||'').startsWith('blob:'))return;
      e.preventDefault();e.stopImmediatePropagation();
      try{
        const data=JSON.parse(await (await fetch(a.href)).text());
        const api=window.MeshUtilzOutlinerAPI;
        if(api?.list){data.objectNames=api.list().map(x=>x.name||'');data.namingVersion=1}
        data.workflow={version:1,projectName:cleanName(projectName),referenceState:captureReferenceState()};
        const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),out=document.createElement('a');
        out.href=url;out.download=`${fileBase()}.meshutilz`;out.dataset.v110Workflow='1';out.dataset.v097Names='1';document.body.appendChild(out);out.click();out.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
        if(status)status.textContent=`Project saved • ${projectName}`;
      }catch(err){if(status)status.textContent=`Workflow project save failed: ${err.message}`}
    },true);

    const projectFile=$('#projectFile');
    projectFile?.addEventListener('change',e=>{
      const file=e.target.files?.[0];if(!file)return;
      file.text().then(text=>{
        let data;try{data=JSON.parse(text)}catch{return}
        const flow=data.workflow;if(!flow)return;
        if(flow.projectName){projectName=cleanName(flow.projectName);try{localStorage.setItem(nameKey,projectName)}catch{};const input=$('#workflowProjectName');if(input)input.value=projectName}
        pendingReferenceState=flow.referenceState||null;
        if(window.__meshutilzReferenceRoot)setTimeout(()=>applyReferenceState(pendingReferenceState),120);
      }).catch(()=>{});
    },true);

    $('#newProjectBtn')?.addEventListener('click',()=>setTimeout(()=>{
      const api=window.MeshUtilzOutlinerAPI;if(api?.list?.().length===0){projectName='Untitled Project';const input=$('#workflowProjectName');if(input)input.value=projectName;pendingReferenceState=null;try{localStorage.setItem(nameKey,projectName)}catch{}}
    },80));

    let tries=0;const timer=setInterval(()=>{
      const ok=installProjectName();installAbout();
      if(ok||++tries>80)clearInterval(timer);
    },100);
    installProjectName();installAbout();
    if(status)status.textContent=`v${build} • Workflow release`;
  });
})();
