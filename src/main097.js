// Balloon v0.9.7 overlay: persistent object naming without disturbing the validated v0.9.6 core.
const here=import.meta.url;
let overlay=await (await fetch(new URL('./main095.js?base=096',here),{cache:'no-store'})).text();

// main095 is executed from a Blob below, so resolve every URL it constructs back to repository files.
const abs=p=>JSON.stringify(new URL(p,here).href);
overlay=overlay.replace("new URL('./main.js?base=094',import.meta.url)",`new URL(${abs('./main.js?base=094')})`);
overlay=overlay.replace("new URL('./balloonGeometry.js',import.meta.url)",`new URL(${abs('./balloonGeometry.js')})`);
overlay=overlay.replace("new URL('./outlineGeometry.js',import.meta.url)",`new URL(${abs('./outlineGeometry.js')})`);
overlay=overlay.replace("new URL('./referenceSurface.js',import.meta.url)",`new URL(${abs('./referenceSurface.js')})`);
overlay=overlay.replace("new URL('./nomadBalloonExport095.js?v=095',import.meta.url)",`new URL(${abs('./nomadBalloonExport097.js?v=097')})`);
overlay=overlay.replaceAll('v0.9.6 core patch failed','v0.9.7 core patch failed');
overlay=overlay.replace("src=src.replaceAll('v0.9.1','v0.9.6');","src=src.replaceAll('v0.9.1','v0.9.7');");
overlay=overlay.replace("src=src.replaceAll('0.9.1','0.9.6');","src=src.replaceAll('0.9.1','0.9.7');");
overlay=overlay.replace("formatVersion:2,appVersion:'0.9.6'","formatVersion:2,appVersion:'0.9.7'");

const marker='const blobUrl=URL.createObjectURL(new Blob([src],{type:\'text/javascript\'}));';
if(!overlay.includes(marker))throw new Error('v0.9.7 overlay insertion point missing');
const extra=String.raw`
// v0.9.7 persistent object names.
mustRe(
/function addItem\(samples,settings=uiSettings\(\),autoSelect=true,registerSurface=true\)\{.*?return x\}/s,
\`function addItem(samples,settings=uiSettings(),autoSelect=true,registerSurface=true){const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material()),baseWidth=settings.baseWidth??settings.width??(+$('#width').value),merged={kind:'tube',bulge:.18,endSoft:.65,loop:false,caps:true,...settings,baseWidth};if(!String(merged.name||'').trim())merged.name=\\\`\\${merged.kind==='outline'?'Outline':'Tube'} Balloon \\${items.length+1}\\\`;const x={samples,settings:merged,mesh};items.push(x);scene.add(mesh);rebuild(x);if(registerSurface)surfaceTargets.register(mesh);if(autoSelect)select(x);return x}\`,
'object naming'
);
must(
\`$('#selectionLabel').textContent=on?\\\`Selected \\${selected.settings.kind==='outline'?'outline':'tube'} balloon \\${items.indexOf(selected)+1}\\\`:'No balloon selected'\`,
\`$('#selectionLabel').textContent=on?(selected.settings.name||\\\`\\${selected.settings.kind==='outline'?'Outline':'Tube'} Balloon \\${items.indexOf(selected)+1}\\\`):'No balloon selected'\`,
'selection name'
);
must(
\`$('#duplicateBtn').onclick=()=>{if(!selected)return;checkpoint();const copy=addItem(selected.samples.map(cloneSample),{...selected.settings},true);copy.mesh.position.y+=.18;setOrbitPivot(copy);refreshExport()};\`,
\`$('#duplicateBtn').onclick=()=>{if(!selected)return;checkpoint();const copy=addItem(selected.samples.map(cloneSample),{...selected.settings,name:\\\`\\${selected.settings.name||'Balloon'} Copy\\\`},true);copy.mesh.position.y+=.18;setOrbitPivot(copy);refreshExport()};\`,
'duplicate name'
);
must(
\`out+=\\\`o \\${x.settings.kind==='outline'?'Outline':'Tube'}_Balloon_\\${i+1}\\n\\\`;\`,
\`const objectName=String(x.settings.name||\\\`\\${x.settings.kind==='outline'?'Outline':'Tube'} Balloon \\${i+1}\\\`).trim().replace(/\\s+/g,'_').replace(/[^A-Za-z0-9_.-]/g,'_');out+=\\\`o \\${objectName}\\n\\\`;\`,
'OBJ object names'
);
must(
\`list:()=>items.map((x,index)=>({index,kind:x.settings.kind||'tube',visible:x.mesh.visible!==false,selected:x===selected})),\`,
\`list:()=>items.map((x,index)=>({index,kind:x.settings.kind||'tube',name:x.settings.name||\\\`\\${x.settings.kind==='outline'?'Outline':'Tube'} Balloon \\${index+1}\\\`,visible:x.mesh.visible!==false,selected:x===selected})),\n  renameIndex:(index,name)=>{const x=items[index];if(!x)return false;const clean=String(name||'').trim();if(!clean)return false;checkpoint();x.settings.name=clean;updateSelectionUI();refreshExport();status.textContent=\\\`Renamed to \\${clean}\\\`;return true},\`,
'outliner rename API'
);
`;
overlay=overlay.replace(marker,extra+'\n'+marker);

const url=URL.createObjectURL(new Blob([overlay],{type:'text/javascript'}));
try{await import(url)}finally{URL.revokeObjectURL(url)}
