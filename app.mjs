import {haversine, isValidCoordinate, progressOnSteps, laneSummary, formatMinutes, routeIsPlausible} from './nav-core.mjs';

const $ = id => document.getElementById(id);
const storageKey = name => `mycommute.smartnav.${name}`;
const state = {
  map: null, home: null, homeMarker: null, userMarker: null, position: null,
  accuracy: Infinity, fixAt: 0, heading: null,
  watchId: null, timer: null, requesting: false, controller: null, routes: [], selected: 0,
  lastRequestAt: 0, closest: null, offRouteCount: 0, pinMode: false, announced: new Set(),
  token: '', hasCentered: false
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

function readHome() {
  try {
    const value = JSON.parse(safeStorageGet('home') || 'null');
    if (value && isValidCoordinate(value.coordinates)) return value;
  } catch {}
  return null;
}
function setHome(coordinates, name='البيت') {
  if (!isValidCoordinate(coordinates)) {feedback('إحداثيات غير صحيحة.',true);return;}
  state.home = {coordinates: coordinates.map(Number), name: String(name).slice(0,150)};
  safeStorageSet('home', JSON.stringify(state.home));
  $('home-details').textContent = `${state.home.name} — ${escapeCoordinate(state.home.coordinates)}`;
  $('results').replaceChildren();
  if (state.homeMarker) state.homeMarker.remove();
  if (state.map) {
    state.homeMarker = new mapboxgl.Marker({color:'#e06d4e'}).setLngLat(coordinates)
      .setPopup(new mapboxgl.Popup({offset:18}).setText('البيت')).addTo(state.map);
    state.map.flyTo({center:coordinates,zoom:13});
  }
  feedback('تم حفظ البيت. ابدأ الملاحة لتفعيل مقارنة الطرق.');
  if (state.watchId !== null) requestRoutes(true);
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
      if (state.home) setHome(state.home.coordinates,state.home.name);
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
    label.textContent = `${i===0?'★ الأسرع حسب التقدير':'بديل'} · ${routeName(route,i)}`;
    const km=document.createElement('small');km.textContent=`${(route.distance/1000).toFixed(1)} كم`;
    label.appendChild(km);
    const time=document.createElement('b');time.textContent=formatMinutes(route.duration);
    button.append(label,time);button.onclick=()=>selectRoute(i);$('routes').appendChild(button);
  }
  if (!selected) { $('eta').textContent='—';$('distance').textContent='—';return; }
  $('eta').textContent=new Intl.DateTimeFormat('ar-AE',{hour:'2-digit',minute:'2-digit'}).format(new Date(Date.now()+selected.duration*1000));
  $('distance').textContent=`${(selected.distance/1000).toFixed(1)} كم`;
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
  if (!state.token || !state.home || !state.position) return;
  if (Date.now()-state.fixAt>MAX_FIX_AGE_MS) {feedback('الموقع قديم؛ انتظر إشارة GPS جديدة قبل تحديث الطريق.',true);return;}
  if (state.accuracy>150) {feedback('دقة GPS غير كافية لحساب التوجيه بأمان. انتظر تحسن الإشارة.',true);return;}
  if (!force && Date.now()-state.lastRequestAt<MIN_RECHECK_MS) return;
  if (haversine(state.position,state.home.coordinates)<80) {
    feedback('وصلت تقريبًا إلى البيت.');stopNavigation();return;
  }
  state.lastRequestAt=Date.now();
  state.controller?.abort();
  state.controller=new AbortController();
  const controller=state.controller;
  state.requesting=true;
  setStatus('تحديث الطريق…');
  const points=`${escapeCoordinate(state.position)};${escapeCoordinate(state.home.coordinates)}`;
  const params=new URLSearchParams({alternatives:'true',steps:'true',overview:'full',geometries:'geojson',language:'ar',access_token:state.token});
  try {
    const response=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${points}?${params}`,{signal:controller.signal});
    const payload=await response.json();
    if (!response.ok || payload.code!=='Ok') throw new Error(payload.message || `HTTP ${response.status}`);
    const valid=(payload.routes || []).filter(routeIsPlausible).sort((a,b)=>a.duration-b.duration);
    if (!valid.length) throw new Error('لم يتم العثور على طريق قابل للقيادة');
    state.routes=valid;
    state.selected=0;
    state.offRouteCount=0;
    renderRouteSummary();renderRoutesOnMap();updateGuidance();
    if (state.map && valid[0]?.geometry?.coordinates && !state.hasCentered) {
      const bounds=valid[0].geometry.coordinates.reduce((b,c)=>b.extend(c),new mapboxgl.LngLatBounds(valid[0].geometry.coordinates[0],valid[0].geometry.coordinates[0]));
      state.map.fitBounds(bounds,{padding:70,maxZoom:13});
    }
    $('last-update').textContent=new Intl.DateTimeFormat('ar-AE',{hour:'2-digit',minute:'2-digit'}).format(new Date());
    setStatus('الملاحة نشطة');
    feedback('تم حساب الطريق باستخدام بيانات Mapbox حيث تتوفر. يُعاد التقييم آليًا كل 90 ثانية ما دامت الصفحة نشطة.');
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
  state.position=coord;state.accuracy=accuracy;state.heading=heading;
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
  if (!state.home) {feedback('حدد موقع البيت أولًا.',true);return;}
  if (!('geolocation' in navigator)) {feedback('المتصفح لا يدعم GPS. استخدم HTTPS أو localhost.',true);return;}
  if (state.watchId!==null) return;
  state.hasCentered=false;
  state.watchId=navigator.geolocation.watchPosition(onPosition,onPositionError,{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
  state.timer=setInterval(()=>{if (!document.hidden && state.watchId!==null) requestRoutes();},RECHECK_MS);
  $('start').disabled=true;$('stop').disabled=false;
  setStatus('بانتظار إشارة GPS…');
  feedback('تم طلب إذن الموقع. يجب إبقاء الصفحة فعالة لتستمر التحديثات.');
  speaker('بدأت الملاحة الذكية.');
}
function stopNavigation() {
  if (state.watchId!==null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId=null;
  if(state.timer!==null) clearInterval(state.timer);
  state.timer=null;state.controller?.abort();
  state.routes=[];state.selected=0;state.position=null;state.closest=null;
  state.announced.clear();state.offRouteCount=0;
  if (state.userMarker){state.userMarker.remove();state.userMarker=null;}
  renderRouteSummary();renderRoutesOnMap();updateGuidance();
  $('start').disabled=false;$('stop').disabled=true;
  $('eta').textContent='—';$('distance').textContent='—';
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
      button.textContent=name;button.onclick=()=>setHome(coord,name);
      $('results').appendChild(button);
    }
    if (!$('results').childElementCount) $('results').textContent='لا توجد نتائج. جرّب تحديد البيت بالنقر على الخريطة.';
  } catch(error) {feedback(`تعذر البحث: ${error.message}`,true);$('results').replaceChildren();}
}
function wireEvents() {
  $('save-token').addEventListener('click',()=>initializeMap($('token').value.trim()));
  $('start').addEventListener('click',startNavigation);
  $('stop').addEventListener('click',()=>{stopNavigation();feedback('تم إيقاف GPS وتحديثات الطريق.');});
  $('search-button').addEventListener('click',searchPlace);
  $('place-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchPlace();}});
  $('pick-on-map').addEventListener('click',()=>{
    if(!state.map){feedback('شغّل الخريطة أولًا.',true);return;}
    if(state.pinMode)return;
    state.pinMode=true;feedback('اضغط على موقع المنزل فوق الخريطة لتثبيته.');
    const handler=event=>{state.pinMode=false;setHome([event.lngLat.lng,event.lngLat.lat],'البيت (تم تحديده على الخريطة)');};
    state.map.once('click',handler);
  });
  $('clear-home').addEventListener('click',()=>{
    stopNavigation();state.home=null;safeStorageRemove('home');
    if(state.homeMarker){state.homeMarker.remove();state.homeMarker=null;}
    $('home-details').textContent='لم يتم تحديد البيت بعد.';
    feedback('حُذف الموقع المحفوظ من هذا المتصفح.');
  });
  document.addEventListener('visibilitychange',()=>{
    if (!document.hidden && state.watchId!==null) requestRoutes();
  });
}
wireEvents();
state.home=readHome();
if(state.home) $('home-details').textContent=`${state.home.name} — ${escapeCoordinate(state.home.coordinates)}`;
const token=safeStorageGet('token');
if(token){$('token').value=token;window.addEventListener('load',()=>initializeMap(token));}
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
