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

function pointInPolygon(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    const cross=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-12)+a.x);
    if(cross)inside=!inside;
  }
  return inside;
}

function pointSegmentDistance(p,a,b){
  const ab=b.clone().sub(a),den=ab.lengthSq();
  if(den<1e-12)return p.distanceTo(a);
  const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/den,0,1);
  return p.distanceTo(a.clone().addScaledVector(ab,t));
}

function interiorCenter(poly){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  poly.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)});
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  let best=new THREE.Vector2(cx,cy),bestD=-1;
  const steps=22;
  for(let iy=0;iy<=steps;iy++)for(let ix=0;ix<=steps;ix++){
    const p=new THREE.Vector2(THREE.MathUtils.lerp(minX,maxX,ix/steps),THREE.MathUtils.lerp(minY,maxY,iy/steps));
    if(!pointInPolygon(p,poly))continue;
    let d=Infinity;
    for(let i=0;i<poly.length;i++)d=Math.min(d,pointSegmentDistance(p,poly[i],poly[(i+1)%poly.length]));
    if(d>bestD){bestD=d;best.copy(p)}
  }
  return best;
}

export function buildOutlineBalloon(points,{depth=.42,roundness=.18,smooth=5}={}){
  if(points.length<3)return new THREE.BufferGeometry();

  const simplified=simplifyClosed(points,Math.max(.018,depth*.045));
  if(simplified.length<3)return new THREE.BufferGeometry();

  const normal=polygonNormal(simplified);
  const origin=new THREE.Vector3();
  simplified.forEach(p=>origin.add(p));origin.multiplyScalar(1/simplified.length);

  let u=simplified[1].clone().sub(simplified[0]).projectOnPlane(normal);
  if(u.lengthSq()<1e-10)u=Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0).cross(normal):new THREE.Vector3(1,0,0).cross(normal);
  u.normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize();

  let pts2=simplified.map(p=>new THREE.Vector2(p.clone().sub(origin).dot(u),p.clone().sub(origin).dot(v)));
  const curve=new THREE.CatmullRomCurve3(pts2.map(p=>new THREE.Vector3(p.x,p.y,0)),true,'centripetal',.45);
  const target=Math.max(24,Math.min(180,pts2.length*Math.max(2,smooth)));
  pts2=curve.getPoints(target).slice(0,-1).map(p=>new THREE.Vector2(p.x,p.y));

  const area=THREE.ShapeUtils.area(pts2);
  if(Math.abs(area)<1e-5)return new THREE.BufferGeometry();
  if(area<0)pts2.reverse();

  const center=interiorCenter(pts2);
  const half=Math.max(.01,depth*.5);
  const rings=Math.max(10,Math.min(22,Math.round(12+roundness*10)));
  const verts=[],idx=[];
  const ringCount=pts2.length;

  // Elliptical section from outline to pole. Using scale=cos(theta), z=sin(theta)
  // gives the front/back skins a vertical tangent at the seam, so they meet smoothly
  // instead of forming a sharp crease around the drawn outline.
  for(let side=0;side<2;side++){
    const sign=side===0?1:-1;
    for(let r=0;r<rings;r++){
      const t=r/(rings-1);
      const theta=t*Math.PI*.5;
      const scale=Math.cos(theta);
      const z=sign*half*Math.sin(theta);
      for(let i=0;i<ringCount;i++){
        const q=center.clone().lerp(pts2[i],scale);
        verts.push(q.x,q.y,z);
      }
    }
    const pole=verts.length/3;
    verts.push(center.x,center.y,sign*half);
    for(let r=0;r<rings-1;r++){
      const a0=side*(rings*ringCount+1)+r*ringCount;
      const b0=a0+ringCount;
      for(let i=0;i<ringCount;i++){
        const ni=(i+1)%ringCount,a=a0+i,b=a0+ni,c=b0+ni,d=b0+i;
        if(side===0)idx.push(a,b,d,b,c,d);else idx.push(a,d,b,b,d,c);
      }
    }
    const last0=side*(rings*ringCount+1)+(rings-1)*ringCount;
    for(let i=0;i<ringCount;i++){
      const ni=(i+1)%ringCount;
      if(side===0)idx.push(last0+i,last0+ni,pole);else idx.push(last0+ni,last0+i,pole);
    }
  }

  const bottomStart=rings*ringCount+1;
  for(let i=0;i<ringCount;i++){
    const ni=(i+1)%ringCount,a=i,b=ni,c=bottomStart+ni,d=bottomStart+i;
    idx.push(a,d,b,b,d,c);
  }

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(idx);
  g.computeVertexNormals();

  const basis=new THREE.Matrix4().makeBasis(u,v,normal);basis.setPosition(origin);g.applyMatrix4(basis);
  g.computeBoundingSphere();
  return g;
}
