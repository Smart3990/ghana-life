// Converts the Low Poly Epic City pack (T version: one shared atlas) into game files.
//   node scripts/epic/convert.cjs <folder with the pack's FBX files, tex/ and units.json> <out folder>
// Writes <out>/<group>/<name>.glb (true metres, one shared material), <out>/thumbs/<name>.png,
// <out>/people-animations.glb and <out>/list.json. Run optimise.mjs afterwards to shrink the GLBs.
// The pack files are paid for: they stay out of Git until converted, and the source FBX never ship.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [src, out] = process.argv.slice(2).map((p) => path.resolve(p));
const three = path.resolve(__dirname, '../../node_modules/three');
const page = path.join(__dirname, 'convert-page.html');
const units = JSON.parse(fs.readFileSync(path.join(src, 'units.json'), 'utf8'));
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.fbx': 'application/octet-stream' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = null;
  if (u === '/' || u === '/page') f = page;
  else if (u.startsWith('/three/')) f = path.join(three, u.slice(7));
  else if (u.startsWith('/src/')) f = path.join(src, u.slice(5));
  if (!f || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/** "Tiles_T__Roads_T__tile-road-straight.fbx" -> { group: "tiles/roads", name: "tile-road-straight" } */
function split(file) {
  const bits = file.replace(/\.fbx$/, '').split('__');
  const name = bits.pop().replace(/_/g, '-');
  const group = bits.map((b) => b.replace(/_T$/, '').toLowerCase()).join('/');
  return { group, name };
}

(async () => {
  await new Promise((ok) => server.listen(0, ok));
  const port = server.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 320, height: 320 } });
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await p.goto(`http://localhost:${port}/page`);
  await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
  fs.mkdirSync(path.join(out, 'thumbs'), { recursive: true });
  const files = fs.readdirSync(src).filter((f) => f.endsWith('.fbx') && f.includes('__')).sort();
  const list = [];
  let n = 0;
  for (const f of files) {
    const { group, name } = split(f);
    try {
      const r = await p.evaluate(([f, u]) => window.convert(f, u), [f, units[f] ?? 100]);
      fs.mkdirSync(path.join(out, group), { recursive: true });
      fs.writeFileSync(path.join(out, group, name + '.glb'), Buffer.from(r.glb, 'base64'));
      fs.writeFileSync(path.join(out, 'thumbs', name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
      list.push({ name, group, file: `${group}/${name}.glb`, size: r.size, min: r.min, tris: r.tris, parts: r.parts.length, skinned: r.skinned });
    } catch (e) {
      console.log('FAILED', f, String(e).slice(0, 200));
      list.push({ name, group, error: String(e).slice(0, 200) });
    }
    if (++n % 40 === 0) console.log(n, '/', files.length);
  }
  const a = await p.evaluate(([f, u]) => window.convertAnimations(f, u), ['people-animations.fbx', units['people-animations.fbx'] ?? 100]);
  fs.writeFileSync(path.join(out, 'people-animations.glb'), Buffer.from(a.glb, 'base64'));
  console.log('animations', JSON.stringify(a.clips), a.bones.length, 'bones');
  fs.writeFileSync(path.join(out, 'list.json'), JSON.stringify({ animations: a.clips, bones: a.bones, models: list }, null, 1));
  console.log('done', list.filter((m) => !m.error).length, 'of', files.length);
  await b.close();
  server.close();
})();
