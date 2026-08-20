import * as THREE from 'three';

export function makeProfile(type,size,sides=12){
 const r=size/2, pts=[];
 if(type==='circle'){for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;pts.push(new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r));}}
 else if(type==='triangle'){for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2;pts.push(new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r));}}
 else if(type==='rectangle'){pts.push(new THREE.Vector2(-r,-r*.55),new THREE.Vector2(r,-r*.55),new THREE.Vector2(r,r*.55),new THREE.Vector2(-r,r*.55));}
 else pts.push(new THREE.Vector2(-r,-r),new THREE.Vector2(r,-r),new THREE.Vector2(r,r),new THREE.Vector2(-r,r));
 return pts;
}

export function buildSweep(path,profile,{caps=true}={}){
 if(path.length<2||profile.length<3)return new THREE.BufferGeometry();
 const verts=[], idx=[], n=profile.length;
 const up=new THREE.Vector3(0,1,0), side=new THREE.Vector3(), binormal=new THREE.Vector3();
 for(let i=0;i<path.length;i++){
  const tangent=(i===0?path[1].clone().sub(path[0]):i===path.length-1?path[i].clone().sub(path[i-1]):path[i+1].clone().sub(path[i-1])).normalize();
  side.crossVectors(up,tangent);
  if(side.lengthSq()<1e-8)side.set(1,0,0); else side.normalize();
  binormal.crossVectors(tangent,side).normalize();
  for(const p of profile){const v=path[i].clone().addScaledVector(side,p.x).addScaledVector(binormal,p.y);verts.push(v.x,v.y,v.z);}
 }
 for(let i=0;i<path.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+(j+1)%n,d=(i+1)*n+j;idx.push(a,b,d,b,c,d);}
 if(caps){const start=verts.length/3;verts.push(path[0].x,path[0].y,path[0].z);const end=verts.length/3;const q=path[path.length-1];verts.push(q.x,q.y,q.z);for(let j=0;j<n;j++){idx.push(start,(j+1)%n,j);const a=(path.length-1)*n+j,b=(path.length-1)*n+(j+1)%n;idx.push(end,a,b);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;
}