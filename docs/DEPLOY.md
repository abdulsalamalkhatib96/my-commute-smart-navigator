# Deploy website as HTTPS PWA with GitHub Pages

This project contains an automatic `main`-branch deployment workflow, with optional manual dispatch: `.github/workflows/pages.yml`.

**One-time GitHub setting:** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. The connected GitHub tools cannot enable this administrative repository setting automatically.

1. After one-time Pages setup, push/merge to `main` automatically deploys the web build. The manual **Actions → Deploy website to GitHub Pages → Run workflow** command remains available.
2. Verify the **Deploy website to GitHub Pages** Actions workflow succeeded.
3. When successful, access `https://abdulsalamalkhatib96.github.io/my-commute-smart-navigator/` from the phone.
4. Create a Mapbox **public** token `pk...` restricted to the Pages origin(s), including `https://abdulsalamalkhatib96.github.io`. Do not commit secrets or home coordinates.
5. On your phone allow location permission in HTTPS browser, save home/work, and add the site to Home Screen.

**Automatic after Pages setup:** A commit to `main` starts deployment. Without enabling the GitHub Pages source setting, deployment can fail even if all source tests pass. The workflow publishes only the explicitly listed website assets; it excludes native files, tests, local data, and secrets.

**Safety:** PWA cannot guarantee continued geolocation or speech when locked/backgrounded. Do not treat this as a primary in-car navigator. Use the built-in Waze deep link for actual guidance. GitHub Pages is publicly reachable; private location data should never be embedded in source or static files.

Track browser Console, network failures and Mapbox token errors during first use. GitHub Actions cannot validate Mapbox traffic coverage or mobile GPS without a real token/device.


### Website route-preview workflow

Once deployed via HTTPS, enter the Mapbox `pk...` token, save home/work, choose the destination, and press **قارن الطرق الآن**. This works without an active GPS watch. Optional toll avoidance is best-effort only; do not mistake the route color for real-time lane speeds. Keep the tab in the foreground for automatic updates.

The experimental Android directory and workflows are not required for website deployment and are outside the current scope.
