import * as THREE from 'three';

function polygonNormal(points){
  const n=new THREE.Vector3();
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    n.x+=(a.y-b.y)*(a.z+b.z);
    n.y+=(a.z-b.z)*(a.x+b.x);
    n.z+=(a.x-b.x)*(a.y+b.y);
  }
  if(n.lengthSq()<1e-10){
    for(let i=1;i<points.length-1;i++){
      n.crossVectors(points[i].clone().sub(points[0]),points[i+1].clone().sub(points[0]));
      if(n.lengthSq()>1e-10)break;
    }
  }
  return n.lengthSq()>1e-10?n.normalize():new THREE.Vector3(0,0,1);
}

function simplifyClosed(points,minDistance){
  if(points.length<3)return points.slice();
  const out=[points[0].clone()];
  for(let i=1;i<points.length;i++){
    if(points[i].distanceTo(out.at(-1))>=minDistance)out.push(points[i].clone());
  }
  if(out.length>3&&out.at(-1).distanceTo(out[0])<minDistance)out.pop();
  return out;
}

export function buildOutlineBalloon(points,{depth=.42,roundness=.18,smooth=5}={}){
  if(points.length<3)return new THREE.BufferGeometry();

  const simplified=simplifyClosed(points,Math.max(.018,depth*.045));
  if(simplified.length<3)return new THREE.BufferGeometry();

  const normal=polygonNormal(simplified);
  const origin=new THREE.Vector3();
  simplified.forEach(p=>origin.add(p));origin.multiplyScalar(1/simplified.length);

  let u=simplified[1].clone().sub(simplified[0]).projectOnPlane(normal);
  if(u.lengthSq()<1e-10){
    u=Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0).cross(normal):new THREE.Vector3(1,0,0).cross(normal);
  }
  u.normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize();

  let pts2=simplified.map(p=>new THREE.Vector2(p.clone().sub(origin).dot(u),p.clone().sub(origin).dot(v)));
  const curve=new THREE.CatmullRomCurve3(pts2.map(p=>new THREE.Vector3(p.x,p.y,0)),true,'centripetal',.45);
  const target=Math.max(16,Math.min(220,pts2.length*Math.max(2,smooth)));
  pts2=curve.getPoints(target).slice(0,-1).map(p=>new THREE.Vector2(p.x,p.y));

  const area=THREE.ShapeUtils.area(pts2);
  if(Math.abs(area)<1e-5)return new THREE.BufferGeometry();
  if(area<0)pts2.reverse();

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  pts2.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)});
  const minSpan=Math.max(.02,Math.min(maxX-minX,maxY-minY));
  const d=Math.max(.02,depth);
  const bevelSize=Math.min(minSpan*.18,d*(.22+.38*roundness));
  const bevelThickness=Math.min(d*.42,d*(.22+.38*roundness));
  const coreDepth=Math.max(.01,d-2*bevelThickness);

  const shape=new THREE.Shape();
  shape.moveTo(pts2[0].x,pts2[0].y);
  for(let i=1;i<pts2.length;i++)shape.lineTo(pts2[i].x,pts2[i].y);
  shape.closePath();

  const g=new THREE.ExtrudeGeometry(shape,{
    depth:coreDepth,
    steps:1,
    curveSegments:1,
    bevelEnabled:true,
    bevelSegments:Math.max(3,Math.min(10,Math.round(3+roundness*8))),
    bevelSize,
    bevelThickness,
    bevelOffset:0
  });
  g.translate(0,0,-coreDepth/2);

  const basis=new THREE.Matrix4().makeBasis(u,v,normal);
  basis.setPosition(origin);
  g.applyMatrix4(basis);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
