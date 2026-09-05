---
title: "Network Overlays"
description: "Route outbound traffic and bind listeners through overlay networks (SOCKS5 proxies, Tor, Tailscale mesh, I2P). Overlay selection is opt-in per call and…"
---

# Network Overlays

Route outbound traffic and bind listeners through overlay networks (SOCKS5 proxies, Tor, Tailscale mesh, I2P). Overlay selection is opt-in per call and inherits across function, process, and HTTP boundaries.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `network.socks5` | Generic SOCKS5 proxy (also covers Tor's SOCKS5 listener) |
| `network.tailscale` | Tailscale tsnet overlay node |
| `network.i2p` | I2P SAM v3 bridge |

## SOCKS5

```yaml
- name: proxy
  kind: network.socks5
  host: 127.0.0.1
  port: 1080
  username: "optional"
  password: "optional"
  isolate_streams: false
```

| Field | Type | Description |
|-------|------|-------------|
| `host` | string | Proxy host |
| `port` | int | Proxy port (1-65535) |
| `username` | string | Optional SOCKS5 auth |
| `password` | string | Optional SOCKS5 auth |
| `isolate_streams` | bool | Per-connection random credentials (Tor stream isolation) |

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| Field | Type | Description |
|-------|------|-------------|
| `hostname` | string | tsnet node name (used in per-node state directory) |
| `auth_key` | string | Tailnet auth key — inline or `${env:NAME}` resolved via the [env registry](system/env.md) |
| `state_dir` | string | Override for tsnet state directory |
| `control_url` | string | Alternate coordination server |
| `ephemeral` | bool | Register as an ephemeral tailnet node |

`auth_key` is required (supply it directly or via `${env:NAME}`). The legacy `auth_key_env` directive resolves the same way but is deprecated; prefer `auth_key: ${env:NAME}`.

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| Field | Type | Description |
|-------|------|-------------|
| `host` | string | SAM v3 bridge host |
| `port` | int | SAM v3 bridge port |
| `session_name` | string | Optional session identifier |

## Selecting an Overlay

### On http.service

Bind the server listener through an overlay (Tailscale, I2P):

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 does not support inbound listening — use it only for outbound dials.

### From Lua

Route a called function or spawned process through an overlay using `with_options`:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app.net:proxy" })
    :call("app.api:fetch_data")
```

```lua
local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

The `http_client` module accepts the same overlay selection on per-call options under the key `overlay_network`.

## Inheritance

Overlay selection flows through the call stack. A function called via `funcs.new():with_options({network=...})` sees the overlay on every inner dial, every nested `funcs.call`, and every `process.spawn` it performs — until a descendant explicitly selects a different overlay or clears it.

Ambient inheritance bypasses the descendant's own `network.select` deny rules. Only explicit selection at a Lua edge is gated.

## App Configuration

Overlay drivers read app-wide settings from a `network_service:` block in `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # base dir for driver state (Tailscale keys, etc.)
  default_network: app.net:tailnet  # overlay applied when no call sets one
```

| Field | Default | Description |
|-------|---------|-------------|
| `state_dir` | `.wippy/net` | Driver state directory. Relative paths resolve against the boot config dir. |
| `default_network` | — | Registry ID of an overlay applied to any task or process that does not pin its own network via options. |

## Raw Dials

Overlay selection is not limited to Lua edges. Dials made through the runtime network service — the WASM [`socket` host](wasm/hosts.md#socket) and the `wasi:sockets` dispatcher — read the overlay off the frame and route through it, whether it was set by `with_options`, by `meta.options.network` on the entry, or by `network_service.default_network`.

The private-IP gate behaves differently on that path. A direct dial resolves the target and checks every resulting address against `socket.private_ip`. With an overlay selected, only a literal IP address in the target is checked; host names are handed to the overlay to resolve, so the local resolver is never consulted and no check is made on what it would have returned.

When an overlay is selected but the context carries no network registry, the dial fails with `network "<id>" selected without a network registry`.

## Updating Overlays

Overlay entries hot-swap on registry update. When an overlay's configuration changes, the driver builds the replacement service first and only swaps it in once it is created successfully; if the new configuration fails, the existing overlay keeps running. Concurrent callers see either the old or the new service, never a gap.

## Permissions

| Action | Resource | Description |
|--------|----------|-------------|
| `network.select` | Network registry ID | Explicit overlay selection at `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Network registry ID | Binding an `http.service` listener through an overlay (the `network:` field) |
| `socket.connect` | `host:port` | Any outbound dial through the network service |
| `socket.listen` | `host:port` | Binding a TCP listener or a UDP socket through the network service |
| `socket.resolve` | Host name | DNS resolution through the network service |
| `socket.private_ip` | IP address | Reaching a loopback, private, link-local or unspecified address |

Deny `network.select` on a scope to stop code inside it from choosing an overlay explicitly. Inherited overlays are unaffected — they were authorized at the caller. `network.bind` is checked when a server with a `network:` overlay starts its listener.

The `socket.*` permissions are checked by the network service itself. `socket.connect`, `socket.listen` and `socket.resolve` are checked before any overlay routing, so they apply equally to clearnet and overlay traffic; `socket.private_ip` narrows to literal addresses once an overlay is selected, as described under [Raw Dials](system/network.md#raw-dials).

## See Also

- [Security](system/security.md) - Policies and actors
- [HTTP Service](http/server.md) - Server binding
- [HTTP Client](lua/http/client.md) - Per-call overlay selection
- [Host Functions](wasm/hosts.md) - WASM socket imports
