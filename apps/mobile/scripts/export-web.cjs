const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { Resvg } = require('@resvg/resvg-js');
const root = resolve(__dirname, '..');
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', 'dist-web'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const out = join(root, 'dist-web');
mkdirSync(join(out, 'icons'), { recursive: true });
mkdirSync(join(out, 'images'), { recursive: true });
copyFileSync(require.resolve('leaflet/dist/leaflet.css'), join(out, 'leaflet.css'));
for (const name of ['layers.png', 'layers-2x.png', 'marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png'])
  copyFileSync(require.resolve('leaflet/dist/images/' + name), join(out, 'images', name));
const svg = readFileSync(join(root, 'assets/brand/mark.svg'), 'utf8').replace('<g ', '<rect width="1024" height="1024" fill="#0593C6"/><g ');
for (const size of [180, 192, 512]) writeFileSync(join(out, 'icons', `${size}.png`), new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
const manifest = { id: '/', name: 'Tripora', short_name: 'Tripora', lang: 'hr', start_url: '/', scope: '/', display: 'standalone', background_color: '#FCFFFF', theme_color: '#0593C6', icons: [192,512].map(size => ({ src: `/icons/${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) };
writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify(manifest));
let html = readFileSync(join(out, 'index.html'), 'utf8');
html = html.replace(/<html[^>]*>/, '<html lang="hr">').replace(/<title>.*?<\/title>/, '<title>Tripora</title>')
  .replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
  .replace('</head>', '<link rel="stylesheet" href="/leaflet.css"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/180.png"><meta name="theme-color" content="#0593C6"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Tripora"><meta name="apple-mobile-web-app-status-bar-style" content="default"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}body{font-family:system-ui,sans-serif;background:#FCFFFF}input,textarea,select{font-size:16px}button{cursor:pointer}*{box-sizing:border-box}</style></head>');
writeFileSync(join(out, 'index.html'), html);
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name), prefix + entry.name + '/') : [prefix + entry.name]);
}
// Build output only. Never runtime API data, user images or map tiles.
const assets = files(out).filter(file => /\.(js|wasm|css|png|webmanifest|html|ttf)$/.test(file)).map(file => '/' + file);
const version = createHash('sha256');
for (const file of assets) version.update(file).update(readFileSync(join(out, file.slice(1))));
const worker = `const CACHE='tripora-shell-${version.digest('hex').slice(0,16)}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
// Wait for all old clients to close. Never reload an active form or delete user storage.
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tripora-shell-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||event.request.headers.has('Authorization'))return;
 if(event.request.mode==='navigate' && (url.pathname==='/'||url.pathname==='/index.html')){
   event.respondWith(caches.open(CACHE).then(cache=>cache.match('/index.html')).then(cached=>cached||fetch(event.request)));return;
 }
 if(!ASSETS.includes(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
});\n`;
writeFileSync(join(out, 'sw.js'), worker);
console.log(`PWA exported: ${assets.length} public assets; versioned offline shell generated.`);
