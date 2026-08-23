(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),aside=$('aside');
    if(!aside)return;
    document.title='MeshUtilz Balloon v0.9.0.2';
    const header=$('header span');if(header)header.textContent='Balloon v0.9.0.2';

    const section=(title,open=true)=>{const d=document.createElement('details');d.className='ui-section';d.open=open;const s=document.createElement('summary');s.textContent=title;const body=document.createElement('div');body.className='ui-section-body';d.append(s,body);return {d,body}};
    const project=section('Project',false),reference=section('Reference',false),create=section('Create',true),shape=section('Shape',true),edit=section('Edit',true),exportSec=section('Export',true);
    const move=(node,body)=>{if(node&&body)body.appendChild(node)};
    const labelOf=id=>$(id)?.closest('label');

    move($('.project-row'),project.body);
    move($('.reference-panel'),reference.body);

    move($('#orbitBtn')?.parentElement,create.body);
    move(labelOf('#creation'),create.body);
    const createToggles=document.createElement('div');createToggles.className='create-toggles-inline';
    for(const id of ['#pencilOnly','#snapSurface','#wire'])move(labelOf(id),createToggles);
    if(createToggles.children.length)create.body.appendChild(createToggles);
    move(labelOf('#plane'),create.body);

    move(labelOf('#width')||$('#widthInfinite')?.closest('label'),shape.body);
    move(labelOf('#pressure'),shape.body);
    move(labelOf('#bulge'),shape.body);
    move(labelOf('#endSoft'),shape.body);
    move(labelOf('#smooth'),shape.body);
    move(labelOf('#sides'),shape.body);
    const tubeControls=document.createElement('div');tubeControls.className='tube-controls-inline';
    for(const id of ['#taper','#loop','#caps'])move(labelOf(id),tubeControls);
    if(tubeControls.children.length)shape.body.appendChild(tubeControls);
    const checks=$('.checks');if(checks&&!checks.children.length)checks.remove();

    move($('#selectionPanel'),edit.body);
    move($('#undoBtn')?.parentElement,edit.body);
    move($('#deleteBtn')?.parentElement,edit.body);

    move($('#exportBtn'),exportSec.body);
    move($('.nomad-export-row'),exportSec.body);
    move($('#nomadHint'),exportSec.body);

    aside.replaceChildren(project.d,reference.d,create.d,shape.d,edit.d,exportSec.d);

    function activeKind(){const text=$('#selectionLabel')?.textContent||'';if(text.includes('outline'))return'outline';if(text.includes('tube'))return'tube';return $('#creation')?.value||'outline'}
    function syncContext(){
      const selected=!!($('#applyBtn')&&!$('#applyBtn').disabled),kind=activeKind();
      tubeControls.hidden=kind!=='tube';
      const refineTitle=$('.refine-title'),refineRows=[...edit.body.querySelectorAll('.refine-row')];
      if(refineTitle)refineTitle.hidden=!selected;
      refineRows.forEach(r=>r.hidden=!selected);
    }
    $('#creation')?.addEventListener('change',()=>queueMicrotask(syncContext));
    const sel=$('#selectionLabel');if(sel)new MutationObserver(syncContext).observe(sel,{childList:true,characterData:true,subtree:true});
    const apply=$('#applyBtn');if(apply)new MutationObserver(syncContext).observe(apply,{attributes:true,attributeFilter:['disabled']});
    syncContext();

    const style=document.createElement('style');style.textContent=`
      aside{overflow-y:auto!important;overflow-x:hidden!important;min-height:0!important;-webkit-overflow-scrolling:touch;padding-bottom:34px!important}
      .ui-section{border:1px solid rgba(255,255,255,.12);border-radius:7px;margin:0 0 5px;background:rgba(255,255,255,.025)}
      .ui-section>summary{list-style:none;cursor:pointer;padding:6px 8px;font-size:11px;font-weight:700;letter-spacing:.02em;user-select:none;-webkit-user-select:none}
      .ui-section>summary::-webkit-details-marker{display:none}
      .ui-section>summary:after{content:'+';float:right;opacity:.6}.ui-section[open]>summary:after{content:'−'}
      .ui-section-body{padding:0 6px 6px}.ui-section:not([open]) .ui-section-body{display:none}
      .ui-section-body>.row,.ui-section-body>label,.ui-section-body>.selection-panel,.ui-section-body>.reference-panel,.ui-section-body>.nomad-export-row,.ui-section-body>.export-link,.tube-controls-inline,.create-toggles-inline{margin-top:3px;margin-bottom:3px}
      .tube-controls-inline[hidden],.refine-title[hidden],.refine-row[hidden]{display:none!important}
      .tube-controls-inline{display:grid;grid-template-columns:1fr 1fr;gap:2px 6px}
      .create-toggles-inline{display:grid;grid-template-columns:1.25fr 1fr .85fr;gap:2px 6px;align-items:center}
      .create-toggles-inline label{margin:0;white-space:nowrap;font-size:10px}
    `;document.head.appendChild(style);
    const status=$('#status');if(status)status.textContent='v0.9.0.2 • Snap / Wireframe moved into Create';
  });
})();
