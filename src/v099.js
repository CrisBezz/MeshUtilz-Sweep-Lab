(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),status=$('#status');
    const build=window.BALLOON_BUILD||'0.9.9.2';
    const storageKey='meshutilz-ui-sections-v099';

    document.title=`MeshUtilz Balloon v${build}`;
    const header=$('header span');if(header)header.textContent=`Balloon v${build}`;

    let saved={};
    try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{}
    const sectionTitle=d=>d.querySelector(':scope > summary')?.textContent?.trim()||'';
    const sectionBody=title=>[...document.querySelectorAll('aside > details.ui-section')].find(d=>sectionTitle(d)===title)?.querySelector(':scope > .ui-section-body')||null;
    const bindSections=()=>{
      for(const d of document.querySelectorAll('aside > details.ui-section')){
        const title=sectionTitle(d);if(!title||d.dataset.v099Bound==='1')continue;
        d.dataset.v099Bound='1';
        if(Object.prototype.hasOwnProperty.call(saved,title))d.open=!!saved[title];
        d.addEventListener('toggle',()=>{saved[title]=d.open;try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{}});
      }
    };

    // The core creates Project controls after the sidebar section module can run on iPad.
    // Always move the live row into Project once it exists instead of leaving an empty shell.
    const ensureProject=()=>{
      const body=sectionBody('Project'),row=document.querySelector('.project-row');
      if(!body||!row)return false;
      if(row.parentElement!==body)body.appendChild(row);
      return !!($('#saveProjectBtn')&&$('#loadProjectBtn')&&$('#newProjectBtn'));
    };

    // Snap to Surface is a creation behaviour, not a reference-only behaviour.
    const ensureSnapPlacement=()=>{
      const body=sectionBody('Create');
      const snap=$('#snapSurface'),label=snap?.closest('label');
      if(!body||!label)return false;
      let toggles=body.querySelector('.create-toggles-inline');
      if(!toggles){
        toggles=document.createElement('div');toggles.className='create-toggles-inline';
        const plane=$('#plane')?.closest('label');
        if(plane?.parentElement===body)body.insertBefore(toggles,plane);else body.appendChild(toggles);
      }
      if(label.parentElement!==toggles)toggles.appendChild(label);
      return true;
    };

    const ensureReference=()=>{
      const body=sectionBody('Reference');
      const panel=document.querySelector('.reference-panel');
      if(body&&panel&&panel.parentElement!==body)body.appendChild(panel);
      if(panel&&!panel.querySelector('.reference-v092-tools')){
        if(!document.querySelector('script[data-v099-ref-recovery]')){
          const s=document.createElement('script');s.type='module';s.dataset.v099RefRecovery='1';s.src=`./src/v092.js?v=099-recover-${Date.now()}`;document.body.appendChild(s);
        }
      }
      return !!(body&&panel);
    };

    const checkReady=()=>{
      bindSections();
      const projectOK=ensureProject();
      const referenceOK=ensureReference();
      const snapOK=ensureSnapPlacement();
      const required=[
        ['viewport canvas',!!document.querySelector('#viewport canvas')],
        ['Draw',!!$('#drawBtn')],['Orbit',!!$('#orbitBtn')],['Creation',!!$('#creation')],
        ['Project',projectOK],['Outliner',!!window.MeshUtilzOutlinerAPI],['Reference',referenceOK],['Snap',snapOK]
      ];
      const missing=required.filter(x=>!x[1]).map(x=>x[0]);
      if(!missing.length){
        if(status)status.textContent=`v${build} • Release candidate ready`;
        return true;
      }
      if(status)status.textContent=`v${build} • Initialising ${missing.join(', ')}…`;
      return false;
    };

    let tries=0;
    const timer=setInterval(()=>{if(checkReady()||++tries>50)clearInterval(timer)},100);
    checkReady();
  });
})();
