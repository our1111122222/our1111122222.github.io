/* static/js/media-app.js — 强化版：兼容 type 列表形式（YAML list）、types/type 两键、object/array/string 等 */
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

  // 更强的归一化：将各种可能的类型（array / string / object / comma-separated string）全部变成字符串数组
  function normalizeFieldToArray(val){
    if (val === null || val === undefined) return [];
    // already array
    if (Array.isArray(val)) return val.map(String).map(s=>s.trim()).filter(Boolean);
    // object (e.g. Hugo might output map-like structure in some rare cases) -> take values
    if (typeof val === 'object'){
      try {
        const arr = Object.values(val);
        return arr.map(String).map(s=>s.trim()).filter(Boolean);
      } catch(e){
        return [];
      }
    }
    // string: possibly comma separated
    if (typeof val === 'string'){
      if (val.indexOf(',') !== -1) return val.split(',').map(s=>s.trim()).filter(Boolean);
      return [val.trim()].filter(Boolean);
    }
    // fallback for number/other
    return [String(val)].map(s=>s.trim()).filter(Boolean);
  }

  // 将后端导出的每条记录统一化：tags/categories/types 都变成数组
  mediaPages = (mediaPages || []).map(p => {
    if (!p || typeof p !== 'object') return p;

    // tags/categories
    p.tags = normalizeFieldToArray(p.tags);
    p.categories = normalizeFieldToArray(p.categories);

    // types: 后端可能输出 types 或 type，模板已同时输出两者；优先取 types，再取 type，再为空
    let rawTypes = undefined;
    if (p.types !== undefined && p.types !== null) rawTypes = p.types;
    else if (p.type !== undefined && p.type !== null) rawTypes = p.type;
    p.types = normalizeFieldToArray(rawTypes);

    // 保证基本字段
    p.score = (p.score === undefined || p.score === null) ? 0 : p.score;
    p.datePublished = p.datePublished || '';
    p.title = p.title || '';
    return p;
  });

  console.log('media-app: items =', mediaPages.length);
  // 如果想在控制台检查解析结果：取消下面注释
  // console.log('parsed mediaPages sample:', mediaPages.slice(0,5));

  // UI state
  const filters = { category:'all', type:'all', tag:'all', score:'all', year:'all', searchQuery:'', viewMode:'image' };
  const sortState = { field:'score', direction:'desc' };
  function saveUI(){ try { localStorage.setItem(LS_UI_KEY, JSON.stringify({filters, sortState})); }catch(e){} }
  function loadUI(){ try { const r = localStorage.getItem(LS_UI_KEY); if (!r) return; const o = JSON.parse(r); if (o.filters) Object.assign(filters, o.filters); if (o.sortState) Object.assign(sortState, o.sortState);}catch(e){} }
  loadUI();

  let defaultCategoryApplied = false;
  function applyDefaultCategoryOnce(){
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
  }

  function getYearFromDate(f){ if (!f) return ''; const d=new Date(f); if (isNaN(d.getTime())) return typeof f==='number'?String(f):''; return String(d.getFullYear()); }
  function highlight(text, q) { return text || ''; }

  function renderScoreHTML(score){ const s=Number(score||0); if (!s) return ''; if (s>=9) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐⭐⭐</span>`; if (s>=7) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐⭐</span>`; if (s>=5) return `${s.toFixed(1)} <span class="stars">⭐⭐⭐</span>`; if (s>=3) return `${s.toFixed(1)} <span class="stars">⭐⭐</span>`; return `${s.toFixed(1)} <span class="stars">⭐</span>`; }

  function placeholderDataURI() { return '/images/placeholder-300x450.png'; }

  // collectDistinctCounts: 返回 [[value,count], ...]，按 count 降序
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
  function buildFuse(){ if(!useFuse) return; try{ fuse = new Fuse(mediaPages, { keys:[{name:'title',weight:0.45},{name:'author',weight:0.2},{name:'tags',weight:0.12},{name:'categories',weight:0.12},{name:'shortReview',weight:0.06},{name:'description',weight:0.05}], includeScore:true, threshold:0.45 }); console.log('Fuse ready'); }catch(e){ console.warn('Fuse init fail',e); fuse=null; } }
  buildFuse();

  function simpleSearchFilter(p,q){ if(!q) return true; const terms=q.toLowerCase().split(/\s+/).filter(Boolean); let hay=''; ['title','shortReview','description','author'].forEach(k=>{ hay+=' '+(p[k]? (Array.isArray(p[k])?p[k].join(' '):p[k]) : ''); }); if(p.tags) hay+=' '+(Array.isArray(p.tags)?p.tags.join(' '):p.tags); if(p.categories) hay+=' '+(Array.isArray(p.categories)?p.categories.join(' '):p.categories); hay=hay.toLowerCase(); return terms.every(t=>hay.includes(t)); }

  // UI elements 创建
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

  // 创建 toolbar
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

  // 渲染 filters：types 基于 category，tags 基于 (category + type)
  function renderFilters(){
    filtersEl.innerHTML = '';

    const cats = collectDistinctCounts('categories', mediaPages);
    const catRow = document.createElement('div'); catRow.className='filter-row';
    const allCat = document.createElement('button'); allCat.textContent = `全部 (${mediaPages.length})`; if(filters.category==='all') allCat.classList.add('active');
    allCat.addEventListener('click', ()=>{ filters.category='all'; filters.tag='all'; filters.type='all'; saveUI(); renderFilters(); renderGallery(); });
    catRow.appendChild(allCat);
    cats.forEach(c=>{ const name = c[0], cnt = c[1]; const b=document.createElement('button'); b.textContent = `${name} (${cnt})`; if(filters.category===name) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.category=name; filters.tag='all'; filters.type='all'; saveUI(); renderFilters(); renderGallery(); }); catRow.appendChild(b); });
    filtersEl.appendChild(catRow);

    // base 集合：先按 category 过滤（types 列表基于当前 category）
    let baseForTagsAndTypes = mediaPages;
    if(filters.category && filters.category !== 'all'){
      baseForTagsAndTypes = baseForTagsAndTypes.filter(p=> Array.isArray(p.categories) ? p.categories.includes(filters.category) : false);
    }

    // types 行（基于 category）
    const types = collectDistinctCounts('types', baseForTagsAndTypes);
    const typeRow = document.createElement('div'); typeRow.className='filter-row';
    const allType = document.createElement('button'); allType.textContent='全部'; if(filters.type==='all') allType.classList.add('active'); allType.addEventListener('click', ()=>{ filters.type='all'; filters.tag='all'; saveUI(); renderFilters(); renderGallery(); }); typeRow.appendChild(allType);
    types.forEach(t=>{ const name = t[0], cnt = t[1]; const b=document.createElement('button'); b.textContent = `${name} (${cnt})`; if(filters.type===name) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.type=name; filters.tag='all'; saveUI(); renderFilters(); renderGallery(); }); typeRow.appendChild(b); });
    filtersEl.appendChild(typeRow);

    // 在 category + type 基础上计算 tags
    if(filters.type && filters.type !== 'all'){
      baseForTagsAndTypes = baseForTagsAndTypes.filter(p=> Array.isArray(p.types) ? p.types.includes(filters.type) : false);
    }

    const tags = collectDistinctCounts('tags', baseForTagsAndTypes);
    const tagRow = document.createElement('div'); tagRow.className='filter-row';
    const allTag = document.createElement('button'); allTag.textContent='全部'; if(filters.tag==='all') allTag.classList.add('active'); allTag.addEventListener('click', ()=>{ filters.tag='all'; saveUI(); renderFilters(); renderGallery(); }); tagRow.appendChild(allTag);
    tags.forEach(t=>{ const name = t[0]; const b=document.createElement('button'); b.textContent = `${name} (${t[1]})`; if(filters.tag===name) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.tag=name; saveUI(); renderFilters(); renderGallery(); }); tagRow.appendChild(b); });
    filtersEl.appendChild(tagRow);

    // year 行
    const years = collectYears(mediaPages);
    const yearRow = document.createElement('div'); yearRow.className='filter-row';
    const allYear = document.createElement('button'); allYear.textContent='全部'; if(filters.year==='all') allYear.classList.add('active'); allYear.addEventListener('click', ()=>{ filters.year='all'; saveUI(); renderFilters(); renderGallery(); }); yearRow.appendChild(allYear);
    years.forEach(y=>{ const b=document.createElement('button'); b.textContent=y; if(filters.year===y) b.classList.add('active'); b.addEventListener('click', ()=>{ filters.year=y; saveUI(); renderFilters(); renderGallery(); }); yearRow.appendChild(b); });
    filtersEl.appendChild(yearRow);

    // score 行
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
          overlay.innerText = p.shortReview ? p.shortReview : (p.description ? p.description : '');
          imgWrap.appendChild(overlay);
        }

        const year = getYearFromDate(p.datePublished);
        if(year){ const badge = document.createElement('div'); badge.className='year-badge'; badge.textContent = year; imgWrap.appendChild(badge); }
        if(p.score){ const r = document.createElement('div'); r.className='media-rating'; r.innerHTML = renderScoreHTML(p.score); imgWrap.appendChild(r); }

        card.appendChild(imgWrap);
      }

      const info = document.createElement('div'); info.className='info';
      const title = document.createElement('div'); title.className='title'; title.innerHTML = q ? highlight(p.title,q) : (p.title || '未命名'); info.appendChild(title);

      if(p.author){ const au = document.createElement('div'); au.className='author'; au.textContent = `${p.author}`; au.style.fontSize='1.2rem'; au.style.color='#000000ff'; info.appendChild(au); }

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

      // meta：type 左对齐，发布时间右对齐
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

  // 初始化
  initToolbar();
  applyDefaultCategoryOnce();
  renderFilters();
  renderGallery();

  // 暴露调试对象
  window.__media_app = { mediaPages, filters, sortState, renderGallery, renderFilters };

  function debounce(fn, wait){ let t=null; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; }

})();
