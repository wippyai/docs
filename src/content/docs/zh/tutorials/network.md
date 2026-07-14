---
title: "网络覆盖层"
---

# 网络覆盖层

通过 SOCKS5、Tailscale 或 I2P 覆盖层路由出站 HTTP 调用和生成的进程。

## 概述

Wippy 支持覆盖网络，可透明地承载来自函数、进程和 HTTP 客户端的流量。每个覆盖层是一个注册表条目；代码在每次调用时选择加入，并且该选择会继承到内层调用，直到某个后代显式覆盖为止。

支持的覆盖层：

- `network.socks5` — 通用 SOCKS5 代理（也兼容 Tor 的 SOCKS5 监听器）
- `network.tailscale` — tsnet 覆盖节点
- `network.i2p` — I2P SAM v3 桥接

## 项目结构

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## 步骤 1：定义覆盖层

创建 `src/_index.yaml`：

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

  # SOCKS5 代理条目（Tor 默认在 127.0.0.1:9050 上暴露一个）
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

`isolate_streams: true` 使 SOCKS5 驱动在每次连接时生成随机凭据，从而让 Tor 为每次拨号开启新的回路。

## 步骤 2：路由出站调用

创建 `src/probe.lua`：

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

`http_client` 上的 `overlay_network` 选项仅为该次调用选择覆盖层。不设置时，拨号使用进程默认值（`.wippy.yaml` 中 `network_service.default_network` 所指定的值，或直连）。

## 步骤 3：运行

```bash
wippy init
wippy run probe
```

在本地运行 Tor 时：

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

如果 Tor 未运行，`tor IP` 行将报告拨号错误 — SOCKS5 覆盖层不会静默回退到直连。

## 继承

覆盖层选择会在嵌套调用中传递。在 `funcs.call` 或 `process.spawn` 边界处选择一次覆盖层，其下的所有内层 HTTP 调用、嵌套 `funcs.call` 和 `process.spawn` 均会使用该覆盖层，直到显式覆盖为止：

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

嵌套函数或生成的进程无需显式传递，即可在每次出站拨号时使用该覆盖层。

## 绑定监听器

支持入站流量的覆盖层（Tailscale、I2P）也可以接受 HTTP 监听器。将覆盖层附加到 `http.service` 而非客户端：

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

服务器绑定在 tailnet 接口上；客户端通过 Tailscale 地址访问。SOCKS5 仅支持出站 — 将其分配给 `http.service` 会被拒绝。

## 应用级默认值

在 `.wippy.yaml` 中设置默认覆盖层，使所有调用都使用它，除非被覆盖：

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

使用 `network = nil` 显式选择可清除该次调用的默认值。

## 权限

`network.select` 动作控制显式覆盖层选择。在某个作用域中拒绝该权限可阻止代码选择覆盖层：

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

继承的覆盖层绕过此检查 — 它们已在调用方边界处获得授权。只有在 Lua 边界处的显式重新选择才会受到控制。

## 下一步

- [Network System](system/network.md) - 条目类型参考
- [HTTP Client](lua/http/client.md) - 每次调用的覆盖层选项
- [Security Model](system/security.md) - 策略和作用域
- [Authentication](tutorials/auth.md) - 基于 Token 的安全
