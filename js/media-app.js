/* static/js/media-app.js — final robust version (含防闪烁和选中样式) */
(function(){
  const LS_UI_KEY = 'hugo_media_ui_v1';
  const container = document.getElementById('media-root');
  if (!container) return console.error('找不到 #media-root');

  // 读取并解析 media-data（兼容 double-encoded）
  let mediaPages = [];
  try {
    const rawNode = document.getElementById('media-data');
    if (!rawNode) { mediaPages = []; }
    else {
      let rawText = (rawNode.textContent || rawNode.innerText || '').trim();
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); console.info('double-encoded JSON parsed'); } catch(e){ /* ignore */ }
        }
      } catch(e){ console.warn('首次 JSON.parse 失败，尝试后续策略'); parsed = null; }
      if (Array.isArray(parsed)) mediaPages = parsed;
      else if (parsed && typeof parsed === 'object') {
        const vals = Object.values(parsed);
        mediaPages = Array.isArray(vals) && vals.length ? vals : [parsed];
      } else if (typeof parsed === 'string') {
        try { const second = JSON.parse(parsed); mediaPages = Array.isArray(second)? second : [second]; } catch(e){ mediaPages = [parsed]; }
      } else mediaPages = [];
    }
  } catch (e) { console.error('读取媒体数据失败', e); mediaPages = []; }

  console.log('media-app: items =', mediaPages.length);

  // UI state
  const filters = { category:'all', tag:'all', score:'all', year:'all', searchQuery:'', viewMode:'image' };
  const sortState = { field:'score', direction:'desc' };
  function saveUI(){ try { localStorage.setItem(LS_UI_KEY, JSON.stringify({filters, sortState})); }catch(e){} }
  function loadUI(){ try { const r = localStorage.getItem(LS_UI_KEY); if (!r) return; const o = JSON.parse(r); if (o.filters) Object.assign(filters, o.filters); if (o.sortState) Object.assign(sortState, o.sortState);}catch(e){} }
  loadUI();

  function getYearFromDate(f){ if (!f) return ''; const d=new Date(f); if (isNaN(d.getTime())) return typeof f==='number'?String(f):''; return String(d.getFullYear()); }
  function highlight(text,q){ if (!q||!text) return text||''; let out=String(text); const terms=q.toLowerCase().split(/\s+/).filter(Boolean); for(const t of terms){ try { const rx=new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'); out=out.replace(rx,m=>`<span class="highlight">${m}</span>`);}catch(e){} } return out; }
  function renderScoreHTML(score){ const s=Number(score||0); if (!s) return ''; if (s>=9) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐⭐⭐</span>`; if (s>=7) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐⭐</span>`; if (s>=5) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐</span>`; if (s>=3) return `${s.toFixed(1)} <span class="stars">⭐⭐</span>`; return `${s.toFixed(1)} <span class="stars">⭐</span>`; }

  function collectDistinct(field){
    const map={};
    mediaPages.forEach(p=>{ if (!p || typeof p!=='object') return; const v=p[field]; if (!v) return; if (Array.isArray(v)) v.forEach(x=>{ if (x) map[x]=(map[x]||0)+1; }); else map[v]=(map[v]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(x=>x[0]);
  }
  function collectYears(){ const map={}; mediaPages.forEach(p=>{ if(!p||typeof p!=='object') return; const y=getYearFromDate(p.datePublished); if (y) map[y]=(map[y]||0)+1; }); return Object.keys(map).sort((a,b)=>Number(b)-Number(a)); }

  // UI builders (toolbar, filters)
  function createTopToolbar(root){
    const toolbar=document.createElement('div'); toolbar.className='top-toolbar';
    const search=document.createElement('input'); search.className='search-input'; search.placeholder='搜索标题、简介、标签...'; search.value=filters.searchQuery||''; search.addEventListener('input',e=>{ filters.searchQuery=e.target.value; saveUI(); renderGallery(); });
    toolbar.appendChild(search);
    const toggle=document.createElement('button'); toggle.textContent=filters.viewMode==='image'?'🖼 图片模式':'📄 无图模式'; toggle.addEventListener('click',()=>{ filters.viewMode = filters.viewMode==='image'?'text':'image'; toggle.textContent = filters.viewMode==='image'?'🖼 图片模式':'📄 无图模式'; saveUI(); renderGallery(); }); toolbar.appendChild(toggle);
    const sortSel=document.createElement('select'); [['score','评分 ↓'],['title_asc','标题 A-Z'],['title_desc','标题 Z-A']].forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; sortSel.appendChild(o); });
    sortSel.value=(sortState.field==='score'&&sortState.direction==='desc')?'score':(sortState.field==='title'&&sortState.direction==='asc'?'title_asc':'title_desc');
    sortSel.addEventListener('change',e=>{ const v=e.target.value; if (v==='score'){ sortState.field='score'; sortState.direction='desc'; } else if(v==='title_asc'){ sortState.field='title'; sortState.direction='asc'; } else { sortState.field='title'; sortState.direction='desc'; } saveUI(); renderGallery(); });
    toolbar.appendChild(sortSel);
    root.appendChild(toolbar);
  }

  function createFilterButtons(root){
    const wrap=document.createElement('div'); wrap.className='filters';
    // categories
    const cats=collectDistinct('categories'); const catRow=document.createElement('div'); catRow.className='filter-row';
    const allCat=document.createElement('button'); allCat.textContent=`全部 (${mediaPages.length})`; if(filters.category==='all') allCat.classList.add('active'); allCat.addEventListener('click',()=>{ filters.category='all'; saveUI(); renderGallery(); }); catRow.appendChild(allCat);
    cats.forEach(c=>{ const b=document.createElement('button'); b.textContent=c; if(filters.category===c) b.classList.add('active'); b.addEventListener('click',()=>{ filters.category=c; saveUI(); renderGallery(); }); catRow.appendChild(b); });
    wrap.appendChild(catRow);
    // tags
    const tags=collectDistinct('tags'); const tagRow=document.createElement('div'); tagRow.className='filter-row';
    const allTag=document.createElement('button'); allTag.textContent='全部'; if(filters.tag==='all') allTag.classList.add('active'); allTag.addEventListener('click',()=>{ filters.tag='all'; saveUI(); renderGallery(); }); tagRow.appendChild(allTag);
    tags.forEach(t=>{ const b=document.createElement('button'); b.textContent=t; if(filters.tag===t) b.classList.add('active'); b.addEventListener('click',()=>{ filters.tag=t; saveUI(); renderGallery(); }); tagRow.appendChild(b); });
    wrap.appendChild(tagRow);
    // year
    const years=collectYears(); const yearRow=document.createElement('div'); yearRow.className='filter-row';
    const allYear=document.createElement('button'); allYear.textContent='全部'; if(filters.year==='all') allYear.classList.add('active'); allYear.addEventListener('click',()=>{ filters.year='all'; saveUI(); renderGallery(); }); yearRow.appendChild(allYear);
    years.forEach(y=>{ const b=document.createElement('button'); b.textContent=y; if(filters.year===y) b.classList.add('active'); b.addEventListener('click',()=>{ filters.year=y; saveUI(); renderGallery(); }); yearRow.appendChild(b); });
    wrap.appendChild(yearRow);
    // score
    const scoreRow=document.createElement('div'); scoreRow.className='filter-row';
    [{name:'全部',v:'all'},{name:'⭐⭐⭐⭐⭐',v:'5'},{name:'⭐⭐⭐⭐',v:'4'},{name:'⭐⭐⭐',v:'3'},{name:'⭐⭐',v:'2'},{name:'⭐',v:'1'}].forEach(opt=>{ const b=document.createElement('button'); b.textContent=opt.name; if(filters.score===opt.v) b.classList.add('active'); b.addEventListener('click',()=>{ filters.score=opt.v; saveUI(); renderGallery(); }); scoreRow.appendChild(b); });
    wrap.appendChild(scoreRow);
    root.appendChild(wrap);
  }

  const useFuse = (typeof Fuse !== 'undefined'); let fuse = null;
  function buildFuse(){ if(!useFuse) return; try{ fuse = new Fuse(mediaPages, { keys:[{name:'title',weight:0.5},{name:'tags',weight:0.15},{name:'categories',weight:0.15},{name:'shortReview',weight:0.09},{name:'description',weight:0.06}], includeScore:true, threshold:0.45 }); console.log('Fuse ready'); }catch(e){ console.warn('Fuse init fail',e); fuse=null; } }
  buildFuse();

  function simpleSearchFilter(p,q){ if(!q) return true; const terms=q.toLowerCase().split(/\s+/).filter(Boolean); let hay=''; ['title','shortReview','description'].forEach(k=>{ hay+=' '+(p[k]? (Array.isArray(p[k])?p[k].join(' '):p[k]) : ''); }); if(p.tags) hay+=' '+(Array.isArray(p.tags)?p.tags.join(' '):p.tags); if(p.categories) hay+=' '+(Array.isArray(p.categories)?p.categories.join(' '):p.categories); hay=hay.toLowerCase(); return terms.every(t=>hay.includes(t)); }

  function renderGallery(){
    container.innerHTML=''; createTopToolbar(container); createFilterButtons(container);
    let filtered = Array.isArray(mediaPages)? mediaPages.slice() : [];
    const q=filters.searchQuery && filters.searchQuery.trim();
    if(q){
      if(fuse && typeof fuse.search==='function'){ try{ const res=fuse.search(q).map(r=> r.item? r.item:r); const set=new Set(res.map(x=>x.relPermalink)); filtered=filtered.filter(p=> set.has(p.relPermalink)); }catch(e){ console.warn('Fuse 搜索出错',e); filtered=filtered.filter(p=> simpleSearchFilter(p,q)); } } else filtered=filtered.filter(p=> simpleSearchFilter(p,q));
    }
    if(filters.category && filters.category!=='all') filtered = filtered.filter(p=> { const c=p.categories; if(!c) return false; return Array.isArray(c)? c.includes(filters.category):(c===filters.category); });
    if(filters.tag && filters.tag!=='all') filtered = filtered.filter(p=> { const t=p.tags; if(!t) return false; return Array.isArray(t)? t.includes(filters.tag):(t===filters.tag); });
    if(filters.year && filters.year!=='all') filtered = filtered.filter(p=> getYearFromDate(p.datePublished) === filters.year);
    if(filters.score && filters.score!=='all'){ const t=Number(filters.score); filtered = filtered.filter(p=>{ const sc=Number(p.score||0); if(t===5) return sc>=9; if(t===4) return sc>=7 && sc<9; if(t===3) return sc>=5 && sc<7; if(t===2) return sc>=3 && sc<5; if(t===1) return sc>0 && sc<3; return false; }); }
    if(sortState.field==='score') filtered.sort((a,b)=> Number(b.score||0)-Number(a.score||0)); else filtered.sort((a,b)=>{ const A=(a.title||'').toLowerCase(), B=(b.title||'').toLowerCase(); return sortState.direction==='asc' ? (A<B?-1:(A>B?1:0)):(A>B?-1:(A<B?1:0)); });
    const countDiv=document.createElement('div'); countDiv.className='results-count'; countDiv.textContent=`找到 ${filtered.length} 个结果`; container.appendChild(countDiv);
    if(filtered.length===0){ const no=document.createElement('div'); no.className='no-results'; no.textContent='没有找到符合条件的媒体'; container.appendChild(no); return; }
    const grid=document.createElement('div'); grid.className='media-grid';
    filtered.forEach(p=>{
      const card=document.createElement('div'); card.className='media-card'; card.addEventListener('click',()=>{ if(p.relPermalink) window.location.href = p.relPermalink; });
      if(filters.viewMode==='image'){
        const imgWrap=document.createElement('div'); imgWrap.className='img-wrap';
        const img=document.createElement('img'); img.className='cover'; img.loading='lazy'; img.src=p.image || '/images/placeholder-300x450.png';
        img.onerror=function(){ try{ this.onerror=null; }catch(e){} if(!(this.src&&this.src.includes('placeholder-300x450.png'))) this.src='/images/placeholder-300x450.png'; };
        imgWrap.appendChild(img);
        const year=getYearFromDate(p.datePublished); if(year){ const badge=document.createElement('div'); badge.className='year-badge'; badge.textContent=year; imgWrap.appendChild(badge); }
        if(p.score){ const r=document.createElement('div'); r.className='media-rating'; r.innerHTML = renderScoreHTML(p.score); imgWrap.appendChild(r); }
        card.appendChild(imgWrap);
      }
      const info=document.createElement('div'); info.className='info';
      const title=document.createElement('div'); title.className='title'; title.innerHTML = q ? highlight(p.title,q) : (p.title || '未命名'); info.appendChild(title);
      if(p.shortReview){ const sr=document.createElement('div'); sr.className='short-review'; sr.innerHTML = q? highlight(p.shortReview,q) : p.shortReview; info.appendChild(sr); }
      if(p.tags && p.tags.length){ const tagsWrap=document.createElement('div'); tagsWrap.className='tag-list'; (Array.isArray(p.tags)?p.tags:[p.tags]).forEach(t=>{ const tspan=document.createElement('span'); tspan.className='tag' + (filters.tag===t ? ' selected' : ''); tspan.textContent = t; tspan.addEventListener('click', ev=>{ ev.stopPropagation(); filters.tag = t; saveUI(); renderGallery(); }); tagsWrap.appendChild(tspan); }); info.appendChild(tagsWrap); }
      const meta=document.createElement('div'); meta.className='meta'; if(p.score){ const sc=document.createElement('span'); sc.className='score'; sc.innerHTML = renderScoreHTML(p.score); meta.appendChild(sc); } if(p.datePublished){ const dp=document.createElement('span'); dp.className='finish'; dp.textContent = `发布：${p.datePublished}`; meta.appendChild(dp); } info.appendChild(meta);
      card.appendChild(info); grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  renderGallery();
})();
