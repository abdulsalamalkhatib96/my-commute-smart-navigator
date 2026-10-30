#!/usr/bin/env bash
set -euo pipefail
# Exercises actual document module initialization in headless Chrome on localhost.
# Hostname routing blocks external map/CDN requests; no Mapbox token or real GPS is used.
PORT="${PORT:-18976}"
python3 -m http.server "$PORT" --bind 127.0.0.1 > /tmp/mycommute-local-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
for _ in {1..20}; do if curl -fsS "http://127.0.0.1:$PORT/index.html" >/dev/null; then break; fi; sleep .25; done
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo "Headless Chrome is required for browser smoke" >&2; exit 1; fi
timeout 65s "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --no-first-run --disable-background-networking --host-resolver-rules="MAP * 0.0.0.0, EXCLUDE 127.0.0.1" \
  --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:$PORT/index.html" \
  >/tmp/mycommute-browser-dom.html 2>/tmp/mycommute-chrome.log || {
    echo "Chrome smoke execution failed; trailing diagnostics:" >&2
    tail -40 /tmp/mycommute-chrome.log >&2
    exit 1
  }
grep -q 'data-app-ready="true"' /tmp/mycommute-browser-dom.html || {
 echo 'Application failed to initialize browser JavaScript; DOM excerpt:' >&2
 head -c 1500 /tmp/mycommute-browser-dom.html >&2
 exit 1
}
grep -q 'id="quick-home"' /tmp/mycommute-browser-dom.html
grep -q 'id="drive-mode-toggle"' /tmp/mycommute-browser-dom.html
echo "Browser startup and primary controls verified"
