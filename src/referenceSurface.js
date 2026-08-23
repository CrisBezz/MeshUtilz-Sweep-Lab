import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Raycast targets are separate from scene ownership, so future balloon surfaces
// can register here without changing the drawing pipeline.
export class SurfaceTargetRegistry {
  constructor(){this.targets=new Set();this.raycaster=new THREE.Raycaster()}
  register(root){this.targets.add(root);return root}
  unregister(root){this.targets.delete(root)}
  clear(){this.targets.clear()}
  hitFromRay(sourceRay,excluded=null){
    const roots=[...this.targets].filter(root=>root!==excluded);if(!roots.length)return null;
    this.raycaster.ray.copy(sourceRay);
    const hit=this.raycaster.intersectObjects(roots,true)[0];
    if(!hit||!hit.face)return null;
    hit.object.updateWorldMatrix(true,false);
    const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    return {position:hit.point.clone(),normal,object:hit.object,distance:hit.distance};
  }
}

export async function loadReferenceMesh(file){
  const url=URL.createObjectURL(file),lower=file.name.toLowerCase();
  try{
    let root;
    if(lower.endsWith('.obj'))root=await new OBJLoader().loadAsync(url);
    else if(lower.endsWith('.glb')||lower.endsWith('.gltf'))root=(await new GLTFLoader().loadAsync(url)).scene;
    else throw new Error('Choose an OBJ, GLB, or GLTF file.');
    root.name=`Reference: ${file.name}`;
    const materials=[];
    root.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshStandardMaterial({color:0x5ea6d8,roughness:.62,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false,wireframe:!!window.MESHUTILZ_REFERENCE_WIREFRAME});materials.push(o.material);o.renderOrder=-1}});
    window.__meshutilzReferenceMaterials=materials;
    return root;
  } finally {URL.revokeObjectURL(url)}
}
