# My Commute Smart Navigator — Web-first Commute Assistant

Arabic-first, local-first journey planning and traffic-aware route comparison for UAE commuting. **This project is an experimental tool, not a certified Waze replacement or safe primary turn-by-turn navigator.** Use Waze/Google Maps for in-car navigation until the native application is validated.

## Current status (30 October 2026)

| Feature | Status |
| --- | --- |
| Saved home / work destinations, map picker, UAE geocoding | Implemented (web) |
| Traffic-aware alternative routes and ETA (Mapbox) | Implemented, requires public Mapbox token and network |
| Fast / balanced / fuel-economy route policy with 2-poll hysteresis | Implemented and tested as pure JS |
| Manual selected route, approximately retained across refreshes | Implemented, route identity is heuristic |
| Fuel estimate with user-set consumption, AED/L and value of time | Implemented; tolls/parking excluded from route ranking |
| Dubai Salik reference rate from manually entered gate count | Implemented; **not route-aware**, Ramadan schedule intentionally unknown |
| Historical departure comparison with sample counts | Implemented; retrospective only, **not a live traffic forecast** |
| Local-only trip history, ETA error, weekday/hour historical observations | Implemented; requires actual completed trips |
| History JSON export/import, CSV export, clear history | Implemented |
| Lane arrows for available upcoming maneuver | Experimental; **not fastest physical lane**, may be unavailable |
| Waze deep-link for dependable turn-by-turn | Implemented; Waze chooses its own path |
| Android native Nav SDK with saved coordinates, Mapbox maneuver view and audio-guidance wiring | Source updated; **not compiled, not field-tested** |
| Android Mapbox audio guidance + foreground GPS service code | Implemented as SDK wiring; **not compiled/verified on device** |
| Real-time lane speeds / route-specific Salik detection | NOT available/implemented |
| Cloud sync, Laravel server, user accounts, iOS | NOT implemented |

## Run the web app

1. Create a **public** Mapbox token (`pk...`) with allowed URL restrictions at https://account.mapbox.com/. Do not put a secret token (`sk...`) in the browser or repository.
2. Serve the root directory over HTTP for local development: `python3 -m http.server 8080` then open `http://localhost:8080`. On a phone use **HTTPS** hosting.
3. Enter the token and press "تشغيل الخريطة". Save precise **home** and **work** locations with the picker or Mapbox geocoding.
4. Select trip destination, set fuel consumption / fuel price, and press "ابدأ الملاحة باستخدام GPS". The app polls Directions (driving-traffic) about every 90 seconds while visible and location fixes are fresh.
5. At journey end press "إنهاء وحفظ الرحلة". Metrics and history are on your device only, under `localStorage`. Export a JSON backup before clearing browser data or switching phones.
6. Use "افتح وجهتك في Waze" for reliable spoken driving directions. It sends destination coordinates to Waze, not your calculated Mapbox route.

### Tests

```bash
node --test tests/*.test.mjs
node --check app.mjs
```

All Node tests are **local unit/static tests**. They do not prove routing accuracy, GPS performance, Mapbox service coverage, Android build status or road safety. Verify against actual map provider and phones separately.

## Routing policy and limitations

- **Fastest:** lowest ETA. **Balanced:** fuel estimate (AED) + travel-time valuation. **Economy:** lowest estimated fuel, with a 10-minute detour guard when comparing route updates.
- When the previous route can be approximately recognized, a change is suggested only with material improvement over two consecutive polls; short-term fluctuations do not trigger changes. Recognizing routes from road names is an approximation and must not be used for safety-critical navigation.
- For costs, only **fuel** is estimated, using route distance x fuel consumption x AED per litre. Salik, parking and route-specific tolls are **unknown** and intentionally not entered as zero.
- Historic departure buckets use 3+ previous trips at the same *local weekday+hour*. These are **retrospective**, not current traffic predictions.
- Route-step progress uses approximate GPS-to-line projection and can fail near parallel/stacked roads. Do not trust experimental lane arrows without road signs. Mapbox intersection lane validity means eligible for maneuver, not lane speed.
- Android PWA may not update or speak when backgrounded or the screen locks; it is not safe as the sole navigator.
- GPS/route API requests and searches are sent directly from device to Mapbox. No independent application server collects detailed positions, but the provider still receives them per its privacy policy. Public tokens can be extracted from client-side apps; restrict domains and watch usage.
- Offline cache holds only the application shell; live traffic, route search and map tiles need a connection.

## Android source foundation

See [`android/README.md`](android/README.md). An experimental Kotlin/Mapbox module is included. Gradle and Mapbox SDK cannot be downloaded in this offline execution environment, so **the Android module was not compiled or tested**. It is not yet a working full guidance application. A real account public access token and Mapbox Downloads read token are mandatory.

## Deployment

Publish the static **root** folder on HTTPS (GitHub Pages, Cloudflare Pages, Netlify). GitHub Pages requires a repository setting and may make the deployed content public. The repository is public; never commit precise personal home/work coordinates or tokens. Run CI before enabling automatic deploy. The browser stores coordinates locally; do not embed them in JavaScript or README.

## Roadmap / non-completed goals

See [`docs/RELEASE-GATES.md`](docs/RELEASE-GATES.md) for reproducible field acceptance criteria and remaining native/production work. Integration with the original ChatGPT My Commute Site is not included: the linked Site is a separate system and wasn't modified.

## Official references

- https://docs.mapbox.com/api/navigation/directions/
- https://docs.mapbox.com/android/navigation/guides/install/
- https://www.mapbox.com/pricing
- https://docs.mapbox.com/help/glossary/access-token/


## October 30 follow-up delivery
- Web: a separate `salik-core.mjs` applies published Dubai standard hourly gate pricing to **a manually entered gate count**, without misrepresenting route-specific toll detection. Ramadan is explicitly marked unknown.
- Web: `departure-core.mjs` compares matching Dubai weekday/hour trip-history samples with a minimum sample size, clearly labeled retrospective; it does not infer future traffic.
- Native: the Mapbox maneuver view and SDK-managed voice guidance are now connected to route progress; home/work bookmarks are stored locally; explicit Stop clears routes and stops the GPS session. These are source-level changes, **not evidence of successful Android build or road readiness**.
- A separate manually triggered GitHub Actions workflow `android-build.yml` can compile and retain a short-lived APK if the repository owner configures `MAPBOX_DOWNLOADS_TOKEN` and `MAPBOX_PUBLIC_TOKEN` as Actions secrets. Never send secret tokens in chat or commit them.
- Web unit tests are run in CI. Android compilation, notification behavior, voice language, background operation, map matching and safety require SDK credentials plus a real device.


## Web-only priority (30 October 2026)

Current development targets the **website/PWA**, not an Android or iOS app. The old experimental `android/` folder is retained as inactive historical code; it is not part of website deployment, testing or the committed web-first feature definition.

### Preview a trip before leaving (no GPS)

1. Save **home** and **work** positions once; Mapbox needs an allowed public token (`pk...`).
2. Select destination and choose the **saved departure location** in the new preview panel.
3. Choose whether to **request toll avoidance**, then click **Compare routes**.
4. Inspect ETA, estimated fuel, alternatives and colored traffic segments, if returned. A route may still contain tolls; the exclusion is not a guarantee and pricing is **not** automatically computed.
5. As long as the website stays visible, the comparison automatically refreshes about every 90 seconds. Manual refresh is also available.
6. Start GPS only if you want the website's experimental live tracking and guidance. A locked/backgrounded browser cannot promise continuous GPS or speech; use Waze for dependable driving guidance.

### New tests

`node --test tests/*.test.mjs` now includes the traffic/endpoint helper tests. Live provider calls, real traffic coverage and road accuracy require a Mapbox key and device verification.


## Full-screen browser map mode

Use **وضع خريطة القيادة** to display a full-screen map and accessible exit, re-center and Waze buttons. With active GPS, the map can follow fresh fixes on the foreground page; manual drag pauses recentering for 45 seconds. The view is a browser convenience, not an approved primary navigator: GPS/speech may stop when the screen is locked, and route projection cannot guarantee correct lanes on stacked roads. Keep attention on the road and use Waze for dependable maneuvers.


## Forecast departure windows (web)

Mapbox Directions driving-traffic supports `depart_at` time-dependent routing. The site compares departure now, +15, +30, +60 minutes using four user-initiated predictions. It displays **driving duration** and **clock-time arrival** separately. These are provider predictions based on historic/live-mixed traffic, not guaranteed future real-time conditions. Only saved-place origin/destination are supported, no background polling, and a two-minute request cooldown protects quota. Provider errors may yield partial comparisons. The feature needs a Mapbox public token and internet connection.

Official reference: https://docs.mapbox.com/api/navigation/directions/


## Automated HTTPS site deployment

Every successful merge to `main` triggers the GitHub Pages workflow. One-time repository Pages setting (source: **GitHub Actions**) must be enabled by the repository administrator. If that setting is disabled, the workflow will fail without publishing; no valid website URL should be claimed until the deployment succeeds. `tests/release-pipeline.test.mjs` guards the JS import/cache/artifact list to prevent a broken deploy from missing modules.


## Geolocation safety guard

Raw browser GPS timestamps are now checked against the actual measurement age and previous accepted fix, so stale/out-of-order fixes cannot masquerade as fresh. Off-route recovery may request a new route after a shorter, still bounded 8-second cooldown versus 35 seconds for ordinary checks. This does **not** constitute map matching or guarantee safe turn-by-turn guidance.


## Optional foreground-only commute reminders and local privacy reset

The user can set two daily reminders in Dubai time, enable them explicitly, and optionally request browser Notification permission through a user click. Reminder windows are de-duplicated per day. **No server-side scheduler or push subscription exists:** reminders do not reliably execute with the page closed or the device asleep. The app offers a separate, confirmed **delete all my local app data** action that removes its own storage prefix, including saved Mapbox public token and trips, without touching other websites' storage. PWA shell files may remain cached; they contain no private travel data.


## Password-encrypted local portable backup (no cloud account)

Use the backup panel to export/import saved places, nonsecret route settings and trip history together. The app encrypts browser-side with PBKDF2-SHA256 (210,000 iterations), a fresh random 16-byte salt, AES-256-GCM and a fresh 12-byte IV; no password is saved or sent to a server. The exported JSON excludes the Mapbox token, and import merges validated trips. A passphrase of at least 12 characters is required. Password recovery is impossible if the passphrase is lost. **This is an encrypted manual backup, not automatic cloud synchronization.** HTTPS/secure context is required for WebCrypto.


## Salik route evidence and conditional VAT scenario

Mapbox v5 Directions returns toll alerts and violated toll-avoidance notices on **route legs** (`route.legs[].notifications`); route comparisons now identify an alerted toll segment when one is reported. A missing alert is **not proof** that a route is free of Salik, and Mapbox does not provide a verified exact count of Dubai toll gates in those notifications. The manual toll calculator supports an optional anticipated Dubai crossing clock time (default now). As the UAE government's 2026 guidance states that 5% VAT applies to toll transactions from June 1, a clearly labeled **if additional** tax scenario is shown separately. The app does not assert whether the official posted toll rate already includes VAT; verify the authoritative invoice. Sources: https://docs.mapbox.com/api/navigation/directions/ and https://u.ae/information-and-services/transportation/roadways
