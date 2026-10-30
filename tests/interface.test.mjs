import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('every bound UI id exists in HTML exactly once',()=>{
  const refs=[...js.matchAll(/\$\('([a-z][\w-]*)'\)/g)].map(m=>m[1]);
  for(const id of new Set(refs)) {
    const occurrences=[...html.matchAll(new RegExp(`\\bid=["']${id}["']`,'g'))];
    assert.equal(occurrences.length,1,`Element #${id} must exist once`);
  }
});
test('service worker caches data decision modules for offline shell',()=>{
  assert.match(sw,/decision-core\.mjs/);
  assert.match(sw,/trip-store\.mjs/);
});
test('not claiming lane-level speed or salik in UI',()=>{
  assert.match(html,/لا يشمل سالك/);
  assert.match(html,/وليس أنه الأسرع/);
});
