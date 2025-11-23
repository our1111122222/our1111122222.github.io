// static/js/micro-library.js — 更新版
document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = document.getElementById('micro-raw');
    const feed = document.getElementById('micro-feed');
    const countEl = document.getElementById('micro-count');
    if (!raw || !feed) return;

    // config from shortcode
    const avatarUrl = raw.dataset.avatar || '/images/avatar.png';
    const limit = Number(raw.dataset.limit || 30);

    // collect day blocks
    const days = Array.from(raw.querySelectorAll('.micro-day'));
    const items = [];

    days.forEach(dayEl => {
      const dayName = dayEl.dataset.day || '';
      const lis = dayEl.querySelectorAll('li');
      lis.forEach((li, idx) => {
        const text = li.textContent ? li.textContent.trim() : '';
        const timeMatch = text.match(/^(\d{1,2}:\d{2})\s*(.*)$/s);
        let time = '', html = '';
        if (timeMatch) {
          time = timeMatch[1];
          html = li.innerHTML.replace(/^\s*\d{1,2}:\d{2}\s*/, '');
        } else {
          time = '';
          html = li.innerHTML;
        }
        // record an approximate sort key: day + time (time '' becomes '99:99' so goes after)
        const sortKey = (dayName ? dayName : '0000-00-00') + ' ' + (time ? time : '99:99');
        items.push({ time, html, day: dayName, sortKey, originalIndex: idx });
      });
    });

    // sort by day desc, then time asc within day (so newer day first, inside day chronological)
    items.sort((a,b) => {
      if (a.sortKey < b.sortKey) return 1;
      if (a.sortKey > b.sortKey) return -1;
      return 0;
    });

    // render up to limit
    let shown = 0;
    for (let i = 0; i < items.length && shown < limit; i++) {
      const it = items[i];

      const card = document.createElement('article');
      card.className = 'micro-card';

      // avatar: if avatarUrl looks like an image path, use <img>, else show first char
      const avatar = document.createElement('div');
      avatar.className = 'micro-avatar';
      const lower = (avatarUrl || '').toLowerCase();
      if (/\.(jpg|jpeg|png|gif|svg|webp)(\?.*)?$/.test(lower) || avatarUrl.startsWith('/') || avatarUrl.startsWith('http')) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = 'avatar';
        avatar.appendChild(img);
      } else {
        // fallback: use first char of "生年不满百" or emoji
        avatar.textContent = (typeof avatarUrl === 'string' && avatarUrl.length) ? avatarUrl.charAt(0) : '生';
      }

      const body = document.createElement('div');
      body.className = 'micro-body';

      const meta = document.createElement('div');
      meta.className = 'micro-meta';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';

      // hide author per request: do NOT render author visible

      const time = document.createElement('div');
      time.className = 'micro-time';
      // show full date and time (if have both)
      const dayStr = it.day || '';
      time.textContent = (dayStr ? dayStr : '') + (it.time ? (' · ' + it.time) : '');

      left.appendChild(time);
      meta.appendChild(left);

      body.appendChild(meta);

      const content = document.createElement('div');
      content.className = 'micro-content';
      // keep HTML (images, links) from original li
      content.innerHTML = it.html;

      body.appendChild(content);

      // actions: only keep placeholder for future (no copy/delete now)
      const actions = document.createElement('div');
      actions.className = 'micro-actions';
      // (no copy button as requested)

      body.appendChild(actions);

      card.appendChild(avatar);
      card.appendChild(body);

      feed.appendChild(card);
      shown++;
    }

    countEl.textContent = shown.toString();
  } catch (err) {
    console.error('micro-library error:', err);
  }
});
