// Balloon v0.9.5 NOM exporter overlay.
// Keeps the validated exporter untouched and adds per-point radiusScale support.
const baseUrl=new URL('./nomadBalloonExport.js?base=0862',import.meta.url);
let src=await (await fetch(baseUrl,{cache:'no-store'})).text();
const old=`let radius=(settings.width??.42)*.5*pressureFactor*inflation;`;
const neu=`let radius=(settings.width??.42)*.5*pressureFactor*inflation*Math.max(.02,sample.radiusScale??1);`;
if(!src.includes(old))throw new Error('v0.9.5 NOM radius patch failed');
src=src.replace(old,neu);
const blobUrl=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
let mod;
try{mod=await import(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}
export const buildLiveNomadBalloon=mod.buildLiveNomadBalloon;
