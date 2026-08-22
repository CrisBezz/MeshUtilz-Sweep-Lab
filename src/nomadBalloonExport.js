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
function lz4Literal(raw){const extra=raw.length>=15?Math.floor((raw.length-15)/255)+1:0,out=new Uint8Array(9+extra+raw.length),dv=new DataView(out.buffer);dv.setUint32(0,raw.length,true);dv.setUint32(4,out.length-8,true);let o=8;out[o++]=Math.min(raw.length,15)<<4;if(raw.length>=15){let n=raw.length-15;while(n>=255){out[o++]=255;n-=255}out[o++]=n}out.set(raw,o);return out}
function bytes(view){return new Uint8Array(view.buffer,view.byteOffset,view.byteLength)}
function cacheTube(mesh,THREE){
  const cfg=mesh.config_tube,points=cfg.curve.points.map(p=>new THREE.Vector3(...p)),closed=!!cfg.curve.closed;
  const rings=Math.max(8,Math.min(420,+cfg.subdiv_y||points.length*5)),sides=Math.max(6,Math.min(96,+cfg.subdiv_x||16));
  const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal',.5),frames=curve.computeFrenetFrames(closed?rings:rings-1,closed),pos=[],uv=[],faces=[];
  for(let i=0;i<rings;i++){const u=closed?i/rings:i/(rings-1),p=curve.getPointAt(u),ri=Math.min(cfg.radiuses.length-1,Math.floor(u*cfg.radiuses.length)),radius=cfg.radiuses[Math.max(0,ri)]??.1,n=frames.normals[i],b=frames.binormals[i];for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,v=p.clone().addScaledVector(n,Math.cos(a)*radius).addScaledVector(b,Math.sin(a)*radius);pos.push(v.x,v.y,v.z);uv.push(j/sides,u)}}
  for(let i=0;i<(closed?rings:rings-1);i++)for(let j=0;j<sides;j++){const next=(i+1)%rings,nj=(j+1)%sides;faces.push(i*sides+j,i*sides+nj,next*sides+nj,next*sides+j)}
  const rawPos=bytes(new Float32Array(pos)),rawUv=bytes(new Float32Array(uv)),rawFaces=bytes(new Int32Array(faces)),rawGroups=bytes(new Uint16Array(faces.length/4)),parts=[];
  const add=(name,raw,type,count,compressed=false)=>{const data=compressed?lz4Literal(raw):raw,offset=parts.reduce((n,p)=>n+p.length,0);mesh[name]={count,type,offset,length:data.length};if(compressed)mesh[name].lz4=true;if(name==='faces_group')mesh[name].only_zeros=true;parts.push(data)};
  mesh.count_vertex=pos.length/3;mesh.count_uv=uv.length/2;mesh.count_face=faces.length/4;
  add('vertices',rawPos,'f32vec3',mesh.count_vertex);add('uvs',rawUv,'f32vec2',mesh.count_uv);add('faces',rawFaces,'i32vec4',mesh.count_face,true);add('faces_uv',rawFaces,'i32vec4',mesh.count_face,true);add('faces_group',rawGroups,'u16',mesh.count_face,true);
  const bin=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const part of parts){bin.set(part,at);at+=part.length}return bin;
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
  cfg.subdiv_x=Math.max(8,settings.sides||16);
  cfg.subdiv_y=Math.min(420,Math.max(8,samples.length*Math.max(2,settings.smooth||5)));
  mesh.name='Live Tube Balloon';
}
export async function buildLiveNomadBalloon(items,THREE){
  const tubes=items.filter(x=>(x.settings.kind||'tube')==='tube'&&x.samples.length>=2);
  if(!tubes.length)throw Error('Create at least one Tube Balloon before exporting Live NOM.');
  const base=await template(),project=clone(base.json),binaryParts=[];
  project.meshes=[];
  const group={name:'MeshUtilz – Live Nomad Balloons',group:0,selected:true,selected_main:true,children:[]};
  tubes.forEach((item,i)=>{
    const mesh=clone(base.json.meshes[0]);configureTube(mesh,item,THREE);const bin=cacheTube(mesh,THREE),offset=binaryParts.reduce((n,p)=>n+p.length,0);for(const field of['vertices','uvs','faces','faces_uv','faces_group'])mesh[field].offset+=offset;project.meshes.push(mesh);binaryParts.push(bin);
    group.children.push({name:`Tube Balloon ${i+1}`,mesh:i,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],transform_reset:false,selected:false,selected_main:false,node_collapse:true,lock:false,children:[],visible:true});
  });
  project.scene=[group];
  const json=enc.encode(JSON.stringify(project)),binaryLength=binaryParts.reduce((n,b)=>n+b.length,0),binaryOffset=(base.jo+json.length+7)&~7,out=new Uint8Array(binaryOffset+binaryLength);
  out.set(base.bytes.slice(0,base.jo));out.set(json,base.jo);let at=binaryOffset;for(const part of binaryParts){out.set(part,at);at+=part.length}
  const dv=new DataView(out.buffer);w64(dv,16,out.length);w64(dv,24,base.jo);w64(dv,32,json.length);w64(dv,40,binaryOffset);w64(dv,48,binaryLength);
  return {bytes:out,count:tubes.length};
}
