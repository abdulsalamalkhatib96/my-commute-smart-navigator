# Deploy website as HTTPS PWA with GitHub Pages

This project contains a manual deployment workflow: `.github/workflows/pages.yml`.

**One-time GitHub setting:** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. The connected GitHub tools cannot enable this administrative repository setting automatically.

1. Verify that the latest **Tests** workflow has passed.
2. Go to **Actions → Deploy website to GitHub Pages → Run workflow**, selecting `main`.
3. When successful, access `https://abdulsalamalkhatib96.github.io/my-commute-smart-navigator/` from the phone.
4. Create a Mapbox **public** token `pk...` restricted to the Pages origin(s), including `https://abdulsalamalkhatib96.github.io`. Do not commit secrets or home coordinates.
5. On your phone allow location permission in HTTPS browser, save home/work, and add the site to Home Screen.

**Not automatic:** Page publication requires a manual workflow dispatch by design. It avoids failing your CI until the Pages setting is enabled. Once enabled, the workflow uploads only the explicitly listed website assets, excluding Android files, tests, local data, and secrets.

**Safety:** PWA cannot guarantee continued geolocation or speech when locked/backgrounded. Do not treat this as a primary in-car navigator. Use the built-in Waze deep link for actual guidance. GitHub Pages is publicly reachable; private location data should never be embedded in source or static files.

Track browser Console, network failures and Mapbox token errors during first use. GitHub Actions cannot validate Mapbox traffic coverage or mobile GPS without a real token/device.


### Website route-preview workflow

Once deployed via HTTPS, enter the Mapbox `pk...` token, save home/work, choose the destination, and press **قارن الطرق الآن**. This works without an active GPS watch. Optional toll avoidance is best-effort only; do not mistake the route color for real-time lane speeds. Keep the tab in the foreground for automatic updates.

The experimental Android directory and workflows are not required for website deployment and are outside the current scope.
