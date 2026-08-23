(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),status=$('#status'),aside=$('aside');
    const build=window.BALLOON_BUILD||'1.0.0';
    const storageKey='meshutilz-ui-sections-v099';

    document.title=`MeshUtilz Balloon v${build}`;
    const header=$('header span');if(header)header.textContent=`Balloon v${build}`;

    let saved={};
    try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{}
    const sectionTitle=d=>d.querySelector(':scope > summary')?.textContent?.trim()||'';
    const findSection=title=>[...document.querySelectorAll('aside > details.ui-section')].find(d=>sectionTitle(d)===title)||null;
    const sectionBody=title=>findSection(title)?.querySelector(':scope > .ui-section-body')||null;
    const bindSections=()=>{
      for(const d of document.querySelectorAll('aside > details.ui-section')){
        const title=sectionTitle(d);if(!title||d.dataset.v099Bound==='1')continue;
        d.dataset.v099Bound='1';
        if(Object.prototype.hasOwnProperty.call(saved,title))d.open=!!saved[title];
        d.addEventListener('toggle',()=>{saved[title]=d.open;try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{}});
      }
    };

    // Project must always exist. Some iPad load orders can run the sidebar rebuild before
    // the core's project row exists, and in rare cases the Project section itself disappears.
    const ensureProject=()=>{
      if(!aside)return false;
      let section=findSection('Project');
      if(!section){
        section=document.createElement('details');section.className='ui-section';section.open=true;
        const summary=document.createElement('summary');summary.textContent='Project';
        const body=document.createElement('div');body.className='ui-section-body';
        section.append(summary,body);
        const first=aside.querySelector(':scope > details.ui-section');
        if(first)aside.insertBefore(section,first);else aside.prepend(section);
      }
      const body=section.querySelector(':scope > .ui-section-body');
      const row=document.querySelector('.project-row');
      if(row&&body&&row.parentElement!==body)body.appendChild(row);
      bindSections();
      return !!(body&&row&&$('#saveProjectBtn')&&$('#loadProjectBtn')&&$('#newProjectBtn'));
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
          const s=document.createElement('script');s.type='module';s.dataset.v099RefRecovery='1';s.src=`./src/v092.js?v=1000-recover-${Date.now()}`;document.body.appendChild(s);
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
        if(status)status.textContent=`v${build} • Stable release ready`;
        return true;
      }
      if(status)status.textContent=`v${build} • Initialising ${missing.join(', ')}…`;
      return false;
    };

    let tries=0;
    const timer=setInterval(()=>{if(checkReady()||++tries>80)clearInterval(timer)},100);
    checkReady();
  });
})();
