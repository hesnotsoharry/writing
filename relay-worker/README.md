# WritersNook E2EE Relay

This Cloudflare Worker is the stateless transport for WritersNook device sync. One
SQLite-backed Durable Object instance coordinates each room's hibernating WebSockets,
but the relay does not read, parse, log, or store frame payloads.

## Local development

```powershell
npm install
npx wrangler dev
```

Run the unit tests with:

```powershell
npm test
```

## Deploy

Deployment is Cole's step. From this directory, authenticate Wrangler and run:

```powershell
npx wrangler deploy
```

The `new_sqlite_classes` migration in `wrangler.jsonc` is the current required flag for
a new SQLite-backed Durable Object class. SQLite-backed Durable Objects are supported on
the Cloudflare Workers Free plan. This relay intentionally makes no Durable Object storage
calls; the SQLite-backed migration selects the supported DO class type, while active socket
membership is provided only by the WebSocket Hibernation API.
