---
title: "配置参考"
description: "Wippy 通过 .wippy.yaml 文件进行配置。所有选项都有合理的默认值。"
---

# 配置参考

Wippy 通过 `.wippy.yaml` 文件进行配置。所有选项都有合理的默认值。

下面的任何值都可以在启动时通过 `wippy run --set section.path=value` 覆盖（可重复使用，优先级高于文件）。如需覆盖单个注册表*入口*而非这些配置区段，请使用 `override:` 区段或 `-o`——参见[覆盖入口](guides/entry-kinds.md#overriding-entries)。

## 配置组合

`--config` 可重复使用；文件按相同的 schema 从左到右组合：

```bash
wippy run --config .wippy.yaml --config .wippy.local.yaml
```

- 后面的文件覆盖匹配的值并保留其余内容。
- 每个显式指定的文件都必须存在。不带 `--config` 时，默认的 `.wippy.yaml` 是可选的。
- 第一个文件锚定用于解析相对路径的目录。
- 文件名不带任何保留含义；除默认文件外不会自动发现任何文件。

配置按顺序应用：文件组合，然后是 `--profile` 选择，最后是 `--set` 覆盖。对于从包运行的应用，打包的运行时默认值位于所有这些之下（参见[发布运行时默认值](guides/publishing.md#publishing-runtime-defaults)）。

## Profiles

配置文件可以在 `profiles:` 下声明具名的覆盖层。每个 profile 主体与普通配置区段的结构相同；通过 `--profile <name>` 选择后，这些值会叠加到合并后的基础配置之上：

```yaml
version: "1.0"

vars:
  port: 8085

override:
  app:db:kind: db.sql.sqlite

disable:
  namespaces: ["legacy.**"]

profiles:
  pg:
    vars:
      port: 18085
    override:
      app:db:kind: db.sql.postgres
    disable:
      namespaces.add: ["experimental.**"]
```

```bash
wippy run --profile pg
```

- `--profile` 可重复使用；profile 从左到右组合，在文件组合之后、`--set` 之前应用。未知名称会报错。
- 值按叶子合并（后写者胜出）。`profiles:` 区段本身会从解析后的配置中剥离。
- `disable` 区段在 profile 内支持列表操作 — `namespaces.add`、`namespaces.remove`、`entries.add`、`entries.remove` — 因此 profile 可以调整基础列表而不是整体替换。
- `${name}` 引用从合并后的 `vars:` 区段插值。profile 的 vars 中不允许引用 OS 环境变量；请在基础配置中使用 `${env:NAME}`，在文件加载时解析。

`wippy run`、`test` 和 `pack` 接受 `--profile`；`run list`、`install`、`update`、`lint` 和 `registry` 同样接受它用于工作区 profile（连同 `--set`）。应用可以在包内附带 profile — 参见[发布 Profile](guides/publishing.md#publishing-profiles)。

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
| `min_level` | int | 0（带 `-v` 时为 `-1`） | 最低级别：-1=debug, 0=info, 1=warn, 2=error。CLI 在读取文件之后用自己的命令行标志写入该键，因此文件中的值会被忽略；请用 `--set logmanager.min_level=<n>` 修改 |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
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
| `strict_mode` | bool | true | 安全上下文不完整时拒绝访问 |

```yaml
security:
  strict_mode: false
```

参见：[安全系统](system/security.md)、[Security 模块](lua/security/security.md)

## 注册表

入口存储和版本历史。注册表保存所有配置入口。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enable_history` | bool | true | 跟踪入口版本 |
| `history_type` | string | memory | 存储类型：`memory`、`sqlite`、`postgres`、`nil` |
| `history_path` | string | .wippy/registry.db | SQLite 文件路径（`history_type: sqlite` 时使用） |
| `history_dsn` | string | | Postgres DSN（`history_type: postgres` 时使用） |
| `history_schema` | string | | Postgres schema 名称（`history_type: postgres` 时使用） |
| `event_wait_timeout` | duration | 30s | 注册表应用期间，每次操作等待监听器确认的时长 |
| `dispatch_internal_kinds` | string[] | `[registry.entry, ns.dependency, ns.requirement, ns.definition]` | 由内部处理而不派发给组件监听器的记录类型 |
| `dependency_resolve_timeout` | duration | 0（无） | 依赖解析的时间上限 |
| `dependency_download_timeout` | duration | 0（无） | 每次模块下载及下载 URL 请求的时间上限 |
| `dependency_lock_path` | string | 自动发现的 `wippy.lock` | 依赖处理器读写的锁文件 |
| `dependency_vendor_dir` | string | `<lock dir>/<directories.modules>/vendor` | 存放已下载模块包的目录 |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

```yaml
registry:
  history_type: postgres
  history_dsn: ${env:WIPPY_REGISTRY_HISTORY_DSN}
  history_schema: wippy_registry
```

参见：[注册表概念](concepts/registry.md)、[Registry 模块](lua/core/registry.md)

## 制品

已物化的[构建期制品](guides/artifacts.md)的输出根目录。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `materialization_root` | string | 依赖 vendor 目录的上级目录 | 由应用拥有的根目录，每种制品格式在其下写入各自的子目录树 |

```yaml
artifact:
  materialization_root: build/wippy
```

参见：[构建期制品](guides/artifacts.md#where-output-lands)

## 工作区

本地模块替换，以 `org/module` 为键。取值为目录；相对路径相对于第一个 `--config` 文件所在目录解析，而 `null` 会禁用从更早的配置层或配置档继承来的替换。

```yaml
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: null
```

替换项从不写入 `wippy.lock`。参见[使用替换进行本地开发](guides/dependency-management.md#local-development-with-replacements)。

## 中继

跨节点的进程间消息路由。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `node_name` | string | 按实例派生的 ID | 此中继节点的标识符（默认：machine-id/hostname + 工作目录的 UUIDv5；可通过 `WIPPY_NODE_ID` / `WIPPY_RELAY_NODE_NAME` 覆盖） |

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
| `cache.enabled` | bool | `type_system.enabled` | 将编译后的字节码/类型检查缓存持久化到磁盘；除非显式设置，否则跟随 `type_system.enabled` |
| `cache.dir` | string | `.wippy/cache/lua` | 缓存目录路径（相对于配置/工作目录） |
| `cache.mode` | string | `readwrite` | 缓存模式：`readwrite`（默认）、`readonly`、`off`；未知值回退为 `readwrite` |
| `cache.compile.enabled` | bool | true | 持久化编译后的字节码（当 `cache.enabled` 时） |
| `cache.typecheck.enabled` | bool | true | 持久化类型检查结果（当 `cache.enabled` 时） |
| `cache.max_bytes` | int | 1073741824 | 磁盘缓存大小上限（字节） |
| `cache.max_entries` | int | 20000 | 最大缓存条目数 |
| `cache.prune_interval` | int | 256 | 两次缓存修剪之间的写入次数 |
| `type_system.enabled` | bool | false | 启用静态类型检查 |
| `type_system.strict` | bool | false | 将类型警告视为错误 |
| `invalidation_wait_timeout` | duration | `registry.event_wait_timeout`（30s） | 记录变更后等待代码失效被确认的时长 |
| `eval.max_steps` | int | 10000 | 一次 `eval` 运行的默认调度器步数预算；负值会被拒绝 |
| `eval.cache_size` | int | 256 | 被求值源码的已编译程序缓存条目数 |
| `eval.cache_ttl` | duration | 0（不过期） | 已缓存的已编译程序的存活时长 |

```yaml
lua:
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

参见：[Lua 概览](lua/overview.md)

## 调度器

WASM 运行时的核心分区。启用后，会为 WASM 执行预留 `reserved_cores` 个 CPU，其余的服务于 actor 调度器；无效的划分（例如预留核心数超过可用核心数）会被记录日志并忽略。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wasm_isolation.enabled` | bool | false | 在 WASM 与 actor 工作之间划分核心 |
| `wasm_isolation.reserved_cores` | int | 1 | 为 WASM 执行预留的核心数 |

```yaml
scheduler:
  wasm_isolation:
    enabled: true
    reserved_cores: 2
```

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

标准 OTEL 环境变量（`OTEL_SDK_DISABLED`、`OTEL_EXPORTER_OTLP_ENDPOINT`、`OTEL_EXPORTER_OTLP_PROTOCOL`、`OTEL_EXPORTER_OTLP_INSECURE`、`OTEL_SERVICE_NAME`、`OTEL_SERVICE_VERSION`、`OTEL_TRACES_SAMPLER`、`OTEL_TRACES_SAMPLER_ARG`、`OTEL_PROPAGATORS`）会覆盖对应字段。

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
| `interceptor.enabled` | bool | true | 自动跟踪函数调用 |

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
| `address` | string | | 监听地址；`enabled: true` 时必须显式设置，否则指标服务器不会启动 |
| `max_cardinality` | int | 1024 | 每个指标保留的不同标签集数量（LRU）；`0` 或更小则使用默认值 |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

暴露 `/metrics` 端点供 Prometheus 抓取，同时还有 `/livez`。

参见：[可观测性指南](guides/observability.md)

## 集群

多节点集群：gossip 成员发现加上有界 Raft 共识核心。架构和运维模型参见[集群指南](guides/cluster.md)；本节为配置键参考。

### 顶层配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启用集群 |
| `name` | string | hostname | 节点名称；在集群中必须唯一 |
| `failure_domain` | string | | 可用区/机架标签；在 gossip 中广播，使选民分布在不同域 |
| `kv_crdt_tombstone_retention` | duration | 0 | `store.kv.crdt` 删除墓碑被回收的年龄阈值；`0` 表示禁用基于年龄的 GC |
| `kv_crdt_tombstone_gc_alive_peers` | bool | false | 使用当前存活成员集合作为墓碑确认集合 |

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
| `membership.gossip_interval` | duration | 500ms | Gossip 传播周期 |
| `membership.push_pull_interval` | duration | 5s | 全量状态同步周期 |
| `membership.dead_node_reclaim_time` | duration | 30s | 死亡节点的名称/地址可被回收的时间 |
| `membership.probe_interval` | duration | 1s | 故障检测探测周期 |
| `membership.probe_timeout` | duration | 200ms | 每次探测的 ack 等待时间 |
| `membership.tcp_timeout` | duration | 1s | TCP 回退探测超时 |
| `membership.suspicion_mult` | int | 3 | 怀疑超时乘数 |

必须提供 gossip 密钥。设置 `membership.secret_key` 或 `membership.secret_file`（两者都给出时以文件为准）；两者都未设置时，集群组件无法启动。该值经 base64 编码。

四个探测键未设置时继承 memberlist 面向局域网的默认值；高延迟链路应调高它们（例如 `probe_interval: 2s`、`probe_timeout: 500ms`、`suspicion_mult: 5`）。

### 节点间（传输）

承载节点间中继和 Raft 流量的 TCP 网格。Raft 通过节点间的 request/reply 在此网格上传输；没有独立的 Raft 端口。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `internode.bind_addr` | string | 0.0.0.0 | 网格绑定地址 |
| `internode.bind_port` | int | 0 | 网格端口（0 = 自动：7950-7959，之后为临时端口） |
| `internode.auto_port` | bool | true | 启动时发现实际端口，固定并在 gossip 中广播 |
| `internode.advertise_addr` | string | | 为已升级的对等节点发布的额外中继端点（IP 或 DNS 名称）— 用于 NAT 或负载均衡场景的可达性 |
| `internode.advertise_port` | int | 0 | `advertise_addr` 的端口（0 = 绑定端口；需要设置 `advertise_addr`） |
| `internode.identity_key` | string | | 标识本节点的 base64 编码 ed25519 私钥（内联） |
| `internode.identity_key_file` | string | | 存放该密钥的文件路径 |
| `internode.trusted_peer_keys` | map | | 每个节点名对应的 base64 编码 ed25519 公钥，包括本节点 |

`advertise_addr`/`advertise_port` 在节点元数据中发布一个附加端点，同时绑定端点保持原样继续广播，因此混合版本集群在滚动升级期间仍能保持连接。

只要启用了集群，节点间身份就是必需的。`identity_key` 和 `identity_key_file` 互斥且必须提供其中之一；该值（标准或原始 base64）解码后为 32 字节的 ed25519 种子或 64 字节的 ed25519 私钥。`trusted_peer_keys` 把每个节点名映射到该节点的 32 字节 ed25519 公钥，并且必须包含与本地 `cluster.name` 对应的条目，其值与本地身份匹配——否则启动失败。参见[集群指南](guides/cluster.md#internode-identity)。

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
| `raft.registry_backend` | string | kv | 集群名称注册表实现：`kv`（共享 kv 键空间）或 `fsm`（专用 Raft FSM） |
| `raft.global_dissem_tombstone_retention` | duration | 0 | 全局名称传播缓存保留删除墓碑的时长 |

单节点（开发环境）——集群开启，立即自举：

```yaml
cluster:
  enabled: true
  name: dev
  membership:
    secret_key: "d2lwcHktZG9jcy1nb3NzaXAtc2VjcmV0LTMyYnl0ZXM="
  internode:
    identity_key: "d2lwcHktZG9jcy1kZXYtbm9kZS1leGFtcGxlc2VlZCE="
    trusted_peer_keys:
      dev: "rNqImcjOzef28dzvma80mSrCW1px5LBAc5TbaYqAgm0="
  raft:
    bootstrap_expect: 1
```

三节点投票集群——每个节点列出其他节点作为种子，等待三个节点全部就绪后组成 quorum。每个节点都携带相同的 `trusted_peer_keys` 映射和各自的私钥：

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/node-1.key
    trusted_peer_keys:
      node-1: "okmamN3PKkMpPwPBurknHy2Wi3dwp/rz+uTM2fF9aD0="
      node-2: "PWX+oOYrFdtjUxbgmTkXCFI0KEvG++ZM52HOWfDkqP8="
      node-3: "QfP0fgllbj4s95VAztTORhy3bv9mst1l0lwuUNvO/hE="
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

仅 gossip 客户端——加入集群用于命名/消息传递，但从不运行 Raft。它同样需要自己的身份，并且必须出现在每个节点的信任映射中：

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/edge-7.key
    trusted_peer_keys:
      node-1: "okmamN3PKkMpPwPBurknHy2Wi3dwp/rz+uTM2fF9aD0="
      node-2: "PWX+oOYrFdtjUxbgmTkXCFI0KEvG++ZM52HOWfDkqP8="
      node-3: "QfP0fgllbj4s95VAztTORhy3bv9mst1l0lwuUNvO/hE="
      edge-7: "7lzP4jBAkC3P+0jq4vtMsC45571BlVXk3mSlOD/Z0SA="
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
| `GOMEMLIMIT` | 未设置 `--memory-limit` 参数时的内存限制回退值（优先级：`--memory-limit` 参数 > `GOMEMLIMIT` > 默认 1G） |

## 另请参阅

- [CLI 参考](guides/cli.md) - 命令行选项
- [集群指南](guides/cluster.md) - 集群架构与运维
- [入口类型](guides/entry-kinds.md) - 所有入口类型
- [可观测性指南](guides/observability.md) - 日志、指标、追踪
