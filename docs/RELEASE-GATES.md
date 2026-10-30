# Web-only delivery scope — 30 October 2026

**Current product target: website / PWA only. Android, iOS, Android Auto and CarPlay are explicitly out of scope until the owner requests them.** The historical experimental Android sources are not part of this release.

## Implemented in the web branch
- Saved home/work departure preview without continuous GPS and automatic refresh in an active tab.
- Mapbox congestion-per-segment coloring when annotations match geometry; unknown segments explicitly shown as unknown.
- Best-effort toll-road exclusion and warnings; no guarantee of avoiding Salik or exact gate fees.
- Existing route ranking, fuel budget, history export/import, manual toll estimate and Waze handoff.

## Web validation still required outside code
- A valid URL-restricted Mapbox public token; account and monthly billing alerts.
- Real UAE traffic responses with alternatives and observed annotation coverage.
- GPS road tests on a physical phone; no reliable background/locked-screen geolocation is promised.
- Mapbox/Waze ETA comparison on several real commutes.
- Enable GitHub Pages in repository settings and run the workflow once.

---

# Delivery gates — what must be demonstrated before claiming "Waze replacement"

All items start **unverified** until supported by evidence. A green unit-test pipeline is insufficient.

## Gate A — Web QA

- [x] Pure routing policy with regression tests for hysteresis and mode differences
- [x] Local trip backup/import and basic CSV formula injection mitigation
- [x] Lane extraction uses the maneuver's first intersection rather than a later junction
- [ ] Live Mapbox Directions requests with an authenticated public token, tested in UAE
- [ ] GPS accuracy and long-session browser behavior measured on actual phone
- [ ] Browser accessibility, low-memory and offline/network-loss QA on target devices
- [ ] Route identities benchmarked against overlapping motorway/service roads

## Gate B — Safe native navigation

- [ ] Android project compiles under pinned dependencies and passes instrumentation tests
- [ ] Android foreground trip service remains active when screen locks; notification and battery drain observed
- [ ] Real GPS map-matching and off-route reroute validated on road, not merely route geometry projection
- [x] Mapbox SDK voice observer wiring added in Android source
- [ ] Localized text-to-speech tested without touching screen on real device
- [x] SDK maneuver view code connected to route-progress observer
- [ ] Lane cards verified at real interchanges
- [ ] Audio focus, Bluetooth, call interruptions, tunnels and reduced connectivity handled
- [ ] User stops navigation, location access is discontinued; no forgotten background session
- [ ] Native destination bookmarks, cost mode and trip history integrated with app
- [ ] iOS native app built and tested (only if relevant to user's phone)

## Gate C — Personal intelligence / backend

- [x] On-device fuel/time ranking and historical trip statistics foundation
- [x] Published standard Salik hourly rules encoded and unit-tested for **manual gate count**
- [x] Mapbox route-leg toll warning detection and conditional VAT scenario with selectable crossing time.
- [ ] Verified route-specific Salik gate count and Ramadan/exception pricing (requires direction-specific gate source)
- [ ] Calibrated ETA versus Waze over 20–30 trips with different departure windows
- [x] Historical weekday/hour departure comparison with sample count and low/medium confidence labels (not a traffic forecast)
- [ ] Calibrated forward-looking departure predictions with uncertainty
- [x] AES-256-GCM password-encrypted local cross-device backup export/import (manual file transfer).
- [ ] Authenticated Laravel cloud sync (requires a deployed and secured backend)
- [x] Browser-local data export/delete, optional reminders and conservative local API request caps.
- [x] Technical in-site privacy/data handling page covering local storage, data deletion, providers, backups and browser caveats.
- [ ] Independent legal/privacy review, provider-side billing caps/alerts and externally verified service data-retention settings
- [ ] Opt-in departure reminders and device-specific push notifications

## Limits not solved by development alone

- Physical **fastest lane** speeds require lane-specific sensor/camera/probe data; a phone GPS fix cannot reliably provide them.
- Mapbox/Waze traffic accuracy depends on provider coverage and recent real-world reports.
- SDKs, map matching, voice, route guidance and use in vehicles are subject to vendor licenses, app store rules and hardware testing.

## Definition of successful personal MVP

Open saved home/work and a current ETA, compare routes including known fuel cost, open reliable Waze navigation, and after driving automatically or manually save a plausible trip history. For a **full native navigator**, all Gate B criteria must be completed, not described as done.
