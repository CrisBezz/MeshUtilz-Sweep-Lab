import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeProfile,buildSweep} from './sweepGeometry.js';

const host=document.querySelector('#viewport'), scene=new THREE.Scene();scene.background=new THREE.Color(0x22262d);
const camera=new THREE.PerspectiveCamera(50,1,.01,1000);camera.position.set(7,7,7);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.enabled=false;
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2.2));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(5,8,4);scene.add(dl);
const grid=new THREE.GridHelper(20,40,0x657080,0x343a44);scene.add(grid);
const material=new THREE.MeshStandardMaterial({color:0xd7dde7,roughness:.55,metalness:.05,side:THREE.DoubleSide});let mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);scene.add(mesh);
let raw=[], history=[], drawing=false, mode='draw';const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ndc=new THREE.Vector2();
const $=s=>document.querySelector(s), status=$('#status');
function pointFromEvent(e){const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const p=new THREE.Vector3();return ray.ray.intersectPlane(plane,p)?p:null;}
function sampledPath(){if(raw.length<2)return raw;const curve=new THREE.CatmullRomCurve3(raw,false,'centripetal',.5);const mult=+$(`#smooth`).value;return curve.getPoints(Math.max(2,Math.min(500,raw.length*mult)));}
function rebuild(){mesh.geometry.dispose();const path=sampledPath(),profile=makeProfile($('#profile').value,+$('#size').value,+$('#sides').value);mesh.geometry=buildSweep(path,profile,{caps:$('#caps').checked});status.textContent=path.length>1?`${path.length} path samples • ${mesh.geometry.getAttribute('position')?.count||0} vertices`:'Ready — draw a path';}
function setMode(m){mode=m;controls.enabled=m==='orbit';$('#drawBtn').classList.toggle('active',m==='draw');$('#orbitBtn').classList.toggle('active',m==='orbit');}
renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='draw')return;drawing=true;history.push(raw.map(p=>p.clone()));raw=[];const p=pointFromEvent(e);if(p)raw.push(p);renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drawing||mode!=='draw')return;const p=pointFromEvent(e);if(!p)return;if(!raw.length||p.distanceTo(raw[raw.length-1])>.035){raw.push(p);rebuild();}});
renderer.domElement.addEventListener('pointerup',()=>{if(!drawing)return;drawing=false;rebuild();});
$('#drawBtn').onclick=()=>setMode('draw');$('#orbitBtn').onclick=()=>setMode('orbit');
['profile','size','smooth','sides','caps'].forEach(id=>$('#'+id).addEventListener('input',()=>{$('#sizeOut').value=(+$('#size').value).toFixed(2);$('#sidesOut').value=$('#sides').value;rebuild();}));
$('#undoBtn').onclick=()=>{if(history.length){raw=history.pop();rebuild();}};$('#clearBtn').onclick=()=>{history.push(raw.map(p=>p.clone()));raw=[];rebuild();};
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});