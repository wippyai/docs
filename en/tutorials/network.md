---
title: "Network Overlays"
description: "Route outbound HTTP calls and spawned processes through SOCKS5, with a partial Tailscale integration recipe."
---

# Network Overlays

Configure a SOCKS5 overlay for outbound HTTP calls, then review inheritance, inbound listeners, application defaults, and permissions.

**Classification:** Runnable SOCKS5 tutorial with a partial Tailscale recipe.
The direct/Tor probe is complete once an external Tor listener is available. The
Tailscale section explains Wippy wiring but intentionally defers account provisioning
to Tailscale. For I2P configuration, use the network-system reference linked below.

## Overview

Wippy represents overlay networks as registry entries. Code can select an overlay for a call, and that selection propagates to nested calls until a descendant overrides it.

Wippy supports three overlay entry kinds:

- `network.socks5` — generic SOCKS5 proxy (also Tor's SOCKS5 listener)
- `network.tailscale` — tsnet overlay node
- `network.i2p` — I2P SAM v3 bridge

## Prerequisites

- Wippy runtime `v0.3.32a`.
- `curl` and outbound HTTPS access to `api.ipify.org`.
- A Tor daemon exposing SOCKS5 on `127.0.0.1:9050`. Install a supported package from
  the [Tor Project download page](https://www.torproject.org/download/tor/), start it,
  and verify the listener before
  running Wippy:

  ```bash
  curl --socks5-hostname 127.0.0.1:9050 https://api.ipify.org?format=json
  ```

  A successful check returns JSON containing an IP address. Tor Browser commonly
  uses port 9150 instead; if that is the listener you are intentionally using,
  change the registry entry and the verification command together.
- An empty working directory:

  ```bash
  mkdir netdemo
  cd netdemo
  mkdir src
  ```

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
  - name: probe_policy
    kind: security.policy
    policy:
      actions:
        - http_client.request
        - network.select
      resources: "*"
      effect: allow

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
        security:
          actor:
            id: app:probe
          policies:
            - app:probe_policy
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

With `isolate_streams: true`, the SOCKS5 driver creates random credentials for each connection so Tor can open a fresh circuit for each dial.

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

The `overlay_network` option selects the overlay for that HTTP call. Without it, the dial uses the process default: `network_service.default_network` from `.wippy.yaml`, or a direct connection when no default is set.

## Step 3: Run It

```bash
wippy init
wippy run probe
```

With Tor running locally:

```
direct IP: <your public IP>
tor IP:    <Tor exit IP>
```

Both lines must contain valid IP addresses. They should normally differ; the important
proof is that the routed request succeeds only through the configured SOCKS listener.

If Tor is not running, the `tor IP` line will report a dial error — the SOCKS5 overlay does not silently fall back to a direct connection.

## Inheritance

Overlay selection propagates through nested calls. Selecting an overlay at a `funcs.call` or `process.spawn` boundary applies it to nested HTTP calls, function calls, and process spawns until one explicitly overrides it:

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

Tailscale can also accept HTTP listeners. Attach the overlay to the `http.service`
instead of the client:

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

## Troubleshooting and Cleanup

- `connection refused` on `127.0.0.1:9050` means Tor is not listening on the
  configured port. Verify Tor with the prerequisite `curl` command before debugging
  Wippy.
- A direct request failure and a routed success usually indicate local DNS, proxy, or
  firewall rules affecting the direct path. The two calls are independent.
- `access denied` for the routed call means the command security context lacks
  `network.select` for `app:tor`; keep `app:probe_policy` attached under
  `meta.command.security`.
- The SOCKS5 driver never falls back to a direct connection. Do not remove the error
  merely to make the demo continue.
- Stop the Wippy command when it exits and stop the Tor daemon only if you started it
  solely for this tutorial. The SOCKS5 example creates no persistent network state.
  A Tailscale entry can persist node state under `.wippy/net/tailscale/`; remove the
  `.wippy/net` state directory only after stopping Wippy and only when you intend to
  discard that local tailnet identity.

## Next Steps

- [Network System](../system/network.md) — Entry-kind reference
- [HTTP Client](../lua/http/client.md) — Per-call overlay options
- [Security Model](../system/security.md) — Policies and scopes
- [Authentication](auth.md) — Token-based security
