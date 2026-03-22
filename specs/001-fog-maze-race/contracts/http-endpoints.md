# HTTP Endpoints Contract

## Purpose

The MVP exposes almost all gameplay behavior through realtime events. The public HTTP
surface is intentionally small and exists only for service health and static asset
delivery.

## Public Endpoints

### `GET /health`

Service health check used by deployment and uptime monitoring.

**Response 200**

```json
{
  "ok": true,
  "service": "fog-maze-race",
  "version": "git-sha-or-semver",
  "uptimeSeconds": 1234
}
```

### `GET /`

Serves the built frontend application shell.

**Behavior**

- Returns the SPA entry document.
- Browser routes are handled client-side after initial load.

## Notes

- No public REST CRUD API is required for rooms in MVP.
- Room listing, joinability, match state, and result data are synchronized via the
  realtime contract.
- The HTTP server and realtime transport share one public origin and one public port.
