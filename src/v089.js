(()=>{
  const onReady=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  onReady(()=>{
    const $=s=>document.querySelector(s);
    document.title='MeshUtilz Balloon v0.8.9.2';
    const header=document.querySelector('header span');if(header)header.textContent='Balloon v0.8.9.2';

    // Keep the proven NOM exporter/event wiring from main.js, but move its controls
    // into a compact row high in the panel so they cannot be clipped by the compact iPad UI.
    const nomadButton=$('#exportLiveNomBtn'),nomadSelect=$('#nomadDetail'),nomadHint=$('#nomadHint'),projectRow=$('.project-row');
    if(nomadButton&&nomadSelect&&projectRow){
      const oldLabel=nomadSelect.closest('label');
      const row=document.createElement('div');row.className='nomad-export-row';
      const title=document.createElement('span');title.className='nomad-export-title';title.textContent='Nomad';
      row.append(title,nomadSelect,nomadButton);
      projectRow.insertAdjacentElement('afterend',row);
      if(oldLabel&&oldLabel.isConnected)oldLabel.remove();
      if(nomadHint)nomadHint.remove();
    }

    // Infinite width scrubber. The visible ruler is a true drag surface rather than a native
    // range control, which makes continuous Pencil/finger dragging reliable on iPadOS.
    // main.js still reads #width as an absolute hidden value, preserving existing geometry,
    // project save/load and NOM export behaviour.
    const oldWidth=$('#width'),out=$('#widthOut');
    if(oldWidth&&out){
      const label=oldWidth.closest('label');
      const initial=Math.max(.001,Number(oldWidth.value)||.42);
      const hidden=document.createElement('input');hidden.type='hidden';hidden.id='width';hidden.value=String(initial);
      const slider=document.createElement('div');slider.id='widthInfinite';slider.className='infinite-ruler';slider.tabIndex=0;slider.setAttribute('role','slider');slider.setAttribute('aria-label','Infinite balloon width adjustment');slider.innerHTML='<span class="infinite-centre"></span>';
      oldWidth.replaceWith(hidden);hidden.insertAdjacentElement('afterend',slider);
      if(label){
        const textNode=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
        if(textNode)textNode.textContent='Balloon width / depth — drag ruler ∞ ';
      }

      let current=initial,lastSelectedKey='',creationWidth=initial,drag=null,stripeOffset=0;
      const baselines=new Map();
      const selectedKey=()=>$('#applyBtn')&&!$('#applyBtn').disabled?($('#selectionLabel')?.textContent||'selected'):'';
      const applyThroughMain=()=>{const p=$('#pressure');if(p)p.dispatchEvent(new Event('input',{bubbles:true}))};
      const readAbsolute=()=>Math.max(.001,Number(hidden.value)||current||.42);
      const show=()=>{
        current=readAbsolute();const key=selectedKey();
        slider.setAttribute('aria-valuenow',String(current));
        if(key){if(!baselines.has(key))baselines.set(key,current);const base=Math.max(.001,baselines.get(key));out.value=`${current.toFixed(current<1?3:2)} • ${Math.round(current/base*100)}%`}
        else out.value=`${creationWidth.toFixed(creationWidth<1?3:2)} • next`;
      };
      const syncSelection=()=>{
        const key=selectedKey();
        if(key!==lastSelectedKey){
          lastSelectedKey=key;
          if(key){current=readAbsolute();if(!baselines.has(key))baselines.set(key,current)}
          else{hidden.value=String(creationWidth);current=creationWidth}
          show();
        }
      };
      const setValue=v=>{
        current=Math.max(.001,v);hidden.value=String(current);
        if(selectedKey())applyThroughMain();else creationWidth=current;
        show();
      };
      const begin=e=>{
        if(e.button!==undefined&&e.button!==0)return;
        syncSelection();drag={id:e.pointerId,startX:e.clientX,startValue:readAbsolute(),lastX:e.clientX};
        slider.classList.add('dragging');
        try{slider.setPointerCapture(e.pointerId)}catch(_){}
        e.preventDefault();
      };
      const move=e=>{
        if(!drag||e.pointerId!==drag.id)return;
        const dx=e.clientX-drag.startX;
        // About 140px doubles/halves the current value. There is no endpoint: lift and drag again.
        setValue(drag.startValue*Math.pow(2,dx/140));
        slider.style.backgroundPosition=`${stripeOffset+dx}px 0`;
        drag.lastX=e.clientX;
        e.preventDefault();
      };
      const end=e=>{
        if(!drag||e.pointerId!==drag.id)return;
        stripeOffset+=drag.lastX-drag.startX;
        slider.style.backgroundPosition=`${stripeOffset}px 0`;
        drag=null;slider.classList.remove('dragging');
        try{slider.releasePointerCapture(e.pointerId)}catch(_){}
        e.preventDefault();
      };
      slider.addEventListener('pointerdown',begin);
      slider.addEventListener('pointermove',move);
      slider.addEventListener('pointerup',end);
      slider.addEventListener('pointercancel',end);
      slider.addEventListener('keydown',e=>{
        if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
        syncSelection();setValue(readAbsolute()*(e.key==='ArrowRight'?1.05:1/1.05));e.preventDefault();
      });

      const selectionLabel=$('#selectionLabel');
      if(selectionLabel)new MutationObserver(()=>queueMicrotask(syncSelection)).observe(selectionLabel,{childList:true,characterData:true,subtree:true});
      const applyBtn=$('#applyBtn');
      if(applyBtn)new MutationObserver(()=>queueMicrotask(syncSelection)).observe(applyBtn,{attributes:true,attributeFilter:['disabled']});

      // Project loading can change the hidden absolute width without changing selection text.
      $('#projectFile')?.addEventListener('change',()=>setTimeout(()=>{creationWidth=readAbsolute();current=creationWidth;show()},120));
      show();
    }

    const style=document.createElement('style');
    style.textContent=`
      aside{overflow-y:auto!important;overflow-x:hidden!important;min-height:0!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:28px!important}
      .nomad-export-row{display:grid;grid-template-columns:auto 82px 1fr;gap:5px;align-items:center;margin:3px 0 4px;padding:4px 5px;border:1px solid rgba(255,255,255,.14);border-radius:6px}
      .nomad-export-title{font-size:10px;font-weight:700;opacity:.82}
      .nomad-export-row select,.nomad-export-row button{min-width:0;margin:0;padding:4px 5px;font-size:10px}
      #widthInfinite{position:relative;width:100%;height:28px;box-sizing:border-box;touch-action:none;user-select:none;-webkit-user-select:none;cursor:ew-resize;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.46) 0 1px,transparent 1px 9px);background-position:0 0;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08);overflow:hidden}
      #widthInfinite.dragging{background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.64) 0 1px,transparent 1px 9px)}
      #widthInfinite .infinite-centre{position:absolute;left:50%;top:0;bottom:0;width:3px;transform:translateX(-1px);background:rgba(255,255,255,.96);box-shadow:0 0 0 1px rgba(0,0,0,.24);pointer-events:none}
    `;
    document.head.appendChild(style);

    const status=$('#status');
    if(status&&$('#orbitBtn')?.classList.contains('active'))status.textContent='Orbit / Select: free 360° trackball • 2 fingers pan/pinch/twist • tap selects';
  });
})();
