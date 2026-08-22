import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildBalloon,smoothRadii} from './balloonGeometry.js';
import {buildOutlineBalloon} from './outlineGeometry.js';
import {SurfaceTargetRegistry,loadReferenceMesh} from './referenceSurface.js';

const host=document.querySelector('#viewport'),scene=new THREE.Scene();
scene.background=new THREE.Color(0x22262d);
const WORLD_ORIGIN=new THREE.Vector3(0,0,0);
const camera=new THREE.PerspectiveCamera(50,1,.01,1000);camera.position.set(7,7,7);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(WORLD_ORIGIN);controls.enableDamping=true;controls.enabled=true;controls.enableRotate=false;controls.enablePan=false;controls.enableZoom=false;
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2.2));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(5,8,4);scene.add(dl);
scene.add(new THREE.GridHelper(20,40,0x657080,0x343a44));
scene.add(new THREE.AxesHelper(0.75));

const $=s=>document.querySelector(s),status=$('#status'),ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
$('#plane').parentElement.insertAdjacentHTML('afterend','<section class="reference-panel"><strong>Reference Surface</strong><input id="referenceFile" type="file" accept=".obj,.glb,.gltf" hidden><button id="loadReferenceBtn">Load Reference Mesh</button><span id="referenceStatus">No reference mesh loaded</span><label><input id="snapSurface" type="checkbox"> Snap to Surface <small>(Tube only)</small></label><label><input id="showReference" type="checkbox" checked> Show Reference Mesh</label><label>Surface offset <input id="surfaceOffset" type="range" min="-0.50" max="0.50" value="0.02" step="0.01"><output id="surfaceOffsetOut">0.02</output></label></section>');
document.title='MeshUtilz Balloon v0.7.5';document.querySelector('header span').textContent='Balloon v0.7.5';
let items=[],current=null,drawing=false,mode='draw',selected=null,undo=[],redo=[],exportUrl=null,orbitTap=null,activeDrawPlane=null;
let orbitPivot=WORLD_ORIGIN.clone();
const touchPointers=new Map();let pinchState=null,tapGesture=null,selectionOutline=null;
const material=()=>new THREE.MeshStandardMaterial({color:0xd7dde7,roughness:.48,metalness:.03,side:THREE.DoubleSide,wireframe:$('#wire').checked});
const referenceGroup=new THREE.Group(),surfaceTargets=new SurfaceTargetRegistry();scene.add(referenceGroup);
let referenceRoot=null;
const selectionOutlineMaterial=new THREE.MeshBasicMaterial({color:0xff2020,side:THREE.BackSide,depthWrite:false});

function uiSettings(){return{kind:$('#creation').value,width:+$('#width').value,pressure:+$('#pressure').value,bulge:+$('#bulge').value,endSoft:+$('#endSoft').value,smooth:+$('#smooth').value,sides:+$('#sides').value,taper:$('#taper').checked,loop:$('#loop').checked,caps:$('#caps').checked}}
function meshCenter(x){if(!x)return WORLD_ORIGIN.clone();x.mesh.updateMatrixWorld(true);const g=x.mesh.geometry;if(!g.boundingSphere)g.computeBoundingSphere();return g.boundingSphere?g.boundingSphere.center.clone().applyMatrix4(x.mesh.matrixWorld):x.mesh.getWorldPosition(new THREE.Vector3())}
function setOrbitPivot(x){orbitPivot=x?meshCenter(x):WORLD_ORIGIN.clone()}
function keepControlsAligned(){const d=Math.max(.1,camera.position.distanceTo(controls.target));const f=new THREE.Vector3();camera.getWorldDirection(f);controls.target.copy(camera.position).addScaledVector(f,d)}
function viewPlane(){const normal=new THREE.Vector3();camera.getWorldDirection(normal).normalize();const anchor=selected?meshCenter(selected):WORLD_ORIGIN.clone();return new THREE.Plane().setFromNormalAndCoplanarPoint(normal,anchor)}
function plane(){const v=$('#plane').value;if(v==='VIEW')return viewPlane();return v==='XY'?new THREE.Plane(new THREE.Vector3(0,0,1),0):v==='YZ'?new THREE.Plane(new THREE.Vector3(1,0,0),0):new THREE.Plane(new THREE.Vector3(0,1,0),0)}
function eventRay(e){const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera)}
function pointFromEvent(e){eventRay(e);const p=new THREE.Vector3(),drawPlane=activeDrawPlane||plane();return ray.ray.intersectPlane(drawPlane,p)?p:null}
function eventPressure(e){if(e.pointerType==='pen'&&Number.isFinite(e.pressure)&&e.pressure>0)return THREE.MathUtils.clamp(e.pressure,0.05,1);return 1}

function clearSelectionOutline(){if(selectionOutline?.parent)selectionOutline.parent.remove(selectionOutline);selectionOutline=null}
function showSelectionOutline(x){
  clearSelectionOutline();if(!x)return;
  const g=x.mesh.geometry;if(!g.boundingSphere)g.computeBoundingSphere();
  const s=1.025,c=g.boundingSphere?.center||new THREE.Vector3();
  selectionOutline=new THREE.Mesh(g,selectionOutlineMaterial);
  selectionOutline.scale.setScalar(s);selectionOutline.position.copy(c).multiplyScalar(1-s);selectionOutline.renderOrder=3;selectionOutline.raycast=()=>{};
  x.mesh.add(selectionOutline);
}
function refreshSelectionOutline(x){if(selected===x)showSelectionOutline(x)}

function cloneSample(s){return {p:s.p.clone(),pressure:s.pressure,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?s.surfaceNormal.clone():null,surfaceOffset:s.surfaceOffset??0}}
function snapshot(){return items.map(x=>({samples:x.samples.map(s=>({p:s.p.toArray(),pressure:s.pressure,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?s.surfaceNormal.toArray():null,surfaceOffset:s.surfaceOffset??0})),settings:{...x.settings},position:x.mesh.position.toArray()}))}
function checkpoint(){undo.push(snapshot());if(undo.length>30)undo.shift();redo=[]}
function disposeItem(x){if(selectionOutline?.parent===x.mesh)clearSelectionOutline();scene.remove(x.mesh);x.mesh.geometry.dispose();x.mesh.material.dispose()}
function restore(snap){clearSelectionOutline();items.forEach(disposeItem);items=[];selected=null;for(const d of snap){const x=addItem(d.samples.map(s=>({p:new THREE.Vector3(...s.p),pressure:s.pressure,snapped:!!s.snapped,surfaceNormal:s.surfaceNormal?new THREE.Vector3(...s.surfaceNormal):null,surfaceOffset:s.surfaceOffset??0})),d.settings,false);x.mesh.position.fromArray(d.position||[0,0,0])}select(items.at(-1)||null);refreshExport();updateStatus()}
function doUndo(){if(!undo.length){status.textContent='Nothing to undo';return}redo.push(snapshot());restore(undo.pop());status.textContent='Undo'}
function doRedo(){if(!redo.length){status.textContent='Nothing to redo';return}undo.push(snapshot());restore(redo.pop());status.textContent='Redo'}

function resample(samples,settings){
  if(samples.length<2)return{path:[],radii:[]};
  const raw=samples.map(s=>s.p),loop=settings.loop&&raw.length>2;
  const curve=new THREE.CatmullRomCurve3(raw,loop,'centripetal',.5);
  const count=Math.max(3,Math.min(420,raw.length*settings.smooth));
  const path=curve.getPoints(count);
  if(loop&&path.length>2&&path[0].distanceToSquared(path.at(-1))<1e-10)path.pop();
  const r=[],base=settings.width/2;
  for(let i=0;i<path.length;i++){
    const u=loop?i/path.length:i/(path.length-1);
    let pressure;
    if(loop){
      const f=u*samples.length,a=Math.floor(f)%samples.length,b=(a+1)%samples.length,q=f-Math.floor(f);
      pressure=THREE.MathUtils.lerp(samples[a].pressure,samples[b].pressure,q);
    }else{
      const f=u*(samples.length-1),a=Math.floor(f),b=Math.min(samples.length-1,a+1),q=f-a;
      pressure=THREE.MathUtils.lerp(samples[a].pressure,samples[b].pressure,q);
    }
    const easedPressure=THREE.MathUtils.smoothstep(pressure,0.05,1);
    const pressureFactor=THREE.MathUtils.lerp(1,0.28+0.92*easedPressure,settings.pressure);
    const bodyShape=loop?0:Math.sin(Math.PI*u);
    const inflation=1+settings.bulge*Math.pow(Math.max(0,bodyShape),0.7);
    let radius=base*pressureFactor*inflation;
    if(!loop&&settings.caps&&settings.taper){
      const edge=Math.min(u,1-u);
      const span=THREE.MathUtils.lerp(0.035,0.2,settings.endSoft);
      const tip=THREE.MathUtils.smoothstep(edge,0,span);
      const minEnd=THREE.MathUtils.lerp(.86,.42,settings.endSoft);
      radius*=THREE.MathUtils.lerp(minEnd,1,tip);
    }
    r.push(radius);
  }
  return{path,radii:smoothRadii(r,3)};
}
function rebuild(x){
  x.mesh.geometry.dispose();
  if((x.settings.kind||'tube')==='outline'){
    x.mesh.geometry=buildOutlineBalloon(x.samples.map(s=>s.p),{
      depth:x.settings.width*(.7+x.settings.bulge*1.5),
      roundness:THREE.MathUtils.clamp(.25+x.settings.bulge,0,1),
      edgeRoundness:THREE.MathUtils.clamp((x.settings.sides-8)/20,0,1),
      smooth:x.settings.smooth
    });
  }else{
    const {path,radii}=resample(x.samples,x.settings);
    x.mesh.geometry=buildBalloon(path,radii,{sides:x.settings.sides,capRings:6,caps:x.settings.caps!==false,loop:x.settings.loop===true});
  }
  x.mesh.material.wireframe=$('#wire').checked;refreshSelectionOutline(x);
}
function addItem(samples,settings=uiSettings(),autoSelect=true){const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material()),x={samples,settings:{kind:'tube',bulge:.18,endSoft:.65,loop:false,caps:true,...settings},mesh};items.push(x);scene.add(mesh);rebuild(x);if(autoSelect)select(x);return x}
function updateStatus(){const verts=items.reduce((n,x)=>n+(x.mesh.geometry.getAttribute('position')?.count||0),0);status.textContent=`${items.length} balloon${items.length===1?'':'s'} • ${verts} vertices${selected?' • selected':''}`}
function loadControls(x){$('#creation').value=x.settings.kind||'tube';$('#width').value=x.settings.width;$('#pressure').value=x.settings.pressure;$('#bulge').value=x.settings.bulge??.18;$('#endSoft').value=x.settings.endSoft??.65;$('#smooth').value=x.settings.smooth;$('#sides').value=x.settings.sides;$('#taper').checked=x.settings.taper;$('#loop').checked=x.settings.loop===true;$('#caps').checked=x.settings.caps!==false;syncOutputs()}
function updateSelectionUI(){const on=!!selected;$('#applyBtn').disabled=!on;$('#duplicateBtn').disabled=!on;$('#deselectBtn').disabled=!on;$('#selectionLabel').textContent=on?`Selected ${selected.settings.kind==='outline'?'outline':'tube'} balloon ${items.indexOf(selected)+1}`:'No balloon selected'}
function deselect(keepPivot=true){if(!selected)return;clearSelectionOutline();selected.mesh.material.emissive.setHex(0);selected=null;if(!keepPivot)setOrbitPivot(null);updateSelectionUI();updateStatus()}
function select(x){clearSelectionOutline();if(selected)selected.mesh.material.emissive.setHex(0);selected=x;if(x){x.mesh.material.emissive.setHex(0);loadControls(x);setOrbitPivot(x);showSelectionOutline(x)}else setOrbitPivot(null);updateSelectionUI();updateStatus()}
function setMode(m){mode=m;$('#drawBtn').classList.toggle('active',m==='draw');$('#orbitBtn').classList.toggle('active',m==='orbit');status.textContent=m==='draw'?'Draw: Pencil draws • 1 finger orbits • 2 fingers pan/pinch':'Orbit / Select: 1 finger rotates • 2 fingers pan/pinch • tap selects'}
function syncOutputs(){$('#widthOut').value=(+$('#width').value).toFixed(2);$('#pressureOut').value=`${Math.round(+$('#pressure').value*100)}%`;$('#bulgeOut').value=`${Math.round(+$('#bulge').value*100)}%`;$('#endSoftOut').value=`${Math.round(+$('#endSoft').value*100)}%`;$('#smoothOut').value=$('#smooth').value;$('#sidesOut').value=$('#sides').value}
function applySelected(saveUndo=false){if(!selected)return;if(saveUndo)checkpoint();selected.settings=uiSettings();rebuild(selected);setOrbitPivot(selected);refreshExport();updateSelectionUI();updateStatus()}

function serializeOBJ(){let out='# MeshUtilz Balloon v0.7.5\n',offset=1;for(let i=0;i<items.length;i++){const x=items[i],g=x.mesh.geometry,pos=g.getAttribute('position');if(!pos||pos.count<3)continue;const index=g.index;out+=`o ${x.settings.kind==='outline'?'Outline':'Tube'}_Balloon_${i+1}\n`;x.mesh.updateMatrixWorld(true);for(let n=0;n<pos.count;n++){const v=new THREE.Vector3().fromBufferAttribute(pos,n).applyMatrix4(x.mesh.matrixWorld);out+=`v ${v.x} ${v.y} ${v.z}\n`}if(index){for(let n=0;n+2<index.count;n+=3)out+=`f ${index.getX(n)+offset} ${index.getX(n+1)+offset} ${index.getX(n+2)+offset}\n`}offset+=pos.count}return out}
function refreshExport(){const a=$('#exportBtn');if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null}const valid=items.some(x=>(x.mesh.geometry.getAttribute('position')?.count||0)>=3);if(!valid){a.classList.add('disabled');a.removeAttribute('download');a.href='#';return}exportUrl=URL.createObjectURL(new Blob([serializeOBJ()],{type:'text/plain;charset=utf-8'}));a.href=exportUrl;a.download='MeshUtilz-Balloon-v0.7.5.obj';a.classList.remove('disabled')}

function surfaceSample(e){eventRay(e);const hit=surfaceTargets.hitFromRay(ray.ray);if(!hit)return null;const offset=+$('#surfaceOffset').value;return {p:hit.position.clone().addScaledVector(hit.normal,offset),pressure:eventPressure(e),snapped:true,surfaceNormal:hit.normal,surfaceOffset:offset}}
function snapEnabled(){return $('#snapSurface').checked&&$('#creation').value==='tube'}
function startDraw(e){const snap=snapEnabled(),sample=snap?surfaceSample(e):null;if(snap&&!sample){status.textContent='Snap: point at the reference mesh to start a tube';return}activeDrawPlane=snap?null:plane().clone();const p=sample?.p||pointFromEvent(e);if(!p){activeDrawPlane=null;return}checkpoint();drawing=true;current=addItem([sample||{p,pressure:eventPressure(e),snapped:false,surfaceNormal:null,surfaceOffset:0}],uiSettings(),false);renderer.domElement.setPointerCapture(e.pointerId);status.textContent=$('#creation').value==='outline'?'Drawing closed outline…':'Drawing tube balloon…'}
function moveDraw(e){if(!drawing||!current)return;const sample=current.settings.kind==='tube'&&$('#snapSurface').checked?surfaceSample(e):null;if(current.settings.kind==='tube'&&$('#snapSurface').checked&&!sample)return;const p=sample?.p||pointFromEvent(e);if(!p)return;const last=current.samples.at(-1).p;if(p.distanceTo(last)>.035){current.samples.push(sample||{p,pressure:eventPressure(e),snapped:false,surfaceNormal:null,surfaceOffset:0});rebuild(current);updateStatus()}}
function finishStroke(){if(!drawing)return;drawing=false;if(!current){activeDrawPlane=null;return}const minimum=current.settings.kind==='outline'?3:2;if(current.samples.length<minimum){disposeItem(current);items=items.filter(x=>x!==current);current=null;activeDrawPlane=null;select(items.at(-1)||null);refreshExport();return}const finished=current;current=null;activeDrawPlane=null;rebuild(finished);select(finished);refreshExport();updateStatus()}
function trackOrbitDown(e){orbitTap={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false}}
function trackOrbitMove(e){if(!orbitTap||orbitTap.id!==e.pointerId)return;const dx=e.clientX-orbitTap.lastX,dy=e.clientY-orbitTap.lastY;if(Math.hypot(e.clientX-orbitTap.x,e.clientY-orbitTap.y)>6)orbitTap.moved=true;orbitTap.lastX=e.clientX;orbitTap.lastY=e.clientY;if(!orbitTap.moved)return;const speed=.006;const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-dx*speed);const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();const pitch=new THREE.Quaternion().setFromAxisAngle(right,-dy*speed);const offset=camera.position.clone().sub(orbitPivot).applyQuaternion(yaw).applyQuaternion(pitch);camera.position.copy(orbitPivot).add(offset);camera.quaternion.premultiply(yaw).premultiply(pitch).normalize();keepControlsAligned()}
function finishOrbitTap(e){if(orbitTap&&orbitTap.id===e.pointerId&&!orbitTap.moved&&mode==='orbit'){eventRay(e);const hits=ray.intersectObjects(items.map(x=>x.mesh),false);select(hits.length?items.find(x=>x.mesh===hits[0].object):null)}orbitTap=null}
function touchMetrics(){const pts=[...touchPointers.values()];if(pts.length<2)return null;const a=pts[0],b=pts[1];return{distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}}
function beginTapGesture(e){if(!tapGesture)tapGesture={started:performance.now(),maxTouches:0,moved:false,starts:new Map()};tapGesture.maxTouches=Math.max(tapGesture.maxTouches,touchPointers.size);tapGesture.starts.set(e.pointerId,{x:e.clientX,y:e.clientY})}
function markTapMovement(e){if(!tapGesture||tapGesture.moved)return;const p=tapGesture.starts.get(e.pointerId);if(!p)return;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>12)tapGesture.moved=true}
function finishTapGesture(){if(!tapGesture)return;const g=tapGesture;tapGesture=null;if(g.moved||performance.now()-g.started>500)return;if(g.maxTouches===2)doUndo();else if(g.maxTouches===3)doRedo()}
function touchDown(e){touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});beginTapGesture(e);if(touchPointers.size===1){pinchState=null;trackOrbitDown(e);return}if(touchPointers.size===2){orbitTap=null;pinchState=touchMetrics()}}
function panView(dx,dy){const h=Math.max(1,renderer.domElement.clientHeight);const dist=Math.max(.2,camera.position.distanceTo(orbitPivot));const worldPerPixel=2*dist*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/h;const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize();const delta=right.multiplyScalar(-dx*worldPerPixel).addScaledVector(up,dy*worldPerPixel);camera.position.add(delta);orbitPivot.add(delta);controls.target.add(delta)}
function touchMove(e){if(!touchPointers.has(e.pointerId))return;markTapMovement(e);touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPointers.size>=2){const m=touchMetrics();if(!m)return;if(!pinchState)pinchState=m;const panDx=m.cx-pinchState.cx,panDy=m.cy-pinchState.cy;if(Math.hypot(panDx,panDy)>.05)panView(panDx,panDy);const ratio=m.distance/pinchState.distance;if(Math.abs(ratio-1)>.002){const forward=new THREE.Vector3();camera.getWorldDirection(forward);const scale=Math.max(.5,camera.position.distanceTo(orbitPivot));let step=Math.log(ratio)*scale*.85;const next=camera.position.clone().addScaledVector(forward,step);const minDist=.18,maxDist=250,dist=next.distanceTo(orbitPivot);if(dist<minDist)step*=Math.max(0,(dist-minDist)/minDist);if(dist<=maxDist)camera.position.addScaledVector(forward,step);keepControlsAligned()}pinchState=m;return}trackOrbitMove(e)}
function touchUp(e){const wasSingle=touchPointers.size===1;if(wasSingle)finishOrbitTap(e);touchPointers.delete(e.pointerId);if(touchPointers.size<2)pinchState=null;if(touchPointers.size===1){const [id,p]=touchPointers.entries().next().value;orbitTap={id,x:p.x,y:p.y,lastX:p.x,lastY:p.y,moved:true}}else if(touchPointers.size===0){orbitTap=null;finishTapGesture()}}

renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();e.stopImmediatePropagation();touchDown(e);return}if(mode==='orbit'){trackOrbitDown(e);return}e.stopImmediatePropagation();startDraw(e)},{capture:true});
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch'){e.preventDefault();e.stopImmediatePropagation();touchMove(e);return}if(mode==='orbit'){trackOrbitMove(e);return}e.stopImmediatePropagation();moveDraw(e)},{capture:true});
renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();e.stopImmediatePropagation();touchUp(e);return}if(mode==='orbit'){finishOrbitTap(e);return}e.stopImmediatePropagation();finishStroke()},{capture:true});
renderer.domElement.addEventListener('pointercancel',e=>{if(e.pointerType==='touch'){touchPointers.delete(e.pointerId);pinchState=null;orbitTap=null;tapGesture=null;return}if(mode==='orbit'){orbitTap=null;return}e.stopImmediatePropagation();finishStroke()},{capture:true});

$('#drawBtn').onclick=()=>setMode('draw');$('#orbitBtn').onclick=()=>setMode('orbit');
$('#creation').addEventListener('change',()=>{if(selected)deselect(true);status.textContent=$('#creation').value==='outline'?'New balloons: closed outline fill':'New balloons: tube stroke'});
['width','pressure','bulge','endSoft','smooth','sides','taper'].forEach(id=>$('#'+id).addEventListener('input',()=>{syncOutputs();if(selected)applySelected(false)}));
['loop','caps'].forEach(id=>$('#'+id).addEventListener('change',()=>{if(selected)applySelected(false);else status.textContent=$('#loop').checked?'New tube balloons: looped':($('#caps').checked?'New tube balloons: open path with caps':'New tube balloons: open path without caps')}));
$('#wire').oninput=()=>{items.forEach(rebuild);refreshExport()};$('#applyBtn').onclick=()=>applySelected(true);$('#deselectBtn').onclick=()=>deselect(true);
$('#duplicateBtn').onclick=()=>{if(!selected)return;checkpoint();const copy=addItem(selected.samples.map(cloneSample),{...selected.settings},true);copy.mesh.position.y+=.18;setOrbitPivot(copy);refreshExport()};
$('#loadReferenceBtn').onclick=()=>$('#referenceFile').click();
$('#referenceFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;$('#referenceStatus').textContent=`Loading ${file.name}…`;try{const root=await loadReferenceMesh(file);if(referenceRoot){surfaceTargets.unregister(referenceRoot);referenceGroup.remove(referenceRoot)}referenceRoot=root;referenceRoot.visible=$('#showReference').checked;referenceGroup.add(root);surfaceTargets.register(root);$('#referenceStatus').textContent=`Loaded ${file.name}`}catch(err){$('#referenceStatus').textContent=`Load failed: ${err.message}`}finally{e.target.value=''}};
$('#showReference').onchange=e=>{if(referenceRoot)referenceRoot.visible=e.target.checked};
$('#surfaceOffset').oninput=()=>$('#surfaceOffsetOut').value=(+$('#surfaceOffset').value).toFixed(2);
$('#snapSurface').onchange=()=>{status.textContent=$('#snapSurface').checked?'Surface Snap enabled for new Tube Balloon strokes':'Surface Snap off — drawing plane active'};
$('#undoBtn').onclick=doUndo;$('#redoBtn').onclick=doRedo;
$('#deleteBtn').onclick=()=>{if(!selected)return;checkpoint();const doomed=selected;deselect(true);disposeItem(doomed);items=items.filter(x=>x!==doomed);select(items.at(-1)||null);refreshExport()};$('#clearBtn').onclick=()=>{if(!items.length)return;checkpoint();restore([])};
$('#exportBtn').addEventListener('click',e=>{if($('#exportBtn').classList.contains('disabled')){e.preventDefault();status.textContent='Nothing to export'}else status.textContent=`OBJ ready • ${items.length} balloon${items.length===1?'':'s'}`});

function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function resetInitialView(){controls.target.copy(WORLD_ORIGIN);orbitPivot.copy(WORLD_ORIGIN);camera.position.set(7,7,7);camera.up.set(0,1,0);camera.lookAt(WORLD_ORIGIN);controls.update()}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,120));if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);
resize();resetInitialView();syncOutputs();updateSelectionUI();setMode('draw');refreshExport();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
