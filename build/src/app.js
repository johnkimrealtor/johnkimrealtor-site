dash.calc('bed_yield', {
  inputs: ['condo_bedrooms'],
  title: 'Gross rental yield by bedrooms',
  fn: (condo_bedrooms) => condo_bedrooms.map((r) => ({ bedrooms: r.bedrooms, gross_yield: (Number(r.avg_rent_q2) * 12) / Number(r.median_sold_3mo) }))
});

dash.calc('speed_bands', {
  inputs: ['districts'],
  title: 'Days on listing by price band',
  fn: (districts) => [
    ['under_700k', 0, 700000], ['700k_1m', 700000, 1000000], ['1m_1_5m', 1000000, 1500000], ['over_1_5m', 1500000, Infinity]
  ].map(([band, lo, hi], order) => {
    const g = districts.filter((r) => Number(r.median_price) >= lo && Number(r.median_price) < hi);
    const s = g.reduce((a, r) => a + Number(r.sales), 0);
    return { band, order, districts: g.length, sales: s, ldom: s ? Math.round(g.reduce((a, r) => a + Number(r.ldom) * Number(r.sales), 0) / s) : null };
  })
});

dash.calc('listing_view', {
  inputs: ['listings', 'districts'],
  title: 'Picked listings vs. district median',
  fn: (listings, districts) => listings.filter((l) => l && l.mls).map((l) => {
    const d = districts.find((x) => x.district === l.district) || {};
    const med = l.type === 'condo' ? d.condo_median_price : l.type === 'det' ? d.detached_median_price : d.median_price;
    return { ...l, area_en: d.area_en || '', area_ko: d.area_ko || '', district_median: med == null ? null : Number(med), vs_median: med && l.list_price ? Number(l.list_price) / Number(med) - 1 : null };
  })
});

window.jkState = { lang: 'ko', tab: 'prices', mtype: 'all', dtype: 'all', area: 'North York', drange: 12, ftype: 'all', ltype: '', larea: '', rrange: 60 };
window.jkT = (en, ko) => jkState.lang === 'ko' ? ko : en;
window.jkBlues = ['#8fd3f4', '#4fb3e8', '#2196d9', '#1673b8', '#0f5596', '#0b3d6e'];
window.jkF = {
  count: d3.format(','),
  money: (v) => '$' + d3.format(',')(Math.round(v)),
  short: (v) => v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1e3) + 'K',
  pct: d3.format('.0%'),
  pct1: d3.format('.1%'),
  num1: d3.format('.1f'),
  rate: (v) => d3.format('.2f')(v * 100) + '%',
  signed: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d3.format('.1%')(Math.abs(v)),
  days: (v) => v + jkT(' days', '일')
};
window.jkTypeName = { det: ['Detached', '단독주택'], semi: ['Semi-detached', '세미'], town: ['Freehold townhouse', '타운하우스'], condo: ['Condo apartment', '콘도 아파트'] };
window.jkTypeLabel = (t) => (jkTypeName[t] || [t, t])[jkState.lang === 'ko' ? 1 : 0];
window.jkWhere = (el) => { const w = (el.dataset.where || '').split('='); return [w[0], w.slice(1).join('=')]; };
window.jkRow = (src, el) => { const d = dash.data(src); if (d.status !== 'ok') return null; const [k, v] = jkWhere(el); return d.data.find((r) => String(r[k]) === v) || null; };
window.jkTip = (el) => {
  const tip = document.createElement('div'); tip.className = 'jk-tip'; tip.hidden = true; el.append(tip);
  return {
    show(ev, title, lines) {
      tip.replaceChildren();
      const t = document.createElement('div'); t.className = 't'; t.textContent = title; tip.append(t);
      lines.forEach((s) => { const d = document.createElement('div'); d.textContent = s; tip.append(d); });
      tip.hidden = false;
      const [px, py] = d3.pointer(ev, el);
      const W = el.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(0, Math.min(px + 12, W - tw)) + 'px';
      tip.style.top = Math.max(0, py - th - 10) + 'px';
    },
    hide() { tip.hidden = true; }
  };
};
window.jkFail = (el, d) => {
  if (d.status !== 'error') return false;
  const s = document.createElement('span');
  s.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:.4rem;min-height:200px;color:var(--color-fg-muted);font-size:12px';
  const dot = document.createElement('span');
  dot.style.cssText = 'width:.375rem;height:.375rem;border-radius:50%;background:var(--color-bad);display:inline-block';
  s.append(dot, document.createTextNode('Failed to load')); el.append(s); return true;
};
window.jkAxis = (g) => { g.attr('font-size', null).attr('font-family', null); g.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 11); g.selectAll('line').attr('stroke', 'var(--cds-chart-grid)'); g.select('.domain').attr('stroke', 'var(--cds-chart-axis)'); };
window.jkSvg = (el, W, H) => d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);

dash.draw('sum', (el) => {
  const r = jkRow(el.dataset.source, el);
  const v = r ? r[el.dataset.field] : null;
  el.textContent = v == null ? '—' : jkF[el.dataset.fmt](Number(v));
});
dash.draw('rate', (el) => {
  const r = jkRow('current_rates', el);
  el.textContent = r ? jkF.rate(Number(r.value)) : '—';
});
dash.draw('fact', (el) => {
  const r = jkRow('cancellations', el);
  if (!r) { el.textContent = '—'; return; }
  const v = Number(r.value);
  el.textContent = r.kind === 'count' ? jkF.count(v) : r.kind === 'approx' ? '~' + d3.format('.0%')(v) : d3.format('.1~%')(v);
});

const jkListRows = () => {
  const d = dash.data('listing_view');
  if (d.status !== 'ok') return null;
  return d.data.filter((r) => (!jkState.ltype || r.type === jkState.ltype) && (!jkState.larea || r.area_en === jkState.larea))
    .sort((a, b) => (a.vs_median == null ? 9 : a.vs_median) - (b.vs_median == null ? 9 : b.vs_median));
};
dash.draw('listing-body', (tb) => {
  tb.replaceChildren();
  const rows = jkListRows();
  if (!rows) return;
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const cell = (t, c) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; tr.append(td); return td; };
    cell(r.address || '', 'l');
    cell(jkTypeLabel(r.type), 'l');
    cell(r.district || '', 'l opt');
    cell(r.beds == null ? '–' : String(r.beds), '');
    cell(r.baths == null ? '–' : String(r.baths), '');
    cell(r.sqft ? String(r.sqft) : '–', 'opt');
    cell(r.list_price ? jkF.money(Number(r.list_price)) : '–', '');
    cell(r.vs_median == null ? '–' : jkF.signed(r.vs_median), 'opt');
    cell(r.dom == null ? '–' : String(r.dom), '');
    const td = cell('', 'l');
    const url = String(r.url || '');
    if (/^https:[/][/]/.test(url)) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.mls; td.append(a); } else { td.textContent = r.mls; }
    tb.append(tr);
  });
});
dash.draw('listing-empty', (el) => {
  const d = dash.data('listing_view');
  const rows = jkListRows();
  if (d.status !== 'ok' || !rows) { el.textContent = '—'; el.style.display = ''; return; }
  if (rows.length) { el.textContent = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  el.textContent = d.data.length
    ? jkT('No picked listings match this type and area yet. Try another filter.', '이 유형·지역에 맞는 추천 매물이 아직 없습니다. 다른 조건을 골라 보세요.')
    : jkT('Picked listings will appear here soon. John is selecting homes that are priced well for their type and neighbourhood.', '곧 추천 매물이 여기에 올라옵니다. 유형과 동네 시세에 비해 괜찮은 매물을 John이 고르고 있습니다.');
});

dash.draw('calc', (el) => {
  el.replaceChildren();
  const q = (id) => document.getElementById(id);
  const rateEl = q('jk-rate');
  if (rateEl && rateEl.value === '') {
    const cr = dash.data('current_rates');
    const r = cr.status === 'ok' ? cr.data.find((x) => x.item === 'best_5y_fixed_insured') : null;
    if (r) rateEl.value = (Number(r.value) * 100).toFixed(2);
  }
  const P = Number(q('jk-price') && q('jk-price').value) || 0;
  const dp = Math.min(100, Math.max(0, Number(q('jk-down') && q('jk-down').value) || 0)) / 100;
  const rate = (Number(rateEl && rateEl.value) || 0) / 100;
  const am = Number(q('jk-amort') && q('jk-amort').value) || 25;
  const D = P * dp;
  const minD = P <= 500000 ? P * 0.05 : P < 1500000 ? 25000 + (P - 500000) * 0.10 : P * 0.20;
  const insured = dp < 0.2 && P < 1500000;
  const prem = insured ? (dp < 0.10 ? 0.04 : dp < 0.15 ? 0.031 : 0.028) + (am === 30 ? 0.002 : 0) : 0;
  const base = P - D, L = base * (1 + prem);
  const pay = (r) => { if (L <= 0) return 0; const i = Math.pow(1 + r / 2, 1 / 6) - 1, n = am * 12; return i === 0 ? L / n : L * i / (1 - Math.pow(1 + i, -n)); };
  const stress = Math.max(rate + 0.02, 0.0525);
  const box = document.createElement('div'); box.className = 'jk-out';
  const add = (k, v, hl) => { const d = document.createElement('div'); if (hl) d.className = 'hl'; const a = document.createElement('div'); a.className = 'k'; a.textContent = k; const b = document.createElement('div'); b.className = 'v'; b.textContent = v; d.append(a, b); box.append(d); };
  add(jkT('Monthly payment', '월 상환액'), jkF.money(pay(rate)), true);
  add(jkT('Down payment', '다운페이'), jkF.money(D));
  add(jkT('CMHC insurance', 'CMHC 보험료'), insured ? jkF.money(base * prem) + ' (' + d3.format('.2~%')(prem) + ')' : jkT('None', '없음'));
  add(jkT('Total mortgage', '총 대출액'), jkF.money(L));
  add(jkT('Stress-test rate', '스트레스 테스트 금리'), jkF.rate(stress));
  add(jkT('Payment at stress rate', '스트레스 금리 상환액'), jkF.money(pay(stress)));
  el.append(box);
  const warn = (t) => { const p = document.createElement('p'); p.className = 'jk-warn'; p.textContent = t; el.append(p); };
  if (P > 0 && D + 0.5 < minD) warn(jkT(`Minimum down payment at this price is ${jkF.money(minD)}.`, `이 가격의 최소 다운페이는 ${jkF.money(minD)}입니다.`));
  if (P >= 1500000 && dp < 0.2) warn(jkT('Homes at $1.5M or more need at least 20% down.', '150만 달러 이상 주택은 최소 20% 다운페이가 필요합니다.'));
});
