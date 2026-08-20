import * as THREE from 'three';

function project(p,plane){
  if(plane==='XY') return new THREE.Vector2(p.x,p.y);
  if(plane==='YZ') return new THREE.Vector2(p.y,p.z);
  return new THREE.Vector2(p.x,p.z);
}

function unproject(p,plane,offset=0){
  if(plane==='XY') return new THREE.Vector3(p.x,p.y,offset);
  if(plane==='YZ') return new THREE.Vector3(offset,p.x,p.y);
  return new THREE.Vector3(p.x,offset,p.y);
}

export function simplifyOutline(points,plane,minDistance=.035,maxPoints=180){
  if(!points?.length) return [];
  const src=points.map(p=>project(p,plane));
  const kept=[src[0].clone()];
  for(let i=1;i<src.length;i++){
    if(src[i].distanceTo(kept.at(-1))>=minDistance) kept.push(src[i].clone());
  }
  if(kept.length>maxPoints){
    const step=(kept.length-1)/(maxPoints-1), reduced=[];
    for(let i=0;i<maxPoints;i++) reduced.push(kept[Math.round(i*step)].clone());
    return reduced;
  }
  return kept;
}

export function buildDrawMesh(points,plane='XZ',depth=.3){
  let contour=simplifyOutline(points,plane);
  if(contour.length<3) return new THREE.BufferGeometry();
  if(contour[0].distanceTo(contour.at(-1))<.04) contour.pop();
  if(contour.length<3) return new THREE.BufferGeometry();
  if(THREE.ShapeUtils.isClockWise(contour)) contour=contour.slice().reverse();

  const triangles=THREE.ShapeUtils.triangulateShape(contour,[]);
  if(!triangles.length) return new THREE.BufferGeometry();

  const half=Math.max(.001,depth/2), verts=[], idx=[], n=contour.length;
  for(const p of contour){ const v=unproject(p,plane,-half); verts.push(v.x,v.y,v.z); }
  for(const p of contour){ const v=unproject(p,plane, half); verts.push(v.x,v.y,v.z); }

  for(const t of triangles){
    const [a,b,c]=t;
    idx.push(a,c,b);
    idx.push(a+n,b+n,c+n);
  }
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    idx.push(i,j,i+n, j,j+n,i+n);
  }

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.userData.outline=contour.map(p=>[p.x,p.y]);
  g.userData.plane=plane;
  return g;
}
