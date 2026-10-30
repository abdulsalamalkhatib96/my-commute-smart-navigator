import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('privacy page accessible from site and included in deployment/offline shell',()=>{
 assert.match(read('index.html'),/href="\.\/privacy\.html"/);
 assert.match(read('sw.js'),/\.\/privacy\.html/);
 assert.match(read('.github/workflows/pages.yml'),/privacy\.html/);
});
test('privacy page describes actual data processing and limits',()=>{
 const p=read('privacy.html');
 for(const s of ['Mapbox','GitHub Pages','GPS','AES-256-GCM','حذف كل بياناتي المحلية'])assert.ok(p.includes(s));
});
