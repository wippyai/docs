# 配置参考

Wippy 通过 `.wippy.yaml` 文件进行配置。所有选项都有合理的默认值。

下面的任何值都可以在启动时通过 `wippy run --set section.path=value` 覆盖（可重复使用，优先级高于文件）。如需覆盖单个注册表*入口*而非这些配置区段，请使用 `override:` 区段或 `-o`——参见[覆盖入口](guides/entry-kinds.md#overriding-entries)。

## Logger

控制 zap logger 编码器。CLI 参数（`-v`、`-c`、`-s`）会覆盖级别/输出；唯一由 yaml 驱动的选项是编码。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `encoding` | string | console | 编码器：`console`（人类可读）或 `json`（结构化） |

```yaml
logger:
  encoding: json
```

## 日志管理器

控制运行时日志路由。控制台输出通过 [CLI 参数](guides/cli.md)（`-v`、`-c`、`-s`）配置。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `propagate_downstream` | bool | true | 发送日志到控制台/文件输出 |
| `stream_to_events` | bool | false | 将日志发布到事件总线供程序访问 |
| `min_level` | int | -1 | 最低级别：-1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

参见：[Logger 模块](lua/system/logger.md)

## 性能分析器

Go pprof HTTP 服务器，用于 CPU/内存分析。通过 `-p` 参数或配置启用。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启动分析器服务 |
| `address` | string | localhost:6060 | 监听地址 |
| `read_timeout` | duration | 15s | HTTP 读取超时 |
| `write_timeout` | duration | 15s | HTTP 写入超时 |
| `idle_timeout` | duration | 60s | 连接保活超时 |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

访问地址：`http://localhost:6060/debug/pprof/`

## 安全

全局安全行为。单独的策略定义为 [security.policy 入口](guides/entry-kinds.md)。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `strict_mode` | bool | false | 安全上下文不完整时拒绝访问 |

```yaml
security:
  strict_mode: true
```

参见：[安全系统](system/security.md)、[Security 模块](lua/security/security.md)

## 注册表

入口存储和版本历史。注册表保存所有配置入口。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enable_history` | bool | true | 跟踪入口版本 |
| `history_type` | string | memory | 存储类型：memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | SQLite 文件路径 |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

参见：[注册表概念](concepts/registry.md)、[Registry 模块](lua/core/registry.md)

## 中继

跨节点的进程间消息路由。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `node_name` | string | local | 中继节点标识符 |

```yaml
relay:
  node_name: worker-1
```

参见：[进程模型](concepts/process-model.md)

## 监督器

服务生命周期管理。控制监督器用于派发生命周期事件的内部控制邮箱。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `host.buffer_size` | int | 1024 | 内部控制邮箱容量 |
| `host.worker_count` | int | 16 | 并发派发工作线程数 |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

参见：[监督指南](guides/supervision.md)

<note>
每个 `process.host` 的工作线程和队列在入口本身（`workers`、`queue_size`、`local_queue_size`）配置，而不是在此全局节中。参见 [Process Host](system/process-host.md) 入口类型。
</note>

## Lua 运行时

Lua 虚拟机缓存和表达式求值。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `proto_cache_size` | int | 60000 | 编译原型缓存 |
| `main_cache_size` | int | 10000 | 主块缓存 |
| `cache.enabled` | bool | false | 将编译后的字节码/类型检查缓存持久化到磁盘 |
| `cache.dir` | string | （系统缓存目录） | 缓存目录路径 |
| `cache.mode` | string | `read_write` | 缓存模式：`read_write`、`read_only`、`write_only` |
| `type_system.enabled` | bool | false | 启用静态类型检查 |
| `type_system.strict` | bool | false | 将类型警告视为错误 |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

参见：[Lua 概览](lua/overview.md)

## 查找器

注册表搜索缓存。内部用于入口查找。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query_cache_size` | int | 1000 | 缓存的查询结果数 |
| `regex_cache_size` | int | 100 | 编译的正则表达式数 |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

通过 OTLP 导出分布式追踪和指标。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启用 OTEL |
| `endpoint` | string | localhost:4318 | OTLP 端点 |
| `protocol` | string | http/protobuf | 协议：grpc, http/protobuf |
| `service_name` | string | wippy-runtime | 服务标识符 |
| `service_version` | string | | 服务版本标签 |
| `insecure` | bool | true | 允许明文 OTLP 连接 |
| `sample_rate` | float | 1.0 | 追踪采样率（0.0-1.0） |
| `propagators` | string[] | `[tracecontext, baggage]` | 上下文传播器 |
| `traces_enabled` | bool | true | 导出追踪 |
| `metrics_enabled` | bool | false | 导出指标 |
| `http.enabled` | bool | true | 追踪 HTTP 请求 |
| `http.extract_headers` | bool | true | 从入站请求头中提取追踪上下文 |
| `http.inject_headers` | bool | true | 向出站请求头注入追踪上下文 |
| `process.enabled` | bool | true | 追踪进程生命周期 |
| `process.trace_lifecycle` | bool | true | 为 spawn/terminate 发出 span |
| `interceptor.enabled` | bool | true | 追踪函数调用 |
| `interceptor.order` | int | 100 | 拦截器优先级 |
| `queue.enabled` | bool | true | 追踪队列发布/消费 |
| `temporal.enabled` | bool | false | 追踪 Temporal 工作流 |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

标准 OTEL 环境变量（`OTEL_EXPORTER_OTLP_ENDPOINT`、`OTEL_SERVICE_NAME`、`OTEL_TRACES_SAMPLER_ARG`、`OTEL_PROPAGATORS`、`OTEL_SDK_DISABLED`）会覆盖对应字段。

参见：[可观测性指南](guides/observability.md)

## 关闭

优雅关闭行为。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeout` | duration | 30s | 等待组件停止的最长时间 |

```yaml
shutdown:
  timeout: 60s
```

## 指标

内部指标收集缓冲区。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `buffer.size` | int | 10000 | 指标缓冲区容量 |
| `interceptor.enabled` | bool | false | 自动跟踪函数调用 |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

参见：[Metrics 模块](lua/system/metrics.md)、[可观测性指南](guides/observability.md)

## Prometheus

Prometheus 指标端点。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启动指标服务 |
| `address` | string | localhost:9090 | 监听地址 |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

暴露 `/metrics` 端点供 Prometheus 抓取。

参见：[可观测性指南](guides/observability.md)

## 集群

多节点集群：gossip 成员发现加上有界 Raft 共识核心。架构和运维模型参见[集群指南](guides/cluster.md)；本节为配置键参考。

### 顶层配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启用集群 |
| `name` | string | hostname | 节点名称；在集群中必须唯一 |
| `failure_domain` | string | | 可用区/机架标签；在 gossip 中广播，使选民分布在不同域 |

### 成员（gossip）

通过 memberlist 实现 SWIM gossip。用于节点发现、故障检测和元数据传播。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `membership.bind_addr` | string | 0.0.0.0 | Gossip 绑定地址 |
| `membership.bind_port` | int | 7946 | Gossip 绑定端口（TCP+UDP） |
| `membership.advertise_addr` | string | | 对等节点访问此节点所用的地址（NAT/k8s） |
| `membership.join_addrs` | string | | 逗号分隔的种子节点 `host:port` 列表 |
| `membership.secret_key` | string | | Base64 编码的 gossip 加密密钥（内联） |
| `membership.secret_file` | string | | 存放 gossip 加密密钥的文件路径 |

### 节点间（传输）

承载节点间中继和 Raft 流量的 TCP 网格。Raft 通过此网格传输（yamux 多路复用）；没有独立的 Raft 端口。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `internode.bind_addr` | string | 0.0.0.0 | 网格绑定地址 |
| `internode.bind_port` | int | 0 | 网格端口（0 = 自动：7950-7959，之后为临时端口） |
| `internode.auto_port` | bool | true | 启动时发现实际端口，固定并在 gossip 中广播 |

### Raft（共识）

有界的 Raft。Raft 状态默认在文件系统持久化，存储于 `raft.data_dir`（默认 `~/.wippy/store`）下；重启后的节点仍会从对等节点重新加入 quorum。[`store.kv.raft`](system/store.md#cluster-kv-stores) entry 通过它进行复制。引导通过 gossip 驱动（Consul/Nomad `bootstrap_expect` 风格）。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `raft.data_dir` | string | `~/.wippy/store` | 文件系统持久化 Raft 状态和持久化 CRDT 快照的目录（位于 `<data_dir>/_sys/` 下）。仅当无路径可解析时（无 home 目录且未设置）才无磁盘运行 |
| `raft.enabled` | bool | true | 运行 Raft 节点；`false` 使此节点成为仅 gossip 客户端 |
| `raft.role` | string | server | `server` 运行 Raft 节点；`client` 仅参与 gossip |
| `raft.eligible` | bool | true | 此节点是否可被选为选民 |
| `raft.priority` | int | 100 | 选民选取优先级（值越低越优先） |
| `raft.bootstrap_expect` | int | 1 | 初始 quorum 大小：`0`=加入已有集群，`1`=单节点，`N`=等待 N 个合格对等节点后组成 quorum |
| `raft.max_voters` | int | 5 | 选民上限（必须为奇数）；超出的合格节点成为备用节点 |
| `raft.max_standbys` | int | 4 | 保持热备以备晋升的非投票成员；超过 voters+standbys 的节点不作为 Raft 成员 |
| `raft.reconcile_debounce` | duration | 2s | gossip 事件后运行选民协调器前的合并窗口 |
| `raft.reconcile_timeout` | duration | 2s | 每次协调过程的超时时间 |
| `raft.heartbeat_timeout` | duration | 3s | 追随者空闲等待发起选举前的超时 |
| `raft.election_timeout` | duration | 3s | 候选人选举超时（不小于心跳超时） |
| `raft.commit_timeout` | duration | 500ms | 空闲 leader 心跳节拍 |
| `raft.snapshot_threshold` | uint64 | 8192 | 触发新快照前自上次快照以来的日志条目数 |
| `raft.snapshot_interval` | duration | 2m | 快照检查间隔 |
| `raft.snapshot_retain` | int | 3 | 保留的快照数量 |
| `raft.trailing_logs` | uint64 | 10240 | 快照后保留的日志条目数 |
| `raft.max_append_entries` | int | 16 | 每次 AppendEntries RPC 的最大条目数 |
| `raft.leader_probe_interval` | duration | 3s | 全局注册表 leader 可达性探测间隔 |
| `raft.leader_probe_grace` | int | 3 | 声明 leader 不可达前允许的连续探测失败次数 |

单节点（开发环境）——集群开启，立即自举：

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

三节点投票集群——每个节点列出其他节点作为种子，等待三个节点全部就绪后组成 quorum：

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

仅 gossip 客户端——加入集群用于命名/消息传递，但从不运行 Raft：

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## LSP

用于编辑器集成的语言服务器协议（Language Server Protocol）服务器。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启用 TCP 服务器 |
| `address` | string | :7777 | TCP 监听地址 |
| `http_enabled` | bool | false | 启用 HTTP 传输 |
| `http_address` | string | :7778 | HTTP 监听地址 |
| `http_path` | string | /lsp | HTTP 端点路径 |
| `http_allow_origin` | string | * | CORS 允许的源 |
| `max_message_bytes` | int | 8388608 | 入站消息最大大小 |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

参见：[LSP 指南](guides/lsp.md)

## 网络服务

覆盖网络管理器（SOCKS5、I2P、Tailscale 驱动）。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `state_dir` | string | .wippy/net | 驱动状态存储目录 |
| `default_network` | string | | 当入口省略 `network` 时应用的默认网络 ID |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

参见：[网络覆盖](system/network.md)

## HTTP 调度器

HTTP 调度函数和出站请求所用的共享 HTTP 客户端池的调优参数。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dispatcher.http.timeout` | duration | 0（无） | 单请求超时 |
| `dispatcher.http.max_idle_conns` | int | 0（标准库） | 所有主机的最大空闲连接数 |
| `dispatcher.http.max_idle_per_host` | int | 0（标准库） | 每个主机的最大空闲连接数 |
| `dispatcher.http.idle_conn_timeout` | duration | 0（标准库） | 空闲连接超时 |
| `dispatcher.http.max_clients` | int | 0（无限制） | 最大池化客户端数 |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

## 模块

`wippy install`/`update` 使用的模块注册表客户端。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `registry_url` | string | https://hub.wippy.ai | 注册表端点 |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## 扩展

启动时加载的原生 Go 插件扩展（仅 Unix）。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | true | 加载扩展 |
| `paths` | string[] | | 插件文件路径（相对于配置目录） |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `GOMEMLIMIT` | 内存限制（覆盖 `--memory-limit` 参数） |

## 另请参阅

- [CLI 参考](guides/cli.md) - 命令行选项
- [集群指南](guides/cluster.md) - 集群架构与运维
- [入口类型](guides/entry-kinds.md) - 所有入口类型
- [可观测性指南](guides/observability.md) - 日志、指标、追踪
