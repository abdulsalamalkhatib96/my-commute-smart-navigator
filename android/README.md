# Android native foundation (EXPERIMENTAL / NOT ROAD-READY)

This is a first-party Android navigation SDK integration scaffold, **not** a compiled or certified Waze replacement. The web app is the tested core; Android must be built and tested using actual Mapbox keys, Gradle/Android Studio and a phone. Current native UI only previews a requested route and uses the provider's map-matched location/route service. Source now wires SDK-managed voice guidance, a maneuver view (which may contain lane information), manually saved coordinate bookmarks, and an explicit foreground location session. **Compilation and road behavior are unverified**. Full voice localization, automatic ETA decision policy, complete offline navigation, auto search, and multi-hour locked-screen behavior are **not validated**.

## Setup

1. Install Android Studio, Android SDK 37 and JDK 17.
2. Set `MAPBOX_DOWNLOADS_TOKEN` in your shell or `~/.gradle/gradle.properties` (secret token with Downloads:Read). NEVER commit the downloads token.
3. Replace the public token placeholder in `app/src/main/res/values/strings.xml` with a restricted Mapbox public token (or inject via local untracked Android resource override).
4. Open `android/` as the root Gradle project; allow sync. Requires network downloads.
5. Grant location permissions, enter destination longitude and latitude and tap Find route. Never operate the controls while driving.

## Pending native milestones

- Compile against Mapbox `3.33.1` and resolve API drift, then test using emulator and real Android device.
- Foreground service and Android 13+ notification permission behavior; locked-screen and background battery tests.
- Compile and verify SDK-native maneuver/voice UI, route progress, lane guidance and reroute handling on phone.
- Safe saved home/work picker and UI accessible with driving constraints.
- Integrate route policies and trip statistics with platform-neutral contracts. Do not automatically force switch a native route just from a browser policy.

Docs: https://docs.mapbox.com/android/navigation/guides/install/ .

### Optional Android GitHub build
Run `.github/workflows/android-build.yml` from GitHub Actions **after** storing `MAPBOX_DOWNLOADS_TOKEN` and `MAPBOX_PUBLIC_TOKEN` in Actions repository secrets. It may fail due to SDK API drift; no APK is claimed to exist before a successful build. Never publish an APK containing a privileged Mapbox Downloads token (the build token must remain CI-side only).
