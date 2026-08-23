(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    document.title='MeshUtilz Balloon v0.9.2.5';
    const header=document.querySelector('header span');if(header)header.textContent='Balloon v0.9.2.5';
    const style=document.createElement('style');
    style.textContent=`
      /* Reference controls should use the same available width as Shape. */
      .reference-panel>.reference-v092-tools{grid-column:1/-1!important;width:100%!important;min-width:0!important}
      .reference-v092-tools>*{min-width:0}
      .reference-top-pair{width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
      .reference-top-pair label{width:100%!important;min-width:0!important}
      .reference-top-pair input[type=range]{width:100%!important;min-width:0!important}
      .reference-xyz-row{width:100%!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .reference-axis-compact{width:100%!important;grid-template-columns:16px minmax(0,1fr)!important}
      .reference-axis-compact .reference-scrub{width:100%!important;min-width:0!important}
      .reference-scale-row{width:100%!important;grid-template-columns:42px minmax(0,1fr) 52px!important}
      .reference-scale-row .reference-scrub{width:100%!important;min-width:0!important}
      .reference-origin-row,.reference-rotate-row,.reference-display-row{width:100%!important}
      .reference-origin-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .reference-rotate-row{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .reference-display-row{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .reference-origin-row button,.reference-rotate-row button{width:100%!important}
      .reference-display-row label{white-space:normal!important;line-height:1.1!important;min-width:0!important}
      .reference-edges-row{width:100%!important}
    `;
    document.head.appendChild(style);
    const status=document.querySelector('#status');if(status)status.textContent='v0.9.2.5 • Reference controls use full panel width';
  });
})();
