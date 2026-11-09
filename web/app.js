
const $ = (s) => document.querySelector(s);
let data = { services: [], bookmarks: [], settings: { source: 'none', query: 'minimal landscape', pexelsKey: '', unsplashKey: '', wallpaper: null } };
let editing = false;
let lib = { fetched: [], uploads: [] };
let iconValue = '', iconMode = 'auto', iconNames = null;
let dlgKind = 'service', dlgId = null;

/* ---------- persistence ---------- */
async function load() {
  try { const d = await API.load(); if (d && typeof d === 'object') data = { services: [], bookmarks: [], ...d }; } catch { /* keep defaults */ }
  try { lib = await API.library(); } catch { /* optional */ }
  normalize();
  render(); renderEngine(); applyGradient(); applyFont(); applyLayout(); applyWallpaper(data.settings.wallpaper);
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => Promise.resolve(API.save(data)).catch(() => {}), 150);
}

/* ---------- clock ---------- */
function tick() {
  const c = data.settings.clock || { h24: false, seconds: false }, d = new Date();
  const o = { hour: c.h24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !c.h24 }; if (c.seconds) o.second = '2-digit';
  $('#time').textContent = d.toLocaleTimeString([], o);
  $('#date').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
let tickTimer;
function startTick() { clearInterval(tickTimer); tick(); tickTimer = setInterval(tick, (data.settings.clock || {}).seconds ? 1000 : 10000); }

/* ---------- search ---------- */
const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google:     { name: 'Google',     url: 'https://www.google.com/search?q=%s' },
  brave:      { name: 'Brave',      url: 'https://search.brave.com/search?q=%s' },
  startpage:  { name: 'Startpage',  url: 'https://www.startpage.com/do/search?q=%s' },
  kagi:       { name: 'Kagi',       url: 'https://kagi.com/search?q=%s' },
  ecosia:     { name: 'Ecosia',     url: 'https://www.ecosia.org/search?q=%s' },
  bing:       { name: 'Bing',       url: 'https://www.bing.com/search?q=%s' },
  custom:     { name: 'Custom',     url: '' },
};
function engine() {
  const s = data.settings;
  const e = ENGINES[s.engine] || ENGINES.duckduckgo;
  if (s.engine === 'custom') return { name: 'Custom', url: s.customEngine && s.customEngine.includes('%s') ? s.customEngine : ENGINES.duckduckgo.url };
  return e;
}
function renderEngine() {
  const name = (ENGINES[data.settings.engine] || ENGINES.duckduckgo).name;
  $('#q').placeholder = 'Search ' + name; $('#q').setAttribute('aria-label', 'Search ' + name);
  $('#engBtn').title = 'Search engine: ' + name;
  const menu = $('#engMenu'); menu.innerHTML = '';
  Object.entries(ENGINES).forEach(([id, e]) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.className = id === data.settings.engine ? 'on' : '';
    b.innerHTML = '<span class="ck">&#10003;</span>'; b.append(e.name + (id === 'custom' ? '…' : ''));
    b.onclick = () => { setEngine(id); closeMenu(); if (id === 'custom' && !data.settings.customEngine) openSettings(); $('#q').focus(); };
    menu.appendChild(b);
  });
}
function setEngine(id) { data.settings.engine = id; save(); renderEngine(); }
function closeMenu() { $('#engMenu').hidden = true; $('#engBtn').setAttribute('aria-expanded', 'false'); }
$('#engBtn').onclick = (e) => { e.stopPropagation(); const m = $('#engMenu'); m.hidden = !m.hidden; $('#engBtn').setAttribute('aria-expanded', String(!m.hidden)); };
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#q').value.trim();
  if (!v) return;
  const looksLikeUrl = /^(https?:\/\/)/i.test(v) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(v) && !v.includes(' ');
  const target = looksLikeUrl ? (/^https?:\/\//i.test(v) ? v : 'http://' + v) : engine().url.replace('%s', encodeURIComponent(v));
  if (data.settings.searchBar.newTab) window.open(target, '_blank', 'noopener'); else location.href = target;
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && !document.querySelector('dialog[open]')) { e.preventDefault(); $('#q').focus(); }
});

/* ---------- font ---------- */
const NERD = '"JetBrainsMono Nerd Font", "JetBrainsMono NF"';
const FONTS = {
  nerd:   { name: 'JetBrainsMono Nerd Font', stack: NERD + ', ui-monospace, Menlo, monospace' },
  system: { name: 'System (SF Pro)', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif, ' + NERD },
  mono:   { name: 'System monospace', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace, ' + NERD },
  serif:  { name: 'New York (serif)', stack: 'ui-serif, "New York", Georgia, serif, ' + NERD },
  custom: { name: 'Custom…', stack: '' },
};
function applyFont() {
  const s = data.settings;
  let stack = (FONTS[s.font] || FONTS.nerd).stack;
  if (s.font === 'custom') {
    const n = (s.customFont || '').replace(/["';]/g, '').trim();
    stack = (n ? '"' + n + '", ' : '') + FONTS.nerd.stack;
  }
  document.documentElement.style.setProperty('--font', stack);
}

/* ---------- gradient ---------- */
const GRADIENTS = {
  midnight: { name: 'Midnight', base: ['#1c1c3a', '#0b1d33'], glow: ['#5e5ce6', '#0a84ff'] },
  aurora:   { name: 'Aurora',   base: ['#0b2a2a', '#10243f'], glow: ['#30d158', '#5e5ce6'] },
  sunset:   { name: 'Sunset',   base: ['#2b1030', '#3a1420'], glow: ['#ff9f0a', '#ff375f'] },
  ocean:    { name: 'Ocean',    base: ['#07233a', '#05182b'], glow: ['#64d2ff', '#0a84ff'] },
  forest:   { name: 'Forest',   base: ['#10261c', '#0b1a14'], glow: ['#34c759', '#00c7be'] },
  rose:     { name: 'Rose',     base: ['#2a1226', '#1d1030'], glow: ['#ff6482', '#bf5af2'] },
  graphite: { name: 'Graphite', base: ['#232326', '#151517'], glow: ['#636366', '#8e8e93'] },
};
function gradientCss(g) {
  const p = GRADIENTS[g.preset];
  if (!p) return `linear-gradient(160deg, ${g.a}, ${g.b})`;
  return `radial-gradient(1200px 800px at 20% 10%, ${p.glow[0]} 0%, transparent 60%), radial-gradient(1000px 700px at 85% 90%, ${p.glow[1]} 0%, transparent 55%), linear-gradient(160deg, ${p.base[0]}, ${p.base[1]})`;
}
function applyGradient() { $('.wp-default').style.background = gradientCss(data.settings.gradient); }
function renderSwatches() {
  const g = data.settings.gradient, box = $('#swatches'); box.innerHTML = '';
  const mk = (id, label, bg) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (g.preset === id ? ' on' : '');
    b.title = label; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(g.preset === id)); b.setAttribute('aria-label', label);
    b.style.background = bg;
    b.onclick = () => { g.preset = id; save(); applyGradient(); renderSwatches(); };
    box.appendChild(b);
  };
  Object.entries(GRADIENTS).forEach(([id, p]) => mk(id, p.name, `linear-gradient(135deg, ${p.glow[0]}, ${p.glow[1]})`));
  mk('custom', 'Custom', `linear-gradient(135deg, ${g.a}, ${g.b})`);
  $('#customColors').hidden = g.preset !== 'custom';
  $('#gA').value = g.a; $('#gB').value = g.b;
}
['#gA', '#gB'].forEach((id, i) => $(id).addEventListener('input', (e) => {
  data.settings.gradient[i ? 'b' : 'a'] = e.target.value; save(); applyGradient(); renderSwatches();
}));

/* ---------- rendering ---------- */
const hues = [210, 265, 330, 12, 35, 150, 185, 240];
function colorFor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return hues[h % hues.length]; }
function normUrl(u) { u = u.trim(); return /^[a-z]+:\/\//i.test(u) ? u : 'http://' + u; }
function hostOf(u) { try { return new URL(u).host; } catch { return u; } }
function faviconOf(u) { try { return new URL(u).origin + '/favicon.ico'; } catch { return ''; } }

function iconSrc(item) {
  const i = (item.icon || '').trim();
  if (i.startsWith('lib:')) return 'icons/' + i.slice(4) + '.png';
  if (/^https?:\/\//i.test(i) || i.startsWith('/')) return i;
  return i ? '' : faviconOf(item.url);
}
function iconNode(item) {
  const box = document.createElement('div'); box.className = 'icon';
  const hue = colorFor(item.name || '?');
  box.style.background = `linear-gradient(160deg, hsl(${hue} 80% 62%), hsl(${hue} 75% 42%))`;
  const ic = (item.icon || '').trim(), src = iconSrc(item);
  box.textContent = (ic && !src) ? ic : ((item.name || '?').trim().charAt(0).toUpperCase() || '?');
  if (src) { const img = new Image(); img.alt = ''; img.src = src; img.onload = () => { box.textContent = ''; box.appendChild(img); }; }
  return box;
}

function render() {
  document.body.classList.toggle('editing', editing);
  $('#editBtn').textContent = editing ? 'Done' : 'Edit';

  const grid = $('#services'); grid.innerHTML = '';
  data.services.forEach((s) => {
    const a = document.createElement(editing ? 'button' : 'a');
    a.className = 'tile';
    if (!editing) { a.href = s.url; } else { a.onclick = () => openItem('service', s); }
    a.appendChild(iconNode(s));
    const l = document.createElement('div'); l.className = 'label'; l.textContent = s.name; a.appendChild(l);
    grid.appendChild(a);
  });
  const add = document.createElement('button'); add.className = 'tile add';
  add.innerHTML = '<div class="icon">+</div><div class="label">Add service</div>';
  add.onclick = () => openItem('service');
  grid.appendChild(add);

  const list = $('#bookmarks'); list.innerHTML = '';
  if (!data.bookmarks.length) {
    list.innerHTML = '<div class="empty">No bookmarks yet. Use “Add bookmark” to save your first one.</div>';
  }
  data.bookmarks.forEach((b) => {
    const r = document.createElement(editing ? 'button' : 'a');
    r.className = 'row';
    if (!editing) { r.href = b.url; } else { r.onclick = () => openItem('bookmark', b); }
    const fav = document.createElement('span'); fav.className = 'fav';
    const bic = (b.icon || '').trim(), bsrc = iconSrc(b);
    fav.textContent = (bic && !bsrc) ? bic : b.name.charAt(0).toUpperCase();
    if (bsrc) { const img = new Image(); img.alt = ''; img.src = bsrc; img.onload = () => { fav.textContent = ''; fav.appendChild(img); }; }
    const n = document.createElement('span'); n.className = 'name'; n.textContent = b.name;
    const h = document.createElement('span'); h.className = 'host'; h.textContent = hostOf(b.url);
    r.append(fav, n, h);
    list.appendChild(r);
  });
}

$('#editBtn').onclick = () => { editing = !editing; render(); };

/* ---------- add / edit sheet ---------- */
const itemDlg = $('#itemDlg');
function openItem(kind, item) {
  dlgKind = kind; dlgId = item ? item.id : null;
  $('#itemTitle').textContent = (item ? 'Edit ' : 'New ') + kind;
  $('#fName').value = item ? item.name : '';
  $('#fUrl').value = item ? item.url : '';
  initIconPicker(item);
  $('#fDelete').hidden = !item;
  itemDlg.showModal();
  $('#fName').focus();
}
$('#addBookmark').onclick = () => openItem('bookmark');
$('#fCancel').onclick = () => itemDlg.close();
$('#fDelete').onclick = () => {
  const key = dlgKind === 'service' ? 'services' : 'bookmarks';
  data[key] = data[key].filter((x) => x.id !== dlgId);
  save(); render(); itemDlg.close();
};
$('#itemForm').addEventListener('submit', () => {
  const key = dlgKind === 'service' ? 'services' : 'bookmarks';
  const item = { id: dlgId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)), name: $('#fName').value.trim(), url: normUrl($('#fUrl').value) };
  if (iconMode === 'url') iconValue = $('#fIcon').value.trim();
  item.icon = iconValue;
  const i = data[key].findIndex((x) => x.id === dlgId);
  if (i >= 0) data[key][i] = item; else data[key].push(item);
  save(); render();
});

/* ---------- built-in wallpapers ---------- */
const BUILTIN = [
  { id: 'dusk-ridges', name: 'Dusk Ridges' }, { id: 'midnight-dunes', name: 'Midnight Dunes' }, { id: 'aurora', name: 'Aurora' },
  { id: 'indigo-mesh', name: 'Indigo Mesh' }, { id: 'violet-waves', name: 'Violet Waves' }, { id: 'forest-mist', name: 'Forest Mist' },
  { id: 'rose-haze', name: 'Rose Haze' }, { id: 'topography', name: 'Topography' }, { id: 'graphite', name: 'Graphite' },
];
const bwp = (w) => ({ url: 'wallpapers/' + w.id + '.jpg', credit: '', link: '', builtin: w.id });
function setBuiltin(id) {
  const w = BUILTIN.find((x) => x.id === id) || BUILTIN[0];
  data.settings.wallpaper = bwp(w); applyWallpaper(data.settings.wallpaper); save(); renderWpGrid();
}
function nextBuiltin() {
  const cur = data.settings.wallpaper && data.settings.wallpaper.builtin;
  setBuiltin(BUILTIN[(BUILTIN.findIndex((x) => x.id === cur) + 1) % BUILTIN.length].id);
}
function renderWpGrid() {
  const g = $('#wpGrid'); g.innerHTML = '';
  const cur = data.settings.wallpaper && data.settings.wallpaper.builtin;
  BUILTIN.forEach((w) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wpt' + (w.id === cur ? ' on' : '');
    b.title = w.name; b.setAttribute('aria-label', w.name);
    const img = new Image(); img.alt = ''; img.src = 'wallpapers/thumbs/' + w.id + '.jpg'; b.appendChild(img);
    b.onclick = () => setBuiltin(w.id); g.appendChild(b);
  });
}
function normalize() {
  data.settings = { source: 'builtin', query: 'minimal landscape', engine: 'duckduckgo', customEngine: '', font: 'nerd', customFont: '', pexelsKey: '', unsplashKey: '', wallpaper: null, ...data.settings };
  data.settings.gradient = { preset: 'midnight', a: '#5e5ce6', b: '#0a84ff', ...(data.settings.gradient || {}) };
  if (!ENGINES[data.settings.engine]) data.settings.engine = 'duckduckgo';
  if (!FONTS[data.settings.font]) data.settings.font = 'nerd';
  const S = data.settings;
  S.clock = { show: true, h24: false, seconds: false, date: true, ...(S.clock || {}) };
  S.searchBar = { show: true, newTab: false, ...(S.searchBar || {}) };
  S.weather = { enabled: false, place: '', lat: null, lon: null, units: 'metric', position: 'below', aqi: true, aqiScale: 'us', ...(S.weather || {}) };
  S.layout = { services: true, bookmarks: true, urls: true, ...(S.layout || {}) };
  if (data.settings.source === 'builtin' && !(data.settings.wallpaper && data.settings.wallpaper.builtin)) data.settings.wallpaper = bwp(BUILTIN[0]);
}

/* ---------- wallpaper ---------- */
let front = 'wpA';
function applyWallpaper(wp) {
  const credit = $('#credit');
  if (!wp || !wp.url) { $('#wpA').classList.remove('on'); $('#wpB').classList.remove('on'); credit.hidden = true; return; }
  const img = new Image();
  img.onload = () => {
    const next = front === 'wpA' ? 'wpB' : 'wpA';
    $('#' + next).style.backgroundImage = `url("${wp.url}")`;
    $('#' + next).classList.add('on');
    $('#' + front).classList.remove('on');
    front = next;
  };
  img.src = wp.url;
  credit.textContent = wp.credit || ''; credit.href = wp.link || '#'; credit.hidden = !wp.credit;
}

async function fetchWallpaper(statusEl) {
  const s = data.settings;
  if (s.source === 'builtin') { nextBuiltin(); return; }
  if (s.source === 'mine') { if (lib.uploads.length) nextMine(); else openSettings(); return; }
  if (s.source === 'none') { s.wallpaper = null; applyWallpaper(null); save(); return; }
  if (statusEl) { statusEl.className = 'status'; statusEl.textContent = 'Fetching…'; }
  try {
    const r = await API.wallpaper(s); lib = r.library; setLibItem(r.item);
    if (statusEl) statusEl.textContent = 'Wallpaper updated.';
  } catch (e) {
    if (statusEl) { statusEl.className = 'status err'; statusEl.textContent = e.message; }
    else { openSettings(); $('#sStatus').className = 'status err'; $('#sStatus').textContent = e.message; }
  }
}

/* ---------- settings sheet ---------- */
const setDlg = $('#setDlg');
function syncSettingsUI() {
  const src = $('#sSource').value;
  $('#sQueryF').hidden = src !== 'pexels' && src !== 'unsplash'; $('#mineF').hidden = src !== 'mine'; $('#recentF').hidden = (src !== 'pexels' && src !== 'unsplash') || !lib.fetched.length; $('#wpGridF').hidden = src !== 'builtin';
  $('#sPexelsF').hidden = src !== 'pexels';
  $('#sUnsplashF').hidden = src !== 'unsplash';
  $('#sFetch').hidden = src !== 'pexels' && src !== 'unsplash';
}
function openSettings() {
  const s = data.settings;
  $('#sSource').value = s.source; $('#sQuery').value = s.query || '';
  $('#sPexels').value = s.pexelsKey || ''; $('#sUnsplash').value = s.unsplashKey || '';
  $('#sStatus').textContent = ''; $('#sStatus').className = 'status';
  $('#eSel').value = s.engine; $('#eCustom').value = s.customEngine || ''; $('#eCustomF').hidden = s.engine !== 'custom';
  $('#fSel').value = s.font; $('#fCustom').value = s.customFont || ''; $('#fCustomF').hidden = s.font !== 'custom';
  renderSwatches(); renderWpGrid(); renderLibGrids(); syncSettingsUI(); syncBinds();
  if (!setDlg.open) setDlg.showModal();
}
function readSettings() {
  const s = data.settings;
  s.source = $('#sSource').value; s.query = $('#sQuery').value.trim();
  s.pexelsKey = $('#sPexels').value.trim(); s.unsplashKey = $('#sUnsplash').value.trim();
  s.engine = $('#eSel').value || 'duckduckgo'; s.customEngine = $('#eCustom').value.trim();
  s.font = $('#fSel').value || 'nerd'; s.customFont = $('#fCustom').value.trim();
  save(); renderEngine(); applyFont();
}
$('#eSel').innerHTML = Object.entries(ENGINES).map(([id, e]) => `<option value="${id}">${e.name}</option>`).join('');
$('#eSel').onchange = () => { $('#eCustomF').hidden = $('#eSel').value !== 'custom'; readSettings(); };
$('#eCustom').addEventListener('change', readSettings);
$('#fSel').innerHTML = Object.entries(FONTS).map(([id, f]) => `<option value="${id}">${f.name}</option>`).join('');
$('#fSel').onchange = () => { $('#fCustomF').hidden = $('#fSel').value !== 'custom'; readSettings(); };
$('#fCustom').addEventListener('input', readSettings);
$('#sClose').onclick = () => { readSettings(); setDlg.close(); };
$('#sDone').onclick = () => { readSettings(); setDlg.close(); };
[setDlg, itemDlg].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
$('#settingsBtn').onclick = openSettings;
$('#sSource').onchange = () => { syncSettingsUI(); readSettings(); const v = $('#sSource').value; if (v === 'none') fetchWallpaper(); if (v === 'mine' && lib.uploads.length) { const c = data.settings.wallpaper && data.settings.wallpaper.lib; setLibItem(lib.uploads.find((x) => x.id === c) || lib.uploads[0]); }
  if (v === 'builtin') setBuiltin((data.settings.wallpaper && data.settings.wallpaper.builtin) || BUILTIN[0].id); };
['#sQuery', '#sPexels', '#sUnsplash'].forEach((id) => $(id).addEventListener('change', readSettings));
$('#sFetch').onclick = () => { readSettings(); fetchWallpaper($('#sStatus')); };
$('#setForm').addEventListener('submit', readSettings);
$('#newWp').onclick = () => {
  if (data.settings.source === 'none') openSettings(); else fetchWallpaper();
};

/* ---------- layout, clock and weather options ---------- */
const BINDS = { '#cShow': 'clock.show', '#c24': 'clock.h24', '#cSec': 'clock.seconds', '#cDate': 'clock.date', '#sbShow': 'searchBar.show', '#sbTab': 'searchBar.newTab',
  '#wEnable': 'weather.enabled', '#wUnits': 'weather.units', '#wAqi': 'weather.aqi', '#wScale': 'weather.aqiScale', '#wPos': 'weather.position', '#lServ': 'layout.services', '#lBm': 'layout.bookmarks', '#lUrls': 'layout.urls' };
const getp = (p) => p.split('.').reduce((o, k) => o[k], data.settings);
const setp = (p, v) => { const k = p.split('.'), last = k.pop(); k.reduce((o, x) => o[x], data.settings)[last] = v; };
function syncBinds() {
  for (const [id, p] of Object.entries(BINDS)) { const el = $(id), v = getp(p); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; }
  $('#wQ').value = data.settings.weather.place || ''; $('#wMsg').textContent = '';
}
function applyLayout() {
  const S = data.settings;
  $('.clock').hidden = !S.clock.show; $('#date').hidden = !S.clock.date;
  $('#searchForm').hidden = !S.searchBar.show;
  $('#secServices').hidden = !S.layout.services; $('#secBookmarks').hidden = !S.layout.bookmarks;
  $('#bookmarks').classList.toggle('nourls', !S.layout.urls);
  $('#wBox').hidden = !S.weather.enabled;
  startTick(); renderWeather();
}
for (const [id, p] of Object.entries(BINDS)) {
  $(id).addEventListener('change', () => {
    const el = $(id); setp(p, el.type === 'checkbox' ? el.checked : el.value);
    save(); applyLayout(); if (p.startsWith('weather.')) loadWeather();
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WX = { 0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'cloud'], 45: ['Fog', 'fog'], 48: ['Fog', 'fog'],
  51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'], 56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'], 66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'], 85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm, hail', 'storm'], 99: ['Thunderstorm, hail', 'storm'] };
const CLOUD = 'M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 6.5 4.3 4.3 0 0 0 7 15z';
const WXI = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5 4.3 4.3 0 0 0 7 18z"/>',
  partly: '<circle cx="7.5" cy="7.5" r="2.6"/><path d="M7.5 2v1M2 7.5h1M3.6 3.6l.7.7M11.4 3.6l-.7.7"/><path d="M9 20h8a3.5 3.5 0 0 0 .5-6.97A4.5 4.5 0 0 0 9 13.2 3.4 3.4 0 0 0 9 20z"/>',
  rain: `<path d="${CLOUD}"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>`,
  snow: `<path d="${CLOUD}"/><path d="M8 19h.01M12 19h.01M16 19h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.6"/>`,
  storm: `<path d="${CLOUD}"/><path d="M12.5 15l-2.5 3.5h3L10.5 22"/>`,
  fog: '<path d="M4 8h16M3 12h18M5 16h14M8 20h8"/>',
};
const wxSvg = (k, n) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WXI[k]}</svg>`;
function wxInfo(code, isDay) { const [label, kind] = WX[code] || ['Weather', 'cloud']; return { label, kind: !isDay && (kind === 'sun' || kind === 'partly') ? 'moon' : kind }; }
const AQI_US = [[50, 'Good', '#30d158'], [100, 'Moderate', '#ffd60a'], [150, 'Unhealthy for sensitive groups', '#ff9f0a'], [200, 'Unhealthy', '#ff453a'], [300, 'Very unhealthy', '#bf5af2'], [Infinity, 'Hazardous', '#a2845e']];
const AQI_EU = [[20, 'Good', '#30d158'], [40, 'Fair', '#a8e063'], [60, 'Moderate', '#ffd60a'], [80, 'Poor', '#ff9f0a'], [100, 'Very poor', '#ff453a'], [Infinity, 'Extremely poor', '#bf5af2']];
function aqiInfo(a, scale) {
  if (!a) return null; const eu = scale === 'eu', v = eu ? a.eu : a.us; if (v == null) return null;
  const t = (eu ? AQI_EU : AQI_US).find((x) => v <= x[0]); return { v: Math.round(v), label: t[1], color: t[2], name: eu ? 'EU AQI' : 'US AQI' };
}
let wxData = null;
async function loadWeather() {
  const w = data.settings.weather;
  if (!w.enabled) { wxData = null; renderWeather(); return; }
  if (w.lat == null) { wxData = null; renderWeather('Set a location in Settings'); return; }
  try { wxData = await API.weather(w.lat, w.lon, w.units); renderWeather(); }
  catch { if (!wxData) renderWeather('Weather unavailable. Tap to retry.'); }
}
function renderWeather(msg) {
  const w = data.settings.weather, box = $('#wx'), btn = $('#wxBtn'), pop = $('#wxPop');
  box.hidden = !w.enabled; box.classList.toggle('corner', w.position === 'corner');
  if (!w.enabled) return;
  if (!wxData) { btn.textContent = msg || 'Loading weather…'; pop.hidden = true; return; }
  const u = w.units === 'imperial' ? ['°F', 'mph'] : ['°C', 'km/h'], c = wxData.current, i = wxInfo(c.code, c.isDay), city = (w.place || '').split(',')[0];
  const q = w.aqi ? aqiInfo(wxData.aqi, w.aqiScale) : null;
  btn.innerHTML = `${wxSvg(i.kind, 18)}<span>${Math.round(c.temp)}${u[0]}</span><span class="dim">${esc(i.label)}${city ? ' · ' + esc(city) : ''}</span>${q ? `<span><i class="dotc" style="background:${q.color}"></i>AQI ${q.v}</span>` : ''}`;
  const days = wxData.daily.map((d, n) => {
    const di = wxInfo(d.code, true), name = n === 0 ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });
    return `<div class="wxd"><span>${esc(name)}</span>${wxSvg(di.kind, 18)}<span>${Math.round(d.max)}° <span class="dim">${Math.round(d.min)}°</span></span></div>`;
  }).join('');
  pop.innerHTML = `<div class="wxhead">${wxSvg(i.kind, 40)}<div><div class="wxt">${Math.round(c.temp)}${u[0]}</div><div class="dim">${esc(i.label)}</div></div></div>
    <div class="wxrow"><span>Feels like</span><b>${Math.round(c.feels)}${u[0]}</b></div>
    <div class="wxrow"><span>Humidity</span><b>${Math.round(c.humidity)}%</b></div>
    <div class="wxrow"><span>Wind</span><b>${Math.round(c.wind)} ${u[1]}</b></div>
    ${q ? `<div class="wxrow"><span>${q.name}</span><b><i class="dotc" style="background:${q.color}"></i>${q.v} · ${esc(q.label)}</b></div>` : ''}
    ${q && wxData.aqi.pm25 != null ? `<div class="wxrow"><span>PM2.5 / PM10</span><b>${Math.round(wxData.aqi.pm25)} / ${Math.round(wxData.aqi.pm10 ?? 0)} µg/m³</b></div>` : ''}
    <div class="wxdays">${days}</div>
    <div class="wxsrc dim">${esc(w.place || '')}${w.place ? ' · ' : ''}<a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather and air quality data by Open-Meteo.com</a></div>`;
}
$('#wxBtn').onclick = (e) => {
  e.stopPropagation(); if (!wxData) { loadWeather(); return; }
  const p = $('#wxPop'); p.hidden = !p.hidden; $('#wxBtn').setAttribute('aria-expanded', String(!p.hidden));
};
document.addEventListener('click', (e) => { if (!e.target.closest('#wx')) { $('#wxPop').hidden = true; $('#wxBtn').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#wxPop').hidden = true; $('#wxBtn').setAttribute('aria-expanded', 'false'); } });
$('#wQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#wFind').click(); } });
$('#wFind').onclick = async () => {
  const msg = $('#wMsg'), box = $('#wResults'); msg.textContent = 'Searching…'; box.hidden = true; box.innerHTML = '';
  try {
    const rs = await API.geocode($('#wQ').value);
    if (!rs.length) { msg.textContent = 'No places found. Try a nearby larger city.'; return; }
    msg.textContent = 'Pick one:';
    rs.forEach((p) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name;
      b.onclick = () => { Object.assign(data.settings.weather, { place: p.name, lat: p.lat, lon: p.lon }); $('#wQ').value = p.name; box.hidden = true; msg.textContent = 'Location saved.'; save(); loadWeather(); };
      box.appendChild(b);
    });
    box.hidden = false;
  } catch (e) { msg.textContent = e.message; }
};

/* ---------- wallpaper library (recent + uploads) ---------- */
function setLibItem(it) {
  data.settings.wallpaper = { url: '/media/' + it.file, credit: it.credit || '', link: it.link || '', lib: it.id };
  applyWallpaper(data.settings.wallpaper); save(); renderLibGrids(); syncSettingsUI();
}
function nextMine() {
  const cur = data.settings.wallpaper && data.settings.wallpaper.lib;
  setLibItem(lib.uploads[(lib.uploads.findIndex((x) => x.id === cur) + 1) % lib.uploads.length]);
}
function libGrid(el, items, label) {
  el.innerHTML = '';
  if (!items.length) { el.innerHTML = '<span class="hint" style="grid-column:1/-1">Nothing here yet.</span>'; return; }
  const cur = data.settings.wallpaper && data.settings.wallpaper.lib;
  items.forEach((it, n) => {
    const wrap = document.createElement('div'); wrap.className = 'wpitem';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wpt' + (it.id === cur ? ' on' : '');
    b.title = it.name || it.credit || label; b.setAttribute('aria-label', 'Use ' + (it.name || it.credit || label + ' ' + (n + 1)));
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.src = '/media/' + (it.thumb || it.file); b.appendChild(img);
    b.onclick = () => setLibItem(it);
    const dl = document.createElement('a'); dl.className = 'wpa dl'; dl.textContent = '↓'; dl.title = 'Download'; dl.setAttribute('aria-label', 'Download');
    dl.href = '/media/' + it.file; dl.download = 'wallpaper-' + it.id + it.file.slice(it.file.lastIndexOf('.'));
    const x = document.createElement('button'); x.type = 'button'; x.className = 'wpa x'; x.textContent = '×'; x.title = 'Remove'; x.setAttribute('aria-label', 'Remove');
    x.onclick = async () => {
      try {
        const r = await API.remove(it.id); lib = r.library;
        if (cur === it.id) { data.settings.wallpaper = null; applyWallpaper(null); save(); }
        renderLibGrids(); syncSettingsUI();
      } catch (e) { $('#sStatus').className = 'status err'; $('#sStatus').textContent = e.message; }
    };
    wrap.append(b, dl, x); el.appendChild(wrap);
  });
}
function renderLibGrids() { libGrid($('#mineGrid'), lib.uploads, 'Upload'); libGrid($('#recentGrid'), lib.fetched, 'Recent wallpaper'); }
function toJpeg(bmp, maxW, q) {
  const k = Math.min(1, maxW / bmp.width), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
async function uploadFile(file) {
  const st = $('#sStatus'); st.className = 'status'; st.textContent = 'Uploading…';
  try {
    let bmp; try { bmp = await createImageBitmap(file); } catch { throw new Error('Could not read that image. Try a JPEG, PNG or WebP file.'); }
    const r = await API.upload({ name: file.name.replace(/\.[^.]+$/, ''), image: toJpeg(bmp, 2560, 0.86), thumb: toJpeg(bmp, 360, 0.76) });
    lib = r.library; setLibItem(r.item); st.textContent = 'Wallpaper added.';
  } catch (e) { st.className = 'status err'; st.textContent = e.message; }
}
$('#upBtn').onclick = () => $('#upFile').click();
$('#upFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) uploadFile(f); };

/* ---------- icon picker ---------- */
const EMOJI = ['🏠','📺','🎬','🎵','📚','📷','📁','☁️','🔒','🔑','🛡️','🌐','📡','🖥️','💾','🗄️','📊','📈','⚙️','🔧','🧰','🐳','📦','🧠','🤖','📝','📓','📅','✉️','💬','🔔','🎮','🕹️','🏋️','🍳','💰','🧾','🛒','🌡️','💡','🔌','📶','🧭','🗺️','⭐','🔖','🚀','🎧'];
const prettyIcon = (n) => n.replace(/-/g, ' ');
function updatePreview() {
  const v = iconMode === 'auto' ? '' : iconValue;
  $('#iconPrev').replaceChildren(iconNode({ name: $('#fName').value || '?', url: $('#fUrl').value, icon: v }));
}
function renderIconGrids() {
  const lg = $('#iconGrid'), qv = $('#iconSearch').value.trim().toLowerCase();
  lg.innerHTML = '';
  (iconNames || []).filter((n) => !qv || n.includes(qv) || prettyIcon(n).includes(qv)).forEach((n) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ic' + (iconValue === 'lib:' + n ? ' on' : ''); b.title = prettyIcon(n); b.setAttribute('aria-label', prettyIcon(n));
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.src = 'icons/' + n + '.png'; b.appendChild(img);
    b.onclick = () => { iconValue = 'lib:' + n; renderIconGrids(); updatePreview(); };
    lg.appendChild(b);
  });
  const eg = $('#emojiGrid'); eg.innerHTML = '';
  EMOJI.forEach((e) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ic' + (iconValue === e ? ' on' : ''); b.textContent = e; b.setAttribute('aria-label', e);
    b.onclick = () => { iconValue = e; renderIconGrids(); updatePreview(); };
    eg.appendChild(b);
  });
}
function setIconMode(m) {
  iconMode = m;
  document.querySelectorAll('#iconMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  ['lib', 'emoji', 'url'].forEach((k) => { $('#pane-' + k).hidden = k !== m; });
  if (m === 'auto') iconValue = '';
  if (m === 'lib' && !iconValue.startsWith('lib:')) iconValue = '';
  if (m === 'emoji' && !EMOJI.includes(iconValue)) iconValue = '';
  if (m === 'url') iconValue = $('#fIcon').value.trim();
  renderIconGrids(); updatePreview();
}
async function initIconPicker(item) {
  iconValue = (item && item.icon) || '';
  $('#iconSearch').value = ''; $('#fIcon').value = '';
  const m = !iconValue ? 'auto' : iconValue.startsWith('lib:') ? 'lib' : EMOJI.includes(iconValue) ? 'emoji' : 'url';
  if (m === 'url') $('#fIcon').value = iconValue;
  if (!iconNames) { try { iconNames = await (await fetch('icons/index.json')).json(); } catch { iconNames = []; } }
  setIconMode(m);
}
$('#iconMode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setIconMode(b.dataset.m); });
$('#iconSearch').addEventListener('input', renderIconGrids);
$('#fIcon').addEventListener('input', () => { iconValue = $('#fIcon').value.trim(); updatePreview(); });
['#fName', '#fUrl'].forEach((id) => $(id).addEventListener('input', updatePreview));

/* ---------- backup ---------- */
$('#bExport').onclick = () => {
  const out = { services: data.services, bookmarks: data.bookmarks, settings: { ...data.settings, pexelsKey: '', unsplashKey: '' } };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'homelab-start-backup.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#bImport').onclick = () => $('#bFile').click();
$('#bFile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; const st = $('#sStatus');
  try {
    const j = JSON.parse(await f.text()); if (!Array.isArray(j.services) || !Array.isArray(j.bookmarks)) throw new Error('bad');
    const ok = (x) => x && typeof x.name === 'string' && typeof x.url === 'string';
    const fix = (x) => ({ ...x, id: x.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)) });
    const keep = { pexelsKey: data.settings.pexelsKey, unsplashKey: data.settings.unsplashKey };
    data.services = j.services.filter(ok).map(fix); data.bookmarks = j.bookmarks.filter(ok).map(fix);
    data.settings = { ...data.settings, ...(j.settings || {}), ...keep }; normalize();
    save(); render(); renderEngine(); applyGradient(); applyFont(); applyLayout(); applyWallpaper(data.settings.wallpaper); loadWeather(); openSettings();
    $('#sStatus').className = 'status'; $('#sStatus').textContent = 'Imported.';
  } catch { st.className = 'status err'; st.textContent = 'That file is not a valid backup.'; }
  e.target.value = '';
};

load().then(() => { loadWeather(); setInterval(loadWeather, 10 * 60e3); });
