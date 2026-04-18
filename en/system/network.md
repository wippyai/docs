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
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| Field | Type | Description |
|-------|------|-------------|
| `hostname` | string | tsnet node name (used in per-node state directory) |
| `auth_key` | string | Inline tailnet auth key |
| `auth_key_env` | string | Env var name holding the auth key (resolved via env registry) |
| `state_dir` | string | Override for tsnet state directory |
| `control_url` | string | Alternate coordination server |
| `ephemeral` | bool | Register as an ephemeral tailnet node |

Either `auth_key` or `auth_key_env` is required.

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

The `httpclient` module accepts the same key on per-call options.

## Inheritance

Overlay selection flows through the call stack. A function called via `funcs.new():with_options({network=...})` sees the overlay on every inner dial, every nested `funcs.call`, and every `process.spawn` it performs — until a descendant explicitly selects a different overlay or clears it.

Ambient inheritance bypasses the descendant's own `network.select` deny rules. Only explicit selection at a Lua edge is gated.

## Permissions

| Action | Resource | Description |
|--------|----------|-------------|
| `network.select` | Network registry ID | Explicit overlay selection at `funcs.call`, `process.spawn`, `http_client` |

Deny `network.select` on a scope to stop code inside it from choosing an overlay explicitly. Inherited overlays are unaffected — they were authorized at the caller.

## See Also

- [Security](system/security.md) - Policies and actors
- [HTTP Service](http/server.md) - Server binding
- [HTTP Client](lua/http/client.md) - Per-call overlay selection
