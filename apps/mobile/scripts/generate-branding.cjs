const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const root = join(__dirname, '..', 'assets');
const mark = readFileSync(join(root, 'brand', 'mark.svg'), 'utf8');
const raster = (name, svg) => writeFileSync(join(root, name), new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng());
mkdirSync(root, { recursive: true });
// Adaptive foreground layers are enlarged by Android masks; keep the entire handle in the safe area.
const adaptive = mark.replace(/(<svg[^>]*>)/, '$1<g transform="translate(92.16 92.16) scale(0.82)">').replace('</svg>', '</g></svg>');
raster('adaptive-icon.png', adaptive);
raster('icon.png', mark.replace('<g ', '<rect width="1024" height="1024" fill="#0593C6"/><g '));
console.log('Generated 1024px launcher assets from assets/brand/mark.svg.');
