# My Commute — private single-user backend

This optional backend enables **zero-knowledge snapshot sync** and real **Web Push**. It is not included in GitHub Pages, which cannot run Node servers.

## Requirements
- Node.js 22+, PostgreSQL 15+.
- TLS reverse proxy (or managed HTTPS) for the API.
- Environment variables in `.env.example`; configure on the host, **never commit values**.
- Run `npm install` from `backend` and `npm start`. DB schema migrates on boot. Run `npm run generate_vapid` once and store keys as server secrets. Server polls due reminders every 30 s.
- Set `WEB_ORIGIN=https://abdulsalamalkhatib96.github.io`; set random `SYNC_API_TOKEN` at least 32 characters and use **the same token** in the personal web client.
- Configure `VAPID_SUBJECT` as a working admin email. Web Push needs a supported browser, installed PWA in some iOS versions, user permission and a running backend. No guaranteed delivery due to OS/push provider restrictions.

## API
All except `GET /health` require `Authorization: Bearer <SYNC_API_TOKEN>`. Only the fixed `WEB_ORIGIN` is admitted by CORS; TLS must be enforced at the host. API does not store encryption passphrases.

- `GET /v1/snapshot` -> `{revision:0,envelope:null}` if empty, otherwise current opaque encrypted envelope.
- `PUT /v1/snapshot` JSON `{expectedRevision:number,envelope:EncryptedBackupV1}`. Revisions use optimistic CAS; `409 {current}` means someone wrote from another device. **Never silently overwrite.**
- `GET /v1/push/key` -> VAPID public key.
- `POST /v1/push/subscriptions` JSON `{subscription:PushSubscriptionJSON,settings:{enabled:boolean,workTime:"06:30",homeTime:"17:00"}}`.
- `DELETE /v1/push/subscriptions` JSON `{endpoint:...}`.

## Data and constraints
- The server retains only AES-GCM encrypted backup envelopes, not decrypted coordinates/places/trips. Clients must separately remember their encryption passphrase; forgotten password makes data unrecoverable.
- Push records contain endpoint and Dubai-local **times**, no location, but remain sensitive and require protected Postgres and regular backups. The `SYNC_API_TOKEN` is an account-wide bearer secret; use only for personal trusted devices. Losing a device or token requires rotation and reconnecting trusted devices.
- A single snapshot is a single user's state, not separate accounts. End-to-end multi-device merging is **manual on 409**; the server refuses data loss through last-writer-wins.
- Scheduler uses Postgres unique delivery keys for at-most-once sends per day/slot/device; a crash after reservation can miss a reminder, whereas transient failed requests are released for retry. A separate always-on process/managed host is required.
- To scale to multiple users, implement per-user OAuth/session model, row-level identities, per-device revocation and audit. Do not expose this service as a shared multi-user SaaS.
- No privileged server secret should ever be sent to GitHub Pages public assets. API token is entered by the owner in the client.


## Verification against PostgreSQL

GitHub Actions provisions ephemeral PostgreSQL 16 and runs `backend/tests/postgres.test.mjs` as a real integration test. It verifies table migrations, encrypted JSONB persistence, optimistic CAS conflict handling and database-level push delivery uniqueness. This does not exercise a deployed HTTPS host or external push provider; live end-to-end acceptance remains required.


## Optional self-hosting with HTTPS

On an owner-controlled VPS with DNS pointing `API_DOMAIN` at the server IP and TCP ports 80/443 open, install Docker Compose and set the environment variables from `.env.example`, including a URL-safe random `PG_PASSWORD`, `API_DOMAIN`, `SYNC_API_TOKEN` and VAPID details. From `backend/`, run `docker compose up -d --build`. Compose creates a persistent private PostgreSQL volume and a Caddy HTTPS proxy. Database port is not exposed publicly. Configure secured database backups, host firewall, API hostname, monitoring and certificate renewal. **Creating external hosting and DNS cannot be performed by the current GitHub-only connection.** Never commit your `.env` or the user's encryption password.
