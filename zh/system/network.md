---
title: "网络覆盖层"
description: "通过覆盖网络（SOCKS5 代理、Tor、Tailscale mesh、I2P）路由出站流量并绑定监听器。覆盖层的选择按调用选择性启用，并在函数、进程和 HTTP 边界之间继承。"
---

# 网络覆盖层

通过覆盖网络（SOCKS5 代理、Tor、Tailscale mesh、I2P）路由出站流量并绑定监听器。覆盖层的选择按调用选择性启用，并在函数、进程和 HTTP 边界之间继承。

## 条目种类

| Kind | 描述 |
|------|-------------|
| `network.socks5` | 通用 SOCKS5 代理（也涵盖 Tor 的 SOCKS5 监听器） |
| `network.tailscale` | Tailscale tsnet 覆盖节点 |
| `network.i2p` | I2P SAM v3 网桥 |

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

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `host` | string | 代理主机 |
| `port` | int | 代理端口 (1-65535) |
| `username` | string | 可选的 SOCKS5 认证 |
| `password` | string | 可选的 SOCKS5 认证 |
| `isolate_streams` | bool | 每连接随机凭证（Tor 流隔离） |

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `hostname` | string | tsnet 节点名称（用于每节点状态目录） |
| `auth_key` | string | tailnet 认证密钥 —— 内联或通过 [env 注册表](system/env.md)解析的 `${env:NAME}` |
| `state_dir` | string | 覆盖 tsnet 状态目录 |
| `control_url` | string | 备用协调服务器 |
| `ephemeral` | bool | 注册为临时 tailnet 节点 |

`auth_key` 是必填的（直接提供或通过 `${env:NAME}` 提供）。旧的 `auth_key_env` 指令解析方式相同，但已废弃；请优先使用 `auth_key: ${env:NAME}`。

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `host` | string | SAM v3 网桥主机 |
| `port` | int | SAM v3 网桥端口 |
| `session_name` | string | 可选的会话标识符 |

## 选择覆盖层

### 在 http.service 上

通过覆盖层（Tailscale、I2P）绑定服务器监听器：

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 不支持入站监听 — 仅用于出站拨号。

### 从 Lua

使用 `with_options` 通过覆盖层路由调用的函数或生成的进程：

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

`http_client` 模块在按调用选项中接受相同的覆盖层选择，键名为 `overlay_network`。

## 继承

覆盖层选择沿调用栈传递。通过 `funcs.new():with_options({network=...})` 调用的函数会在每次内部拨号、每次嵌套的 `funcs.call` 以及它执行的每个 `process.spawn` 上看到该覆盖层 — 直到后代显式选择另一个覆盖层或清除它。

环境继承会绕过后代自己的 `network.select` 拒绝规则。只有 Lua 边界处的显式选择会受到限制。

## 应用配置

覆盖层驱动从 `.wippy.yaml` 中的 `network_service:` 块读取应用范围的设置：

```yaml
network_service:
  state_dir: .wippy/net          # 驱动状态的基础目录（Tailscale 密钥等）
  default_network: app.net:tailnet  # 当没有调用设置时应用的覆盖层
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `state_dir` | `.wippy/net` | 驱动状态目录。相对路径相对于启动配置目录解析。 |
| `default_network` | — | 应用于任何未通过选项固定自身网络的任务或进程的覆盖层 Registry ID。 |

## 原始拨号

覆盖层选择并不限于 Lua 边界。通过运行时网络服务发起的拨号——WASM [`socket` 宿主](wasm/hosts.md#socket)和 `wasi:sockets` 分发器——会从帧上读取覆盖层并经由它路由，无论该覆盖层是由 `with_options`、条目上的 `meta.options.network`，还是 `network_service.default_network` 设置的。

私有 IP 门控在这条路径上的行为有所不同。直接拨号会解析目标，并针对 `socket.private_ip` 检查所有得到的地址。选择了覆盖层后，只检查目标中的字面 IP 地址；主机名会交给覆盖层解析，因此本地解析器不会被使用，也不会对它本应返回的结果做任何检查。

当选择了覆盖层但上下文中没有携带网络注册表时，拨号会以 `network "<id>" selected without a network registry` 失败。

## 更新覆盖层

覆盖层入口在注册表更新时热替换。当某个覆盖层的配置发生变化时，驱动会先构建替换服务，仅在其成功创建后才将其换入；如果新配置失败，现有覆盖层会继续运行。并发调用方看到的要么是旧服务，要么是新服务，绝不会出现空档。

## 权限

| 动作 | 资源 | 描述 |
|--------|----------|-------------|
| `network.select` | 网络 Registry ID | 在 `funcs.call`、`process.spawn`、`http_client` 处显式选择覆盖层 |
| `network.bind` | 网络 Registry ID | 通过覆盖层绑定 `http.service` 监听器（`network:` 字段） |
| `socket.connect` | `host:port` | 通过网络服务发起的任何出站拨号 |
| `socket.listen` | `host:port` | 通过网络服务绑定 TCP 监听器或 UDP socket |
| `socket.resolve` | 主机名 | 通过网络服务进行的 DNS 解析 |
| `socket.private_ip` | IP 地址 | 访问回环、私有、链路本地或未指定地址 |

在作用域上拒绝 `network.select` 以阻止其中的代码显式选择覆盖层。继承的覆盖层不受影响 — 它们已在调用方获得授权。`network.bind` 在带有 `network:` 覆盖层的服务器启动其监听器时进行检查。

`socket.*` 权限由网络服务自身检查。`socket.connect`、`socket.listen` 和 `socket.resolve` 在任何覆盖层路由之前检查，因此对明网流量和覆盖层流量同样适用；一旦选择了覆盖层，`socket.private_ip` 就收窄为只针对字面地址，如[原始拨号](system/network.md#raw-dials)中所述。

## 另见

- [安全](system/security.md) - 策略与参与者
- [HTTP 服务](http/server.md) - 服务器绑定
- [HTTP 客户端](lua/http/client.md) - 按调用的覆盖层选择
- [宿主函数](wasm/hosts.md) - WASM socket 导入
