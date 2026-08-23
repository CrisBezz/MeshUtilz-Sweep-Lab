// v0.9.7 wrapper around the validated live NOM exporter.
// Geometry/cache generation remains untouched; this only updates exported node/mesh names.
import {buildLiveNomadBalloon as buildBase} from './nomadBalloonExport095.js?v=095';
const dec=new TextDecoder(),enc=new TextEncoder();
const u64=(dv,o)=>Number(dv.getBigUint64(o,true));
const w64=(dv,o,n)=>dv.setBigUint64(o,BigInt(n),true);

function validItems(items){
  const tubes=items.filter(x=>(x.settings.kind||'tube')==='tube'&&x.samples.length>=2);
  const outlines=items.filter(x=>x.settings.kind==='outline'&&(x.mesh.geometry.getAttribute('position')?.count||0)>=3&&x.mesh.geometry.index?.count>=3);
  return tubes.concat(outlines);
}
function childNodes(scene){
  const out=[];
  function walk(nodes){for(const n of nodes||[]){if(Number.isInteger(n.mesh))out.push(n);walk(n.children)}}
  walk(scene);return out;
}

export async function buildLiveNomadBalloon(items,THREE,options={}){
  const result=await buildBase(items,THREE,options),bytes=result.bytes,dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const jo=u64(dv,24),jl=u64(dv,32),bo=u64(dv,40),bl=u64(dv,48),project=JSON.parse(dec.decode(bytes.slice(jo,jo+jl)));
  const ordered=validItems(items),nodes=childNodes(project.scene);
  ordered.forEach((item,i)=>{
    const fallback=`${(item.settings.kind||'tube')==='outline'?'Outline':'Tube'} Balloon ${i+1}`;
    const name=String(item.settings.name||fallback).trim()||fallback;
    if(nodes[i])nodes[i].name=name;
    if(project.meshes?.[i])project.meshes[i].name=name;
  });
  const json=enc.encode(JSON.stringify(project)),binary=bytes.slice(bo,bo+bl),newBo=(jo+json.length+7)&~7,out=new Uint8Array(newBo+binary.length);
  out.set(bytes.slice(0,jo));out.set(json,jo);out.set(binary,newBo);
  const odv=new DataView(out.buffer);w64(odv,16,out.length);w64(odv,24,jo);w64(odv,32,json.length);w64(odv,40,newBo);w64(odv,48,binary.length);
  return {...result,bytes:out};
}
