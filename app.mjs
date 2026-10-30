import {haversine, isValidCoordinate, progressOnSteps, laneSummary, formatMinutes, routeIsPlausible} from './nav-core.mjs';
import {DEFAULT_SETTINGS, normalizeSettings, fuelCost, chooseRoute, tripStats, departureBuckets, formatAED} from './decision-core.mjs';
import {readTrips, saveTrip, clearTrips, csvTrips, exportTrips, importTrips} from './trip-store.mjs';

const $ = id => document.getElementById(id);
const storageKey = name => `mycommute.smartnav.${name}`;
const state = {
  map: null, home: null, homeMarker: null, userMarker: null, position: null,
  accuracy: Infinity, fixAt: 0, heading: null,
  watchId: null, timer: null, requesting: false, controller: null, routes: [], selected: 0,
  lastRequestAt: 0, closest: null, offRouteCount: 0, pinMode: false, announced: new Set(),
  token: '', hasCentered: false, destination: 'home', work: null, workMarker: null,
  settings: {...DEFAULT_SETTINGS}, pendingRoute: null, trip: null, lastGpsFix: null,
  lastRouteChange: 0, lastDecision: '—', savePinFor: 'home', manualRouteUntil: 0
};
const RECHECK_MS = 90_000;
const MIN_RECHECK_MS = 35_000;
const MAX_FIX_AGE_MS = 35_000;
function feedback(msg, isError=false) {
  $('feedback').textContent = msg;
  $('feedback').style.color = isError ? '#a33f37' : '';
}
function setStatus(msg) { $('status').textContent = msg; }
function safeStorageGet(key) { try { return localStorage.getItem(storageKey(key)); } catch { return null; } }
function safeStorageSet(key, value) { try { localStorage.setItem(storageKey(key), value); } catch { feedback('تعذر الحفظ محليًا: المتصفح يمنع التخزين.'); } }
function safeStorageRemove(key) { try { localStorage.removeItem(storageKey(key)); } catch {} }
function escapeCoordinate(coord) { return `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`; }

function readPlace(key) {
  try {
    const value = JSON.parse(safeStorageGet(key) || 'null');
    if (value && isValidCoordinate(value.coordinates)) return value;
  } catch {}
  return null;
}
function setHome(coordinates, name='البيت') {
  setPlace('home',coordinates,name);
}
function setPlace(which, coordinates, name=which==='home'?'البيت':'العمل') {
  if (!isValidCoordinate(coordinates)) {feedback('إحداثيات غير صحيحة.',true);return;}
  const place={coordinates: coordinates.map(Number), name: String(name).slice(0,150)};
  state[which]=place;
  safeStorageSet(which, JSON.stringify(place));
  $(`${which}-details`).textContent = `${place.name} — ${escapeCoordinate(place.coordinates)}`;
  $('results').replaceChildren();
  const markerKey=which==='home'?'homeMarker':'workMarker';
  if (state[markerKey]) state[markerKey].remove();
  if (state.map) {
    state[markerKey] = new mapboxgl.Marker({color:which==='home'?'#e06d4e':'#2a5eaa'})
      .setLngLat(place.coordinates).setPopup(new mapboxgl.Popup({offset:18}).setText(name)).addTo(state.map);
    state.map.flyTo({center:place.coordinates,zoom:13});
  }
  feedback(`تم حفظ ${which==='home'?'البيت':'العمل'}.`);
  if (state.watchId !== null && state.destination===which) requestRoutes(true);
}
function selectedDestination() {return state[state.destination];}
function downloadFile(contents, filename, mime) {
  const url=URL.createObjectURL(new Blob([contents],{type:mime}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function readSettings() {
  try {return normalizeSettings(JSON.parse(safeStorageGet('settings')||'{}'));}
  catch {return {...DEFAULT_SETTINGS};}
}
function updateSettingsUI() {
  $('mode').value=state.settings.mode;
  $('consumption').value=state.settings.litersPer100km;
  $('fuel-price').value=state.settings.fuelPriceAED;
  $('time-value').value=state.settings.valueOfTimeAEDPerHour;
}
function saveSettings() {
  state.settings=normalizeSettings({mode:$('mode').value,
    litersPer100km:$('consumption').value,fuelPriceAED:$('fuel-price').value,
    valueOfTimeAEDPerHour:$('time-value').value});
  safeStorageSet('settings',JSON.stringify(state.settings));
  updateSettingsUI(); renderRouteSummary();renderHistory();
  feedback('حُفظت الإعدادات على هذا الجهاز. التكلفة لا تشمل سالك أو المواقف.');
}
function renderHistory() {
  const trips=readTrips();const stats=tripStats(trips,state.destination);
  $('trip-count').textContent=String(stats.count);
  $('median-duration').textContent=stats.medianSeconds===null?'—':formatMinutes(stats.medianSeconds);
  $('eta-error').textContent=stats.medianEtaErrorSeconds===null?'—':formatMinutes(stats.medianEtaErrorSeconds);
  const buckets=departureBuckets(trips,state.destination);
  const best=buckets.sort((a,b)=>a.medianSeconds-b.medianSeconds)[0];
  $('historical').textContent=best
    ? `من سجلك السابق: الساعة ${best.key.split('-')[1]} كان وسيط الرحلة ${formatMinutes(best.medianSeconds)} (${best.count} رحلات). هذا ليس توقعًا حيًا.`
    : 'نحتاج 3 رحلات مكتملة على الأقل في نفس اليوم والساعة لعرض مقارنة تاريخية.';
}
function finishTrip(arrived=false) {
  if(!state.trip)return;
  const t=state.trip;state.trip=null;
  const seconds=Math.round((Date.now()-new Date(t.startAt).getTime())/1000);
  if(seconds<120 || !Number.isFinite(seconds) || t.distanceMeters<200 || t.initialEtaSeconds===null) return;
  saveTrip({id:t.id,destination:t.destination,startAt:t.startAt,endAt:new Date().toISOString(),
    durationSeconds:Math.min(seconds,86399),distanceMeters:Math.min(t.distanceMeters,1499999),
    initialEtaSeconds:t.initialEtaSeconds},state.settings.maxHistory);
  renderHistory();
  feedback(arrived?'تم حفظ الرحلة عند الوصول.':'تم حفظ الرحلة عند الإيقاف.');
}
function trackTripPosition(coord, accuracy, timestamp) {
  if(!state.trip || accuracy>70)return;
  const previous=state.lastGpsFix;state.lastGpsFix={coord, timestamp};
  if(!previous)return;
  const seconds=(timestamp-previous.timestamp)/1000;
  if(seconds<=0 || seconds>60)return;
  const delta=haversine(previous.coord,coord);
  if(delta>7 && delta/seconds<42)state.trip.distanceMeters+=delta;
}

function initializeMap(token) {
  if (!/^pk\.[A-Za-z0-9._-]+$/.test(token)) {
    feedback('أدخل Public access token صحيحًا من Mapbox يبدأ بـ pk.',true); return;
  }
  if (!window.mapboxgl?.supported()) {
    feedback('تعذر تشغيل Mapbox GL JS. افحص الاتصال ودعم WebGL.',true);return;
  }
  state.token = token;
  safeStorageSet('token', token);
  $('token').value = token;
  $('map').replaceChildren();
  if (state.map) state.map.remove();
  state.map = null;
  state.routes = [];
  try {
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container:'map', style:'mapbox://styles/mapbox/streets-v12',
      center:[55.22,25.27],zoom:9, attributionControl:true
    });
    state.map = map;
    map.addControl(new mapboxgl.NavigationControl({showCompass:true}), 'top-left');
    map.on('load', () => {
      map.addSource('alternates', {type:'geojson',data:emptyCollection()});
      map.addSource('selected', {type:'geojson',data:emptyCollection()});
      map.addLayer({id:'alternates-line',type:'line',source:'alternates',paint:{'line-color':'#8b9dae','line-width':5,'line-opacity':.65},layout:{'line-cap':'round','line-join':'round'}});
      map.addLayer({id:'selected-outline',type:'line',source:'selected',paint:{'line-color':'#fff','line-width':9},layout:{'line-cap':'round','line-join':'round'}});
      map.addLayer({id:'selected-line',type:'line',source:'selected',paint:{'line-color':'#169d83','line-width':6},layout:{'line-cap':'round','line-join':'round'}});
      if (state.home) setPlace('home',state.home.coordinates,state.home.name);
      if (state.work) setPlace('work',state.work.coordinates,state.work.name);
      if (state.position) drawUserPosition();
      renderRoutesOnMap();
      setStatus('الخريطة جاهزة');
    });
    map.on('error', e => {
      const msg = e?.error?.message || 'خطأ في خدمة الخرائط';
      if (/unauthorized|forbidden|access token|401|403/i.test(msg)) feedback('مفتاح Mapbox مرفوض. تحقق من صلاحيات الرمز والنطاق المسموح.',true);
    });
  } catch(error) {feedback(`تعذر تهيئة الخريطة: ${error.message}`,true);}
}
function emptyCollection() {return {type:'FeatureCollection',features:[]};}
function routeFeature(route) {return {type:'Feature',properties:{},geometry:route.geometry};}
function renderRoutesOnMap() {
  if (!state.map?.getSource('selected')) return;
  const valid = state.routes.filter(routeIsPlausible);
  const selected = valid[state.selected];
  state.map.getSource('selected').setData({type:'FeatureCollection',features:selected ? [routeFeature(selected)] : []});
  state.map.getSource('alternates').setData({type:'FeatureCollection',features:valid.filter(route=>route!==selected).map(routeFeature)});
}
function drawUserPosition() {
  if (!state.map || !state.position) return;
  if (!state.userMarker) {
    const el=document.createElement('div');el.className='user-dot';
    el.style.cssText='width:19px;height:19px;border-radius:50%;background:#2f7af6;border:4px solid white;box-shadow:0 0 0 4px #3478ff40';
    state.userMarker = new mapboxgl.Marker({element:el}).setLngLat(state.position).addTo(state.map);
  } else state.userMarker.setLngLat(state.position);
  if (!state.hasCentered) {state.map.easeTo({center:state.position,zoom:13});state.hasCentered=true;}
}
function selectRoute(index) {
  if (!state.routes[index]) return;
  state.selected = index;
  state.pendingRoute=null;state.manualRouteUntil=Date.now()+15*60_000;
  state.announced.clear();
  renderRouteSummary();
  renderRoutesOnMap();
  updateGuidance();
}
function routeName(route,index) {
  const roads=[...new Set((route.legs?.[0]?.steps||[]).map(step=>step.name).filter(Boolean))];
  return roads.slice(0,2).join(' / ') || (index === 0 ? 'الطريق المقترح' : `بديل ${index}`);
}
function renderRouteSummary() {
  const selected=state.routes[state.selected];
  $('routes').replaceChildren();
  for (let i=0;i<state.routes.length;i++) {
    const route=state.routes[i], button=document.createElement('button');
    button.type='button'; button.className=`route ${i===state.selected?'selected':''}`;
    const label=document.createElement('span');
    label.textContent = `${i===state.selected?'✓ المختار':i===0?'★ الأسرع زمنًا':'بديل'} · ${routeName(route,i)}`;
    const km=document.createElement('small');km.textContent=`${(route.distance/1000).toFixed(1)} كم`;
    const cost=document.createElement('small');cost.textContent=`وقود تقديري ${formatAED(fuelCost(route,state.settings))} · دون سالك` ;label.append(km,cost);
    const time=document.createElement('b');time.textContent=formatMinutes(route.duration);
    button.append(label,time);button.onclick=()=>selectRoute(i);$('routes').appendChild(button);
  }
  if (!selected) { $('eta').textContent='—';$('distance').textContent='—';return; }
  $('eta').textContent=new Intl.DateTimeFormat('ar-AE',{hour:'2-digit',minute:'2-digit'}).format(new Date(Date.now()+selected.duration*1000));
  $('distance').textContent=`${(selected.distance/1000).toFixed(1)} كم`;
  $('fuel-estimate').textContent=formatAED(fuelCost(selected,state.settings));
}
function directionSymbol(indications) {
  const arrows={'straight':'↑','left':'↖','right':'↗','slight left':'↖','slight right':'↗','sharp left':'←','sharp right':'→','uturn':'↩','none':'·'};
  const dirs=indications.map(i=>arrows[i]||'·');
  return dirs.slice(0,2).join(' ');
}
function speaker(text) {
  if (!$('voice').checked || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const msg=new SpeechSynthesisUtterance(text);
    msg.lang='ar-AE';msg.rate=.94;speechSynthesis.speak(msg);
  } catch {}
}
function updateGuidance() {
  const selected=state.routes[state.selected];
  const steps=selected?.legs?.[0]?.steps;
  $('lanes').replaceChildren();
  if (!state.position || !steps?.length) {
    $('maneuver').textContent='بانتظار GPS ومسار الرحلة…';return;
  }
  const progress=progressOnSteps(state.position,steps);
  if (!progress) { $('maneuver').textContent='لا توجد بيانات توجيه كافية.';return; }
  state.closest=progress;
  const upcoming=steps[progress.stepIndex+1];
  if (!upcoming) { $('maneuver').textContent='اقتربت من وجهتك.';return; }
  const ahead=Math.round(progress.remainingMeters);
  const instruction=upcoming.maneuver?.instruction || `اتبع الطريق نحو ${upcoming.name||'المنزل'}`;
  const distLabel=ahead<1000?`${ahead} م`:`${(ahead/1000).toFixed(1)} كم`;
  $('maneuver').textContent=`بعد ${distLabel}: ${instruction}`;
  const lanes=laneSummary(upcoming);
  if (lanes) {
    for (const lane of lanes) {
      const el=document.createElement('div');el.className=`lane ${lane.valid?'valid':''}`;
      const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent=directionSymbol(lane.indications);
      const caption=document.createElement('small');caption.textContent=lane.valid?'مناسب':'غير مناسب';
      el.append(arrow,caption);$('lanes').appendChild(el);
    }
  } else {const line=document.createElement('span');line.className='help';line.textContent='لا توجد بيانات مسارب متاحة لهذه المناورة.';$('lanes').appendChild(line);}
  // Use stable maneuver location rather than request ID: refreshes should not repeat the same prompt.
  const loc=upcoming.maneuver?.location;
  if (isValidCoordinate(loc)) {
    const key=`${loc[0].toFixed(4)},${loc[1].toFixed(4)}`;
    const stage=ahead<=170?'near':ahead<=650?'early':null;
    if (stage && !state.announced.has(`${key}:${stage}`)) {
      state.announced.add(`${key}:${stage}`);speaker(`بعد ${distLabel}، ${instruction}`);
    }
  }
}
async function requestRoutes(force=false) {
  const destination=selectedDestination();
  if (!state.token || !destination || !state.position) return;
  if (Date.now()-state.fixAt>MAX_FIX_AGE_MS) {feedback('الموقع قديم؛ انتظر إشارة GPS جديدة قبل تحديث الطريق.',true);return;}
  if (state.accuracy>150) {feedback('دقة GPS غير كافية لحساب التوجيه بأمان. انتظر تحسن الإشارة.',true);return;}
  if (!force && Date.now()-state.lastRequestAt<MIN_RECHECK_MS) return;
  if (haversine(state.position,destination.coordinates)<100) {
    stopNavigation(true);return;
  }
  state.lastRequestAt=Date.now();
  state.controller?.abort();
  state.controller=new AbortController();
  const controller=state.controller;
  state.requesting=true;
  setStatus('تحديث الطريق…');
  const points=`${escapeCoordinate(state.position)};${escapeCoordinate(destination.coordinates)}`;
  const params=new URLSearchParams({alternatives:'true',steps:'true',overview:'full',geometries:'geojson',language:'ar',access_token:state.token});
  try {
    const response=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${points}?${params}`,{signal:controller.signal});
    const payload=await response.json();
    if (!response.ok || payload.code!=='Ok') throw new Error(payload.message || `HTTP ${response.status}`);
    const valid=(payload.routes || []).filter(routeIsPlausible).sort((a,b)=>a.duration-b.duration);
    if (!valid.length) throw new Error('لم يتم العثور على طريق قابل للقيادة');
    if(state.controller!==controller)return; // stale response must never overwrite a newer route
    const previous=state.routes[state.selected]||null;
    const offRoute=state.offRouteCount>=3;
    let decision=chooseRoute(valid,previous,state.pendingRoute,state.settings,state.routes.length===0||offRoute);
    if(!offRoute && Date.now()<state.manualRouteUntil && previous){
      const manual=valid.findIndex(route=>route===previous);
      const matched=manual>=0?manual:valid.findIndex(route=>{
        const roads=new Set((route.legs?.[0]?.steps||[]).map(x=>x.name).filter(Boolean));
        const prior=(previous.legs?.[0]?.steps||[]).map(x=>x.name).filter(Boolean);
        return prior.length>=2 && prior.filter(name=>roads.has(name)).length/prior.length>=.75;
      });
      if(matched>=0)decision={index:matched,pending:null,reason:'manual-locked'};
    }
    state.pendingRoute=decision.pending;state.lastDecision=decision.reason;
    if(previous && decision.reason==='better-route') speaker('وجدت طريقًا أسرع بشكل ملحوظ. تحقق من إمكانية تغيير الطريق بأمان.');
    state.routes=valid;
    state.selected=decision.index;
    state.offRouteCount=0;
    if(state.trip && state.trip.initialEtaSeconds===null)state.trip.initialEtaSeconds=valid[state.selected].duration;
    renderRouteSummary();renderRoutesOnMap();updateGuidance();
    if (state.map && valid[0]?.geometry?.coordinates && !state.hasCentered) {
      const bounds=valid[0].geometry.coordinates.reduce((b,c)=>b.extend(c),new mapboxgl.LngLatBounds(valid[0].geometry.coordinates[0],valid[0].geometry.coordinates[0]));
      state.map.fitBounds(bounds,{padding:70,maxZoom:13});
    }
    $('last-update').textContent=new Intl.DateTimeFormat('ar-AE',{hour:'2-digit',minute:'2-digit'}).format(new Date());
    setStatus('الملاحة نشطة');
    feedback(`تم تقييم المسارات (${decision.reason}). يُعاد التقييم آليًا عند نشاط التطبيق؛ Waze متاح للملاحة المعتمدة.`);
  } catch(error) {
    if (error.name==='AbortError') return;
    setStatus('تعذر تحديث المسار');
    feedback(`فشل تحديث الطريق: ${error.message}. سيبقى آخر مسار معروضًا إن وجد.`,true);
  } finally {if (state.controller===controller) state.requesting=false;}
}
function onPosition(position) {
  const {longitude,latitude,accuracy,heading}=position.coords;
  const coord=[longitude,latitude];
  if (!isValidCoordinate(coord)) return;
  if(position.timestamp && state.lastGpsFix && position.timestamp<=state.lastGpsFix.timestamp)return;
  state.position=coord;state.accuracy=accuracy;state.heading=heading;
  trackTripPosition(coord,accuracy,position.timestamp||Date.now());
  state.fixAt=Date.now();
  drawUserPosition();
  if (state.routes.length) {
    updateGuidance();
    if (state.closest?.lateralMeters>120 && accuracy<60) state.offRouteCount++;
    else state.offRouteCount=0;
    if (state.offRouteCount>=3 && Date.now()-state.lastRequestAt>=MIN_RECHECK_MS) {
      feedback('يبدو أنك خرجت عن المسار: يجري إعادة حساب الطريق.');
      state.offRouteCount=0;requestRoutes(true);return;
    }
  }
  if (!state.routes.length) requestRoutes(true);
  else if (Date.now()-state.lastRequestAt>=RECHECK_MS) requestRoutes();
}
function onPositionError(error) {
  const messages={1:'تم رفض إذن GPS. اسمح للموقع باستخدام الموقع الجغرافي.',2:'تعذر تحديد موقعك حاليًا.',3:'انتهت مهلة الحصول على موقع GPS.'};
  feedback(messages[error.code] || error.message,true);
  if (error.code===1) stopNavigation();
}
function startNavigation() {
  if (!state.map) {feedback('شغّل الخريطة أولًا.',true);return;}
  if (!selectedDestination()) {feedback('حدد الوجهة المحددة أولًا.',true);return;}
  if (!('geolocation' in navigator)) {feedback('المتصفح لا يدعم GPS. استخدم HTTPS أو localhost.',true);return;}
  if (state.watchId!==null) return;
  state.hasCentered=false;
  state.trip={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,destination:state.destination,startAt:new Date().toISOString(),distanceMeters:0,initialEtaSeconds:null};
  state.lastGpsFix=null;
  state.watchId=navigator.geolocation.watchPosition(onPosition,onPositionError,{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
  state.timer=setInterval(()=>{if (!document.hidden && state.watchId!==null) requestRoutes();},RECHECK_MS);
  $('start').disabled=true;$('stop').disabled=false;
  setStatus('بانتظار إشارة GPS…');
  feedback('تم طلب إذن الموقع. يجب إبقاء الصفحة فعالة لتستمر التحديثات.');
  speaker('بدأت الملاحة الذكية.');
}
function stopNavigation(arrived=false) {
  finishTrip(arrived);
  if (state.watchId!==null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId=null;
  if(state.timer!==null) clearInterval(state.timer);
  state.timer=null;state.controller?.abort();
  state.routes=[];state.selected=0;state.position=null;state.closest=null;state.pendingRoute=null;state.lastGpsFix=null;state.manualRouteUntil=0;
  state.announced.clear();state.offRouteCount=0;
  if (state.userMarker){state.userMarker.remove();state.userMarker=null;}
  renderRouteSummary();renderRoutesOnMap();updateGuidance();
  $('start').disabled=false;$('stop').disabled=true;
  $('eta').textContent='—';$('distance').textContent='—';$('fuel-estimate').textContent='—';
  setStatus('متوقفة');
}
async function searchPlace() {
  const search=$('place-search').value.trim();
  if (!state.token){feedback('أدخل Mapbox token أولًا.',true);return;}
  if (search.length<3){feedback('اكتب 3 أحرف على الأقل للبحث عن الوجهة.',true);return;}
  const params=new URLSearchParams({q:search,language:'ar',country:'ae',limit:'5',access_token:state.token});
  $('results').textContent='جاري البحث…';
  try {
    const response=await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
    const data=await response.json();
    if (!response.ok) throw new Error(data.message||`HTTP ${response.status}`);
    $('results').replaceChildren();
    for (const result of data.features||[]) {
      const coord=result.geometry?.coordinates;
      if (!isValidCoordinate(coord)) continue;
      const name=result.properties?.full_address||result.properties?.name||'موقع على الخريطة';
      const button=document.createElement('button');button.type='button';button.className='result';
      button.textContent=name;button.onclick=()=>setPlace(state.savePinFor,coord,name);
      $('results').appendChild(button);
    }
    if (!$('results').childElementCount) $('results').textContent='لا توجد نتائج. جرّب تحديد البيت بالنقر على الخريطة.';
  } catch(error) {feedback(`تعذر البحث: ${error.message}`,true);$('results').replaceChildren();}
}
function wireEvents() {
  $('destination').addEventListener('change',()=>{
    if(state.watchId!==null)stopNavigation();
    state.destination=$('destination').value;renderHistory();renderRouteSummary();
    const target=selectedDestination();if(target && state.map)state.map.flyTo({center:target.coordinates,zoom:12});
  });
  $('place-kind').addEventListener('change',()=>{state.savePinFor=$('place-kind').value;});
  $('settings-save').addEventListener('click',saveSettings);
  $('export-json').addEventListener('click',()=>downloadFile(exportTrips(readTrips()),'my-commute-trips.json','application/json'));
  $('export-csv').addEventListener('click',()=>downloadFile('\ufeff'+csvTrips(readTrips()),'my-commute-trips.csv','text/csv;charset=utf-8'));
  $('import-json').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {if(file.size>2_000_000)throw new Error('الملف كبير جدًا');
      const count=importTrips(await file.text(),state.settings.maxHistory);
      renderHistory();feedback(`استيراد ناجح: ${count} رحلة محفوظة.`);
    }catch(error){feedback(`رفض الاستيراد: ${error.message}`,true)}finally{e.target.value='';}
  });
  $('delete-history').addEventListener('click',()=>{
    if(!confirm('حذف جميع الرحلات المحفوظة في هذا المتصفح؟ لا يمكن التراجع.'))return;
    clearTrips();renderHistory();feedback('حُذف سجل الرحلات من هذا المتصفح.');
  });
  $('open-waze').addEventListener('click',()=>{
    const dest=selectedDestination();if(!dest){feedback('حدد وجهتك أولًا.',true);return;}
    const [lng,lat]=dest.coordinates;
    window.open(`https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`,'_blank','noopener,noreferrer');
  });
  $('save-token').addEventListener('click',()=>initializeMap($('token').value.trim()));
  $('start').addEventListener('click',startNavigation);
  $('stop').addEventListener('click',()=>{stopNavigation();feedback('تم إيقاف GPS وتحديثات الطريق.');});
  $('search-button').addEventListener('click',searchPlace);
  $('place-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchPlace();}});
  $('pick-on-map').addEventListener('click',()=>{
    if(!state.map){feedback('شغّل الخريطة أولًا.',true);return;}
    if(state.pinMode)return;
    state.pinMode=true;feedback('اضغط على موقع المنزل فوق الخريطة لتثبيته.');
    const handler=event=>{state.pinMode=false;setPlace(state.savePinFor,[event.lngLat.lng,event.lngLat.lat],state.savePinFor==='home'?'البيت':'العمل');};
    state.map.once('click',handler);
  });
  $('clear-home').addEventListener('click',()=>{
    if(state.watchId!==null)stopNavigation();
    const which=state.savePinFor;state[which]=null;safeStorageRemove(which);
    const marker=which==='home'?'homeMarker':'workMarker';
    if(state[marker]){state[marker].remove();state[marker]=null;}
    $(`${which}-details`).textContent='غير محدد.';
    feedback('حُذف الموقع المختار من هذا المتصفح.');
  });
  document.addEventListener('visibilitychange',()=>{
    if (!document.hidden && state.watchId!==null) requestRoutes();
  });
}
wireEvents();
state.home=readPlace('home');state.work=readPlace('work');state.settings=readSettings();
if(state.home) $('home-details').textContent=`${state.home.name} — ${escapeCoordinate(state.home.coordinates)}`;
if(state.work) $('work-details').textContent=`${state.work.name} — ${escapeCoordinate(state.work.coordinates)}`;
updateSettingsUI();renderHistory();
const token=safeStorageGet('token');
if(token){$('token').value=token;window.addEventListener('load',()=>initializeMap(token));}
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
