// Small client for the server's JSON API.
async function call(url, method, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j;
}
window.API = {
  async load() { return (await fetch('/api/data')).json(); },
  async save(data) { await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); },
  async wallpaper(s) { return call('/api/wallpaper', 'POST', s); },
  async weather(lat, lon, units) { return call(`/api/weather?lat=${lat}&lon=${lon}&units=${units}`, 'GET'); },
  async geocode(q) { return call('/api/geocode?q=' + encodeURIComponent(q), 'GET'); },
  async library() { return (await fetch('/api/library')).json(); },
  async upload(body) { return call('/api/upload', 'POST', body); },
  async remove(id) { return call('/api/library/' + id, 'DELETE'); },
};
