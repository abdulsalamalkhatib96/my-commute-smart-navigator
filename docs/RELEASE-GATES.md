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
- [ ] Localized text-to-speech for upcoming maneuvers, tested without touching screen
- [ ] Lane cards bound to actual route progress, verified at interchanges
- [ ] Audio focus, Bluetooth, call interruptions, tunnels and reduced connectivity handled
- [ ] User stops navigation, location access is discontinued; no forgotten background session
- [ ] Native destination bookmarks, cost mode and trip history integrated with app
- [ ] iOS native app built and tested (only if relevant to user's phone)

## Gate C — Personal intelligence / backend

- [x] On-device fuel/time ranking and historical trip statistics foundation
- [ ] Real Salik data from official/licensed source and time-of-day rules
- [ ] Calibrated ETA versus Waze over 20–30 trips with different departure windows
- [ ] Historical departure recommendations with confidence bounds and explicit uncertainty
- [ ] Authenticated Laravel sync and cross-device encrypted backups (if demanded)
- [ ] Privacy policy, retention controls, data export/delete, billing guardrails and API usage budgets
- [ ] Opt-in departure reminders and device-specific push notifications

## Limits not solved by development alone

- Physical **fastest lane** speeds require lane-specific sensor/camera/probe data; a phone GPS fix cannot reliably provide them.
- Mapbox/Waze traffic accuracy depends on provider coverage and recent real-world reports.
- SDKs, map matching, voice, route guidance and use in vehicles are subject to vendor licenses, app store rules and hardware testing.

## Definition of successful personal MVP

Open saved home/work and a current ETA, compare routes including known fuel cost, open reliable Waze navigation, and after driving automatically or manually save a plausible trip history. For a **full native navigator**, all Gate B criteria must be completed, not described as done.
