import * as THREE from 'three';

const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
ready(()=>{
  const $=s=>document.querySelector(s),status=$('#status');
  const build=window.BALLOON_BUILD||'0.9.2.4';
  document.title=`MeshUtilz Balloon v${build}`;
  const header=$('header span');if(header)header.textContent=`Balloon v${build}`;

  const panel=$('.reference-panel');
  if(!panel)return;

  const surfaceOffsetLabel=$('#surfaceOffset')?.closest('label');
  const showReferenceLabel=$('#showReference')?.closest('label');
  const referenceWireLabel=$('#referenceWire')?.closest('label');

  const tools=document.createElement('div');
  tools.className='reference-v092-tools';
  tools.innerHTML=`
    <div class="reference-top-pair"></div>
    <div class="reference-transform-title">Reference transforms</div>
    <div class="reference-xyz-row">
      <div class="reference-axis-compact"><span>X</span><div class="reference-scrub" data-axis="x"></div><output id="referenceXOut">0.00</output></div>
      <div class="reference-axis-compact"><span>Y</span><div class="reference-scrub" data-axis="y"></div><output id="referenceYOut">0.00</output></div>
      <div class="reference-axis-compact"><span>Z</span><div class="reference-scrub" data-axis="z"></div><output id="referenceZOut">0.00</output></div>
    </div>
    <div class="reference-scale-row"><span>Scale</span><div class="reference-scrub reference-scale-scrub" data-axis="scale"></div><output id="referenceScaleOut">100%</output></div>
    <div class="reference-origin-row"><button id="referenceCentreBtn">Centre Origin</button><button id="referenceResetBtn">Reset Transform</button></div>
    <div class="reference-rotate-row"><button data-ref-rotate="x">X +90°</button><button data-ref-rotate="y">Y +90°</button><button data-ref-rotate="z">Z +90°</button></div>
    <div class="reference-display-row"></div>
    <label class="reference-edges-row"><input id="referenceEdges" type="checkbox"> Shaded + edge</label>
  `;
  panel.appendChild(tools);

  const topPair=tools.querySelector('.reference-top-pair');
  if(surfaceOffsetLabel)topPair.appendChild(surfaceOffsetLabel);
  const opacityLabel=document.createElement('label');opacityLabel.className='reference-opacity-label';opacityLabel.innerHTML='Reference opacity <input id="referenceOpacity" type="range" min="10" max="100" value="42" step="1"><output id="referenceOpacityOut">42%</output>';
  topPair.appendChild(opacityLabel);

  const displayRow=tools.querySelector('.reference-display-row');
  const isolateLabel=document.createElement('label');isolateLabel.innerHTML='<input id="referenceIsolate" type="checkbox"> Isolate ref';
  if(showReferenceLabel){const text=[...showReferenceLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(text)text.textContent=' Show ref mesh';displayRow.appendChild(showReferenceLabel)}
  displayRow.appendChild(isolateLabel);
  if(referenceWireLabel){const text=[...referenceWireLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(text)text.textContent=' Ref wireframe';displayRow.appendChild(referenceWireLabel)}

  const opacity=$('#referenceOpacity'),opacityOut=$('#referenceOpacityOut'),wire=$('#referenceWire'),edges=$('#referenceEdges'),isolate=$('#referenceIsolate');
  let overlayRoot=null;
  const hiddenSceneMeshes=new Map();

  const root=()=>window.__meshutilzReferenceRoot||null;
  const materials=()=>window.__meshutilzReferenceMaterials||[];
  const sceneFromRoot=()=>root()?.parent?.parent||null;
  const updateOutputs=()=>{const r=root();$('#referenceXOut').value=r?r.position.x.toFixed(2):'0.00';$('#referenceYOut').value=r?r.position.y.toFixed(2):'0.00';$('#referenceZOut').value=r?r.position.z.toFixed(2):'0.00';$('#referenceScaleOut').value=r?`${Math.round(r.scale.x*100)}%`:'100%'};
  const applyOpacity=()=>{const v=(+opacity.value||42)/100;opacityOut.value=`${Math.round(v*100)}%`;for(const m of materials()){m.opacity=v;m.transparent=v<1;m.needsUpdate=true}};
  const clearEdges=()=>{if(overlayRoot?.parent)overlayRoot.parent.remove(overlayRoot);if(overlayRoot){overlayRoot.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()})}overlayRoot=null};
  const rebuildEdges=()=>{
    clearEdges();if(!edges.checked||!root())return;
    overlayRoot=new THREE.Group();overlayRoot.name='Reference edge overlay';overlayRoot.raycast=()=>{};
    root().traverse(o=>{if(!o.isMesh||!o.geometry)return;const g=new THREE.EdgesGeometry(o.geometry,20),m=new THREE.LineBasicMaterial({transparent:true,opacity:.75});const l=new THREE.LineSegments(g,m);l.raycast=()=>{};l.matrixAutoUpdate=false;l.matrix.copy(o.matrixWorld);overlayRoot.add(l)});
    const scene=sceneFromRoot();if(scene)scene.add(overlayRoot);
  };
  const syncEdgeTransforms=()=>{if(!overlayRoot||!root())return;clearEdges();rebuildEdges()};
  const isolateReference=()=>{
    const scene=sceneFromRoot();if(!scene)return;
    if(isolate.checked){hiddenSceneMeshes.clear();for(const child of scene.children){if(child.isMesh){hiddenSceneMeshes.set(child,child.visible);child.visible=false}}}
    else{for(const [obj,vis] of hiddenSceneMeshes)obj.visible=vis;hiddenSceneMeshes.clear()}
  };
  const rootSize=()=>{const r=root();if(!r)return 1;const box=new THREE.Box3().setFromObject(r),s=new THREE.Vector3();box.getSize(s);return Math.max(.01,s.length()/Math.sqrt(3))};
  const afterTransform=()=>{root()?.updateMatrixWorld(true);updateOutputs();if(edges.checked)syncEdgeTransforms();status.textContent='Reference transform updated • snapping follows transformed reference'};

  opacity.addEventListener('input',applyOpacity);
  wire?.addEventListener('change',()=>{if(wire.checked&&edges.checked){edges.checked=false;clearEdges()}else if(!wire.checked&&edges.checked)rebuildEdges()});
  edges.addEventListener('change',()=>{if(edges.checked&&wire?.checked){wire.checked=false;wire.dispatchEvent(new Event('change',{bubbles:true}))}rebuildEdges()});
  isolate.addEventListener('change',isolateReference);

  for(const scrub of tools.querySelectorAll('.reference-scrub')){
    let id=null,startX=0,startValue=0,startScale=1,baseSize=1;
    const axis=scrub.dataset.axis;
    const end=e=>{if(id!==e.pointerId)return;try{scrub.releasePointerCapture(id)}catch{}id=null;scrub.style.setProperty('--offset','0px')};
    scrub.addEventListener('pointerdown',e=>{const r=root();if(!r)return;e.preventDefault();id=e.pointerId;startX=e.clientX;baseSize=rootSize();startScale=r.scale.x;startValue=axis==='scale'?startScale:r.position[axis];scrub.setPointerCapture(id)});
    scrub.addEventListener('pointermove',e=>{if(id!==e.pointerId||!root())return;e.preventDefault();const dx=e.clientX-startX;scrub.style.setProperty('--offset',`${dx%9}px`);if(axis==='scale'){const s=Math.max(.001,startScale*Math.exp(dx/180));root().scale.setScalar(s)}else root().position[axis]=startValue+dx*(baseSize/320);afterTransform()});
    scrub.addEventListener('pointerup',end);scrub.addEventListener('pointercancel',end);
  }

  $('#referenceCentreBtn').onclick=()=>{const r=root();if(!r)return;const box=new THREE.Box3().setFromObject(r),c=new THREE.Vector3();box.getCenter(c);r.position.sub(c);afterTransform()};
  $('#referenceResetBtn').onclick=()=>{const r=root();if(!r)return;r.position.set(0,0,0);r.rotation.set(0,0,0);r.scale.setScalar(1);afterTransform()};
  for(const b of tools.querySelectorAll('[data-ref-rotate]'))b.onclick=()=>{const r=root();if(!r)return;r.rotation[b.dataset.refRotate]+=Math.PI/2;afterTransform()};

  const onReferenceLoaded=()=>setTimeout(()=>{applyOpacity();updateOutputs();if(wire)wire.checked=!!window.MESHUTILZ_REFERENCE_WIREFRAME;if(edges.checked)rebuildEdges();if(isolate.checked)isolateReference();status.textContent='Reference loaded • full-width reference controls ready'},40);
  addEventListener('meshutilz-reference-loaded',onReferenceLoaded);
  $('#referenceFile')?.addEventListener('change',()=>setTimeout(onReferenceLoaded,160));

  const style=document.createElement('style');style.textContent=`
    .reference-panel{display:flex!important;flex-direction:column!important;align-items:stretch!important}
    .reference-panel>.reference-v092-tools{width:100%!important;min-width:0!important}
    .reference-v092-tools{display:grid;gap:5px;margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,.1);width:100%}
    .reference-v092-tools>*{min-width:0}
    .reference-top-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px;align-items:end;width:100%}
    .reference-top-pair label{margin:0;font-size:10px;min-width:0;width:100%}.reference-top-pair input[type=range]{width:100%;min-width:0}.reference-top-pair output{font-size:9px}
    .reference-transform-title{font-size:10px;font-weight:700;opacity:.82;margin-top:2px}
    .reference-xyz-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%}
    .reference-axis-compact{display:grid;grid-template-columns:15px minmax(0,1fr);grid-template-rows:24px 13px;gap:2px 4px;align-items:center;font-size:10px;min-width:0;width:100%}
    .reference-axis-compact span{grid-row:1}.reference-axis-compact .reference-scrub{grid-row:1;width:100%;min-width:0}.reference-axis-compact output{grid-column:2;grid-row:2;text-align:center;font-size:9px;opacity:.78}
    .reference-scale-row{display:grid;grid-template-columns:38px minmax(0,1fr) 48px;gap:6px;align-items:center;font-size:10px;width:100%}
    .reference-scrub{height:24px;touch-action:none;cursor:ew-resize;border-radius:4px;background-position:var(--offset,0px) 0;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.38) 0 1px,transparent 1px 9px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
    .reference-scrub:after{content:'';display:block;width:2px;height:24px;margin:auto;background:rgba(255,255,255,.92)}
    .reference-scale-row output{text-align:right;font-size:9px;opacity:.8}
    .reference-origin-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;width:100%}
    .reference-rotate-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:100%}
    .reference-origin-row button,.reference-rotate-row button{min-width:0;width:100%;padding:5px 4px;font-size:10px;min-height:29px}
    .reference-display-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;align-items:center;margin-top:2px;width:100%}
    .reference-display-row label{margin:0;white-space:normal;font-size:10px;line-height:1.1;min-width:0}
    .reference-edges-row{margin:0!important;font-size:10px;white-space:nowrap;width:100%}
  `;document.head.appendChild(style);
  applyOpacity();updateOutputs();
});
