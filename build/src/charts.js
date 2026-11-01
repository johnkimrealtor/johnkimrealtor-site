window.JK_OUTLINE = [[-79.545,43.585],[-79.590,43.620],[-79.620,43.660],[-79.640,43.720],[-79.639,43.750],[-79.590,43.762],[-79.520,43.778],[-79.420,43.797],[-79.330,43.812],[-79.230,43.840],[-79.170,43.855],[-79.150,43.830],[-79.125,43.800],[-79.115,43.790],[-79.150,43.770],[-79.200,43.735],[-79.240,43.710],[-79.280,43.672],[-79.320,43.660],[-79.345,43.640],[-79.380,43.637],[-79.400,43.633],[-79.440,43.630],[-79.470,43.628],[-79.500,43.618],[-79.520,43.598],[-79.545,43.585]];
const jkMapFields = { all: ['median_price', 'sales', 'avg_price'], condo: ['condo_median_price', 'condo_sales', 'condo_avg_price'], det: ['detached_median_price', 'detached_sales', 'detached_avg_price'] };

dash.draw('map', (el) => {
  el.replaceChildren();
  const d = dash.data('districts');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const [mf, nf, af] = jkMapFields[jkState.mtype];
  const rows = d.data.filter((r) => r[mf] != null && Number(r[nf]) > 0).map((r) => ({ ...r, m: Number(r[mf]), n: Number(r[nf]), a: Number(r[af]) })).sort((p, q) => q.n - p.n);
  const W = el.clientWidth || 700, k = Math.cos(43.7 * Math.PI / 180), pad = 26;
  const xs = JK_OUTLINE.map((p) => p[0] * k), ys = JK_OUTLINE.map((p) => p[1]);
  const minx = d3.min(xs), maxx = d3.max(xs), miny = d3.min(ys), maxy = d3.max(ys);
  const sc = Math.min((W - 2 * pad) / (maxx - minx), (Math.min(560, W * 0.75) - 2 * pad) / (maxy - miny));
  const H = (maxy - miny) * sc + 2 * pad, ox = (W - (maxx - minx) * sc) / 2;
  const px = (lon) => ox + (lon * k - minx) * sc, py = (lat) => pad + (maxy - lat) * sc;
  const svg = jkSvg(el, W, H);
  svg.append('path').attr('d', 'M' + JK_OUTLINE.map((p) => px(p[0]) + ',' + py(p[1])).join('L') + 'Z')
    .style('fill', 'color-mix(in srgb, #2196d9 7%, transparent)').attr('stroke', jkBlues[2]).attr('stroke-width', 1.5).attr('stroke-linejoin', 'round');
  svg.append('text').attr('x', px(-79.33)).attr('y', py(43.615)).attr('text-anchor', 'middle').attr('font-size', 12).attr('letter-spacing', '.3em').attr('fill', jkBlues[2]).text(jkT('LAKE ONTARIO', '온타리오 호수'));
  const lo = d3.min(rows, (r) => r.m), hi = d3.max(rows, (r) => r.m);
  const t = d3.scaleLog([lo, hi], [0, 1]).clamp(true);
  const col = (v) => d3.interpolateRgb('#d4ecfa', '#0a2a52')(t(v));
  const rad = d3.scaleSqrt([0, d3.max(rows, (r) => r.n)], [0, W < 520 ? 20 : 30]);
  const tip = jkTip(el);
  const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(${px(r.lon)},${py(r.lat)})`);
  g.append('circle').attr('r', (r) => Math.max(4, rad(r.n))).attr('fill', (r) => col(r.m)).attr('fill-opacity', 0.92).attr('stroke', '#fff').attr('stroke-width', 1.5)
    .on('pointermove', (ev, r) => tip.show(ev, `${r.neighbourhoods} (${r.district})`, [jkT(`Median ${jkF.money(r.m)}`, `중간 ${jkF.money(r.m)}`), jkT(`Average ${jkF.money(r.a)}`, `평균 ${jkF.money(r.a)}`), jkT(`Sales ${jkF.count(r.n)}`, `거래 ${jkF.count(r.n)}건`)]))
    .on('pointerleave', () => tip.hide())
    .on('click', (ev, r) => { jkState.mdist = jkState.mdist === r.district ? '' : r.district; ['map', 'map-detail', 'map-hint'].forEach((n) => dash.draw(n)); })
    .style('cursor', 'pointer').attr('stroke', (r) => (r.district === jkState.mdist ? '#f5b400' : '#fff')).attr('stroke-width', (r) => (r.district === jkState.mdist ? 4 : 1.5));
  g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', 10).attr('font-weight', 700).attr('pointer-events', 'none')
    .attr('fill', (r) => (t(r.m) > 0.45 ? '#fff' : '#0b3d6e')).text((r) => (rad(r.n) >= 11 ? r.district : ''));
  const leg = document.createElement('div'); leg.className = 'jk-legend';
  const bar = document.createElement('span'); bar.style.cssText = 'display:inline-block;width:140px;height:10px;border-radius:5px;background:linear-gradient(90deg,#d4ecfa,#0a2a52)';
  const a = document.createElement('span'); a.textContent = jkF.short(lo);
  const b = document.createElement('span'); b.textContent = jkF.short(hi);
  const s = document.createElement('span'); s.textContent = jkT('Circle size = number of sales', '원 크기 = 거래 건수');
  leg.append(a, bar, b, s); el.append(leg);
});

dash.draw('types', (el) => {
  el.replaceChildren();
  const d = dash.data('types');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const rows = [...d.data].map((r) => ({ ...r, avg: Number(r.to_avg), med: Number(r.to_median) })).sort((p, q) => q.avg - p.avg);
  const W = el.clientWidth || 400, H = rows.length * 46 + 20, left = W < 420 ? 110 : 140, right = 74;
  const svg = jkSvg(el, W, H);
  const x = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.avg, r.med))], [left, W - right]);
  const y = d3.scaleBand(rows.map((r) => r.type), [4, H - 10]).padding(0.3);
  const tip = jkTip(el);
  const g = svg.append('g').selectAll('g').data(rows).join('g');
  g.append('text').attr('x', left - 10).attr('y', (r) => y(r.type) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', 700).attr('fill', 'var(--color-fg)').text((r) => jkTypeLabel(r.type));
  g.append('rect').attr('x', left).attr('y', (r) => y(r.type)).attr('height', y.bandwidth()).attr('width', (r) => x(r.avg) - left).attr('rx', 3).attr('fill', (r, i) => jkBlues[5 - i]);
  g.append('line').attr('x1', (r) => x(r.med)).attr('x2', (r) => x(r.med)).attr('y1', (r) => y(r.type) - 3).attr('y2', (r) => y(r.type) + y.bandwidth() + 3).attr('stroke', 'var(--color-fg)').attr('stroke-width', 2);
  g.append('text').attr('x', (r) => Math.max(x(r.avg), x(r.med)) + 6).attr('y', (r) => y(r.type) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((r) => jkF.short(r.avg));
  g.append('rect').attr('x', 0).attr('width', W).attr('y', (r) => y(r.type)).attr('height', y.bandwidth()).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, jkTypeLabel(r.type), [jkT(`Average ${jkF.money(r.avg)}`, `평균 ${jkF.money(r.avg)}`), jkT(`Median ${jkF.money(r.med)}`, `중간 ${jkF.money(r.med)}`), jkT(`Sales ${jkF.count(r.to_sales)}`, `거래 ${jkF.count(r.to_sales)}건`)]))
    .on('pointerleave', () => tip.hide());
});

dash.draw('beds', (el) => {
  el.replaceChildren();
  const d = dash.data('condo_bedrooms'), yv = dash.data('bed_yield');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const yl = yv.status === 'ok' ? yv.data : [];
  const rows = d.data.map((r) => ({ ...r, p: Number(r.median_sold_3mo), rent: Number(r.avg_rent_q2), y: (yl.find((z) => z.bedrooms === r.bedrooms) || {}).gross_yield }));
  const W = el.clientWidth || 400, H = rows.length * 58 + 16, left = 66, right = W < 420 ? 60 : 200;
  const svg = jkSvg(el, W, H);
  const x = d3.scaleLinear([0, d3.max(rows, (r) => r.p)], [left, W - right]);
  const y = d3.scaleBand(rows.map((r) => r.bedrooms), [4, H - 8]).padding(0.32);
  const tip = jkTip(el);
  const lab = (n) => jkT(n + (n === 1 ? ' bed' : ' beds'), '침실 ' + n);
  const g = svg.append('g').selectAll('g').data(rows).join('g');
  g.append('text').attr('x', left - 10).attr('y', (r) => y(r.bedrooms) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', 700).attr('fill', 'var(--color-fg)').text((r) => lab(r.bedrooms));
  g.append('rect').attr('x', left).attr('y', (r) => y(r.bedrooms)).attr('height', y.bandwidth()).attr('width', (r) => x(r.p) - left).attr('rx', 3).attr('fill', (r, i) => jkBlues[2 + i]);
  g.append('text').attr('x', (r) => x(r.p) + 6).attr('y', (r) => y(r.bedrooms) + y.bandwidth() / 2 - (W < 420 ? 0 : 7)).attr('dy', '0.35em').attr('font-size', 12).attr('font-weight', 700).attr('fill', 'var(--color-fg)').text((r) => jkF.short(r.p));
  if (W >= 420) g.append('text').attr('x', (r) => x(r.p) + 6).attr('y', (r) => y(r.bedrooms) + y.bandwidth() / 2 + 9).attr('dy', '0.35em').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)')
    .text((r) => jkT(`rent ${jkF.money(r.rent)}/mo · yield ${r.y == null ? '–' : d3.format('.1%')(r.y)}`, `월세 ${jkF.money(r.rent)} · 수익률 ${r.y == null ? '–' : d3.format('.1%')(r.y)}`));
  g.append('rect').attr('x', 0).attr('width', W).attr('y', (r) => y(r.bedrooms)).attr('height', y.bandwidth()).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, lab(r.bedrooms), [jkT(`Median sold (3 mo) ${jkF.money(r.p)}`, `중간 거래가(3개월) ${jkF.money(r.p)}`), jkT(`Average rent Q2 2026 ${jkF.money(r.rent)}`, `2026년 2분기 평균 월세 ${jkF.money(r.rent)}`), jkT(`Gross yield ${r.y == null ? '–' : d3.format('.1%')(r.y)}`, `총 임대수익률 ${r.y == null ? '–' : d3.format('.1%')(r.y)}`)]))
    .on('pointerleave', () => tip.hide());
});

const jkDField = { all: ['median_price', 'avg_price', 'sales'], condo: ['condo_median_price', 'condo_avg_price', 'condo_sales'], det: ['detached_median_price', 'detached_avg_price', 'detached_sales'] };
dash.draw('districts', (el) => {
  el.replaceChildren();
  const d = dash.data('districts');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const [mf, af, sf] = jkDField[jkState.dtype];
  const rows = d.data.filter((r) => !jkState.area || r.area_en === jkState.area).filter((r) => r[mf] != null && Number(r[sf]) > 0)
    .map((r) => ({ ...r, m: Number(r[mf]), a: Number(r[af]), n: Number(r[sf]) })).sort((p, q) => q.m - p.m);
  const W = el.clientWidth || 600, narrow = W < 560, top = 4, bottom = 24, H = top + bottom + rows.length * 30;
  const svg = jkSvg(el, W, H);
  const label = (r) => narrow ? r.district : `${r.district}  ${r.neighbourhoods}`;
  const meas = svg.append('g').attr('font-size', 12); let lm = 0;
  rows.forEach((r) => { lm = Math.max(lm, meas.append('text').text(label(r)).node().getComputedTextLength()); }); meas.remove();
  const left = Math.min(lm + 14, W * 0.55), right = 64;
  const x = d3.scaleLinear([0, d3.max(rows, (r) => r.m) || 1], [left, W - right]);
  const y = d3.scaleBand(rows.map((r) => r.district), [top, H - bottom]).padding(0.25);
  svg.append('g').attr('transform', `translate(0,${H - bottom})`).call(d3.axisBottom(x).ticks(narrow ? 3 : 5).tickFormat(jkF.short).tickSizeOuter(0)).call(jkAxis);
  const g = svg.append('g').selectAll('g').data(rows).join('g');
  g.append('text').attr('x', left - 8).attr('y', (r) => y(r.district) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('fill', 'var(--color-fg)').text(label)
    .each(function () { let s = this.textContent; while (this.getComputedTextLength() > left - 12 && s.length > 4) { s = s.slice(0, -2); this.textContent = s + '…'; } });
  g.append('rect').attr('x', left).attr('y', (r) => y(r.district)).attr('height', y.bandwidth()).attr('width', (r) => Math.max(1, x(r.m) - left)).attr('rx', 3)
    .attr('fill', (r) => r.area_en === 'North York' ? jkBlues[4] : jkBlues[2]).attr('opacity', (r) => r.n < 10 ? 0.4 : 1);
  g.append('text').attr('x', (r) => x(r.m) + 6).attr('y', (r) => y(r.district) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((r) => jkF.short(r.m));
  const tip = jkTip(el);
  g.append('rect').attr('x', 0).attr('width', W).attr('y', (r) => y(r.district) - 2).attr('height', y.bandwidth() + 4).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, `${r.neighbourhoods} (${r.district})`, [jkT(`Median ${jkF.money(r.m)}`, `중간 ${jkF.money(r.m)}`), jkT(`Average ${jkF.money(r.a)}`, `평균 ${jkF.money(r.a)}`), jkT(`Sales ${jkF.count(r.n)}`, `거래 ${jkF.count(r.n)}건`)]))
    .on('pointerleave', () => tip.hide());
});

const jkMonth = (m) => new Date(m + '-01T00:00:00Z');
const jkMLabel = (dt, long) => jkState.lang === 'ko' ? (long ? dt.getUTCFullYear() + '년 ' : (dt.getUTCMonth() === 0 ? String(dt.getUTCFullYear()).slice(2) + '년 ' : '')) + (dt.getUTCMonth() + 1) + '월' : d3.utcFormat(long ? '%B %Y' : (dt.getUTCMonth() === 0 ? '%b %Y' : '%b'))(dt);

dash.draw('domtrend', (el) => {
  el.replaceChildren();
  const d = dash.data('condo_dom_trend');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const all = d.data.map((r) => ({ dt: jkMonth(r.month), v: Number(r.condo_ldom) })).sort((p, q) => p.dt - q.dt);
  const rows = all.slice(-jkState.drange);
  const W = el.clientWidth || 600, H = 240, m = { t: 18, r: 18, b: 28, l: 36 };
  const svg = jkSvg(el, W, H);
  const x = d3.scaleUtc([rows[0].dt, rows[rows.length - 1].dt], [m.l, W - m.r]);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => r.v) * 1.15], [H - m.b, m.t]);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 8).tickFormat((t) => jkMLabel(t)).tickSizeOuter(0)).call(jkAxis);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r))).call(jkAxis).call((g) => g.select('.domain').remove());
  const area = d3.area().x((r) => x(r.dt)).y0(H - m.b).y1((r) => y(r.v));
  svg.append('path').datum(rows).attr('d', area).attr('fill', jkBlues[1]).attr('fill-opacity', 0.18);
  svg.append('path').datum(rows).attr('d', d3.line().x((r) => x(r.dt)).y((r) => y(r.v))).attr('fill', 'none').attr('stroke', jkBlues[4]).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  const tip = jkTip(el);
  svg.append('g').selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(r.dt)).attr('cy', (r) => y(r.v)).attr('r', 4).attr('fill', 'var(--color-panel)').attr('stroke', jkBlues[4]).attr('stroke-width', 2);
  const last = rows[rows.length - 1];
  svg.append('text').attr('x', x(last.dt) - 4).attr('y', y(last.v) - 10).attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', 700).attr('fill', jkBlues[5]).text(jkF.days(last.v));
  const bw = (W - m.l - m.r) / Math.max(1, rows.length - 1);
  svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.dt) - bw / 2).attr('width', bw).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, jkMLabel(r.dt, true), [jkT(`Condo days on listing: ${r.v}`, `콘도 리스팅 일수: ${r.v}일`)]))
    .on('pointerleave', () => tip.hide());
});

dash.draw('domyoy', (el) => {
  el.replaceChildren();
  const d = dash.data('dom_yoy');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const rows = d.data.map((r) => ({ dt: jkMonth(r.month), ld: Number(r.ldom), pd: Number(r.pdom) }));
  const months = [...new Set(rows.map((r) => r.dt.getUTCMonth()))].sort((a, b) => a - b);
  const years = [...new Set(rows.map((r) => r.dt.getUTCFullYear()))].sort();
  const W = el.clientWidth || 400, H = 250, m = { t: 16, r: 10, b: 44, l: 32 };
  const svg = jkSvg(el, W, H);
  const mName = (mo) => jkState.lang === 'ko' ? (mo + 1) + '월' : d3.utcFormat('%b')(new Date(Date.UTC(2026, mo, 1)));
  const x0 = d3.scaleBand(months, [m.l, W - m.r]).padding(0.25);
  const x1 = d3.scaleBand(years, [0, x0.bandwidth()]).padding(0.12);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => r.pd) * 1.1], [H - m.b, m.t]);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x0).tickFormat(mName).tickSizeOuter(0)).call(jkAxis);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r))).call(jkAxis).call((g) => g.select('.domain').remove());
  const colr = (yr) => yr === years[years.length - 1] ? jkBlues[4] : jkBlues[1];
  const tip = jkTip(el);
  const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(${x0(r.dt.getUTCMonth()) + x1(r.dt.getUTCFullYear())},0)`);
  g.append('rect').attr('y', (r) => y(r.ld)).attr('height', (r) => y(0) - y(r.ld)).attr('width', x1.bandwidth()).attr('rx', 3).attr('fill', (r) => colr(r.dt.getUTCFullYear()));
  g.append('circle').attr('cx', x1.bandwidth() / 2).attr('cy', (r) => y(r.pd)).attr('r', 4.5).attr('fill', 'var(--color-panel)').attr('stroke', (r) => colr(r.dt.getUTCFullYear())).attr('stroke-width', 2.5);
  g.append('rect').attr('y', m.t).attr('height', H - m.t - m.b).attr('width', x1.bandwidth()).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, jkMLabel(r.dt, true), [jkT(`Days on listing ${r.ld}`, `리스팅 일수 ${r.ld}일`), jkT(`Days since first listed ${r.pd}`, `최초 등록부터 ${r.pd}일`)]))
    .on('pointerleave', () => tip.hide());
  const lg = svg.append('g').attr('transform', `translate(${m.l},${H - 14})`);
  years.forEach((yr, i) => { const gg = lg.append('g').attr('transform', `translate(${i * 80},0)`); gg.append('rect').attr('width', 10).attr('height', 10).attr('y', -9).attr('rx', 2).attr('fill', colr(yr)); gg.append('text').attr('x', 15).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(yr); });
});

dash.draw('typespeed', (el) => {
  el.replaceChildren();
  const d = dash.data('types');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const rows = [...d.data].map((r) => ({ ...r, v: Number(r.to_ldom), g: Number(r.gta_ldom) })).sort((p, q) => p.v - q.v);
  const W = el.clientWidth || 400, H = rows.length * 46 + 20, left = W < 420 ? 110 : 140, right = 60;
  const svg = jkSvg(el, W, H);
  const x = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.v, r.g))], [left, W - right]);
  const y = d3.scaleBand(rows.map((r) => r.type), [4, H - 10]).padding(0.3);
  const tip = jkTip(el);
  const g = svg.append('g').selectAll('g').data(rows).join('g');
  g.append('text').attr('x', left - 10).attr('y', (r) => y(r.type) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', 700).attr('fill', 'var(--color-fg)').text((r) => jkTypeLabel(r.type));
  g.append('rect').attr('x', left).attr('y', (r) => y(r.type)).attr('height', y.bandwidth()).attr('width', (r) => x(r.v) - left).attr('rx', 3).attr('fill', (r, i) => jkBlues[2 + i]);
  g.append('line').attr('x1', (r) => x(r.g)).attr('x2', (r) => x(r.g)).attr('y1', (r) => y(r.type) - 3).attr('y2', (r) => y(r.type) + y.bandwidth() + 3).attr('stroke', 'var(--color-fg)').attr('stroke-width', 2);
  g.append('text').attr('x', (r) => Math.max(x(r.v), x(r.g)) + 6).attr('y', (r) => y(r.type) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((r) => jkF.days(r.v));
  g.append('rect').attr('x', 0).attr('width', W).attr('y', (r) => y(r.type)).attr('height', y.bandwidth()).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, jkTypeLabel(r.type), [jkT(`Toronto ${r.v} days`, `토론토 ${r.v}일`), jkT(`GTA ${r.g} days`, `GTA ${r.g}일`), jkT(`GTA sold/list ${d3.format('.0%')(r.gta_sp_lp)}`, `GTA 판매가율 ${d3.format('.0%')(r.gta_sp_lp)}`)]))
    .on('pointerleave', () => tip.hide());
});

const jkFField = { all: ['ldom', 'sales', 'median_price'], condo: ['condo_ldom', 'condo_sales', 'condo_median_price'], det: ['detached_ldom', 'detached_sales', 'detached_median_price'] };
dash.draw('fast', (el) => {
  el.replaceChildren();
  const d = dash.data('districts');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const [lf, sf, mf] = jkFField[jkState.ftype];
  const rows = d.data.filter((r) => r[lf] != null && Number(r[sf]) >= 5).map((r) => ({ ...r, v: Number(r[lf]), n: Number(r[sf]), m: Number(r[mf]) })).sort((p, q) => p.v - q.v || q.n - p.n).slice(0, 10);
  const W = el.clientWidth || 400, narrow = W < 460, H = rows.length * 30 + 10;
  const svg = jkSvg(el, W, H);
  const label = (r) => narrow ? r.neighbourhoods.split('·')[0] : r.neighbourhoods.split('·').slice(0, 2).join(', ');
  const left = narrow ? 120 : 230, right = 56;
  const x = d3.scaleLinear([0, d3.max(rows, (r) => r.v) || 1], [left, W - right]);
  const y = d3.scaleBand(rows.map((r) => r.district), [4, H - 4]).padding(0.25);
  const tip = jkTip(el);
  const g = svg.append('g').selectAll('g').data(rows).join('g');
  g.append('text').attr('x', left - 8).attr('y', (r) => y(r.district) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('fill', 'var(--color-fg)').text(label)
    .each(function () { let s = this.textContent; while (this.getComputedTextLength() > left - 12 && s.length > 4) { s = s.slice(0, -2); this.textContent = s + '…'; } });
  g.append('rect').attr('x', left).attr('y', (r) => y(r.district)).attr('height', y.bandwidth()).attr('width', (r) => Math.max(2, x(r.v) - left)).attr('rx', 3).attr('fill', (r, i) => i < 3 ? jkBlues[5] : jkBlues[2]);
  g.append('text').attr('x', (r) => x(r.v) + 6).attr('y', (r) => y(r.district) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((r) => jkF.days(r.v));
  g.append('rect').attr('x', 0).attr('width', W).attr('y', (r) => y(r.district)).attr('height', y.bandwidth()).attr('fill', 'transparent')
    .on('pointermove', (ev, r) => tip.show(ev, `${r.neighbourhoods} (${r.district})`, [jkT(`Days on listing ${r.v}`, `리스팅 일수 ${r.v}일`), jkT(`Sales ${r.n}`, `거래 ${r.n}건`), jkT(`Median ${jkF.money(r.m)}`, `중간 ${jkF.money(r.m)}`)]))
    .on('pointerleave', () => tip.hide());
});

dash.draw('bands', (el) => {
  el.replaceChildren();
  const d = dash.data('speed_bands');
  if (jkFail(el, d) || d.status !== 'ok') return;
  const names = { under_700k: ['Under $700K', '70만 달러 미만'], '700k_1m': ['$700K–$1M', '70만~100만'], '1m_1_5m': ['$1M–$1.5M', '100만~150만'], over_1_5m: ['$1.5M+', '150만 이상'] };
  const L = jkState.lang === 'ko' ? 1 : 0;
  const rows = [...d.data].filter((r) => r.ldom != null).sort((p, q) => p.order - q.order);
  const W = el.clientWidth || 400, H = rows.length * 52 + 10, left = 108, right = W < 420 ? 50 : 150;
  const svg = jkSvg(el, W, H);
  const x = d3.scaleLinear([0, d3.max(rows, (r) => r.ldom) || 1], [left, W - right]);
  const y = d3.scaleBand(rows.map((r) => r.band), [4, H - 6]).padding(0.3);
  const g = svg.append('g').selectAll('g').data(rows).join('g');
  g.append('text').attr('x', left - 10).attr('y', (r) => y(r.band) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', 700).attr('fill', 'var(--color-fg)').text((r) => names[r.band][L]);
  g.append('rect').attr('x', left).attr('y', (r) => y(r.band)).attr('height', y.bandwidth()).attr('width', (r) => x(r.ldom) - left).attr('rx', 3).attr('fill', (r, i) => jkBlues[2 + i]);
  g.append('text').attr('x', (r) => x(r.ldom) + 6).attr('y', (r) => y(r.band) + y.bandwidth() / 2 - (W < 420 ? 0 : 7)).attr('dy', '0.35em').attr('font-size', 12).attr('font-weight', 700).attr('fill', 'var(--color-fg)').text((r) => jkF.days(r.ldom));
  if (W >= 420) g.append('text').attr('x', (r) => x(r.ldom) + 6).attr('y', (r) => y(r.band) + y.bandwidth() / 2 + 9).attr('dy', '0.35em').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)')
    .text((r) => jkT(`${r.districts} districts · ${jkF.count(r.sales)} sales`, `${r.districts}개 디스트릭트 · ${jkF.count(r.sales)}건`));
});

dash.draw('rates', (el) => {
  el.replaceChildren();
  const h = dash.data('rates_history'), f = dash.data('rate_forecasts');
  if (jkFail(el, h) || h.status !== 'ok') return;
  const hist = h.data.map((r) => ({ dt: jkMonth(r.month), p: Number(r.policy_rate), pr: Number(r.prime_rate) })).sort((a, b) => a.dt - b.dt).slice(-jkState.rrange);
  const end = new Date('2027-12-31T00:00:00Z');
  const fc = f.status === 'ok' ? d3.groups(f.data.map((r) => ({ ...r, dt: new Date(r.quarter_end + 'T00:00:00Z'), v: Number(r.policy_rate) })).filter((r) => r.dt <= end), (r) => r.bank) : [];
  const W = el.clientWidth || 700, H = 320, m = { t: 16, r: 16, b: 28, l: 44 };
  const svg = jkSvg(el, W, H);
  const x = d3.scaleUtc([hist[0].dt, end], [m.l, W - m.r]);
  const ymax = d3.max(hist, (r) => r.pr) * 1.08;
  const y = d3.scaleLinear([0, ymax], [H - m.b, m.t]);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 8).tickFormat((t) => jkState.lang === 'ko' ? d3.utcFormat('%y년 %-m월')(t) : d3.utcFormat('%b %Y')(t)).tickSizeOuter(0)).call(jkAxis);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')).tickSize(-(W - m.l - m.r))).call(jkAxis).call((g) => g.select('.domain').remove());
  const last = hist[hist.length - 1];
  svg.append('rect').attr('x', x(last.dt)).attr('width', Math.max(0, x(end) - x(last.dt))).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'var(--cds-chart-grid)').attr('opacity', 0.35);
  svg.append('text').attr('x', x(last.dt) + 6).attr('y', m.t + 12).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(jkT('Forecasts', '전망'));
  const step = d3.line().curve(d3.curveStepAfter).x((r) => x(r.dt));
  svg.append('path').datum(hist).attr('d', step.y((r) => y(r.pr))).attr('fill', 'none').attr('stroke', jkBlues[1]).attr('stroke-width', 2.5);
  svg.append('path').datum(hist).attr('d', step.y((r) => y(r.p))).attr('fill', 'none').attr('stroke', jkBlues[5]).attr('stroke-width', 2.5);
  const tip = jkTip(el);
  const cols = dash.colors;
  fc.forEach(([bank, pts], i) => {
    const s = [{ dt: last.dt, v: last.p }].concat(pts.sort((a, b) => a.dt - b.dt));
    svg.append('path').datum(s).attr('d', d3.line().x((r) => x(r.dt)).y((r) => y(r.v))).attr('fill', 'none').attr('stroke', cols[i % cols.length]).attr('stroke-width', 2).attr('stroke-dasharray', '5 4');
    svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (r) => x(r.dt)).attr('cy', (r) => y(r.v)).attr('r', 4).attr('fill', cols[i % cols.length])
      .on('pointermove', (ev, r) => tip.show(ev, bank, [jkT(`${d3.utcFormat('%b %Y')(r.dt)}: ${jkF.rate(r.v)}`, `${d3.utcFormat('%Y년 %-m월')(r.dt)}: ${jkF.rate(r.v)}`), jkT(`Published ${r.published}`, `발표 ${r.published}`)]))
      .on('pointerleave', () => tip.hide());
  });
  const hx = d3.bisector((r) => r.dt).left;
  svg.append('rect').attr('x', m.l).attr('width', Math.max(0, x(last.dt) - m.l)).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('pointermove', (ev) => { const [mx] = d3.pointer(ev); const i = Math.min(hist.length - 1, Math.max(0, hx(hist, x.invert(mx)) - 1)); const r = hist[i]; tip.show(ev, jkMLabel(r.dt, true), [jkT(`Policy rate ${jkF.rate(r.p)}`, `기준금리 ${jkF.rate(r.p)}`), jkT(`Prime ${jkF.rate(r.pr)}`, `프라임 ${jkF.rate(r.pr)}`)]); })
    .on('pointerleave', () => tip.hide());
  const leg = document.createElement('div'); leg.className = 'jk-legend';
  const item = (c, t, dashed) => { const s = document.createElement('span'); const i2 = document.createElement('i'); i2.style.background = c; if (dashed) i2.style.borderRadius = '50%'; s.append(i2, document.createTextNode(t)); leg.append(s); };
  item(jkBlues[5], jkT('BoC policy rate', '기준금리'));
  item(jkBlues[1], jkT('Prime rate', '프라임 금리'));
  fc.forEach(([bank], i) => item(cols[i % cols.length], bank, true));
  el.append(leg);
});

const jkAll = ['sum', 'rate', 'fact', 'listing-body', 'listing-empty', 'calc', 'map', 'types', 'beds', 'districts', 'domtrend', 'domyoy', 'typespeed', 'fast', 'bands', 'rates', 'commentary', 'outlook', 'reviews', 'posts', 'news', 'map-detail', 'map-hint', 'mbasics', 'videos', 'mnews'];
const jkSeg = (attr, key, draws, num) => document.querySelectorAll(`.jk-seg button[data-${attr}]`).forEach((b) => b.addEventListener('click', () => {
  jkState[key] = num ? Number(b.dataset[attr]) : b.dataset[attr];
  document.querySelectorAll(`.jk-seg button[data-${attr}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  draws.forEach((n) => dash.draw(n));
}));
jkSeg('mtype', 'mtype', ['map']);
jkSeg('dtype', 'dtype', ['districts']);
jkSeg('area', 'area', ['districts']);
jkSeg('drange', 'drange', ['domtrend'], true);
jkSeg('ftype', 'ftype', ['fast']);
jkSeg('ltype', 'ltype', ['listing-body', 'listing-empty']);
jkSeg('larea', 'larea', ['listing-body', 'listing-empty']);
jkSeg('rrange', 'rrange', ['rates'], true);
document.querySelectorAll('.jk-tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => {
  jkState.tab = b.dataset.tab;
  document.querySelectorAll('.jk-tabs button[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  document.querySelectorAll('[data-tab-panel]').forEach((p) => { p.hidden = p.dataset.tabPanel !== jkState.tab; });
  dash.setLink('tab-' + jkState.tab);
}));
document.querySelectorAll('.jk-langs button[data-lang]').forEach((b) => b.addEventListener('click', () => {
  jkState.lang = b.dataset.lang;
  document.documentElement.lang = jkState.lang;
  document.querySelectorAll('.jk').forEach((r) => { r.classList.toggle('lang-en', jkState.lang === 'en'); r.classList.toggle('lang-ko', jkState.lang === 'ko'); });
  document.querySelectorAll('.jk-langs button[data-lang]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  jkAll.forEach((n) => dash.draw(n));
}));
['jk-price', 'jk-down', 'jk-rate', 'jk-amort'].forEach((id) => { const e = document.getElementById(id); if (e) e.addEventListener('input', () => dash.draw('calc')); });
