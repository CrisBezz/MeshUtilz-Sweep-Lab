import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildBalloon,smoothRadii} from './balloonGeometry.js';

const host=document.querySelector('#viewport'),scene=new THREE.Scene();
scene.background=new THREE.Color(0x22262d);
const camera=new THREE.PerspectiveCamera(50,1,.01,1000);camera.position.set(7,7,7);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.enabled=true;controls.enableRotate=true;controls.enablePan=true;controls.enableZoom=true;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2.2));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(5,8,4);scene.add(dl);
scene.add(new THREE.GridHelper(20,40,0x657080,0x343a44));

const $=s=>document.querySelector(s),status=$('#status'),ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
let items=[],current=null,drawing=false,mode='draw',selected=null,undo=[],redo=[],exportUrl=null,orbitTap=null;
const material=()=>new THREE.MeshStandardMaterial({color:0xd7dde7,roughness:.48,metalness:.03,side:THREE.DoubleSide,wireframe:$('#wire').checked});

function uiSettings(){return{width:+$('#width').value,pressure:+$('#pressure').value,bulge:+$('#bulge').value,endSoft:+$('#endSoft').value,smooth:+$('#smooth').value,sides:+$('#sides').value,taper:$('#taper').checked}}
function plane(){const v=$('#plane').value;return v==='XY'?new THREE.Plane(new THREE.Vector3(0,0,1),0):v==='YZ'?new THREE.Plane(new THREE.Vector3(1,0,0),0):new THREE.Plane(new THREE.Vector3(0,1,0),0)}
function eventRay(e){const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera)}
function pointFromEvent(e){eventRay(e);const p=new THREE.Vector3();return ray.ray.intersectPlane(plane(),p)?p:null}
function eventPressure(e){if(e.pointerType==='pen'&&Number.isFinite(e.pressure)&&e.pressure>0)return THREE.MathUtils.clamp(e.pressure,0.05,1);return 1}

function snapshot(){return items.map(x=>({samples:x.samples.map(s=>({p:s.p.toArray(),pressure:s.pressure})),settings:{...x.settings},position:x.mesh.position.toArray()}))}
function checkpoint(){undo.push(snapshot());if(undo.length>30)undo.shift();redo=[]}
function disposeItem(x){scene.remove(x.mesh);x.mesh.geometry.dispose();x.mesh.material.dispose()}
function restore(snap){items.forEach(disposeItem);items=[];selected=null;for(const d of snap){const x=addItem(d.samples.map(s=>({p:new THREE.Vector3(...s.p),pressure:s.pressure})),d.settings,false);x.mesh.position.fromArray(d.position||[0,0,0])}select(items.at(-1)||null);refreshExport();updateStatus()}

function resample(samples,settings){
  if(samples.length<2)return{path:[],radii:[]};
  const raw=samples.map(s=>s.p),curve=new THREE.CatmullRomCurve3(raw,false,'centripetal',.5);
  const count=Math.max(3,Math.min(420,raw.length*settings.smooth));
  const path=curve.getPoints(count),r=[];
  const base=settings.width/2;
  for(let i=0;i<path.length;i++){
    const u=i/(path.length-1),f=u*(samples.length-1),a=Math.floor(f),b=Math.min(samples.length-1,a+1),q=f-a;
    const pressure=THREE.MathUtils.lerp(samples[a].pressure,samples[b].pressure,q);
    const easedPressure=THREE.MathUtils.smoothstep(pressure,0.05,1);
    const pressureFactor=THREE.MathUtils.lerp(1,0.28+0.92*easedPressure,settings.pressure);
    const bodyShape=Math.sin(Math.PI*u);
    const inflation=1+settings.bulge*Math.pow(Math.max(0,bodyShape),0.7);
    let radius=base*pressureFactor*inflation;
    if(settings.taper){
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
  const {path,radii}=resample(x.samples,x.settings);
  x.mesh.geometry=buildBalloon(path,radii,{sides:x.settings.sides,capRings:6});
  x.mesh.material.wireframe=$('#wire').checked;
}
function addItem(samples,settings=uiSettings(),autoSelect=true){const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material()),x={samples,settings:{bulge:.18,endSoft:.65,...settings},mesh};items.push(x);scene.add(mesh);rebuild(x);if(autoSelect)select(x);return x}
function updateStatus(){const verts=items.reduce((n,x)=>n+(x.mesh.geometry.getAttribute('position')?.count||0),0);status.textContent=`${items.length} balloon${items.length===1?'':'s'} • ${verts} vertices${selected?' • selected':''}`}
function loadControls(x){$('#width').value=x.settings.width;$('#pressure').value=x.settings.pressure;$('#bulge').value=x.settings.bulge??.18;$('#endSoft').value=x.settings.endSoft??.65;$('#smooth').value=x.settings.smooth;$('#sides').value=x.settings.sides;$('#taper').checked=x.settings.taper;syncOutputs()}
function updateSelectionUI(){const on=!!selected;$('#applyBtn').disabled=!on;$('#duplicateBtn').disabled=!on;$('#selectionLabel').textContent=on?`Selected balloon ${items.indexOf(selected)+1}`:'No balloon selected'}
function select(x){if(selected)selected.mesh.material.emissive.setHex(0);selected=x;if(x){x.mesh.material.emissive.setHex(0x29405f);loadControls(x)}updateSelectionUI();updateStatus()}
function setMode(m){mode=m;$('#drawBtn').classList.toggle('active',m==='draw');$('#orbitBtn').classList.toggle('active',m==='orbit');status.textContent=m==='draw'?'Draw: Pencil draws • finger always orbits':'Orbit / Select: finger or Pencil rotates • tap selects'}
function syncOutputs(){$('#widthOut').value=(+$('#width').value).toFixed(2);$('#pressureOut').value=`${Math.round(+$('#pressure').value*100)}%`;$('#bulgeOut').value=`${Math.round(+$('#bulge').value*100)}%`;$('#endSoftOut').value=`${Math.round(+$('#endSoft').value*100)}%`;$('#smoothOut').value=$('#smooth').value;$('#sidesOut').value=$('#sides').value}
function applySelected(saveUndo=false){if(!selected)return;if(saveUndo)checkpoint();selected.settings=uiSettings();rebuild(selected);selected.mesh.material.emissive.setHex(0x29405f);refreshExport();updateStatus()}

function serializeOBJ(){let out='# MeshUtilz Balloon v0.6.3\n',offset=1;for(let i=0;i<items.length;i++){const x=items[i],g=x.mesh.geometry,pos=g.getAttribute('position');if(!pos||pos.count<3)continue;const index=g.index;out+=`o Balloon_${i+1}\n`;x.mesh.updateMatrixWorld(true);for(let n=0;n<pos.count;n++){const v=new THREE.Vector3().fromBufferAttribute(pos,n).applyMatrix4(x.mesh.matrixWorld);out+=`v ${v.x} ${v.y} ${v.z}\n`}if(index){for(let n=0;n+2<index.count;n+=3)out+=`f ${index.getX(n)+offset} ${index.getX(n+1)+offset} ${index.getX(n+2)+offset}\n`}offset+=pos.count}return out}
function refreshExport(){const a=$('#exportBtn');if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null}const valid=items.some(x=>(x.mesh.geometry.getAttribute('position')?.count||0)>=3);if(!valid){a.classList.add('disabled');a.removeAttribute('download');a.href='#';return}exportUrl=URL.createObjectURL(new Blob([serializeOBJ()],{type:'text/plain;charset=utf-8'}));a.href=exportUrl;a.download='MeshUtilz-Balloon-v0.6.3.obj';a.classList.remove('disabled')}

function startDraw(e){const p=pointFromEvent(e);if(!p)return;checkpoint();drawing=true;current=addItem([{p,pressure:eventPressure(e)}],uiSettings(),false);renderer.domElement.setPointerCapture(e.pointerId);status.textContent='Drawing balloon…'}
function moveDraw(e){if(!drawing||!current)return;const p=pointFromEvent(e);if(!p)return;const last=current.samples.at(-1).p;if(p.distanceTo(last)>.035){current.samples.push({p,pressure:eventPressure(e)});rebuild(current);updateStatus()}}
function finishStroke(){if(!drawing)return;drawing=false;if(!current)return;if(current.samples.length<2){disposeItem(current);items=items.filter(x=>x!==current);current=null;select(items.at(-1)||null);refreshExport();return}const finished=current;current=null;rebuild(finished);select(finished);refreshExport();updateStatus()}
function trackOrbitDown(e){orbitTap={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}}
function trackOrbitMove(e){if(orbitTap&&orbitTap.id===e.pointerId&&Math.hypot(e.clientX-orbitTap.x,e.clientY-orbitTap.y)>6)orbitTap.moved=true}
function finishOrbitTap(e){if(orbitTap&&orbitTap.id===e.pointerId&&!orbitTap.moved){eventRay(e);const hits=ray.intersectObjects(items.map(x=>x.mesh),false);select(hits.length?items.find(x=>x.mesh===hits[0].object):null)}orbitTap=null}

renderer.domElement.addEventListener('pointerdown',e=>{
  const finger=e.pointerType==='touch';
  if(finger||mode==='orbit'){trackOrbitDown(e);return}
  e.stopImmediatePropagation();startDraw(e);
},{capture:true});
renderer.domElement.addEventListener('pointermove',e=>{
  const finger=e.pointerType==='touch';
  if(finger||mode==='orbit'){trackOrbitMove(e);return}
  e.stopImmediatePropagation();moveDraw(e);
},{capture:true});
renderer.domElement.addEventListener('pointerup',e=>{
  const finger=e.pointerType==='touch';
  if(finger||mode==='orbit'){finishOrbitTap(e);return}
  e.stopImmediatePropagation();finishStroke();
},{capture:true});
renderer.domElement.addEventListener('pointercancel',e=>{
  const finger=e.pointerType==='touch';
  if(finger||mode==='orbit'){orbitTap=null;return}
  e.stopImmediatePropagation();finishStroke();
},{capture:true});

$('#drawBtn').onclick=()=>setMode('draw');$('#orbitBtn').onclick=()=>setMode('orbit');
['width','pressure','bulge','endSoft','smooth','sides','taper'].forEach(id=>$('#'+id).addEventListener('input',()=>{syncOutputs();if(selected)applySelected(false)}));
$('#wire').oninput=()=>{items.forEach(rebuild);refreshExport()};$('#applyBtn').onclick=()=>applySelected(true);
$('#duplicateBtn').onclick=()=>{if(!selected)return;checkpoint();const copy=addItem(selected.samples.map(s=>({p:s.p.clone(),pressure:s.pressure})),{...selected.settings},true);copy.mesh.position.y+=.18;refreshExport()};
$('#undoBtn').onclick=()=>{if(undo.length){redo.push(snapshot());restore(undo.pop())}};$('#redoBtn').onclick=()=>{if(redo.length){undo.push(snapshot());restore(redo.pop())}};
$('#deleteBtn').onclick=()=>{if(!selected)return;checkpoint();disposeItem(selected);items=items.filter(x=>x!==selected);select(items.at(-1)||null);refreshExport()};$('#clearBtn').onclick=()=>{if(!items.length)return;checkpoint();restore([])};
$('#exportBtn').addEventListener('click',e=>{if($('#exportBtn').classList.contains('disabled')){e.preventDefault();status.textContent='Nothing to export'}else status.textContent=`OBJ ready • ${items.length} balloon${items.length===1?'':'s'}`});

function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,120));if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);
resize();syncOutputs();updateSelectionUI();setMode('draw');refreshExport();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
