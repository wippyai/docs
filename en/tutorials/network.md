# Network Overlays

Route outbound HTTP calls and spawned processes through SOCKS5, Tailscale, or I2P overlays.

## Overview

Wippy supports overlay networks that transparently carry traffic originating from functions, processes, and HTTP clients. Each overlay is a registry entry; code opts in per call, and the selection inherits to inner calls until a descendant explicitly overrides it.

Supported overlays:

- `network.socks5` — generic SOCKS5 proxy (also Tor's SOCKS5 listener)
- `network.tailscale` — tsnet overlay node
- `network.i2p` — I2P SAM v3 bridge

## Project Structure

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## Step 1: Define an Overlay

Create `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 proxy entry (Tor exposes one at 127.0.0.1:9050 by default)
  - name: tor
    kind: network.socks5
    host: 127.0.0.1
    port: 9050
    isolate_streams: true

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true` makes the SOCKS5 driver mint random credentials per connection so Tor opens a fresh circuit for each dial.

## Step 2: Route Outbound Calls

Create `src/probe.lua`:

```lua
local io = require("io")
local http_client = require("http_client")
local json = require("json")

local function fetch_ip(overlay)
    local options = { timeout = "15s" }
    if overlay then
        options.overlay_network = overlay
    end

    local resp, err = http_client.get("https://api.ipify.org?format=json", options)
    if err then
        return nil, tostring(err)
    end
    if resp.status_code ~= 200 then
        return nil, "HTTP " .. resp.status_code
    end

    local body = json.decode(resp.body or "")
    return body and body.ip, nil
end

local function main()
    local direct, d_err = fetch_ip(nil)
    if d_err then
        io.print("direct failed: " .. d_err)
    else
        io.print("direct IP: " .. direct)
    end

    local routed, r_err = fetch_ip("app:tor")
    if r_err then
        io.print("tor failed: " .. r_err)
    else
        io.print("tor IP:    " .. routed)
    end

    return 0
end

return { main = main }
```

The `overlay_network` option on `http_client` picks the overlay for that call only. Without it the dial goes through the process default (either `network_service.default_network` in `.wippy.yaml` or direct).

## Step 3: Run It

```bash
wippy init
wippy run probe
```

With Tor running locally:

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

If Tor is not running, the `tor IP` line will report a dial error — the SOCKS5 overlay does not silently fall back to a direct connection.

## Inheritance

Overlay selection flows through nested calls. Pick the overlay once at a `funcs.call` or `process.spawn` edge and every inner HTTP call, nested `funcs.call`, and `process.spawn` underneath uses it until an explicit override:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:tor" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:tor" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

The nested function or spawned process sees the overlay on every outgoing dial without passing it explicitly.

## Binding a Listener

Overlays that support inbound traffic (Tailscale, I2P) can also accept HTTP listeners. Attach the overlay to the `http.service` instead of the client:

```yaml
  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key_env: TS_AUTHKEY
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
```

The server binds on the tailnet interface; clients reach it via the Tailscale address. SOCKS5 is outbound-only — assigning it to `http.service` is rejected.

## App-wide Default

Set a default overlay in `.wippy.yaml` so every call uses it unless overridden:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

Explicit selection with `network = nil` clears the default for that call.

## Permissions

The `network.select` action gates explicit overlay selection. Deny it on a scope to stop code from choosing an overlay:

```yaml
  - name: deny_network
    kind: security.policy
    policy:
      actions: "network.select"
      resources: "*"
      effect: deny
    groups:
      - untrusted
```

Inherited overlays bypass this check — they were authorized at the caller's edge. Only explicit re-selection at a Lua boundary is gated.

## Next Steps

- [Network System](system/network.md) - Entry kind reference
- [HTTP Client](lua/http/client.md) - Per-call overlay options
- [Security Model](system/security.md) - Policies and scopes
- [Authentication](tutorials/auth.md) - Token-based security
