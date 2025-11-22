/* static/js/media-app.js — 合并版：兼容 rawType/rawTypes/raw.fields，保留 series/author/overlay 行为 */
(function(){
  const LS_UI_KEY = 'hugo_media_ui_v1';
  const container = document.getElementById('media-root');
  if (!container) return console.error('找不到 #media-root');

  let mediaPages = [];
  let rawList = null;
  try {
    const rawNode = document.getElementById('media-data');
    if (!rawNode) { mediaPages = []; rawList = []; }
    else {
      let rawText = (rawNode.textContent || rawNode.innerText || '').trim();
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); console.info('double-encoded JSON parsed'); } catch(e){ /* ignore */ }
        }
      } catch(e){ console.warn('首次 JSON.parse 失败，尝试后续策略'); parsed = null; }
      if (Array.isArray(parsed)) rawList = parsed;
      else if (parsed && typeof parsed === 'object') {
        const vals = Object.values(parsed);
        rawList = Array.isArray(vals) && vals.length ? vals : [parsed];
      } else if (typeof parsed === 'string') {
        try { const second = JSON.parse(parsed); rawList = Array.isArray(second)? second : [second]; } catch(e){ rawList = [parsed]; }
      } else rawList = [];
      mediaPages = Array.isArray(rawList) ? rawList.slice() : [];
    }
  } catch (e) { console.error('读取媒体数据失败', e); mediaPages = []; rawList = []; }

  function normalizeFieldToArray(val){
    if (val === null || val === undefined) return [];
    function splitAndCleanString(s){
      if (s === null || s === undefined) return [];
      s = String(s).trim();
      if (!s) return [];
      const parts = s.split(/[,;\/\n]+/).map(x=>x.trim()).filter(Boolean);
      return parts;
    }
    function extractStringFromObject(obj){
      if (!obj || typeof obj !== 'object') return '';
      const keys = ['name','title','label','slug','key'];
      for (let k of keys){
        if (k in obj && obj[k] !== undefined && obj[k] !== null){
          const v = obj[k];
          if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
        }
      }
      for (let k of Object.keys(obj)){
        const v = obj[k];
        if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
      }
      try { return JSON.stringify(obj); } catch(e){ return ''; }
    }

    if (Array.isArray(val)){
      const out = [];
      val.forEach(item=>{
        if (item === null || item === undefined) return;
        if (typeof item === 'string' || typeof item === 'number'){
          splitAndCleanString(String(item)).forEach(p => { if (p) out.push(p); });
        } else if (typeof item === 'object'){
          const extracted = extractStringFromObject(item);
          if (extracted) splitAndCleanString(extracted).forEach(p => { if (p) out.push(p); });
        } else {
          splitAndCleanString(String(item)).forEach(p => { if (p) out.push(p); });
        }
      });
      return Array.from(new Set(out));
    }

    if (typeof val === 'object'){
      const extracted = extractStringFromObject(val);
      if (!extracted) return [];
      return Array.from(new Set(splitAndCleanString(extracted)));
    }

    if (typeof val === 'string'){
      return Array.from(new Set(splitAndCleanString(val)));
    }

    return [String(val).trim()].filter(Boolean);
  }

  mediaPages = (mediaPages || []).map((p, idx) => {
    if (!p || typeof p !== 'object') return p;
    const raw = Array.isArray(rawList) && rawList[idx] ? rawList[idx] : null;

    const rawTags = raw && (raw.tags !== undefined ? raw.tags : undefined);
    const rawCats = raw && (raw.categories !== undefined ? raw.categories : undefined);
    p.tags = normalizeFieldToArray(rawTags !== undefined ? rawTags : p.tags);
    p.categories = normalizeFieldToArray(rawCats !== undefined ? rawCats : p.categories);

    // ---- types：优先检查 raw 中各种可能字段 ----
    let rawTypes = undefined;
    if (raw){
      // 兼容多种 key：types / type / rawTypes / rawType
      if (raw.types !== undefined && raw.types !== null) rawTypes = raw.types;
      else if (raw.type !== undefined && raw.type !== null) rawTypes = raw.type;
      else if (raw.rawTypes !== undefined && raw.rawTypes !== null) rawTypes = raw.rawTypes;
      else if (raw.rawType !== undefined && raw.rawType !== null) rawTypes = raw.rawType;
    }
    // 若 rawTypes 仍未设定，则回退到 p 上的字段（旧逻辑）
    if (rawTypes === undefined){
      if (p.types !== undefined && p.types !== null) rawTypes = p.types;
      else if (p.type !== undefined && p.type !== null) rawTypes = p.type;
    }
    p.types = normalizeFieldToArray(rawTypes);

    // ---- series：优先 raw 中的可能 key ----
    let rawSeries = undefined;
    if (raw){
      if (raw.series !== undefined && raw.series !== null) rawSeries = raw.series;
      else if (raw.Series !== undefined && raw.Series !== null) rawSeries = raw.Series;
      else if (raw.seriesName !== undefined && raw.seriesName !== null) rawSeries = raw.seriesName;
    }
    if (rawSeries === undefined) rawSeries = p.series;
    p.series = normalizeFieldToArray(rawSeries);

    p.__orig_index = idx;
    p.score = (p.score === undefined || p.score === null) ? 0 : p.score;
    p.datePublished = p.datePublished || '';
    p.title = p.title || '';
    p.author = p.author || '';
    return p;
  });

  console.log('media-app: items =', mediaPages.length);

  const filters = { category:'all', type:'all', tag:'all', score:'all', year:'all', searchQuery:'', viewMode:'image', series:'all' };
  const sortState = { field:'score', direction:'desc' };
  function saveUI(){ try { localStorage.setItem(LS_UI_KEY, JSON.stringify({filters, sortState})); }catch(e){} }
  function loadUI(){ try { const r = localStorage.getItem(LS_UI_KEY); if (!r) return; const o = JSON.parse(r); if (o.filters) Object.assign(filters, o.filters); if (o.sortState) Object.assign(sortState, o.sortState);}catch(e){} }
  loadUI();

  function getYearFromDate(f){ if (!f) return ''; const d=new Date(f); if (isNaN(d.getTime())) return typeof f==='number'?String(f):''; return String(d.getFullYear()); }
  function renderScoreHTML(score){ const s=Number(score||0); if (!s) return ''; if (s>=9) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐⭐⭐</span>`; if (s>=7) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐⭐</span>`; if (s>=5) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐</span>`; if (s>=3) return `${s.toFixed(1)} <span class="stars">⭐⭐</span>`; return `${s.toFixed(1)} <span class="stars">⭐</span>`; }

  function placeholderDataURI() { return '/images/placeholder-300x450.png'; }

  function collectDistinctCounts(field, subset){
    const map={};
    (Array.isArray(subset) ? subset : mediaPages).forEach(p=>{
      if (!p || typeof p!=='object') return;
      const v = p[field];
      if (!v) return;
      if (Array.isArray(v)) v.forEach(x=>{ if (x) { const key = String(x).trim(); if (key) map[key]=(map[key]||0)+1; } });
      else { const key = String(v).trim(); if (key) map[key]=(map[key]||0)+1; }
    });
    return Object.entries(map).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  }
  function collectYears(subset){ const map={}; (Array.isArray(subset) ? subset : mediaPages).forEach(p=>{ if(!p||typeof p!=='object') return; const y=getYearFromDate(p.datePublished); if (y) map[y]=(map[y]||0)+1; }); return Object.keys(map).sort((a,b)=>Number(b)-Number(a)); }

  const useFuse = (typeof Fuse !== 'undefined'); let fuse = null;
  try{ if(useFuse) fuse = new Fuse(mediaPages, { keys:[{name:'title',weight:0.45},{name:'author',weight:0.2},{name:'tags',weight:0.12},{name:'categories',weight:0.12},{name:'shortReview',weight:0.06},{name:'description',weight:0.05}], includeScore:true, threshold:0.45 }); }catch(e){ fuse=null; console.warn('Fuse init fail', e); }

  function simpleSearchFilter(p,q){ if(!q) return true; const terms=q.toLowerCase().split(/\s+/).filter(Boolean); let hay=''; ['title','shortReview','description','author'].forEach(k=>{ hay+=' '+(p[k]? (Array.isArray(p[k])?p[k].join(' '):p[k]) : ''); }); if(p.tags) hay+=' '+(Array.isArray(p.tags)?p.tags.join(' '):p.tags); if(p.categories) hay+=' '+(Array.isArray(p.categories)?p.categories.join(' '):p.categories); hay=hay.toLowerCase(); return terms.every(t=>hay.includes(t)); }

  function getSeriesArrayForItem(p){
    if (!p) return [];
    if (Array.isArray(p.series) && p.series.length) return p.series;
    if (p.__orig_index !== undefined && Array.isArray(rawList) && rawList[p.__orig_index]){
      const raw = rawList[p.__orig_index];
      if (raw){
        const cand = raw.series !== undefined ? raw.series : (raw.Series !== undefined ? raw.Series : (raw.seriesName !== undefined ? raw.seriesName : (raw.seriesName !== undefined ? raw.seriesName : undefined)));
        if (cand !== undefined && cand !== null){
          const arr = normalizeFieldToArray(cand);
          if (arr && arr.length) return arr;
        }
      }
    }
    return [];
  }

  // UI create
  const toolbarEl = document.createElement('div');
  const filtersEl = document.createElement('div');
  const countEl = document.createElement('div');
  const gridEl = document.createElement('div');
  toolbarEl.className = 'top-toolbar';
  filtersEl.className = 'filters';
  countEl.className = 'results-count';
  gridEl.className = 'media-grid';
  if(!container.querySelector('.top-toolbar')) container.appendChild(toolbarEl);
  if(!container.querySelector('.filters')) container.appendChild(filtersEl);
  if(!container.querySelector('.results-count')) container.appendChild(countEl);
  if(!container.querySelector('.media-grid')) container.appendChild(gridEl);

  // toolbar & render functions (unchanged behavior: author click -> search; overlay uses description)
  let searchInput = null;
  function initToolbar(){
    const existingToolbar = container.querySelector('.top-toolbar');
    if (existingToolbar && existingToolbar.querySelector('.search-input')) {
      searchInput = existingToolbar.querySelector('.search-input');
      if(!existingToolbar.querySelector('select')) {
        const sortSel = document.createElement('select');
        [['score','评分 ↓'],['title_asc','标题 A-Z'],['title_desc','标题 Z-A'],['date_desc','发布时间 ↓'],['date_asc','发布时间 ↑']].forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; sortSel.appendChild(o); });
        sortSel.value = (sortState.field==='score'&&sortState.direction==='desc')?'score':(sortState.field==='title'&&sortState.direction==='asc'?'title_asc':(sortState.field==='date'&&sortState.direction==='desc'?'date_desc':'title_desc'));
        sortSel.addEventListener('change', e=>{ handleSortChange(e.target.value); });
        existingToolbar.appendChild(sortSel);
      }
      if(!existingToolbar.querySelector('button')) {
        const toggle = document.createElement('button'); toggle.textContent = filters.viewMode==='image' ? '🖼 图片模式' : '📄 无图模式';
        toggle.addEventListener('click', ()=>{ filters.viewMode = filters.viewMode==='image' ? 'text' : 'image'; saveUI(); toggle.textContent = filters.viewMode==='image' ? '🖼 图片模式' : '📄 无图模式'; container.classList.toggle('view-mode-text', filters.viewMode==='text'); renderGallery(); });
        existingToolbar.appendChild(toggle);
      }
      attachSearchListeners();
      return;
    }

    toolbarEl.innerHTML = '';
    searchInput = document.createElement('input'); searchInput.className='search-input'; searchInput.placeholder='搜索标题、作者、简介、标签...'; searchInput.value = filters.searchQuery || '';
    toolbarEl.appendChild(searchInput);

    const toggle = document.createElement('button'); toggle.textContent = filters.viewMode==='image' ? '🖼 图片模式' : '📄 无图模式';
    toggle.addEventListener('click', ()=>{ filters.viewMode = filters.viewMode==='image' ? 'text' : 'image'; saveUI(); toggle.textContent = filters.viewMode==='image' ? '🖼 图片模式' : '📄 无图模式'; container.classList.toggle('view-mode-text', filters.viewMode==='text'); renderGallery(); });
    toolbarEl.appendChild(toggle);

    const sortSel = document.createElement('select');
    [['score','评分 ↓'],['title_asc','标题 A-Z'],['title_desc','标题 Z-A'],['date_desc','发布时间 ↓'],['date_asc','发布时间 ↑']].forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; sortSel.appendChild(o); });
    sortSel.value = (sortState.field==='score'&&sortState.direction==='desc')?'score':(sortState.field==='title'&&sortState.direction==='asc'?'title_asc':(sortState.field==='date'&&sortState.direction==='desc'?'date_desc':'title_desc'));
    sortSel.addEventListener('change', e=>{ handleSortChange(e.target.value); });
    toolbarEl.appendChild(sortSel);

    let isComposing = false;
    const debounceRender = debounce(()=>{ filters.searchQuery = searchInput.value; saveUI(); renderGallery(); }, 300);

    searchInput.addEventListener('compositionstart', ()=>{ isComposing = true; });
    searchInput.addEventListener('compositionend', ()=>{ isComposing = false; filters.searchQuery = searchInput.value; saveUI(); renderGallery(); });
    searchInput.addEventListener('input', (e)=>{ if (isComposing) return; debounceRender(); });
  }

  function attachSearchListeners(){
    if(!searchInput) return;
    if(searchInput._media_listeners_attached) return;
    let composing = false, t=null;
    searchInput.addEventListener('compositionstart', ()=> composing = true);
    searchInput.addEventListener('compositionend', ()=> { composing = false; filters.searchQuery = searchInput.value; saveUI(); renderGallery(); });
    searchInput.addEventListener('input', ()=>{ if(composing) return; clearTimeout(t); t = setTimeout(()=>{ filters.searchQuery = searchInput.value; saveUI(); renderGallery(); }, 260); });
    searchInput._media_listeners_attached = true;
  }

  function handleSortChange(val){
    if(val === 'score'){ sortState.field='score'; sortState.direction='desc'; }
    else if(val === 'title_asc'){ sortState.field='title'; sortState.direction='asc'; }
    else if(val === 'title_desc'){ sortState.field='title'; sortState.direction='desc'; }
    else if(val === 'date_desc'){ sortState.field='date'; sortState.direction='desc'; }
    else if(val === 'date_asc'){ sortState.field='date'; sortState.direction='asc'; }
    saveUI();
    renderGallery();
  }

  function renderFilters(){
    filtersEl.innerHTML = '';

    const cats = collectDistinctCounts('categories', mediaPages);
    const catRow = document.createElement('div'); catRow.className='filter-row';
    const allCat = document.createElement('button'); allCat.textContent = `全部 (${mediaPages.length})`; if(filters.category==='all') allCat.classList.add('active');
    allCat.addEventListener('click', ()=>{ filters.category='all'; filters.tag='all'; filters.type='all'; filters.series='all'; saveUI(); renderFilters(); renderGallery(); });
    catRow.appendChild(allCat);
    cats.forEach(c=>{ const name = c[0], cnt = c[1]; const b=document.createElement('button'); b.textContent = `${name} (${cnt})`; if(filters.category===name) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.category=name; filters.tag='all'; filters.type='all'; filters.series='all'; saveUI(); renderFilters(); renderGallery(); }); catRow.appendChild(b); });
    filtersEl.appendChild(catRow);

    let baseForTagsAndTypes = mediaPages;
    if(filters.category && filters.category !== 'all'){
      baseForTagsAndTypes = baseForTagsAndTypes.filter(p=> Array.isArray(p.categories) ? p.categories.includes(filters.category) : false);
    }

    const types = collectDistinctCounts('types', baseForTagsAndTypes);
    const typeRow = document.createElement('div'); typeRow.className='filter-row';
    const allType = document.createElement('button'); allType.textContent='全部'; if(filters.type==='all') allType.classList.add('active'); allType.addEventListener('click', ()=>{ filters.type='all'; filters.tag='all'; saveUI(); renderFilters(); renderGallery(); }); typeRow.appendChild(allType);
    types.forEach(t=>{ const name = t[0], cnt = t[1]; const b=document.createElement('button'); b.textContent = `${name} (${cnt})`; if(filters.type===name) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.type=name; filters.tag='all'; saveUI(); renderFilters(); renderGallery(); }); typeRow.appendChild(b); });
    filtersEl.appendChild(typeRow);

    if(filters.type && filters.type !== 'all'){
      baseForTagsAndTypes = baseForTagsAndTypes.filter(p=> Array.isArray(p.types) ? p.types.includes(filters.type) : false);
    }

    const tags = collectDistinctCounts('tags', baseForTagsAndTypes);
    const tagRow = document.createElement('div'); tagRow.className='filter-row';
    const allTag = document.createElement('button'); allTag.textContent='全部'; if(filters.tag==='all') allTag.classList.add('active'); allTag.addEventListener('click', ()=>{ filters.tag='all'; saveUI(); renderFilters(); renderGallery(); }); tagRow.appendChild(allTag);
    tags.forEach(t=>{ const name = t[0]; const b=document.createElement('button'); b.textContent = `${name} (${t[1]})`; if(filters.tag===name) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.tag=name; saveUI(); renderFilters(); renderGallery(); }); tagRow.appendChild(b); });
    filtersEl.appendChild(tagRow);

    const years = collectYears(mediaPages);
    const yearRow = document.createElement('div'); yearRow.className='filter-row';
    const allYear = document.createElement('button'); allYear.textContent='全部'; if(filters.year==='all') allYear.classList.add('active'); allYear.addEventListener('click', ()=>{ filters.year='all'; saveUI(); renderFilters(); renderGallery(); }); yearRow.appendChild(allYear);
    years.forEach(y=>{ const b=document.createElement('button'); b.textContent=y; if(filters.year===y) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.year=y; saveUI(); renderFilters(); renderGallery(); }); yearRow.appendChild(b); });
    filtersEl.appendChild(yearRow);

    const scoreRow = document.createElement('div'); scoreRow.className='filter-row';
    [{name:'全部',v:'all'},{name:'⭐⭐⭐⭐⭐',v:'5'},{name:'⭐⭐⭐⭐',v:'4'},{name:'⭐⭐⭐',v:'3'},{name:'⭐⭐',v:'2'},{name:'⭐',v:'1'}].forEach(opt=>{ const b=document.createElement('button'); b.textContent=opt.name; if(filters.score===opt.v) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.score=opt.v; saveUI(); renderFilters(); renderGallery(); }); scoreRow.appendChild(b); });
    filtersEl.appendChild(scoreRow);
  }

  function renderGallery(){
    container.classList.toggle('view-mode-text', filters.viewMode==='text');

    let filtered = Array.isArray(mediaPages)? mediaPages.slice() : [];
    const q = filters.searchQuery && filters.searchQuery.trim();

    if(q){
      if(fuse && typeof fuse.search==='function'){
        try{
          const res = fuse.search(q).map(r=> r.item? r.item:r);
          const set = new Set(res.map(x=> x.relPermalink));
          filtered = filtered.filter(p=> set.has(p.relPermalink));
        } catch(e){
          console.warn('Fuse 搜索出错', e);
          filtered = filtered.filter(p=> simpleSearchFilter(p,q));
        }
      } else filtered = filtered.filter(p=> simpleSearchFilter(p,q));
    }

    if(filters.category && filters.category!=='all') filtered = filtered.filter(p=> Array.isArray(p.categories) ? p.categories.includes(filters.category) : false);
    if(filters.type && filters.type!=='all') filtered = filtered.filter(p=> Array.isArray(p.types) ? p.types.includes(filters.type) : false);
    if(filters.tag && filters.tag!=='all') filtered = filtered.filter(p=> Array.isArray(p.tags) ? p.tags.includes(filters.tag) : false);
    if(filters.year && filters.year!=='all') filtered = filtered.filter(p=> getYearFromDate(p.datePublished) === filters.year);
    if(filters.score && filters.score!=='all'){ const t=Number(filters.score); filtered = filtered.filter(p=>{ const sc=Number(p.score||0); if(t===5) return sc>=9; if(t===4) return sc>=7 && sc<9; if(t===3) return sc>=5 && sc<7; if(t===2) return sc>=3 && sc<5; if(t===1) return sc>0 && sc<3; return false; }); }

    if(filters.series && filters.series!=='all'){
      filtered = filtered.filter(p=>{
        const arr = getSeriesArrayForItem(p);
        return arr && arr.includes(filters.series);
      });
    }

    if(sortState.field==='score') filtered.sort((a,b)=> Number(b.score||0)-Number(a.score||0));
    else if(sortState.field==='date') filtered.sort((a,b)=>{
      const da = a.datePublished ? new Date(a.datePublished).getTime() : 0;
      const db = b.datePublished ? new Date(b.datePublished).getTime() : 0;
      return sortState.direction==='asc' ? (da - db) : (db - da);
    });
    else filtered.sort((a,b)=>{ const A=(a.title||'').toLowerCase(), B=(b.title||'').toLowerCase(); return sortState.direction==='asc' ? (A<B?-1:(A>B?1:0)):(A>B?-1:(A<B?1:0)); });

    countEl.textContent = `找到 ${filtered.length} 个结果`;

    gridEl.innerHTML = '';
    if(filtered.length===0){
      const no = document.createElement('div'); no.className='no-results'; no.textContent='没有找到符合条件的媒体';
      gridEl.appendChild(no);
      return;
    }

    filtered.forEach(p=>{
      const card = document.createElement('div'); card.className='media-card';
      card.addEventListener('click', ()=>{ if(p.relPermalink) window.location.href = p.relPermalink; });

      if(filters.viewMode==='image'){
        const imgWrap = document.createElement('div'); imgWrap.className='img-wrap';
        const img = document.createElement('img'); img.className='cover'; img.loading='lazy';
        img.src = p.image && String(p.image).trim() ? p.image : placeholderDataURI(300,450,'No Image');
        img.onerror = function(){ try{ this.onerror = null; }catch(e){} this.src = placeholderDataURI(300,450,'No Image'); };
        imgWrap.appendChild(img);

        if(!filters.searchQuery){
          const overlay = document.createElement('div'); overlay.className = 'overlay';
          overlay.innerText = p.description ? p.description : '';
          imgWrap.appendChild(overlay);
        }

        const year = getYearFromDate(p.datePublished);
        //if(year){ const badge = document.createElement('div'); badge.className='year-badge'; badge.textContent = year; imgWrap.appendChild(badge); }
        if(p.score){ const r = document.createElement('div'); r.className='media-rating'; r.innerHTML = renderScoreHTML(p.score); imgWrap.appendChild(r); }

        const seriesArr = getSeriesArrayForItem(p);
        if (seriesArr && seriesArr.length){
          const val = seriesArr[0];
          const sb = document.createElement('div');
          sb.className = 'series-badge';
          sb.textContent = val;
          sb.title = `按 series: ${val} 筛选`;
          sb.addEventListener('click', ev=>{
            ev.stopPropagation();
            if (filters.series === val) filters.series = 'all';
            else filters.series = val;
            saveUI(); renderFilters(); renderGallery();
          });
          imgWrap.appendChild(sb);
        }

        card.appendChild(imgWrap);
      }

      const info = document.createElement('div'); info.className='info';
      const title = document.createElement('div'); title.className='title'; title.innerHTML = (filters.searchQuery ? highlight(p.title, filters.searchQuery) : (p.title || '未命名')); info.appendChild(title);

      if(p.author){
        const au = document.createElement('div'); au.className='author'; au.textContent = `${p.author}`;
        au.addEventListener('click', ev=>{
          ev.stopPropagation();
          filters.searchQuery = p.author;
          if (searchInput) searchInput.value = filters.searchQuery;
          saveUI();
          renderGallery();
        });
        info.appendChild(au);
      }

      if(p.tags && p.tags.length){
        const tagsWrap = document.createElement('div'); tagsWrap.className='tag-list';
        (Array.isArray(p.tags)?p.tags:[p.tags]).forEach(t=>{
          const tspan = document.createElement('span'); tspan.className = 'tag' + (filters.tag===t ? ' selected' : '');
          tspan.textContent = t;
          tspan.addEventListener('click', ev=>{ ev.stopPropagation(); filters.tag = t; saveUI(); renderFilters(); renderGallery(); });
          tagsWrap.appendChild(tspan);
        });
        info.appendChild(tagsWrap);
      }

      const meta = document.createElement('div'); meta.className='meta meta-flex';
      const left = document.createElement('div'); left.className='meta-left';
      const right = document.createElement('div'); right.className='meta-right';

      left.textContent = (p.types && p.types.length) ? p.types.join(', ') : '';
      right.textContent = p.datePublished ? `发布：${p.datePublished}` : '';

      meta.appendChild(left);
      meta.appendChild(right);
      info.appendChild(meta);

      card.appendChild(info);
      gridEl.appendChild(card);
    });
  }

  initToolbar();
  applyDefaultCategoryOnce = function(){
    // minimal: 尽量保留之前默认逻辑（如果需要可以删除）
    let defaultCategoryApplied = false;
    if (defaultCategoryApplied) return;
    if (filters.category && filters.category !== 'all') { defaultCategoryApplied = true; return; }
    const cats = collectDistinctCounts('categories', mediaPages);
    const foundTRPG = cats.some(c => c[0] === 'TRPG');
    if (foundTRPG){
      filters.category = 'TRPG';
      defaultCategoryApplied = true;
      saveUI();
    } else {
      defaultCategoryApplied = true;
    }
  };
  applyDefaultCategoryOnce();
  renderFilters();
  renderGallery();

  window.__media_app = { mediaPages, filters, sortState, renderGallery, renderFilters, rawList };

  function debounce(fn, wait){ let t=null; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; }
  function highlight(text, q) { return text || ''; } // 保留占位
})();
