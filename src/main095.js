// Balloon v0.9.6 core overlay.
// Keeps the validated v0.9.4 main.js untouched, patches it at module load, then executes it.
const baseUrl=new URL('./main.js?base=094',import.meta.url);
let src=await (await fetch(baseUrl,{cache:'no-store'})).text();

function must(oldText,newText,label){
  if(!src.includes(oldText))throw new Error(`v0.9.6 core patch failed: ${label}`);
  src=src.replace(oldText,newText);
}
function mustRe(pattern,replacement,label){
  if(!pattern.test(src))throw new Error(`v0.9.6 core patch failed: ${label}`);
  src=src.replace(pattern,replacement);
}

// Blob-loaded module needs absolute imports.
must("'./balloonGeometry.js'",JSON.stringify(new URL('./balloonGeometry.js',import.meta.url).href),'balloon geometry import');
must("'./outlineGeometry.js'",JSON.stringify(new URL('./outlineGeometry.js',import.meta.url).href),'outline geometry import');
must("'./referenceSurface.js'",JSON.stringify(new URL('./referenceSurface.js',import.meta.url).href),'reference import');
must("'./nomadBalloonExport.js?v=0862'",JSON.stringify(new URL('./nomadBalloonExport095.js?v=095',import.meta.url).href),'NOM exporter import');

// Version strings now belong to the current build.
src=src.replaceAll('v0.9.1','v0.9.6');
src=src.replaceAll('0.9.1','0.9.6');

// Add radius editing controls to the existing Refine selection UI.
must(
`<div class="row refine-row"><button id="reducePointsBtn" disabled>Reduce Points</button><button id="gizmoBtn" disabled>Universal Gizmo</button></div>`,
`<div class="row refine-row"><button id="reducePointsBtn" disabled>Reduce Points</button><button id="editRadiusBtn" disabled>Edit Radius</button><button id="resetPointRadiusBtn" disabled>Radius 100%</button></div><div class="row refine-row"><button id="gizmoBtn" disabled>Universal Gizmo</button></div>`,
'radius buttons'
);

// Radius mode state.
must(
`let editPoints=false,insertPointMode=false,pointHandles=[],activePoint=-1,pointDragId=null,pointDragPlane=null;`,
`let editPoints=false,insertPointMode=false,editRadius=false,pointHandles=[],activePoint=-1,pointDragId=null,pointDragPlane=null,radiusDragStartX=0,radiusDragStartScale=1;`,
'radius state'
);

// Radius scale and visibility are part of the object snapshot, so both survive project save/load and Undo/Redo.
must(
`function cloneSample(s){return {p:s.p.clone(),pressure:s.pressure,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?s.surfaceNormal.clone():null,surfaceOffset:s.surfaceOffset??0}}`,
`function cloneSample(s){return {p:s.p.clone(),pressure:s.pressure,radiusScale:s.radiusScale??1,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?s.surfaceNormal.clone():null,surfaceOffset:s.surfaceOffset??0}}`,
'clone radius'
);
must(
`function snapshot(){return items.map(x=>({samples:x.samples.map(s=>({p:s.p.toArray(),pressure:s.pressure,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?s.surfaceNormal.toArray():null,surfaceOffset:s.surfaceOffset??0})),settings:{...x.settings},position:x.mesh.position.toArray(),quaternion:x.mesh.quaternion.toArray(),scale:x.mesh.scale.toArray()}))}`,
`function snapshot(){return items.map(x=>({samples:x.samples.map(s=>({p:s.p.toArray(),pressure:s.pressure,radiusScale:s.radiusScale??1,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?s.surfaceNormal.toArray():null,surfaceOffset:s.surfaceOffset??0})),settings:{...x.settings},position:x.mesh.position.toArray(),quaternion:x.mesh.quaternion.toArray(),scale:x.mesh.scale.toArray(),visible:x.mesh.visible!==false}))}`,
'snapshot radius and visibility'
);
must(
`{p:new THREE.Vector3(...s.p),pressure:s.pressure,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?new THREE.Vector3(...s.surfaceNormal):null,surfaceOffset:s.surfaceOffset??0}`,
`{p:new THREE.Vector3(...s.p),pressure:s.pressure,radiusScale:s.radiusScale??1,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?new THREE.Vector3(...s.surfaceNormal):null,surfaceOffset:s.surfaceOffset??0}`,
'restore radius'
);
must(
`if(d.scale)x.mesh.scale.fromArray(d.scale);x.mesh.updateMatrixWorld(true)}select(items.at(-1)||null);`,
`if(d.scale)x.mesh.scale.fromArray(d.scale);x.mesh.visible=d.visible!==false;x.mesh.updateMatrixWorld(true)}select(items.at(-1)||null);`,
'restore visibility'
);

// Project persistence v2: exact free-trackball camera orientation, active selection and object visibility.
must(`formatVersion:1,appVersion:'0.9.6'`,`formatVersion:2,appVersion:'0.9.6'`,'project format version');
must(
`camera:{position:camera.position.toArray(),up:camera.up.toArray(),orbitPivot:orbitPivot.toArray(),target:controls.target.toArray()},reference:{name:referenceName||null,embedded:false}`,
`camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),orbitPivot:orbitPivot.toArray(),target:controls.target.toArray()},selectedIndex:items.indexOf(selected),reference:{name:referenceName||null,embedded:false}`,
'camera quaternion and selection save'
);
must(
`if(c?.up?.length===3)camera.up.fromArray(c.up);if(c?.orbitPivot?.length===3)orbitPivot.fromArray(c.orbitPivot);`,
`if(c?.up?.length===3)camera.up.fromArray(c.up);if(c?.quaternion?.length===4)camera.quaternion.fromArray(c.quaternion);if(c?.orbitPivot?.length===3)orbitPivot.fromArray(c.orbitPivot);`,
'camera quaternion restore'
);
must(`camera.lookAt(orbitPivot);const ref=data.reference?.name;`,`if(!(c?.quaternion?.length===4))camera.lookAt(orbitPivot);const ref=data.reference?.name;`,'preserve camera roll');
must(
`setMode('orbit');refreshExport();updateSelectionUI();updateStatus();status.textContent=`,
`setMode('orbit');if(Number.isInteger(data.selectedIndex)&&data.selectedIndex>=0&&data.selectedIndex<items.length)select(items[data.selectedIndex]);refreshExport();updateSelectionUI();updateStatus();status.textContent=`,
'restore selected item'
);

// Interpolate radius scale along the smoothed Tube path.
mustRe(
/function resample\(samples,settings\)\{.*?\}\nfunction rebuild\(x\)/s,
`function resample(samples,settings){if(samples.length<2)return{path:[],radii:[]};const raw=samples.map(s=>s.p),loop=settings.loop&&raw.length>2;const curve=new THREE.CatmullRomCurve3(raw,loop,'centripetal',.5);const count=Math.max(3,Math.min(420,raw.length*settings.smooth));const path=curve.getPoints(count);if(loop&&path.length>2&&path[0].distanceToSquared(path.at(-1))<1e-10)path.pop();const r=[],base=settings.width/2;for(let i=0;i<path.length;i++){const u=loop?i/path.length:i/(path.length-1);let pressure,radiusScale;if(loop){const f=u*samples.length,a=Math.floor(f)%samples.length,b=(a+1)%samples.length,q=f-Math.floor(f);pressure=THREE.MathUtils.lerp(samples[a].pressure,samples[b].pressure,q);radiusScale=THREE.MathUtils.lerp(samples[a].radiusScale??1,samples[b].radiusScale??1,q)}else{const f=u*(samples.length-1),a=Math.floor(f),b=Math.min(samples.length-1,a+1),q=f-a;pressure=THREE.MathUtils.lerp(samples[a].pressure,samples[b].pressure,q);radiusScale=THREE.MathUtils.lerp(samples[a].radiusScale??1,samples[b].radiusScale??1,q)}const easedPressure=THREE.MathUtils.smoothstep(pressure,0.05,1);const pressureFactor=THREE.MathUtils.lerp(1,0.28+0.92*easedPressure,settings.pressure);const bodyShape=loop?0:Math.sin(Math.PI*u);const inflation=1+settings.bulge*Math.pow(Math.max(0,bodyShape),0.7);let radius=base*pressureFactor*inflation*Math.max(.02,radiusScale);if(!loop&&settings.caps&&settings.taper){const edge=Math.min(u,1-u),span=THREE.MathUtils.lerp(0.035,0.2,settings.endSoft),tip=THREE.MathUtils.smoothstep(edge,0,span),minEnd=THREE.MathUtils.lerp(.86,.42,settings.endSoft);radius*=THREE.MathUtils.lerp(minEnd,1,tip)}r.push(radius)}return{path,radii:smoothRadii(r,3)}}
function rebuild(x)`,
'resample radius'
);

// Context button enable/active state.
mustRe(
/function updateSelectionUI\(\)\{.*?\}\nfunction clearPointHandles/s,
`function updateSelectionUI(){const on=!!selected,tube=on&&(selected.settings.kind||'tube')==='tube',pointReady=tube&&editPoints&&activePoint>=0;$('#applyBtn').disabled=!on;$('#duplicateBtn').disabled=!on;$('#deselectBtn').disabled=!on;$('#editPointsBtn').disabled=!tube;$('#insertPointBtn').disabled=!tube;$('#reducePointsBtn').disabled=!tube;$('#editRadiusBtn').disabled=!tube;$('#resetPointRadiusBtn').disabled=!pointReady;$('#deletePointBtn').disabled=!pointReady;$('#gizmoBtn').disabled=!on;for(const id of ['mirrorXBtn','mirrorYBtn','mirrorZBtn','reversePathBtn','resetWidthBtn'])$('#'+id).disabled=!on;$('#toggleLoopBtn').disabled=!tube;$('#toggleLoopBtn').textContent=tube&&selected.settings.loop?'Open Loop':'Close Loop';$('#gizmoBtn').classList.toggle('active',on&&!editPoints&&gizmoEnabled);$('#editPointsBtn').classList.toggle('active',editPoints&&tube);$('#insertPointBtn').classList.toggle('active',insertPointMode&&editPoints&&tube);$('#editRadiusBtn').classList.toggle('active',editRadius&&editPoints&&tube);$('#selectionLabel').textContent=on?\`Selected \${selected.settings.kind==='outline'?'outline':'tube'} balloon \${items.indexOf(selected)+1}\`:'No balloon selected'}
function clearPointHandles`,
'radius UI state'
);

// Leaving point editing/selection also exits radius mode.
must(`editPoints=false;insertPointMode=false;selected.mesh.material.emissive`,`editPoints=false;insertPointMode=false;editRadius=false;selected.mesh.material.emissive`,'deselect radius mode');
must(`editPoints=false;insertPointMode=false;if(selected)selected.mesh.material.emissive`,`editPoints=false;insertPointMode=false;editRadius=false;if(selected)selected.mesh.material.emissive`,'select radius mode');
must(`if(gizmoEnabled){editPoints=false;insertPointMode=false;clearPointHandles()`,`if(gizmoEnabled){editPoints=false;insertPointMode=false;editRadius=false;clearPointHandles()`,'gizmo radius mode');
must(
`function setEditPoints(on){if(!selected||(selected.settings.kind||'tube')!=='tube')return;editPoints=on;if(!on)insertPointMode=false;`,
`function setEditPoints(on){if(!selected||(selected.settings.kind||'tube')!=='tube')return;editPoints=on;if(!on){insertPointMode=false;editRadius=false;}`,
'point mode radius reset'
);
must(
`function toggleInsertPoint(){if(!selected||(selected.settings.kind||'tube')!=='tube')return;if(!editPoints)setEditPoints(true);insertPointMode=!insertPointMode;updateSelectionUI();status.textContent=insertPointMode?'Insert Point: tap near a Tube segment to add a control point':'Insert Point off'}`,
`function toggleInsertPoint(){if(!selected||(selected.settings.kind||'tube')!=='tube')return;if(!editPoints)setEditPoints(true);insertPointMode=!insertPointMode;if(insertPointMode)editRadius=false;updateSelectionUI();status.textContent=insertPointMode?'Insert Point: tap near a Tube segment to add a control point':'Insert Point off'}
function toggleRadiusMode(){if(!selected||(selected.settings.kind||'tube')!=='tube')return;if(!editPoints)setEditPoints(true);editRadius=!editRadius;if(editRadius)insertPointMode=false;updateSelectionUI();status.textContent=editRadius?'Edit Radius: drag a Tube control point left/right • infinite relative scale':'Radius editing off'}
function resetActivePointRadius(){if(!selected||activePoint<0||(selected.settings.kind||'tube')!=='tube')return;checkpoint();selected.samples[activePoint].radiusScale=1;rebuild(selected);refreshPointHandles();refreshExport();updateSelectionUI();status.textContent=\`Point \${activePoint+1} radius reset to 100%\`}`,
'radius mode functions'
);

// New points inherit interpolated local radius.
must(
`const pressure=THREE.MathUtils.lerp(a.pressure??1,b.pressure??1,seg.t),insertAt=seg.i+1;checkpoint();selected.samples.splice(insertAt,0,{p,pressure,snapped,surfaceNormal:normal,surfaceOffset:offset});`,
`const pressure=THREE.MathUtils.lerp(a.pressure??1,b.pressure??1,seg.t),radiusScale=THREE.MathUtils.lerp(a.radiusScale??1,b.radiusScale??1,seg.t),insertAt=seg.i+1;checkpoint();selected.samples.splice(insertAt,0,{p,pressure,radiusScale,snapped,surfaceNormal:normal,surfaceOffset:offset});`,
'insert point radius'
);

// In Edit Radius mode horizontal handle drag adjusts local radius multiplicatively and indefinitely.
mustRe(
/function beginPointDrag\(e\)\{.*?\}\nfunction endPointDrag\(e\)/s,
`function beginPointDrag(e){const h=pointHit(e);if(!h)return false;checkpoint();activePoint=h.userData.sampleIndex;pointDragId=e.pointerId;radiusDragStartX=e.clientX;radiusDragStartScale=selected.samples[activePoint].radiusScale??1;if(!editRadius){const normal=new THREE.Vector3();camera.getWorldDirection(normal).normalize();pointDragPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,selected.samples[activePoint].p)}else pointDragPlane=null;for(let i=0;i<pointHandles.length;i++)pointHandles[i].material=i===activePoint?activePointMaterial:pointMaterial;updateSelectionUI();return true}
function movePointDrag(e){if(pointDragId!==e.pointerId||activePoint<0||!selected)return false;const s=selected.samples[activePoint];if(editRadius){const dx=e.clientX-radiusDragStartX;s.radiusScale=Math.max(.02,Math.min(50,radiusDragStartScale*Math.exp(dx/140)));rebuild(selected);refreshExport();status.textContent=\`Point \${activePoint+1} radius • \${Math.round(s.radiusScale*100)}%\`;return true}eventRay(e);let p=null,normal=null,snapped=false;if(snapEnabled()){const hit=surfaceTargets.hitFromRay(ray.ray,selected.mesh);if(hit){const offset=+$('#surfaceOffset').value;p=hit.position.clone().addScaledVector(hit.normal,offset);normal=hit.normal;snapped=true}}else{p=new THREE.Vector3();if(!ray.ray.intersectPlane(pointDragPlane,p))p=null}if(!p)return true;s.p.copy(p);s.snapped=snapped;s.surfaceNormal=normal?normal.clone():null;s.surfaceOffset=snapped?+$('#surfaceOffset').value:0;rebuild(selected);if(pointHandles[activePoint])pointHandles[activePoint].position.copy(p);setOrbitPivot(selected);refreshExport();return true}
function endPointDrag(e)`,
'radius handle drag'
);

// Every newly drawn sample starts at 100% local radius.
must(
`return {p:hit.position.clone().addScaledVector(hit.normal,offset),pressure:eventPressure(e),snapped:true,surfaceNormal:hit.normal,surfaceOffset:offset}`,
`return {p:hit.position.clone().addScaledVector(hit.normal,offset),pressure:eventPressure(e),radiusScale:1,snapped:true,surfaceNormal:hit.normal,surfaceOffset:offset}`,
'snapped sample radius'
);
src=src.replaceAll(`{p,pressure:eventPressure(e),snapped:false,surfaceNormal:null,surfaceOffset:0}`,`{p,pressure:eventPressure(e),radiusScale:1,snapped:false,surfaceNormal:null,surfaceOffset:0}`);

// Hook the new buttons.
must(
`$('#editPointsBtn').onclick=()=>setEditPoints(!editPoints);$('#insertPointBtn').onclick=toggleInsertPoint;$('#deletePointBtn').onclick=deleteActivePoint;$('#reducePointsBtn').onclick=reduceTubePoints;$('#gizmoBtn').onclick=toggleGizmo;`,
`$('#editPointsBtn').onclick=()=>setEditPoints(!editPoints);$('#insertPointBtn').onclick=toggleInsertPoint;$('#deletePointBtn').onclick=deleteActivePoint;$('#reducePointsBtn').onclick=reduceTubePoints;$('#editRadiusBtn').onclick=toggleRadiusMode;$('#resetPointRadiusBtn').onclick=resetActivePointRadius;$('#gizmoBtn').onclick=toggleGizmo;`,
'radius button handlers'
);

// Optional public inspection hook for later UI work.
must(
`window.MeshUtilzOutlinerAPI={`,
`window.MeshUtilzPointRadiusAPI={
  info:()=>({tube:!!selected&&(selected.settings.kind||'tube')==='tube',editPoints,editRadius,activePoint,radiusScale:selected&&activePoint>=0?(selected.samples[activePoint].radiusScale??1):null}),
  toggle:()=>{toggleRadiusMode();return true},
  reset:()=>{resetActivePointRadius();return true}
};
window.MeshUtilzOutlinerAPI={`,
'radius public API'
);

const blobUrl=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
try{await import(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}
