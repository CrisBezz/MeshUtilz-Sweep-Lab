import * as THREE from 'three';

function computeFrames(path){
  const tangents=[], normals=[], binormals=[];
  for(let i=0;i<path.length;i++){
    const t=(i===0?path[1].clone().sub(path[0]):i===path.length-1?path[i].clone().sub(path[i-1]):path[i+1].clone().sub(path[i-1])).normalize();
    tangents.push(t);
  }
  let seed=Math.abs(tangents[0].y)<0.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  normals[0]=new THREE.Vector3().crossVectors(seed,tangents[0]).normalize();
  binormals[0]=new THREE.Vector3().crossVectors(tangents[0],normals[0]).normalize();
  for(let i=1;i<path.length;i++){
    const axis=new THREE.Vector3().crossVectors(tangents[i-1],tangents[i]);
    normals[i]=normals[i-1].clone();
    if(axis.lengthSq()>1e-10){
      axis.normalize();
      const angle=Math.acos(THREE.MathUtils.clamp(tangents[i-1].dot(tangents[i]),-1,1));
      normals[i].applyAxisAngle(axis,angle).normalize();
    }
    binormals[i]=new THREE.Vector3().crossVectors(tangents[i],normals[i]).normalize();
  }
  return {tangents,normals,binormals};
}

export function smoothRadii(values,passes=2){
  let out=values.slice();
  for(let p=0;p<passes;p++){
    const next=out.slice();
    for(let i=1;i<out.length-1;i++) next[i]=(out[i-1]+out[i]*2+out[i+1])/4;
    out=next;
  }
  return out;
}

export function buildBalloon(path,radii,{sides=16,capRings=5}={}){
  if(path.length<2)return new THREE.BufferGeometry();
  const {tangents,normals,binormals}=computeFrames(path);
  const verts=[],idx=[];
  const ringMeta=[];
  const pushRing=(center,n,b,r)=>{
    const start=verts.length/3;
    for(let j=0;j<sides;j++){
      const a=j/sides*Math.PI*2;
      const v=center.clone().addScaledVector(n,Math.cos(a)*r).addScaledVector(b,Math.sin(a)*r);
      verts.push(v.x,v.y,v.z);
    }
    ringMeta.push(start);
  };

  // Rounded start cap: pole -> expanding latitude rings.
  const startR=Math.max(0.001,radii[0]);
  const startT=tangents[0],startN=normals[0],startB=binormals[0];
  const startPole=path[0].clone().addScaledVector(startT,-startR);
  const startPoleIndex=verts.length/3;verts.push(startPole.x,startPole.y,startPole.z);
  for(let k=1;k<=capRings;k++){
    const u=k/(capRings+1),theta=u*Math.PI/2;
    const center=path[0].clone().addScaledVector(startT,-Math.cos(theta)*startR);
    pushRing(center,startN,startB,Math.sin(theta)*startR);
  }

  // Main rings.
  const mainRingStart=ringMeta.length;
  for(let i=0;i<path.length;i++) pushRing(path[i],normals[i],binormals[i],Math.max(0.001,radii[i]));

  // Rounded end cap.
  const endR=Math.max(0.001,radii[radii.length-1]);
  const endT=tangents.at(-1),endN=normals.at(-1),endB=binormals.at(-1),endP=path.at(-1);
  for(let k=1;k<=capRings;k++){
    const u=k/(capRings+1),theta=u*Math.PI/2;
    const center=endP.clone().addScaledVector(endT,Math.cos(theta)*endR);
    pushRing(center,endN,endB,Math.cos(theta)*endR);
  }
  const endPole=endP.clone().addScaledVector(endT,endR);
  const endPoleIndex=verts.length/3;verts.push(endPole.x,endPole.y,endPole.z);

  // Start pole fan.
  const firstRing=ringMeta[0];
  for(let j=0;j<sides;j++) idx.push(startPoleIndex,firstRing+(j+1)%sides,firstRing+j);
  // Ring connections.
  for(let r=0;r<ringMeta.length-1;r++){
    const a0=ringMeta[r],b0=ringMeta[r+1];
    for(let j=0;j<sides;j++){
      const a=a0+j,b=a0+(j+1)%sides,c=b0+(j+1)%sides,d=b0+j;
      idx.push(a,b,d,b,c,d);
    }
  }
  // End fan.
  const lastRing=ringMeta.at(-1);
  for(let j=0;j<sides;j++) idx.push(endPoleIndex,lastRing+j,lastRing+(j+1)%sides);

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();
  return g;
}
