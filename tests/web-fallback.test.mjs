import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
test('public token is stored before Mapbox GL/WebGL capability gate',()=>{
 const start=app.indexOf('function initializeMap(token)');
 const token=app.indexOf('state.token = token',start);
 const webgl=app.indexOf('if (!window.mapboxgl?.supported?.())',start);
 assert.ok(start>0&&token>start&&webgl>token);
});
test('route preview and text traffic no longer require map GL',()=>{
 const preview=app.slice(app.indexOf('function previewRoutes(){'),app.indexOf('function startNavigation()'));
 assert.doesNotMatch(preview,/!state\.map/);
 assert.match(preview,/!state\.token/);
 const request=app.slice(app.indexOf('async function requestRoutes('),app.indexOf('function onPosition('));
 assert.match(request,/renderRouteSummary\(\);renderTrafficSummary\(\);renderRoutesOnMap\(\)/);
});
