(()=>{
  const ready=fn=>document.readyState==='complete'?fn():addEventListener('load',fn,{once:true});
  ready(()=>{
    const $=s=>document.querySelector(s),aside=$('aside'),status=$('#status');
    if(!aside)return;
    const build=window.BALLOON_BUILD||'0.9.4';
    document.title=`MeshUtilz Balloon v${build}`;
    const header=$('header span');if(header)header.textContent=`Balloon v${build}`;

    const section=document.createElement('details');section.className='ui-section outliner-section';section.open=true;
    const summary=document.createElement('summary');summary.textContent='Outliner';
    const body=document.createElement('div');body.className='ui-section-body outliner-body';
    const toolbar=document.createElement('div');toolbar.className='outliner-toolbar';
    toolbar.innerHTML='<button id="outlinerShowAll">Show All</button><button id="outlinerHideAll">Hide All</button><button id="outlinerSolo">Solo</button><select id="outlinerFilter"><option value="all">All</option><option value="tube">Tube</option><option value="outline">Outline</option></select>';
    const meta=document.createElement('div');meta.className='outliner-meta';
    const list=document.createElement('div');list.className='outliner-list';
    const empty=document.createElement('div');empty.className='outliner-empty';empty.textContent='No balloons yet';
    body.append(toolbar,meta,list,empty);section.append(summary,body);

    const sections=[...aside.querySelectorAll(':scope > .ui-section')];
    const project=sections.find(s=>s.querySelector(':scope > summary')?.textContent.trim()==='Project');
    if(project)project.insertAdjacentElement('afterend',section);else aside.prepend(section);

    let lastKey='',filter='all';
    const api=()=>window.MeshUtilzOutlinerAPI;
    function setVisibility(predicate,visible){const a=api();if(!a)return;for(const item of a.list())if(predicate(item)&&item.visible!==visible)a.toggleVisible(item.index);lastKey='';render()}
    $('#outlinerShowAll').onclick=()=>{setVisibility(()=>true,true);status.textContent='Outliner • all balloons shown'};
    $('#outlinerHideAll').onclick=()=>{setVisibility(()=>true,false);status.textContent='Outliner • all balloons hidden'};
    $('#outlinerSolo').onclick=()=>{const a=api();if(!a)return;const selected=a.list().find(x=>x.selected);if(!selected){status.textContent='Outliner • select a balloon to Solo';return}for(const item of a.list()){const should=item.index===selected.index;if(item.visible!==should)a.toggleVisible(item.index)}lastKey='';render();status.textContent=`Outliner • solo ${selected.kind} ${selected.index+1}`};
    $('#outlinerFilter').onchange=e=>{filter=e.target.value;lastKey='';render()};

    function render(){
      const a=api();if(!a)return;
      const all=a.list(),items=filter==='all'?all:all.filter(x=>x.kind===filter);
      const key=`${filter}|`+all.map(x=>`${x.index}:${x.kind}:${x.visible?1:0}:${x.selected?1:0}`).join('|');
      if(key===lastKey)return;lastKey=key;
      list.replaceChildren();empty.hidden=items.length>0;
      meta.textContent=`${all.length} balloon${all.length===1?'':'s'} • ${all.filter(x=>x.visible).length} visible`;
      for(const item of items){
        const row=document.createElement('div');row.className='outliner-row'+(item.selected?' selected':'')+(!item.visible?' hidden-item':'');
        row.dataset.index=item.index;
        const selectBtn=document.createElement('button');selectBtn.className='outliner-select';
        const kind=item.kind==='outline'?'Outline':'Tube';
        selectBtn.innerHTML=`<span class="outliner-kind">${item.kind==='outline'?'◯':'⌁'}</span><span>${kind} ${item.index+1}</span>`;
        selectBtn.onclick=()=>{a.selectIndex(item.index);render()};
        const eye=document.createElement('button');eye.className='outliner-icon';eye.title=item.visible?'Hide':'Show';eye.textContent=item.visible?'◉':'○';eye.onclick=e=>{e.stopPropagation();a.toggleVisible(item.index);lastKey='';render()};
        const dup=document.createElement('button');dup.className='outliner-icon';dup.title='Duplicate';dup.textContent='＋';dup.onclick=e=>{e.stopPropagation();a.duplicateIndex(item.index);lastKey='';setTimeout(render,0)};
        const del=document.createElement('button');del.className='outliner-icon outliner-delete';del.title='Delete';del.textContent='×';del.onclick=e=>{e.stopPropagation();a.deleteIndex(item.index);lastKey='';setTimeout(render,0)};
        row.append(selectBtn,eye,dup,del);list.appendChild(row);
      }
    }

    const style=document.createElement('style');style.textContent=`
      .outliner-body{padding-top:2px!important}
      .outliner-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr 70px;gap:3px;margin-bottom:3px}
      .outliner-toolbar button,.outliner-toolbar select{min-width:0!important;min-height:27px!important;height:27px!important;padding:3px 4px!important;font-size:9px!important}
      .outliner-meta{font-size:9px;color:#8993a2;padding:1px 2px 3px}
      .outliner-list{display:grid;gap:3px;max-height:168px;overflow-y:auto;-webkit-overflow-scrolling:touch}
      .outliner-empty{font-size:10px;color:#8993a2;padding:5px 2px}
      .outliner-row{display:grid;grid-template-columns:minmax(0,1fr) 30px 30px 30px;gap:3px;align-items:center}
      .outliner-row.hidden-item .outliner-select{opacity:.55}
      .outliner-row button{min-height:28px!important;height:28px!important;padding:3px 5px!important;font-size:10px!important}
      .outliner-select{display:flex;align-items:center;gap:6px;min-width:0;text-align:left;overflow:hidden}
      .outliner-select span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .outliner-kind{font-size:13px;opacity:.8;flex:0 0 auto}
      .outliner-row.selected .outliner-select{background:#e8edf4!important;color:#14171b!important}
      .outliner-icon{padding:2px!important;font-size:14px!important;line-height:1!important}
      .outliner-delete{font-size:16px!important}
    `;document.head.appendChild(style);
    setInterval(render,220);render();
    if(status)status.textContent=`v${build} • Outliner visibility and filtering tools`;
  });
})();
