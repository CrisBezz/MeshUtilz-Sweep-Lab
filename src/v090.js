(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),aside=$('aside');
    if(!aside)return;
    document.title='MeshUtilz Balloon v0.9.0';
    const header=$('header span');if(header)header.textContent='Balloon v0.9.0';

    const section=(title,open=true)=>{const d=document.createElement('details');d.className='ui-section';d.open=open;const s=document.createElement('summary');s.textContent=title;const body=document.createElement('div');body.className='ui-section-body';d.append(s,body);return {d,body}};
    const create=section('Create',true),shape=section('Shape',true),tube=section('Tube Options',true),refine=section('Refine',true),edit=section('Edit',true),reference=section('Reference',false),exportSec=section('Export',true),project=section('Project',false);

    const move=(node,body)=>{if(node&&body)body.appendChild(node)};
    const labelOf=id=>$(id)?.closest('label');

    const navRow=$('#orbitBtn')?.parentElement;
    move(navRow,create.body);move(labelOf('#creation'),create.body);move(labelOf('#pencilOnly'),create.body);move(labelOf('#plane'),create.body);

    move(labelOf('#width')||$('#widthInfinite')?.closest('label'),shape.body);move(labelOf('#pressure'),shape.body);move(labelOf('#bulge'),shape.body);move(labelOf('#endSoft'),shape.body);move(labelOf('#smooth'),shape.body);move(labelOf('#sides'),shape.body);
    const wireLabel=labelOf('#wire');move(wireLabel,shape.body);

    for(const id of ['#taper','#loop','#caps'])move(labelOf(id),tube.body);
    const checks=$('.checks');if(checks&&!checks.children.length)checks.remove();

    move($('#selectionPanel'),refine.body);
    const undoRow=$('#undoBtn')?.parentElement,deleteRow=$('#deleteBtn')?.parentElement;move(undoRow,edit.body);move(deleteRow,edit.body);

    move($('.reference-panel'),reference.body);
    move($('#exportBtn'),exportSec.body);move($('.nomad-export-row'),exportSec.body);move($('#nomadHint'),exportSec.body);
    move($('.project-row'),project.body);

    const hint=$('.hint');if(hint)hint.remove();
    aside.prepend(project.d,exportSec.d,reference.d,edit.d,refine.d,tube.d,shape.d,create.d);

    function activeKind(){const text=$('#selectionLabel')?.textContent||'';if(text.includes('outline'))return'outline';if(text.includes('tube'))return'tube';return $('#creation')?.value||'outline'}
    function syncContext(){const selected=!!($('#applyBtn')&&!$('#applyBtn').disabled),kind=activeKind();refine.d.hidden=!selected;tube.d.hidden=kind!=='tube';if(selected)refine.d.open=true}
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
      .ui-section-body>.row,.ui-section-body>label,.ui-section-body>.selection-panel,.ui-section-body>.reference-panel,.ui-section-body>.nomad-export-row,.ui-section-body>.export-link{margin-top:3px;margin-bottom:3px}
      .ui-section[hidden]{display:none!important}
    `;document.head.appendChild(style);
    const status=$('#status');if(status)status.textContent='v0.9.0 • Context UI • free trackball • 2 fingers pan/pinch/twist';
  });
})();
