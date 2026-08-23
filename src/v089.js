(()=>{
  const onReady=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  onReady(()=>{
    const $=s=>document.querySelector(s);
    document.title='MeshUtilz Balloon v0.8.9.1';
    const header=document.querySelector('header span');if(header)header.textContent='Balloon v0.8.9.1';

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

    // Replace the finite absolute width slider with a centred, repeatable multiplier slider.
    // main.js continues to read #width as an absolute value through a hidden input, so creation,
    // rebuild, project save/load and the existing NOM exporter keep their established data path.
    const oldWidth=$('#width'),out=$('#widthOut');
    if(oldWidth&&out){
      const label=oldWidth.closest('label');
      const initial=Math.max(.001,Number(oldWidth.value)||.42);
      const hidden=document.createElement('input');hidden.type='hidden';hidden.id='width';hidden.value=String(initial);
      const slider=document.createElement('input');slider.type='range';slider.id='widthInfinite';slider.min='-100';slider.max='100';slider.step='1';slider.value='0';slider.setAttribute('aria-label','Infinite balloon width adjustment');
      oldWidth.replaceWith(hidden);hidden.insertAdjacentElement('afterend',slider);
      if(label){
        const textNode=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
        if(textNode)textNode.textContent='Balloon width / depth — infinite drag ∞ ';
      }

      let gestureStart=initial,current=initial,lastSelectedKey='',creationWidth=initial;
      const baselines=new Map();
      const selectedKey=()=>$('#applyBtn')&&!$('#applyBtn').disabled?($('#selectionLabel')?.textContent||'selected'):'';
      const applyThroughMain=()=>{const p=$('#pressure');if(p)p.dispatchEvent(new Event('input',{bubbles:true}))};
      const readAbsolute=()=>Math.max(.001,Number(hidden.value)||current||.42);
      const show=()=>{
        current=readAbsolute();const key=selectedKey();
        if(key){if(!baselines.has(key))baselines.set(key,current);const base=Math.max(.001,baselines.get(key));out.value=`${current.toFixed(current<1?3:2)} • ${Math.round(current/base*100)}%`}
        else out.value=`${creationWidth.toFixed(creationWidth<1?3:2)} • next`;
      };
      const syncSelection=()=>{
        const key=selectedKey();
        if(key!==lastSelectedKey){
          lastSelectedKey=key;
          if(key){current=readAbsolute();if(!baselines.has(key))baselines.set(key,current)}
          else{hidden.value=String(creationWidth);current=creationWidth}
          gestureStart=readAbsolute();slider.value='0';show();
        }
      };
      const begin=()=>{syncSelection();gestureStart=readAbsolute();slider.value='0'};
      const adjust=()=>{
        const delta=Number(slider.value)||0;
        const factor=Math.pow(2,delta/50); // each full throw = x4 or x0.25; release and drag again to continue infinitely
        current=Math.max(.001,gestureStart*factor);
        hidden.value=String(current);
        if(selectedKey())applyThroughMain();else creationWidth=current;
        show();
      };
      const commit=()=>{current=readAbsolute();if(!selectedKey())creationWidth=current;gestureStart=current;slider.value='0';show()};
      slider.addEventListener('pointerdown',begin);
      slider.addEventListener('input',adjust);
      slider.addEventListener('change',commit);
      slider.addEventListener('pointerup',commit);
      slider.addEventListener('pointercancel',commit);

      const selectionLabel=$('#selectionLabel');
      if(selectionLabel)new MutationObserver(()=>queueMicrotask(syncSelection)).observe(selectionLabel,{childList:true,characterData:true,subtree:true});
      const applyBtn=$('#applyBtn');
      if(applyBtn)new MutationObserver(()=>queueMicrotask(syncSelection)).observe(applyBtn,{attributes:true,attributeFilter:['disabled']});

      // Project loading can change the hidden absolute width without changing selection text.
      $('#projectFile')?.addEventListener('change',()=>setTimeout(()=>{creationWidth=readAbsolute();gestureStart=creationWidth;slider.value='0';show()},120));
      show();
    }

    const style=document.createElement('style');
    style.textContent=`
      aside{overflow-y:auto!important;overflow-x:hidden!important;min-height:0!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:28px!important}
      .nomad-export-row{display:grid;grid-template-columns:auto 82px 1fr;gap:5px;align-items:center;margin:3px 0 4px;padding:4px 5px;border:1px solid rgba(255,255,255,.14);border-radius:6px}
      .nomad-export-title{font-size:10px;font-weight:700;opacity:.82}
      .nomad-export-row select,.nomad-export-row button{min-width:0;margin:0;padding:4px 5px;font-size:10px}
      #widthInfinite{-webkit-appearance:none;appearance:none;width:100%;height:24px;touch-action:none;cursor:ew-resize;background:repeating-linear-gradient(90deg,rgba(255,255,255,.42) 0 1px,transparent 1px 9px);border:0;border-radius:0}
      #widthInfinite::-webkit-slider-runnable-track{height:20px;background:transparent;border:0}
      #widthInfinite::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:3px;height:24px;margin-top:-2px;background:rgba(255,255,255,.92);border:0;border-radius:0;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
      #widthInfinite::-moz-range-track{height:20px;background:transparent;border:0}
      #widthInfinite::-moz-range-thumb{width:3px;height:24px;background:rgba(255,255,255,.92);border:0;border-radius:0}
    `;
    document.head.appendChild(style);

    const status=$('#status');
    if(status&&$('#orbitBtn')?.classList.contains('active'))status.textContent='Orbit / Select: free 360° trackball • 2 fingers pan/pinch/twist • tap selects';
  });
})();
