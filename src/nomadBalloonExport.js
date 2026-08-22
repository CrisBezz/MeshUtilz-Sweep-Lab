// Builds native Nomad Sculpt projects from the validated editable Tube template.
// v0.8.6.2 keeps enough live Tube control points for a useful first-open cache while preserving editability.
const TEMPLATE_URL='./src/templates/nomad-tube.nom';
const enc=new TextEncoder(),dec=new TextDecoder();
const u64=(dv,o)=>Number(dv.getBigUint64(o,true));
const w64=(dv,o,n)=>dv.setBigUint64(o,BigInt(n),true);
const clone=x=>structuredClone(x);
const DATA_FIELDS=['vertices','uvs','faces','faces_uv','faces_group','normals','colors','materials'];
const DETAIL={
  low:{radiusTol:.46,pathTol:.016,max:18,min:6},
  medium:{radiusTol:.26,pathTol:.008,max:28,min:8},
  high:{radiusTol:.13,pathTol:.0035,max:48,min:10}
};

async function template(){
  const bytes=new Uint8Array(await (await fetch(TEMPLATE_URL,{cache:'no-store'})).arrayBuffer());
  if(dec.decode(bytes.slice(0,12))!=='Nomad Sculpt')throw Error('Nomad Tube template is invalid');
  const dv=new DataView(bytes.buffer),jo=u64(dv,24),jl=u64(dv,32),bo=u64(dv,40),bl=u64(dv,48);
  return {bytes,jo,json:JSON.parse(dec.decode(bytes.slice(jo,jo+jl))),bin:bytes.slice(bo,bo+bl)};
}

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

function pathLength(records,closed=false){
  let length=0;
  for(let i=1;i<records.length;i++)length+=records[i].p.distanceTo(records[i-1].p);
  if(closed&&records.length>2)length+=records[0].p.distanceTo(records.at(-1).p);
  return length;
}

function pointSegmentError(rec,a,b,radiusWeight){
  const ab=b.p.clone().sub(a.p),len2=ab.lengthSq();
  let t=len2>1e-12?rec.p.clone().sub(a.p).dot(ab)/len2:0;
  t=Math.max(0,Math.min(1,t));
  const q=a.p.clone().addScaledVector(ab,t),posErr=rec.p.distanceTo(q);
  const expected=a.r+(b.r-a.r)*t,radiusErr=Math.abs(rec.r-expected);
  return Math.hypot(posErr,radiusErr*radiusWeight);
}

function rdpIndices(records,tolerance,radiusWeight){
  if(records.length<=2)return records.map((_,i)=>i);
  const keep=new Set([0,records.length-1]),stack=[[0,records.length-1]];
  while(stack.length){
    const [a,b]=stack.pop();let best=-1,bestErr=tolerance;
    for(let i=a+1;i<b;i++){
      const err=pointSegmentError(records[i],records[a],records[b],radiusWeight);
      if(err>bestErr){bestErr=err;best=i}
    }
    if(best>=0){keep.add(best);stack.push([a,best],[best,b])}
  }
  return [...keep].sort((a,b)=>a-b);
}

function simplifyOpen(records,detail){
  if(records.length<=4)return records.slice();
  const spec=DETAIL[detail]||DETAIL.medium,total=pathLength(records,false),avgRadius=records.reduce((n,x)=>n+x.r,0)/records.length;
  let tolerance=Math.max(avgRadius*spec.radiusTol,total*spec.pathTol,1e-5),indices=rdpIndices(records,tolerance,1.8);
  for(let pass=0;indices.length>spec.max&&pass<10;pass++){
    tolerance*=1.32;
    indices=rdpIndices(records,tolerance,1.8);
  }
  return indices.map(i=>records[i]);
}

function simplifyClosed(records,detail){
  if(records.length<=6)return records.slice();
  let far=1,farD=-1;
  for(let i=1;i<records.length;i++){
    const d=records[0].p.distanceToSquared(records[i].p);
    if(d>farD){farD=d;far=i}
  }
  const first=records.slice(0,far+1),second=records.slice(far).concat([records[0]]);
  const a=simplifyOpen(first,detail),b=simplifyOpen(second,detail);
  return a.slice(0,-1).concat(b.slice(0,-1));
}

function evenlySpacedRecords(records,count,closed){
  if(records.length<=count)return records.slice();
  const out=[],used=new Set();
  for(let i=0;i<count;i++){
    const u=closed?i/count:i/Math.max(1,count-1);
    const idx=closed?Math.floor(u*records.length):Math.round(u*(records.length-1));
    if(!used.has(idx)){used.add(idx);out.push(records[idx])}
  }
  return out;
}

function simplifiedTubeSamples(item,detail,THREE){
  const source=item.samples,settings=item.settings,spec=DETAIL[detail]||DETAIL.medium;
  const records=source.map((s,i)=>({p:s.p.clone(),r:sampleRadius(s,settings,i,source.length,THREE)}));
  let reduced=settings.loop===true?simplifyClosed(records,detail):simplifyOpen(records,detail);
  const minimum=Math.min(records.length,spec.min);
  if(reduced.length<minimum)reduced=evenlySpacedRecords(records,minimum,settings.loop===true);
  if(reduced.length<(settings.loop?3:2))return records;
  return reduced;
}

function configureTube(mesh,item,detail,THREE){
  const settings=item.settings,cfg=mesh.config_tube;
  if(!cfg?.curve)throw Error('Nomad Tube template has no config_tube curve');
  const records=simplifiedTubeSamples(item,detail,THREE);
  cfg.curve.points=records.map(x=>[x.p.x,x.p.y,x.p.z]);
  cfg.curve.sharps=records.map(()=>0);
  cfg.curve.closed=!!settings.loop;
  cfg.cap_start=settings.caps!==false;
  cfg.cap_end=settings.caps!==false;
  cfg.radiuses=records.map(x=>x.r);
  cfg.edit_radius='all';
  cfg.edit_rotate='none';
  cfg.edit_profile='none';
  cfg.edit_hole='none';
  cfg.edit_spiral='none';
  cfg.rotates=records.map(()=>0);
  cfg.spirals=records.map(()=>0);
  if(Array.isArray(cfg.profiles)&&cfg.profiles.length){
    const seed=clone(cfg.profiles[0]);
    cfg.profiles=records.map(()=>clone(seed));
  }
  mesh.name='Live Tube Balloon';
  return {source:item.samples.length,exported:records.length};
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
  const normals=mesh.normals;
  if(normals?.type==='f32vec3'&&!normals.lz4&&Number.isFinite(normals.count)&&normals.offset>=0&&normals.offset+normals.count*12<=bin.length){
    const sourceView=new DataView(donorBin.buffer,donorBin.byteOffset,donorBin.byteLength);
    for(let i=0;i<normals.count;i++){
      const o=normals.offset+i*12,nx=sourceView.getFloat32(o,true),ny=sourceView.getFloat32(o+4,true),nz=sourceView.getFloat32(o+8,true);
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

function fieldLike(seed,type,count,offset,length){
  const out=seed?clone(seed):{};
  out.type=type;out.count=count;out.offset=offset;out.length=length;out.lz4=false;
  return out;
}

function mergeTrianglePair(a,b){
  const edges=[[a[0],a[1]],[a[1],a[2]],[a[2],a[0]],[b[0],b[1]],[b[1],b[2]],[b[2],b[0]]],border=[];
  for(let i=0;i<edges.length;i++){const [from,to]=edges[i];if(!edges.some((edge,j)=>j!==i&&edge[0]===to&&edge[1]===from))border.push([from,to])}
  if(border.length!==4)return null;
  const quad=[border[0][0],border[0][1]];
  while(quad.length<4){const next=border.find(edge=>edge[0]===quad.at(-1)&&!quad.includes(edge[1]));if(!next)return null;quad.push(next[1])}
  return border.some(edge=>edge[0]===quad[3]&&edge[1]===quad[0])?quad:null;
}

function outlineMeshPart(item,donorMesh,THREE){
  const g=item.mesh.geometry,pos=g.getAttribute('position'),index=g.index;
  if(!pos||pos.count<3||!index||index.count<3)throw Error('Outline Balloon has no indexed triangle mesh to export');
  item.mesh.updateMatrixWorld(true);
  const normalAttr=g.getAttribute('normal'),normalMatrix=new THREE.Matrix3().getNormalMatrix(item.mesh.matrixWorld);
  const vertexBytes=new Uint8Array(pos.count*12),vDv=new DataView(vertexBytes.buffer),v=new THREE.Vector3(),n=new THREE.Vector3();
  const normalBytes=new Uint8Array(pos.count*12),nDv=new DataView(normalBytes.buffer);
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).applyMatrix4(item.mesh.matrixWorld);
    let o=i*12;vDv.setFloat32(o,v.x,true);vDv.setFloat32(o+4,v.y,true);vDv.setFloat32(o+8,v.z,true);
    if(normalAttr)n.fromBufferAttribute(normalAttr,i).applyNormalMatrix(normalMatrix).normalize();else n.set(0,1,0);
    nDv.setFloat32(o,n.x,true);nDv.setFloat32(o+4,n.y,true);nDv.setFloat32(o+8,n.z,true);
  }
  const triangles=[];for(let i=0;i<index.count;i+=3)triangles.push([index.getX(i),index.getX(i+1),index.getX(i+2)]);
  const quads=[];for(let i=0;i<triangles.length;){const quad=i+1<triangles.length?mergeTrianglePair(triangles[i],triangles[i+1]):null;if(quad){quads.push(quad);i+=2}else{const [a,b,c]=triangles[i++];quads.push([a,b,c,c])}}
  const faceCount=quads.length,faceBytes=new Uint8Array(faceCount*16),fDv=new DataView(faceBytes.buffer);
  for(let f=0;f<faceCount;f++){const o=f*16,q=quads[f];for(let j=0;j<4;j++)fDv.setInt32(o+j*4,q[j],true)}
  const uvBytes=new Uint8Array(pos.count*8),faceUvBytes=faceBytes.slice(),faceGroupBytes=new Uint8Array(faceCount*2);
  const bin=new Uint8Array(vertexBytes.length+normalBytes.length+uvBytes.length+faceBytes.length+faceUvBytes.length+faceGroupBytes.length);
  const normalOffset=vertexBytes.length,uvOffset=normalOffset+normalBytes.length,faceOffset=uvOffset+uvBytes.length,faceUvOffset=faceOffset+faceBytes.length,faceGroupOffset=faceUvOffset+faceUvBytes.length;
  bin.set(vertexBytes,0);bin.set(normalBytes,normalOffset);bin.set(uvBytes,uvOffset);bin.set(faceBytes,faceOffset);bin.set(faceUvBytes,faceUvOffset);bin.set(faceGroupBytes,faceGroupOffset);
  const mesh=clone(donorMesh);
  for(const key of Object.keys(mesh))if(key.startsWith('config_'))delete mesh[key];
  delete mesh.mesh_type;
  for(const key of DATA_FIELDS)delete mesh[key];
  mesh.name='Outline Balloon Mesh';
  mesh.count_vertex=pos.count;
  mesh.count_uv=pos.count;
  mesh.count_face=faceCount;
  mesh.vertices=fieldLike(donorMesh.vertices,'f32vec3',pos.count,0,vertexBytes.length);
  mesh.normals=fieldLike(donorMesh.normals,'f32vec3',pos.count,normalOffset,normalBytes.length);
  mesh.uvs=fieldLike(donorMesh.uvs,'f32vec2',pos.count,uvOffset,uvBytes.length);
  mesh.faces=fieldLike(donorMesh.faces,'i32vec4',faceCount,faceOffset,faceBytes.length);
  mesh.faces_uv=fieldLike(donorMesh.faces_uv,'i32vec4',faceCount,faceUvOffset,faceUvBytes.length);
  mesh.faces_group=fieldLike(donorMesh.faces_group,'u16',faceCount,faceGroupOffset,faceGroupBytes.length);
  return {mesh,bin,vertices:pos.count,faces:faceCount};
}

function makeNode(proto,name,meshIndex){
  const node=clone(proto);
  node.name=name;node.mesh=meshIndex;node.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];node.transform_reset=false;node.selected=false;node.selected_main=false;node.node_collapse=true;node.lock=false;node.children=[];node.visible=true;
  delete node.hid;delete node.group;
  return node;
}

export async function buildLiveNomadBalloon(items,THREE,options={}){
  const detail=(options.detail||'high').toLowerCase();
  const tubes=items.filter(x=>(x.settings.kind||'tube')==='tube'&&x.samples.length>=2);
  const outlines=items.filter(x=>x.settings.kind==='outline'&&(x.mesh.geometry.getAttribute('position')?.count||0)>=3&&x.mesh.geometry.index?.count>=3);
  if(!tubes.length&&!outlines.length)throw Error('Create at least one Tube or Outline Balloon before exporting NOM.');
  const base=await template(),donor=meshSlice(base,base.json.meshes[0]);
  if(!donor.bin.length)throw Error('Nomad Tube template has no usable donor mesh cache');
  const project=clone(base.json),binaryParts=[];project.meshes=[];
  const proto=findNode(base.json.scene,0)||{};
  const group={name:'MeshUtilz – Live Nomad Balloons',group:0,selected:true,selected_main:true,children:[],visible:true,node_collapse:false,lock:false};
  let sourcePoints=0,exportPoints=0,outlineVertices=0,outlineFaces=0;
  tubes.forEach((item,i)=>{
    const mesh=clone(donor.mesh),sourceConfig=clone(mesh.config_tube);
    const counts=configureTube(mesh,item,detail,THREE);sourcePoints+=counts.source;exportPoints+=counts.exported;
    const bin=deformTubeCache(donor.bin,mesh,sourceConfig,THREE),offset=binaryParts.reduce((n,p)=>n+p.length,0);
    offsetFields(mesh,offset);const meshIndex=project.meshes.length;project.meshes.push(mesh);binaryParts.push(bin);
    group.children.push(makeNode(proto,`Tube Balloon ${i+1}`,meshIndex));
  });
  outlines.forEach((item,i)=>{
    const part=outlineMeshPart(item,donor.mesh,THREE),offset=binaryParts.reduce((n,p)=>n+p.length,0);
    offsetFields(part.mesh,offset);const meshIndex=project.meshes.length;project.meshes.push(part.mesh);binaryParts.push(part.bin);
    outlineVertices+=part.vertices;outlineFaces+=part.faces;group.children.push(makeNode(proto,`Outline Balloon ${i+1}`,meshIndex));
  });
  project.scene=[group];
  const json=enc.encode(JSON.stringify(project)),binaryLength=binaryParts.reduce((n,b)=>n+b.length,0),binaryOffset=(base.jo+json.length+7)&~7,out=new Uint8Array(binaryOffset+binaryLength);
  out.set(base.bytes.slice(0,base.jo));out.set(json,base.jo);let at=binaryOffset;for(const part of binaryParts){out.set(part,at);at+=part.length}
  const dv=new DataView(out.buffer);w64(dv,16,out.length);w64(dv,24,base.jo);w64(dv,32,json.length);w64(dv,40,binaryOffset);w64(dv,48,binaryLength);
  return {bytes:out,count:tubes.length+outlines.length,tubeCount:tubes.length,outlineCount:outlines.length,sourcePoints,exportPoints,outlineVertices,outlineFaces,detail};
}
