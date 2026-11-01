// Minimal stand-in for the dashboard runtime so the page runs as a plain website.
(function () {
  const D = window.JK_DATA || {};
  const calcs = {};
  const draws = {};
  const dash = {
    colors: ['#e8833a', '#2a9d8f', '#8e5bd6', '#d6455d', '#4c9f38', '#c9a227', '#3f6fd8', '#8a6d5a'],
    calc(name, spec) { calcs[name] = spec; },
    data(name) {
      if (Object.prototype.hasOwnProperty.call(D, name)) return { status: 'ok', data: D[name] };
      const c = calcs[name];
      if (c) {
        const ins = c.inputs.map((i) => dash.data(i));
        if (ins.some((x) => x.status !== 'ok')) return { status: 'empty', data: [] };
        try { return { status: 'ok', data: c.fn(...ins.map((x) => x.data)) }; }
        catch (e) { console.error(e); return { status: 'error', data: [] }; }
      }
      return { status: 'empty', data: [] };
    },
    draw(name, fn) {
      if (typeof fn === 'function') { draws[name] = fn; return; }
      const f = draws[name];
      if (!f) return;
      document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
        try { f(el); } catch (e) { console.error(name, e); }
      });
    },
    drawAll() { Object.keys(draws).forEach((n) => dash.draw(n)); },
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} }
  };
  window.dash = dash;
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(dash.drawAll, 200); });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('.jk-tabs button[data-tab]')) setTimeout(dash.drawAll, 0);
  });
})();
