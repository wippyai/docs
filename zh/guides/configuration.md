# 配置参考

Wippy 通过 `.wippy.yaml` 文件进行配置。所有选项都有合理的默认值。

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

服务生命周期管理。控制受监督入口的启动/停止方式。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `host.buffer_size` | int | 1024 | 消息队列容量 |
| `host.worker_count` | int | NumCPU | 并发工作线程数 |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

参见：[监督指南](guides/supervision.md)

## 函数

函数执行宿主。运行 `function.lua` 入口。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `host.buffer_size` | int | 1024 | 任务队列容量 |
| `host.worker_count` | int | NumCPU | 并发工作线程数 |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

参见：[函数概念](concepts/functions.md)、[Funcs 模块](lua/core/funcs.md)

## Lua 运行时

Lua 虚拟机缓存和表达式求值。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `proto_cache_size` | int | 60000 | 编译原型缓存 |
| `main_cache_size` | int | 10000 | 主块缓存 |
| `expr.cache_enabled` | bool | true | 缓存编译表达式 |
| `expr.capacity` | int | 5000 | 表达式缓存大小 |
| `json.cache_enabled` | bool | true | 缓存 JSON Schema |
| `json.capacity` | int | 1000 | JSON 缓存大小 |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
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
| `service_name` | string | wippy | 服务标识符 |
| `sample_rate` | float | 1.0 | 追踪采样率（0.0-1.0） |
| `traces_enabled` | bool | false | 导出追踪 |
| `metrics_enabled` | bool | false | 导出指标 |
| `http.enabled` | bool | true | 追踪 HTTP 请求 |
| `process.enabled` | bool | true | 追踪进程生命周期 |
| `interceptor.enabled` | bool | false | 追踪函数调用 |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

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

基于 gossip 发现的多节点集群。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | false | 启用集群 |
| `name` | string | hostname | 节点标识符 |
| `internode.bind_addr` | string | 0.0.0.0 | 节点间绑定地址 |
| `internode.bind_port` | int | 0 | 端口（0=自动 7950-7959） |
| `membership.bind_port` | int | 7946 | Gossip 端口 |
| `membership.join_addrs` | string | | 种子节点（逗号分隔） |
| `membership.secret_key` | string | | 加密密钥（base64） |
| `membership.secret_file` | string | | 密钥文件路径 |
| `membership.advertise_addr` | string | | NAT 公网地址 |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

参见：[集群指南](guides/cluster.md)

## 环境变量

| 变量 | 说明 |
|------|------|
| `GOMEMLIMIT` | 内存限制（覆盖 `--memory-limit` 参数） |

## 参见

- [CLI 参考](guides/cli.md) - 命令行选项
- [入口类型](guides/entry-kinds.md) - 所有入口类型
- [集群指南](guides/cluster.md) - 多节点配置
- [可观测性指南](guides/observability.md) - 日志、指标、追踪
