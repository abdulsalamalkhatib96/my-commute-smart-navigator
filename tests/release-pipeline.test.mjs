import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('every app local import is copied in pages artifact and pre-cached',()=>{
 const app=read('app.mjs'),sw=read('sw.js'),deploy=read('.github/workflows/pages.yml');
 const imports=[...app.matchAll(/from\s+['"]\.\/(.+?\.mjs)['"]/g)].map(x=>x[1]);
 assert.ok(imports.length>=5);
 for(const file of imports){
   assert.match(sw,new RegExp(file.replaceAll('.','\\.')));
   assert.match(deploy,new RegExp(file.replaceAll('.','\\.')));
 }
});
test('website deploy runs automatically on main and manually on demand',()=>{
 const deploy=read('.github/workflows/pages.yml');
 assert.match(deploy,/push:\s*\n\s*branches:\s*\[main\]/);
 assert.match(deploy,/workflow_dispatch:/);
 assert.match(deploy,/upload-pages-artifact/);
});
test('deployment does not bundle native app or hidden local tokens',()=>{
 const deploy=read('.github/workflows/pages.yml');
 const copy=deploy.split('Build safe static artifact')[1]?.split('- name: Inject domain-restricted')[0]||'';
 assert.doesNotMatch(copy,/android\/|\.env|secrets\.|gradle/);
});
