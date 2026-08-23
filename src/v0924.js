(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    document.title='MeshUtilz Balloon v0.9.2.4';
    const header=document.querySelector('header span');if(header)header.textContent='Balloon v0.9.2.4';
    const style=document.createElement('style');
    style.textContent=`
      .reference-panel>.reference-v092-tools{grid-column:1/-1!important;width:100%!important;min-width:0!important}
      .reference-v092-tools{gap:5px!important;margin-top:5px!important;padding-top:5px!important;width:100%!important}
      .reference-v092-tools>*{min-width:0}
      .reference-top-pair{gap:7px!important;width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
      .reference-top-pair label,.reference-opacity-label{font-size:11px!important;line-height:1.2!important;width:100%!important;min-width:0!important}
      .reference-top-pair input[type=range]{width:100%!important;min-width:0!important;min-height:24px!important}
      .reference-top-pair output{font-size:10px!important}
      .reference-transform-title{font-size:11px!important;margin-top:3px!important;margin-bottom:1px!important}
      .reference-xyz-row{gap:6px!important;width:100%!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .reference-axis-compact{grid-template-columns:15px minmax(0,1fr)!important;grid-template-rows:26px 14px!important;gap:2px 4px!important;font-size:11px!important;width:100%!important;min-width:0!important}
      .reference-axis-compact .reference-scrub{width:100%!important;min-width:0!important}
      .reference-axis-compact output{font-size:10px!important}
      .reference-scale-row{grid-template-columns:38px minmax(0,1fr) 48px!important;gap:6px!important;font-size:11px!important;width:100%!important}
      .reference-scale-row .reference-scrub{width:100%!important;min-width:0!important}
      .reference-scale-row output{font-size:10px!important}
      .reference-scrub{height:26px!important;border-radius:4px!important}
      .reference-scrub:after{height:26px!important}
      .reference-origin-row,.reference-rotate-row,.reference-display-row{gap:5px!important;width:100%!important}
      .reference-origin-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .reference-rotate-row{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .reference-origin-row button,.reference-rotate-row button{padding:6px 5px!important;font-size:10px!important;min-height:30px!important;width:100%!important}
      .reference-display-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;margin-top:3px!important}
      .reference-display-row label,.reference-edges-row{font-size:10px!important;line-height:1.15!important}
      .reference-display-row label{white-space:normal!important;min-width:0!important}
      .reference-display-row input[type=checkbox],.reference-edges-row input[type=checkbox]{transform:scale(1.08);transform-origin:left center}
      .reference-edges-row{width:100%!important}
    `;
    document.head.appendChild(style);
    const status=document.querySelector('#status');if(status)status.textContent='v0.9.2.4 • Reference controls full width';
  });
})();
