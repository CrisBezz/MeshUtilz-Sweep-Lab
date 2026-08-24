// Balloon NOM exporter overlay.
// Keeps the validated v0.8.4 exporter architecture untouched while adding
// per-point radiusScale support and v1.1.3 workflow naming.
const baseUrl=new URL('./nomadBalloonExport.js?base=0862',import.meta.url);
let src=await (await fetch(baseUrl,{cache:'no-store'})).text();

const patch=(oldText,newText,label)=>{
  if(!src.includes(oldText))throw new Error(`NOM workflow patch failed: ${label}`);
  src=src.replace(oldText,newText);
};

patch(
  `let radius=(settings.width??.42)*.5*pressureFactor*inflation;`,
  `let radius=(settings.width??.42)*.5*pressureFactor*inflation*Math.max(.02,sample.radiusScale??1);`,
  'per-point radius'
);

// Read the current Outliner names at export time. This does not modify the
// modelling items or the validated NOM binary/cache construction.
patch(
  `export async function buildLiveNomadBalloon(items,THREE,options={}){\n  const detail=(options.detail||'high').toLowerCase();`,
  `export async function buildLiveNomadBalloon(items,THREE,options={}){\n  const detail=(options.detail||'high').toLowerCase();\n  const workflowNames=(window.MeshUtilzOutlinerAPI?.list?.()||[]).map(x=>String(x.name||''));`,
  'Outliner name capture'
);

// Give both the procedural Tube mesh and its Nomad scene node the Outliner name.
patch(
  `  mesh.name='Live Tube Balloon';`,
  `  mesh.name=String(item.exportName||'Live Tube Balloon');`,
  'Tube mesh name'
);
patch(
  `  tubes.forEach((item,i)=>{\n    const mesh=clone(donor.mesh),sourceConfig=clone(mesh.config_tube);`,
  `  tubes.forEach((sourceItem,i)=>{\n    const sourceIndex=items.indexOf(sourceItem),exportName=workflowNames[sourceIndex]||\`Tube Balloon \${i+1}\`,item={...sourceItem,exportName};\n    const mesh=clone(donor.mesh),sourceConfig=clone(mesh.config_tube);`,
  'Tube export name'
);
patch(
  `    group.children.push(makeNode(proto,\`Tube Balloon \${i+1}\`,meshIndex));`,
  `    group.children.push(makeNode(proto,exportName,meshIndex));`,
  'Tube node name'
);

// Outline Balloons remain fixed meshes; only their Nomad mesh/node names change.
patch(
  `  outlines.forEach((item,i)=>{\n    const part=outlineMeshPart(item,donor.mesh,THREE),offset=binaryParts.reduce((n,p)=>n+p.length,0);`,
  `  outlines.forEach((item,i)=>{\n    const sourceIndex=items.indexOf(item),exportName=workflowNames[sourceIndex]||\`Outline Balloon \${i+1}\`;\n    const part=outlineMeshPart(item,donor.mesh,THREE),offset=binaryParts.reduce((n,p)=>n+p.length,0);\n    part.mesh.name=exportName;`,
  'Outline export name'
);
patch(
  `    outlineVertices+=part.vertices;outlineFaces+=part.faces;group.children.push(makeNode(proto,\`Outline Balloon \${i+1}\`,meshIndex));`,
  `    outlineVertices+=part.vertices;outlineFaces+=part.faces;group.children.push(makeNode(proto,exportName,meshIndex));`,
  'Outline node name'
);

const blobUrl=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
let mod;
try{mod=await import(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}
export const buildLiveNomadBalloon=mod.buildLiveNomadBalloon;
