// Builds a native Nomad Sculpt project from the validated editable Tube template
// used by MeshUtilz. Each Balloon Tube remains an independent live Tube object.
const TEMPLATE_URL='./src/templates/nomad-tube.nom';
const enc=new TextEncoder(),dec=new TextDecoder();
const u64=(dv,o)=>Number(dv.getBigUint64(o,true));
const w64=(dv,o,n)=>dv.setBigUint64(o,BigInt(n),true);
const clone=x=>structuredClone(x);

async function template(){
  const bytes=new Uint8Array(await (await fetch(TEMPLATE_URL,{cache:'no-store'})).arrayBuffer());
  if(dec.decode(bytes.slice(0,12))!=='Nomad Sculpt')throw Error('Nomad Tube template is invalid');
  const dv=new DataView(bytes.buffer),jo=u64(dv,24),jl=u64(dv,32),bo=u64(dv,40),bl=u64(dv,48);
  return {bytes,jo,json:JSON.parse(dec.decode(bytes.slice(jo,jo+jl))),bin:bytes.slice(bo,bo+bl)};
}
function offsetFields(value,delta){
  if(!value||typeof value!=='object')return;
  if(Number.isFinite(value.offset)&&Number.isFinite(value.length))value.offset+=delta;
  for(const v of Object.values(value))offsetFields(v,delta);
}
function tubeRadius(sample,settings,THREE){
  const pressure=THREE.MathUtils.smoothstep(sample.pressure??1,.05,1);
  return settings.width*.5*THREE.MathUtils.lerp(1,.28+.92*pressure,settings.pressure??.7);
}
// THREE is supplied by the app, avoiding another module-level CDN dependency.
function configureTube(mesh,item,THREE){
  const samples=item.samples,settings=item.settings,cfg=mesh.config_tube;
  cfg.curve.points=samples.map(s=>[s.p.x,s.p.y,s.p.z]);
  cfg.curve.sharps=samples.map(()=>0);
  cfg.curve.closed=!!settings.loop;
  cfg.cap_start=settings.caps!==false;cfg.cap_end=settings.caps!==false;
  cfg.radiuses=samples.map(s=>tubeRadius(s,settings,THREE));
  cfg.subdiv_x=Math.min(160,Math.max(8,samples.length*Math.max(2,settings.smooth||5)));
  cfg.subdiv_y=Math.max(8,settings.sides||16);
  mesh.name='Live Tube Balloon';
}
export async function buildLiveNomadBalloon(items,THREE){
  const tubes=items.filter(x=>(x.settings.kind||'tube')==='tube'&&x.samples.length>=2);
  if(!tubes.length)throw Error('Create at least one Tube Balloon before exporting Live NOM.');
  const base=await template(),project=clone(base.json),binaryParts=[];
  project.meshes=[];
  const group={name:'MeshUtilz – Live Nomad Balloons',group:0,selected:true,selected_main:true,children:[]};
  tubes.forEach((item,i)=>{
    const mesh=clone(base.json.meshes[0]);offsetFields(mesh,i*base.bin.length);configureTube(mesh,item,THREE);project.meshes.push(mesh);binaryParts.push(base.bin);
    group.children.push({name:`Tube Balloon ${i+1}`,mesh:i,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],transform_reset:false,selected:false,selected_main:false,node_collapse:true,lock:false,children:[],visible:true});
  });
  project.scene=[group];
  const json=enc.encode(JSON.stringify(project)),binaryLength=binaryParts.reduce((n,b)=>n+b.length,0),binaryOffset=(base.jo+json.length+7)&~7,out=new Uint8Array(binaryOffset+binaryLength);
  out.set(base.bytes.slice(0,base.jo));out.set(json,base.jo);let at=binaryOffset;for(const part of binaryParts){out.set(part,at);at+=part.length}
  const dv=new DataView(out.buffer);w64(dv,16,out.length);w64(dv,24,base.jo);w64(dv,32,json.length);w64(dv,40,binaryOffset);w64(dv,48,binaryLength);
  return {bytes:out,count:tubes.length};
}
