---
title: "Keeper over MCP"
description: "Wippy Keeper is the control plane for a running Wippy app — a registry workbench, filesystem↔registry governance, agent/task orchestration, Hub…"
---

# Keeper over MCP

Wippy Keeper is the control plane for a running Wippy app — a registry workbench,
filesystem↔registry governance, agent/task orchestration, Hub install, knowledge base,
logs and process inspection, and a Git review/push flow, all behind a built-in UI. Its
defining feature is that it exposes those operator capabilities to AI clients (Claude,
Codex, …) over **MCP (Model Context Protocol)**. This page adds Keeper to an app and
connects an MCP client to it.

## What You'll Build

1. Keeper added to an app scaffolded from `app-template`.
2. The Keeper UI at `/app/keeper` and the MCP endpoint at `/keeper-mcp/`.
3. A scoped MCP token, and an MCP client configured to drive the app through Keeper.

## Prerequisites

- An app from [app-template](https://github.com/wippyai/app-template). It already
  provides everything Keeper binds to: `app:gateway`, `app:api`, `app:db`,
  `app:processes`, `app.security:admin`, and `app.env:store`.
- The Keeper module installed:

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## Add Keeper

Declare the dependency and bind it to the app's resources. Only `admin_scope` is
required (no default); the rest default to the names `app-template` already uses, shown
here explicitly for clarity:

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # hosts /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

Start the app:

```bash
wippy run
```

Keeper auto-mounts three surfaces:

- **UI** — `/app/keeper`
- **MCP transport** — `/keeper-mcp/` on the public gateway
- **Token API** — on `app:api` (`/keeper/mcp/tokens`, `/keeper/mcp/scopes`)

The MCP transport is gated by the `MCP_ENABLED` environment variable (default `true`);
set it to `false` to close the endpoint.

## Mint an MCP Token

Tokens are issued by an admin user, scoped, and shown exactly once. Create one via the
token API (or the MCP page in the Keeper UI):

```bash
curl -X POST http://localhost:8085/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset` bundles a set of scopes. Available presets: `root`, `developer`,
`wippy_operator`, `observer`, `knowledge_manager`, `explorer_tools_only`. For
finer control, pass an explicit `scopes` array instead (e.g. `registry.read`,
`state.write`, `git.pr`, `tasks.run`, `knowledge.read`). The raw `wkmcp_...` token is
returned once and stored only as a hash — copy it immediately.

## Connect a Client

Point an MCP client at the endpoint with the token as a bearer header. For Claude Code /
Codex, an `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8085/keeper-mcp/",
      "headers": { "Authorization": "Bearer wkmcp_<token>" }
    }
  }
}
```

Use the app's public base URL in place of `http://localhost:8085` in a deployed
environment.

## How the MCP Surface Works

Keeper does not expose a flat, fixed tool list. It presents a few **meta-tools** plus
**traits** that activate concrete tools on demand, so the surface stays small until you
opt into a capability:

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

## Notes

- **Governance scope** — set `GOV_MANAGED_NAMESPACES=app` so Keeper's
  filesystem↔registry sync only governs your app's namespace. Do not add `keeper`,
  `wippy`, or `userspace` unless you are developing those modules.
- **Security** — tokens are bound to the issuing admin identity and a scope set, stored
  as SHA-256, and revocable via `POST /keeper/mcp/tokens/revoke`. The `/keeper-mcp/`
  route runs no auth middleware; the handler enforces the bearer token itself.
- **Reference app** — `app-keeper` is the worked example that wires Keeper into an app
  shell; copy its `src/app/deps/_index.yaml` block if you want a known-good setup.

## Next Steps

- [Hello World](tutorials/hello-world.md) — the minimal project layout
- [Authentication](tutorials/auth.md) — the admin identity that issues tokens
- [Agents](framework/agents.md) — the agents and tools Keeper traits expose
