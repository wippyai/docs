---
title: "Keeper over MCP"
description: "Add Wippy Keeper to an application, mint a scoped token, and connect an MCP client to its operator tools."
---

# Keeper over MCP

Wippy Keeper provides a UI for registry operations, filesystem-to-registry governance, task and agent orchestration, Hub installation, knowledge-base management, runtime inspection, and Git workflows. It also exposes operator capabilities to compatible clients through the Model Context Protocol (MCP). This page adds Keeper to an application and configures an MCP connection.

**Classification: runnable integration tutorial.** The application and Keeper
transport run locally. Completing the last step requires an MCP client that supports
remote HTTP servers and bearer headers.

## What You'll Build

1. Keeper added to an application scaffolded from the Wippy application template.
2. The Keeper UI at `/c/keeper:main` and the MCP endpoint at `/keeper-mcp/`.
3. A scoped MCP token, and an MCP client configured to drive the app through Keeper.

## Prerequisites

- An app from the [Wippy application template](https://github.com/wippyai/app). It already
  provides everything Keeper binds to: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin`, and `app.env:store`.
- An active admin account in that application. Keeper binds token issuance to the
  signed-in admin identity; a generic API key cannot mint an MCP token.

## Add Keeper

Declare the dependency and bind it to the application's resources. `admin_scope` is required and has no default. The other parameters default to the entry names used by the application template, but the example supplies them explicitly:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  version: "*"
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hosts /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Resolve the source dependency and its transitive graph, then start the app:

```bash
wippy update
wippy run -c
```

`wippy update` scans the source entries, updates the lock, resolves transitive
dependencies, and installs them. `wippy add keeper/keeper` alone updates only the
named lock module; it does not resolve this source-declared dependency graph.

Keeper mounts three surfaces:

- **UI** — `/c/keeper:main`
- **MCP transport** — `/keeper-mcp/` on the public gateway
- **Token API** — on `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

The MCP transport is gated by the `MCP_ENABLED` environment variable (default `true`);
set it to `false` to close the endpoint.

## Mint an MCP Token

Tokens are issued by an active admin user, scoped, and shown exactly once.

1. Sign in to the application as an admin.
2. Open `/c/keeper:main`, select **MCP**, and choose **Create Scoped Token**.
3. Enter a label and select a preset. `observer` is the safest first connection;
   use `developer` or `wippy_operator` only when the client needs write operations.
4. Create the token and copy the displayed `wkmcp_...` value immediately. The UI
   cannot display the raw value again.

The UI also shows the effective MCP URL and copyable client snippets. This is the
recommended flow because it reuses the current signed-in admin session.

For automation, call the API with that same application's **admin session bearer**:

```bash
curl -X POST http://localhost:8080/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "local-observer", "preset": "observer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`<admin-session-token>` is the bearer issued by the application's normal login
flow, not the new Keeper MCP token. The endpoint rejects unauthenticated, inactive,
or non-admin users. `GET /api/v1/keeper/mcp/scopes` returns the live preset and
scope catalog before issuance.

`preset` bundles a set of scopes. Available presets: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. For
finer control, pass an explicit `scopes` array instead (e.g. `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). The raw `wkmcp_...` token is
returned once and stored only as a hash — copy it immediately.

## Connect a Client

Point an MCP client at the endpoint with the token as a bearer header. Keep the token out
of checked-in configuration by exporting it first:

```bash
export KEEPER_MCP_TOKEN='wkmcp_<token>'
```

For Claude Code, use a project-scoped `.mcp.json`:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8080/keeper-mcp/",
      "headers": { "Authorization": "Bearer ${KEEPER_MCP_TOKEN}" }
    }
  }
}
```

Claude Code expands `${KEEPER_MCP_TOKEN}` from the environment when it loads the
project configuration. Restart or reconnect the MCP server after changing the
environment variable.

For Codex, use the user-level `~/.codex/config.toml` or a project-scoped
`.codex/config.toml` in a trusted project:

```toml
[mcp_servers.keeper]
url = "http://localhost:8080/keeper-mcp/"
bearer_token_env_var = "KEEPER_MCP_TOKEN"
```

Use the app's public base URL in place of `http://localhost:8080` in a deployed
environment.

Connect with the configured client and verify that it completes the MCP lifecycle:

1. The client sends `initialize` and receives the server capabilities.
2. It sends `notifications/initialized`.
3. It requests `tools/list`; an `observer` token should expose the discovery and
   session tools allowed by that preset.
4. Call `session_info` and confirm that the returned scopes match the token.

A custom Streamable HTTP client must send
`Accept: application/json, text/event-stream` on these requests and preserve any
session ID returned during initialization. Sending `tools/list` as the first request
is not a valid MCP lifecycle probe. A missing or invalid bearer fails before Keeper
exposes the scoped tool catalog.

## How the MCP Surface Works

Keeper exposes a small set of **meta-tools** and uses **traits** to activate capability-specific tools on demand:

- `session_info` — always available; reports the session's scopes and active traits.
- `list_traits` / `describe_trait` — discover what's available.
- `use_trait` / `drop_trait` (and `set_traits`) — activate or remove a trait; this emits
  an MCP `notifications/tools/list_changed`, so the visible tools change live.
- `list_tools` / `call_tool` — enumerate and invoke the tools a trait materialized.

What a token can activate is bounded by its **scopes** — roughly `registry.*`,
`state.*`, `hub.*`, `knowledge.*`, `git.*`, `components.*`, `tasks.*`, `agents.*`,
`tests.run`, `logger.*`, `env.*`, `functions.call`, `app.ui` (plus `mcp.root` for full
admin bypass). The token's `access_mode` (`any` / `traits` / `tools_only`) further
constrains how it may call tools.

## Operational and Security Notes

- **Governance scope** — set `GOV_MANAGED_NAMESPACES=app` so Keeper's
  filesystem↔registry sync only governs your app's namespace. Do not add `keeper`,
  `wippy`, or `userspace` unless you are developing those modules.
- **Security** — tokens are bound to the issuing admin identity and a scope set, stored
  as SHA-256, and revocable from the Keeper MCP page. The revoke API accepts the
  hashed token identifier returned by the token-list API in
  `POST /api/v1/keeper/mcp/tokens/revoke`; it does not accept the one-time raw bearer. The
  `/keeper-mcp/` route runs no auth middleware; the handler enforces the bearer token.
- **Reference app** — the Wippy application template is the worked example that wires
  Keeper into an app shell; its `src/app/deps/_index.yaml` contains a known-good binding.

## Next Steps

- [Hello World](./hello-world.md) — Minimal project layout
- [Authentication](./auth.md) — Admin identity and token concepts
- [Agents](../framework/agents.md) — Agents and tools exposed by Keeper traits
