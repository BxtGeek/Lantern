// Homelab start page: tiny dependency-free server (Node 18+)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const LIB_DIR = path.join(DATA_DIR, 'wallpapers');
const LIB_FILE = path.join(LIB_DIR, 'index.json');
const MAX_FETCHED = Number(process.env.WALLPAPER_HISTORY) || 8; // recent Pexels/Unsplash wallpapers kept (5-10 is sensible)
const MAX_UPLOADS = 10;
fs.mkdirSync(LIB_DIR, { recursive: true });

const DEFAULTS = {
  services: [],
  bookmarks: [],
  settings: {
    source: 'builtin', // builtin | none | pexels | unsplash
    query: 'minimal landscape',
    engine: 'duckduckgo', // duckduckgo | google | brave | startpage | kagi | bing | custom
    font: 'nerd', // nerd | system | mono | serif | custom
    customFont: '',
    customEngine: '', // URL template, e.g. https://search.example.com/search?q=%s
    gradient: { preset: 'midnight', a: '#5e5ce6', b: '#0a84ff' },
    pexelsKey: process.env.PEXELS_API_KEY || '',
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY || '',
    wallpaper: null, // { url, credit, link }
  },
};

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...DEFAULTS, ...d, settings: { ...DEFAULTS.settings, ...(d.settings || {}) } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function loadLib() {
  try { const l = JSON.parse(fs.readFileSync(LIB_FILE, 'utf8')); return { fetched: l.fetched || [], uploads: l.uploads || [] }; }
  catch { return { fetched: [], uploads: [] }; }
}
function saveLib(l) { fs.writeFileSync(LIB_FILE + '.tmp', JSON.stringify(l, null, 2)); fs.renameSync(LIB_FILE + '.tmp', LIB_FILE); }
function rmFiles(it) { for (const f of [it.file, it.thumb]) if (f) { try { fs.unlinkSync(path.join(LIB_DIR, path.basename(f))); } catch { /* already gone */ } } }
async function download(url, base, maxBytes = 25e6) {
  if (!/(^|\.)(unsplash\.com|pexels\.com)$/.test(new URL(url).hostname)) throw new Error('Unexpected image host.');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not download the photo (${r.status}).`);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[(r.headers.get('content-type') || '').split(';')[0]];
  if (!ext) throw new Error('The provider returned an unexpected image type.');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('That photo is too large.');
  fs.writeFileSync(path.join(LIB_DIR, `${base}.${ext}`), buf);
  return `${base}.${ext}`;
}
function jpegFromDataUrl(str) {
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(str || '');
  const buf = m && Buffer.from(m[1], 'base64');
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('Unsupported image. Try a JPEG, PNG or WebP photo.');
  return buf;
}

const wxCache = new Map();
async function cached(key, ttl, fn) {
  const c = wxCache.get(key);
  if (c && Date.now() - c.t < ttl) return c.v;
  const v = await fn();
  wxCache.set(key, { t: Date.now(), v });
  if (wxCache.size > 200) wxCache.delete(wxCache.keys().next().value);
  return v;
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > limit) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function fetchWallpaper(source, query, settings) {
  const q = encodeURIComponent(query || 'minimal landscape');
  if (source === 'pexels') {
    const key = settings.pexelsKey || process.env.PEXELS_API_KEY;
    if (!key) throw new Error('Add a Pexels API key in Settings.');
    const page = 1 + Math.floor(Math.random() * 5);
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${q}&orientation=landscape&size=large&per_page=40&page=${page}`,
      { headers: { Authorization: key } }
    );
    if (!r.ok) throw new Error(`Pexels returned ${r.status}. Check your API key.`);
    const { photos } = await r.json();
    if (!photos || !photos.length) throw new Error('No Pexels photos found for that search.');
    const p = photos[Math.floor(Math.random() * photos.length)];
    return { full: p.src.large2x, thumb: p.src.medium, credit: `${p.photographer} / Pexels`, link: p.url };
  }
  if (source === 'unsplash') {
    const key = settings.unsplashKey || process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new Error('Add an Unsplash access key in Settings.');
    const r = await fetch(
      `https://api.unsplash.com/photos/random?query=${q}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!r.ok) throw new Error(`Unsplash returned ${r.status}. Check your access key.`);
    const p = await r.json();
    return { full: `${p.urls.raw}&w=2400&q=80&fit=max&auto=format`, thumb: p.urls.small, credit: `${p.user.name} / Unsplash`, link: p.links.html };
  }
  throw new Error('Choose Pexels or Unsplash in Settings.');
}

const WEB = path.join(__dirname, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.json': 'application/json', '.svg': 'image/svg+xml' };
function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(WEB, path.normalize(rel));
  const type = TYPES[path.extname(file)];
  if (!file.startsWith(WEB + path.sep) || !type || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const long = rel.startsWith('/fonts/') || rel.startsWith('/wallpapers/') || rel.startsWith('/icons/');
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': long ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/data' && req.method === 'GET') return send(res, 200, load());

    if (url.pathname === '/api/data' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req));
      save({
        services: Array.isArray(body.services) ? body.services : [],
        bookmarks: Array.isArray(body.bookmarks) ? body.bookmarks : [],
        settings: { ...DEFAULTS.settings, ...(body.settings || {}) },
      });
      return send(res, 200, { ok: true });
    }

    if (url.pathname === '/api/wallpaper' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const data = load();
      const settings = { ...data.settings, ...body };
      const wp = await fetchWallpaper(settings.source, settings.query, settings);
      const id = rid();
      const file = await download(wp.full, id);
      let thumb = '';
      try { thumb = await download(wp.thumb, id + '-t', 5e6); } catch { /* thumbnail is optional */ }
      const lib = loadLib();
      const item = { id, file, thumb, credit: wp.credit, link: wp.link, ts: Date.now() };
      lib.fetched.unshift(item);
      const active = (data.settings.wallpaper || {}).url || '';
      while (lib.fetched.length > MAX_FETCHED) { // drop the oldest, but never the wallpaper currently in use
        let i = lib.fetched.length - 1;
        while (i >= 0 && '/media/' + lib.fetched[i].file === active) i--;
        if (i < 0) break;
        rmFiles(lib.fetched.splice(i, 1)[0]);
      }
      saveLib(lib);
      return send(res, 200, { item, library: lib });
    }

    if (url.pathname === '/api/geocode' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length < 2) throw new Error('Type at least 2 letters.');
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
      if (!r.ok) throw new Error('Location search is unavailable right now.');
      const j = await r.json();
      return send(res, 200, (j.results || []).map((p) => ({ name: [p.name, p.admin1, p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude })));
    }

    if (url.pathname === '/api/weather' && req.method === 'GET') {
      const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
      const imp = url.searchParams.get('units') === 'imperial';
      if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) throw new Error('Invalid location.');
      const out = await cached(`${lat.toFixed(2)},${lon.toFixed(2)},${imp}`, 10 * 60e3, async () => {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5&timezone=auto${imp ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : ''}`);
        if (!r.ok) throw new Error('The weather service is unavailable right now.');
        let aqi = null; // air quality is optional: weather still works if this call fails
        try {
          const ar = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,european_aqi,pm2_5,pm10&timezone=auto`);
          if (ar.ok) { const a = (await ar.json()).current || {}; aqi = { us: a.us_aqi ?? null, eu: a.european_aqi ?? null, pm25: a.pm2_5 ?? null, pm10: a.pm10 ?? null }; }
        } catch { /* ignore */ }
        const j = await r.json(), c = j.current, d = j.daily;
        return {
          aqi,
          current: { temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, code: c.weather_code, isDay: !!c.is_day },
          daily: d.time.map((t, i) => ({ date: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], code: d.weather_code[i], pop: d.precipitation_probability_max[i] })),
        };
      });
      return send(res, 200, out);
    }

    if (url.pathname === '/api/library' && req.method === 'GET') return send(res, 200, loadLib());

    if (url.pathname === '/api/upload' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 30e6));
      const lib = loadLib();
      if (lib.uploads.length >= MAX_UPLOADS) throw new Error(`You already have ${MAX_UPLOADS} uploads. Remove one first.`);
      const full = jpegFromDataUrl(b.image);
      const thumbBuf = b.thumb ? jpegFromDataUrl(b.thumb) : null;
      const id = rid();
      fs.writeFileSync(path.join(LIB_DIR, id + '.jpg'), full);
      if (thumbBuf) fs.writeFileSync(path.join(LIB_DIR, id + '-t.jpg'), thumbBuf);
      const item = { id, file: id + '.jpg', thumb: thumbBuf ? id + '-t.jpg' : '', name: String(b.name || 'Upload').slice(0, 80), credit: '', link: '', ts: Date.now() };
      lib.uploads.unshift(item);
      saveLib(lib);
      return send(res, 200, { item, library: lib });
    }

    const del = /^\/api\/library\/([\w-]+)$/.exec(url.pathname);
    if (del && req.method === 'DELETE') {
      const lib = loadLib();
      for (const k of ['fetched', 'uploads']) {
        const i = lib[k].findIndex((x) => x.id === del[1]);
        if (i >= 0) rmFiles(lib[k].splice(i, 1)[0]);
      }
      saveLib(lib);
      return send(res, 200, { library: lib });
    }

    if (url.pathname.startsWith('/media/') && req.method === 'GET') {
      const name = path.basename(url.pathname);
      const type = TYPES[path.extname(name)];
      const file = path.join(LIB_DIR, name);
      if (type && /^[\w.-]+$/.test(name) && name !== 'index.json' && fs.existsSync(file)) {
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' });
        return fs.createReadStream(file).pipe(res);
      }
    }

    if (req.method === 'GET' && serveStatic(res, url.pathname)) return;

    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Start page running on http://localhost:${PORT}`));
