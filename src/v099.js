(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),status=$('#status');
    const build=window.BALLOON_BUILD||'0.9.9';
    const storageKey='meshutilz-ui-sections-v099';

    document.title=`MeshUtilz Balloon v${build}`;
    const header=$('header span');if(header)header.textContent=`Balloon v${build}`;

    // Remember which sidebar sections the user keeps open without touching tool state.
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{}
    const sectionTitle=d=>d.querySelector(':scope > summary')?.textContent?.trim()||'';
    const bindSections=()=>{
      for(const d of document.querySelectorAll('aside > details.ui-section')){
        const title=sectionTitle(d);if(!title||d.dataset.v099Bound==='1')continue;
        d.dataset.v099Bound='1';
        if(Object.prototype.hasOwnProperty.call(saved,title))d.open=!!saved[title];
        d.addEventListener('toggle',()=>{saved[title]=d.open;try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{}});
      }
    };

    // Final load-order guard. It only repairs UI placement; modelling, geometry and gestures stay untouched.
    const ensureReference=()=>{
      const sections=[...document.querySelectorAll('aside > details.ui-section')];
      const reference=sections.find(d=>sectionTitle(d)==='Reference');
      const body=reference?.querySelector(':scope > .ui-section-body');
      const panel=document.querySelector('.reference-panel');
      if(body&&panel&&panel.parentElement!==body)body.appendChild(panel);
      if(panel&&!panel.querySelector('.reference-v092-tools')){
        // Re-run the already validated reference UI module only when its tools are genuinely absent.
        if(!document.querySelector('script[data-v099-ref-recovery]')){
          const s=document.createElement('script');s.type='module';s.dataset.v099RefRecovery='1';s.src=`./src/v092.js?v=099-recover-${Date.now()}`;document.body.appendChild(s);
        }
      }
      return !!(body&&panel);
    };

    const checkReady=()=>{
      bindSections();
      const referenceOK=ensureReference();
      const required=[
        ['viewport canvas',!!document.querySelector('#viewport canvas')],
        ['Draw',!!$('#drawBtn')],['Orbit',!!$('#orbitBtn')],['Creation',!!$('#creation')],
        ['Project',!!$('#saveProjectBtn')&&!!$('#loadProjectBtn')],
        ['Outliner',!!window.MeshUtilzOutlinerAPI],['Reference',referenceOK]
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
