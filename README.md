# My Commute — Smart Navigator (Arabic MVP)

A functional **personal-use web/PWA prototype** for live-traffic-aware route comparison and junction lane guidance **when available**, using Mapbox Directions API and a mobile device's GPS. Not a lane-speed sensor, not a certified turn-by-turn navigation product.

## Start in 5 minutes

1. Create a Mapbox account: https://account.mapbox.com/ . Copy a **public** token (`pk...`); do **not** use a secret (`sk...`) token in the frontend. Restrict allowed URLs for deployment. Read provider licensing terms before use in a vehicle, commercial use, or broader distribution.
2. Serve the unzipped directory locally (do not open `file://`): `python3 -m http.server 8080`, then open `http://localhost:8080`. For GPS on a **phone**, deploy as an HTTPS static website (e.g. Cloudflare Pages, Netlify). `localhost` GPS permission works for local development.
3. Enter the Mapbox public token, then search for the home's neighborhood/address or use **حدد البيت على الخريطة** and click the precise home location. It is saved to your current browser's localStorage.
4. Press **ابدأ الملاحة باستخدام GPS** on the phone and grant permission. The app requests alternatives and refreshes about every 90 seconds while the page remains active.
5. Add to Home Screen via your browser to install the PWA shell.

## What is implemented
- Geolocation watch (high accuracy), map point, home pin, and locally saved home.
- Directions `/directions/v5/mapbox/driving-traffic/` with `steps=true`, `geometries=geojson`, `alternatives=true` and Arabic instructions.
- The quickest route by returned ETA, route alternatives, km and ETA display.
- Re-evaluation every 90 seconds while page is active, after GPS updates; basic off-route replan after repeated accurate fixes (>120 m off path) with cooldown; stale / inaccurate GPS rejection.
- Upcoming turn and **valid turn-lane arrows** where Directions response has intersection.lanes (left-to-right; not live lane speeds). Browser speech synthesis when permitted.
- Basic PWA metadata, installable icons, offline app shell; map/routing needs internet.
- No personal location history sent to an application server. Location and destination are sent to Mapbox for routing; browser holds public token and saved destination.

## Hard limitations / not for hands-on driving use
- **Never** infer fastest physical lane. Mapbox `intersections.lanes.valid` means eligible for the upcoming turn, not fastest lane. Some maneuvers have no lane metadata.
- Browser background geolocation/timers are not reliable on iOS/Android under lock/background. A robust always-on in-car product requires native SDK and permission-handling.
- Route progress uses GPS nearest step geometry: not accurate enough for close parallel roads, stacked roads, or final ramp decisions. No map-matching in this MVP. Do not rely on experimental spoken instructions as a sole navigation source.
- Traffic availability/quality for a given UAE road must be evaluated with a real token and actual phone trip; Mapbox can fall back to non-live driving routes in areas without supported coverage.
- A local Mapbox token is a **public** credential. Restrict by allowed website URL, monitor requests and configure billing alerts/limits. Check Mapbox terms (including vehicular/embedded use clauses) before production.
- Auto-selecting the fastest route at each update may cause switching; route-change hysteresis and map-matching belong in a next iteration, after field data validates routing.
- The app's offline cache is only the shell. Traffic and map tiles are not provided offline.
- Don't manipulate this prototype while driving; obey signs, traffic law and safe lane-change rules. Use Waze/Google Maps for dependable navigation in the meantime.

## Testing

```
node --test tests/*.test.mjs
```

No live Mapbox API calls are possible without your token; tests only validate geographic and guidance helpers. This demo has not been road-tested.

## Official sources (checked 30 Oct 2026)
- https://docs.mapbox.com/api/navigation/directions/
- https://docs.mapbox.com/mapbox-gl-js/api/markers/
- https://www.mapbox.com/pricing
- https://www.mapbox.com/traffic-data

## Integration with existing My Commute
The directory is intentionally independent, because the existing My Commute website's source files and deployment are not available in this session. A production integration should expose this behind the current app's navigation menu, reuse its destination settings, and persist completed trip stats via the project's authenticated API; don't overwrite its existing trip tracking until reviewed.
