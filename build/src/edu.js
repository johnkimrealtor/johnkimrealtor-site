const jkEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const jkSafe = (u) => typeof u === 'string' && u.indexOf('https://') === 0 ? u : '';
const jkWait = (el, d) => { el.replaceChildren(); if (jkFail(el, d)) return true; if (d.status !== 'ok') { el.textContent = '—'; return true; } return false; };

dash.draw('commentary', (el) => {
  const S = dash.data('summary'), T = dash.data('types'), D = dash.data('districts');
  el.replaceChildren();
  if ([S, T, D].some((d) => d.status === 'error')) { jkFail(el, { status: 'error' }); return; }
  if ([S, T, D].some((d) => d.status !== 'ok')) { el.append(jkEl('li', '', '—')); return; }
  const c = S.data.find((r) => r.area === 'City of Toronto');
  if (!c) { el.append(jkEl('li', '', '—')); return; }
  const add = (t) => el.append(jkEl('li', '', t));
  const avg = Number(c.avg_price), med = Number(c.median_price), gap = avg / med - 1;
  add(jkT(`The average sale (${jkF.money(avg)}) ran ${jkF.pct(gap)} above the median (${jkF.money(med)}): a smaller number of high-end detached sales pull the average up, so the median is the better guide to a typical home.`,
    `평균 거래가(${jkF.money(avg)})가 중간 가격(${jkF.money(med)})보다 ${jkF.pct(gap)} 높습니다. 고가 단독주택 몇 건이 평균을 끌어올리기 때문에, 보통 집 시세는 중간 가격으로 보는 게 더 정확합니다.`));
  const moi = Number(c.moi), splp = Number(c.sp_lp);
  const mk = moi < 3 ? jkT('a seller’s market', '매도자 우위') : moi <= 6 ? jkT('a balanced market leaning toward buyers', '매수자 쪽으로 기운 균형 시장') : jkT('a buyer’s market', '매수자 우위');
  add(jkT(`Homes sold for ${jkF.pct(splp)} of list price on average with ${jkF.num1(moi)} months of inventory: ${mk}. Buyers have room to negotiate, especially on homes that have sat for a while.`,
    `평균 리스팅가의 ${jkF.pct(splp)}에 팔렸고 재고는 ${jkF.num1(moi)}개월 분량입니다. 즉 ${mk}입니다. 특히 오래 걸려 있는 매물은 가격 협상 여지가 있습니다.`));
  const ty = T.data.map((r) => ({ t: r.type, m: Number(r.to_median), d: Number(r.to_ldom) }));
  const fast = ty.reduce((a, b) => (b.d < a.d ? b : a)), slow = ty.reduce((a, b) => (b.d > a.d ? b : a));
  add(jkT(`${jkTypeLabel(fast.t)} homes sold fastest (${jkF.days(fast.d)} on average); ${jkTypeLabel(slow.t).toLowerCase()}s were slowest at ${jkF.days(slow.d)}, at a median of ${jkF.money(slow.m)}.`,
    `${jkTypeLabel(fast.t)}이(가) 가장 빨리 팔렸고(평균 ${jkF.days(fast.d)}), ${jkTypeLabel(slow.t)}은(는) ${jkF.days(slow.d)}로 가장 느렸습니다. 중간 가격은 ${jkF.money(slow.m)}입니다.`));
  const ds = D.data.filter((r) => Number(r.sales) >= 10).map((r) => ({ id: r.district, nb: r.neighbourhoods, m: Number(r.median_price), sp: Number(r.sp_lp) }));
  if (ds.length) {
    const hi = ds.reduce((a, b) => (b.m > a.m ? b : a)), lo = ds.reduce((a, b) => (b.m < a.m ? b : a));
    add(jkT(`Among districts with 10+ sales, ${hi.id} (${hi.nb}) had the highest median at ${jkF.short(hi.m)} and ${lo.id} (${lo.nb}) the lowest at ${jkF.short(lo.m)}.`,
      `거래 10건 이상 디스트릭트 중 ${hi.id}(${hi.nb})의 중간 가격이 ${jkF.short(hi.m)}로 가장 높고, ${lo.id}(${lo.nb})가 ${jkF.short(lo.m)}로 가장 낮았습니다.`));
    const over = ds.filter((r) => r.sp >= 1).length;
    add(jkT(`${over} of ${ds.length} of those districts sold at or above list on average, so well-priced homes in the right pockets still draw competing offers.`,
      `그중 ${ds.length}곳 가운데 ${over}곳은 평균적으로 리스팅가 이상에 팔렸습니다. 동네와 가격만 맞으면 여전히 경쟁 오퍼가 붙습니다.`));
  }
});

dash.draw('outlook', (el) => {
  const d = dash.data('outlook');
  if (jkWait(el, d)) return;
  d.data.forEach((r) => {
    const li = jkEl('li', '', jkT(r.en, r.ko));
    const src = jkEl('span', 'src');
    const u = jkSafe(r.url);
    if (u) { const a = jkEl('a', '', r.source); a.href = u; a.target = '_blank'; a.rel = 'noopener'; src.append(a); } else src.append(document.createTextNode(r.source));
    src.append(document.createTextNode(' · ' + r.date));
    li.append(src); el.append(li);
  });
});

dash.draw('reviews', (el) => {
  const d = dash.data('reviews');
  if (jkWait(el, d)) return;
  const r = d.data.find((x) => x.item === 'google_reviews');
  if (!r) { el.textContent = '—'; return; }
  const top = jkEl('div', 'top');
  const n = Number(r.count);
  if (r.rating) top.append(jkEl('span', 'stars', '★'.repeat(Math.round(Number(r.rating)) || 0)));
  if (r.count !== '' && n > 0) {
    top.append(jkEl('span', 'big', jkF.count(n)), jkEl('span', '', jkT('Google reviews', '개의 구글 리뷰') + (r.rating ? ' · ' + r.rating : '')));
  } else {
    top.append(jkEl('span', 'big', jkT('Google reviews', '구글 리뷰')));
  }
  el.append(top);
  const q = jkT(r.quote_en, r.quote_ko);
  if (q) {
    const bq = jkEl('blockquote', '', q);
    if (r.author) bq.append(jkEl('footer', '', '— ' + r.author + (r.as_of ? ' · ' + r.as_of : '')));
    el.append(bq);
  } else {
    el.append(jkEl('p', '', jkT('Read what clients say about working with John on Google.', '고객분들이 John과의 거래에 대해 남긴 후기를 구글에서 확인해 보세요.')));
  }
  const u = jkSafe(r.url);
  if (u) { const b = jkEl('div', 'jk-btns'); const a = jkEl('a', '', jkT('Read all reviews →', '리뷰 전체 보기 →')); a.href = u; a.target = '_blank'; a.rel = 'noopener'; b.append(a); el.append(b); }
});

dash.draw('posts', (el) => {
  const d = dash.data('posts');
  if (jkWait(el, d)) return;
  [...d.data].sort((a, b) => String(b.date).localeCompare(String(a.date))).forEach((p) => {
    const art = jkEl('article', 'jk-post');
    const meta = jkEl('div', 'meta');
    meta.append(jkEl('span', 'tag', jkT(p.cat_en, p.cat_ko)), document.createTextNode(p.date));
    art.append(meta, jkEl('h4', '', jkT(p.title_en, p.title_ko)), jkEl('p', '', jkT(p.sum_en, p.sum_ko)));
    const body = jkT(p.body_en, p.body_ko);
    if (body) {
      const det = jkEl('details'); det.append(jkEl('summary', '', jkT('Read more', '전체 읽기')));
      String(body).split(String.fromCharCode(10)).filter(Boolean).forEach((para) => det.append(jkEl('p', '', para)));
      art.append(det);
    }
    el.append(art);
  });
});

dash.draw('news', (el) => {
  const d = dash.data('news');
  if (jkWait(el, d)) return;
  [...d.data].sort((a, b) => String(b.date).localeCompare(String(a.date))).forEach((n) => {
    const li = jkEl('li');
    li.append(jkEl('div', 'meta', n.source + ' · ' + n.date));
    const u = jkSafe(n.url), t = jkT(n.title_en, n.title_ko);
    if (u) { const a = jkEl('a', '', t); a.href = u; a.target = '_blank'; a.rel = 'noopener'; li.append(a); } else li.append(jkEl('b', '', t));
    li.append(jkEl('p', '', jkT(n.sum_en, n.sum_ko)));
    el.append(li);
  });
});

window.jkState.mdist = '';
dash.draw('map-detail', (tb) => {
  tb.replaceChildren();
  const d = dash.data('districts');
  if (d.status !== 'ok') return;
  const rows = d.data.filter((r) => !jkState.mdist || r.district === jkState.mdist).sort((a, b) => Number(b.median_price) - Number(a.median_price));
  const m = (v) => (v == null || v === '' ? '–' : jkF.money(Number(v)));
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    if (r.district === jkState.mdist) tr.className = 'sel';
    const cell = (t, c) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; tr.append(td); };
    cell(r.district, 'l');
    cell(r.neighbourhoods, 'l nm');
    cell(jkF.count(Number(r.sales)), '');
    cell(m(r.median_price), '');
    cell(m(r.avg_price), 'opt');
    cell(r.sp_lp == null ? '–' : jkF.pct(Number(r.sp_lp)), '');
    cell(r.ldom == null ? '–' : String(r.ldom), '');
    cell(r.new_listings == null ? '–' : jkF.count(Number(r.new_listings)), 'opt');
    cell(m(r.condo_median_price), 'opt');
    cell(m(r.detached_median_price), 'opt');
    tb.append(tr);
  });
});
dash.draw('map-hint', (el) => {
  const d = dash.data('districts');
  const r = d.status === 'ok' && jkState.mdist ? d.data.find((x) => x.district === jkState.mdist) : null;
  el.textContent = r ? r.neighbourhoods : '—';
  document.querySelectorAll('.jk-hint-all').forEach((x) => { x.hidden = !!r; });
  document.querySelectorAll('.jk-hint-one').forEach((x) => { x.hidden = !r; });
});

dash.draw('mbasics', (el) => {
  const d = dash.data('mortgage_basics');
  if (jkWait(el, d)) return;
  [...d.data].sort((a, b) => Number(a.order) - Number(b.order)).forEach((r) => {
    const det = jkEl('details', 'jk-basic');
    det.append(jkEl('summary', '', jkT(r.t_en, r.t_ko)), jkEl('p', '', jkT(r.en, r.ko)));
    el.append(det);
  });
});

dash.draw('videos', (el) => {
  const d = dash.data('videos');
  if (jkWait(el, d)) return;
  d.data.filter((v) => jkState.lang === 'ko' || v.lang === 'en').forEach((v) => {
    const u = jkSafe(v.url);
    if (!u) return;
    const a = jkEl('a', 'jk-vid'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
    const play = jkEl('span', 'pl', '▶');
    const txt = jkEl('span', 'tx');
    txt.append(jkEl('span', 'tp', jkT(v.topic_en, v.topic_ko)), jkEl('span', 'tt', v.title));
    a.append(play, txt); el.append(a);
  });
});

dash.draw('mnews', (el) => {
  const d = dash.data('mortgage_news');
  if (jkWait(el, d)) return;
  [...d.data].sort((a, b) => String(b.date).localeCompare(String(a.date))).forEach((n) => {
    const li = jkEl('li');
    li.append(jkEl('div', 'meta', n.source + ' · ' + n.date));
    const u = jkSafe(n.url), t = jkT(n.title_en, n.title_ko);
    if (u) { const a = jkEl('a', '', t); a.href = u; a.target = '_blank'; a.rel = 'noopener'; li.append(a); } else li.append(jkEl('b', '', t));
    li.append(jkEl('p', '', jkT(n.sum_en, n.sum_ko)));
    el.append(li);
  });
});

document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
  const t = document.querySelector('.jk-tabs button[data-tab=' + b.dataset.goto + ']');
  if (t) { t.click(); t.scrollIntoView({ block: 'start' }); }
}));
document.querySelectorAll('button[data-mdist]').forEach((b) => b.addEventListener('click', () => {
  jkState.mdist = '';
  ['map', 'map-detail', 'map-hint'].forEach((n) => dash.draw(n));
}));

// Boot: draw everything, then open the tab named in the URL hash.
dash.drawAll();
(() => {
  const want = location.hash.replace('#tab-', '');
  const btn = [...document.querySelectorAll('.jk-tabs button[data-tab]')].find((b) => b.dataset.tab === want);
  if (btn) btn.click();
})();
