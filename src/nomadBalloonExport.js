// Builds native Nomad Sculpt projects from the validated editable Tube template
// previously proven in MeshUtilz. Each Balloon Tube remains an independent live Tube.
// v0.8.1 keeps the donor Tube cache structure intact, deforms only its cached vertices
// to the Balloon path, and writes the complete per-point Tube parameter arrays Nomad expects.
const TEMPLATE_URL='./src/templates/nomad-tube.nom';
const enc=new TextEncoder(),dec=new TextDecoder();
const u64=(dv,o)=>Number(dv.getBigUint64(o,true));
const w64=(dv,o,n)=>dv.setBigUint64(o,BigInt(n),true);
const clone=x=>structuredClone(x);
const DATA_FIELDS=['vertices','uvs','faces','faces_uv','faces_group','normals','colors','materials'];

async function template(){
  const bytes=new Uint8Array(await (await fetch(TEMPLATE_URL,{cache:'no-store'})).arrayBuffer());
  if(dec.decode(bytes.slice(0,12))!=='Nomad Sculpt')throw Error('Nomad Tube template is invalid');
  const dv=new DataView(bytes.buffer),jo=u64(dv,24),jl=u64(dv,32),bo=u64(dv,40),bl=u64(dv,48);
  return {bytes,jo,json:JSON.parse(dec.decode(bytes.slice(jo,jo+jl))),bin:bytes.slice(bo,bo+bl)};
}

// This is the same safe pattern used by the proven MeshUtilz procedural exporter:
// retain the complete donor mesh cache slice rather than rebuilding only a few fields.
function meshSlice(parsed,sourceMesh){
  let lo=Infinity,hi=0;
  for(const key of DATA_FIELDS){
    const field=sourceMesh?.[key];
    if(field&&Number.isFinite(field.offset)&&Number.isFinite(field.length)){
      lo=Math.min(lo,field.offset);
      hi=Math.max(hi,field.offset+field.length);
    }
  }
  const mesh=clone(sourceMesh);
  if(!Number.isFinite(lo))return {mesh,bin:new Uint8Array()};
  function rebase(value){
    if(!value||typeof value!=='object')return;
    if(Number.isFinite(value.offset)&&Number.isFinite(value.length)&&value.offset>=lo&&value.offset+value.length<=hi)value.offset-=lo;
    for(const child of Object.values(value))rebase(child);
  }
  rebase(mesh);
  return {mesh,bin:parsed.bin.slice(lo,hi)};
}

function offsetFields(value,delta){
  if(!value||typeof value!=='object')return;
  if(Number.isFinite(value.offset)&&Number.isFinite(value.length))value.offset+=delta;
  for(const child of Object.values(value))offsetFields(child,delta);
}

function sampleRadius(sample,settings,index,count,THREE){
  const pressure=THREE.MathUtils.smoothstep(sample.pressure??1,.05,1);
  const pressureFactor=THREE.MathUtils.lerp(1,.28+.92*pressure,settings.pressure??.7);
  const loop=settings.loop===true;
  const u=loop?index/Math.max(1,count):index/Math.max(1,count-1);
  const bodyShape=loop?0:Math.sin(Math.PI*u);
  const inflation=1+(settings.bulge??.18)*Math.pow(Math.max(0,bodyShape),.7);
  let radius=(settings.width??.42)*.5*pressureFactor*inflation;
  if(!loop&&settings.caps!==false&&settings.taper!==false){
    const edge=Math.min(u,1-u);
    const span=THREE.MathUtils.lerp(.035,.2,settings.endSoft??.65);
    const tip=THREE.MathUtils.smoothstep(edge,0,span);
    const minEnd=THREE.MathUtils.lerp(.86,.42,settings.endSoft??.65);
    radius*=THREE.MathUtils.lerp(minEnd,1,tip);
  }
  return Math.max(1e-5,radius);
}

function configureTube(mesh,item,THREE){
  const samples=item.samples,settings=item.settings,cfg=mesh.config_tube;
  if(!cfg?.curve)throw Error('Nomad Tube template has no config_tube curve');
  cfg.curve.points=samples.map(s=>[s.p.x,s.p.y,s.p.z]);
  cfg.curve.sharps=samples.map(()=>0);
  cfg.curve.closed=!!settings.loop;
  cfg.cap_start=settings.caps!==false;
  cfg.cap_end=settings.caps!==false;
  cfg.radiuses=samples.map((sample,i)=>sampleRadius(sample,settings,i,samples.length,THREE));

  // MeshUtilz's known-good native Tube adapter writes all of these arrays together.
  // Keeping their lengths aligned with curve.points is important to Nomad's live Tube state.
  cfg.rotates=samples.map(()=>0);
  cfg.spirals=samples.map(()=>0);
  if(Array.isArray(cfg.profiles)&&cfg.profiles.length){
    const seed=clone(cfg.profiles[0]);
    cfg.profiles=samples.map(()=>clone(seed));
  }

  // Preserve the validated donor subdivision/profile settings. The cached donor topology
  // therefore remains structurally consistent until Nomad chooses to regenerate it.
  mesh.name='Live Tube Balloon';
}

function radiusAt(config,u,THREE){
  const radiuses=config?.radiuses||[];
  if(!radiuses.length)return .1;
  if(radiuses.length===1)return Number(radiuses[0])||.1;
  const f=THREE.MathUtils.clamp(u,0,1)*(radiuses.length-1),a=Math.floor(f),b=Math.min(radiuses.length-1,a+1),t=f-a;
  return THREE.MathUtils.lerp(Number(radiuses[a])||.1,Number(radiuses[b])||.1,t);
}

function frameAt(frames,u,segments,THREE){
  const f=THREE.MathUtils.clamp(u,0,1)*segments,a=Math.floor(f),b=Math.min(segments,a+1),t=f-a;
  const normal=frames.normals[a].clone().lerp(frames.normals[b],t).normalize();
  const binormal=frames.binormals[a].clone().lerp(frames.binormals[b],t).normalize();
  const tangent=frames.tangents[a].clone().lerp(frames.tangents[b],t).normalize();
  return {normal,binormal,tangent};
}

function deformTubeCache(donorBin,mesh,sourceConfig,THREE){
  const bin=donorBin.slice(),field=mesh.vertices;
  if(!field||field.type!=='f32vec3'||!Number.isFinite(field.count))throw Error('Nomad Tube template has no editable f32vec3 vertex cache');
  if(field.lz4)throw Error('Compressed/LZ4 Tube vertex caches are not supported by this exporter');
  if(field.offset<0||field.offset+field.count*12>bin.length)throw Error('Nomad Tube donor vertex cache is outside the binary slice');

  const sourcePoints=sourceConfig?.curve?.points||[],a0=sourcePoints[0],b0=sourcePoints.at(-1);
  if(!a0||!b0)throw Error('Nomad Tube donor curve is invalid');
  const sourceA=new THREE.Vector3(...a0),sourceB=new THREE.Vector3(...b0),sourceAxis=sourceB.clone().sub(sourceA),sourceLength=sourceAxis.length();
  if(!(sourceLength>1e-8))throw Error('Nomad Tube donor curve has zero length');
  sourceAxis.multiplyScalar(1/sourceLength);

  // Build a stable perpendicular basis around the donor's straight Tube axis.
  const helper=Math.abs(sourceAxis.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1);
  const sourceN=helper.clone().sub(sourceAxis.clone().multiplyScalar(helper.dot(sourceAxis))).normalize();
  const sourceBino=new THREE.Vector3().crossVectors(sourceAxis,sourceN).normalize();

  const cfg=mesh.config_tube,targetPoints=cfg.curve.points.map(p=>new THREE.Vector3(...p)),closed=!!cfg.curve.closed;
  const curve=new THREE.CatmullRomCurve3(targetPoints,closed,'centripetal',.5);
  const segments=Math.max(64,Math.min(512,targetPoints.length*24));
  const frames=curve.computeFrenetFrames(segments,closed);
  const sourceRadiusFallback=Math.max(1e-8,Number(sourceConfig?.radiuses?.[0])||.5);
  const dv=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
  const p=new THREE.Vector3(),axisPoint=new THREE.Vector3(),radial=new THREE.Vector3();

  for(let i=0;i<field.count;i++){
    const o=field.offset+i*12;
    p.set(dv.getFloat32(o,true),dv.getFloat32(o+4,true),dv.getFloat32(o+8,true));
    const along=p.clone().sub(sourceA).dot(sourceAxis),u=THREE.MathUtils.clamp(along/sourceLength,0,1);
    axisPoint.copy(sourceA).addScaledVector(sourceAxis,along);
    radial.copy(p).sub(axisPoint);
    const rx=radial.dot(sourceN),rz=radial.dot(sourceBino);
    const sourceRadius=Math.max(1e-8,radiusAt(sourceConfig,u,THREE)||sourceRadiusFallback),targetRadius=radiusAt(cfg,u,THREE),scale=targetRadius/sourceRadius;
    const center=curve.getPointAt(u),frame=frameAt(frames,u,segments,THREE);
    const q=center.clone().addScaledVector(frame.normal,rx*scale).addScaledVector(frame.binormal,rz*scale);
    dv.setFloat32(o,q.x,true);dv.setFloat32(o+4,q.y,true);dv.setFloat32(o+8,q.z,true);
  }

  // When the donor normals are plain f32vec3, rotate them with the deformed Tube as well.
  // If Nomad's donor stores them differently, leave that validated donor field untouched.
  const normals=mesh.normals;
  if(normals?.type==='f32vec3'&&!normals.lz4&&Number.isFinite(normals.count)&&normals.offset>=0&&normals.offset+normals.count*12<=bin.length){
    const sourceView=new DataView(donorBin.buffer,donorBin.byteOffset,donorBin.byteLength);
    for(let i=0;i<normals.count;i++){
      const o=normals.offset+i*12,nx=sourceView.getFloat32(o,true),ny=sourceView.getFloat32(o+4,true),nz=sourceView.getFloat32(o+8,true);
      // Map by corresponding vertex u where possible; otherwise use the nearest available vertex.
      const vi=Math.min(field.count-1,Math.floor(i*field.count/Math.max(1,normals.count))),vo=field.offset+vi*12;
      p.set(sourceView.getFloat32(vo,true),sourceView.getFloat32(vo+4,true),sourceView.getFloat32(vo+8,true));
      const u=THREE.MathUtils.clamp(p.clone().sub(sourceA).dot(sourceAxis)/sourceLength,0,1),frame=frameAt(frames,u,segments,THREE);
      const sourceNormal=new THREE.Vector3(nx,ny,nz);
      const a=sourceNormal.dot(sourceN),b=sourceNormal.dot(sourceAxis),c=sourceNormal.dot(sourceBino);
      const out=frame.normal.clone().multiplyScalar(a).addScaledVector(frame.tangent,b).addScaledVector(frame.binormal,c).normalize();
      dv.setFloat32(o,out.x,true);dv.setFloat32(o+4,out.y,true);dv.setFloat32(o+8,out.z,true);
    }
  }
  return bin;
}

function findNode(nodes,meshIndex=0){
  for(const node of nodes||[]){
    if(node.mesh===meshIndex)return node;
    const found=findNode(node.children,meshIndex);if(found)return found;
  }
  return null;
}

export async function buildLiveNomadBalloon(items,THREE){
  const tubes=items.filter(x=>(x.settings.kind||'tube')==='tube'&&x.samples.length>=2);
  if(!tubes.length)throw Error('Create at least one Tube Balloon before exporting Live NOM.');
  const base=await template(),donor=meshSlice(base,base.json.meshes[0]);
  if(!donor.bin.length)throw Error('Nomad Tube template has no usable donor mesh cache');

  const project=clone(base.json),binaryParts=[];project.meshes=[];
  const proto=findNode(base.json.scene,0)||{};
  const group={name:'MeshUtilz – Live Nomad Balloons',group:0,selected:true,selected_main:true,children:[],visible:true,node_collapse:false,lock:false};

  tubes.forEach((item,i)=>{
    const mesh=clone(donor.mesh),sourceConfig=clone(mesh.config_tube);
    configureTube(mesh,item,THREE);
    const bin=deformTubeCache(donor.bin,mesh,sourceConfig,THREE),offset=binaryParts.reduce((n,p)=>n+p.length,0);
    offsetFields(mesh,offset);
    project.meshes.push(mesh);binaryParts.push(bin);

    const node=clone(proto);
    node.name=`Tube Balloon ${i+1}`;node.mesh=i;node.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];node.transform_reset=false;node.selected=false;node.selected_main=false;node.node_collapse=true;node.lock=false;node.children=[];node.visible=true;
    delete node.hid;delete node.group;
    group.children.push(node);
  });
  project.scene=[group];

  const json=enc.encode(JSON.stringify(project)),binaryLength=binaryParts.reduce((n,b)=>n+b.length,0),binaryOffset=(base.jo+json.length+7)&~7,out=new Uint8Array(binaryOffset+binaryLength);
  out.set(base.bytes.slice(0,base.jo));out.set(json,base.jo);let at=binaryOffset;for(const part of binaryParts){out.set(part,at);at+=part.length}
  const dv=new DataView(out.buffer);w64(dv,16,out.length);w64(dv,24,base.jo);w64(dv,32,json.length);w64(dv,40,binaryOffset);w64(dv,48,binaryLength);
  return {bytes:out,count:tubes.length};
}
