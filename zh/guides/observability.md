# 可观测性

配置 Wippy 应用的日志、指标和分布式追踪。

## 概述

Wippy 提供三大可观测性支柱，在启动时配置：

| 支柱 | 后端 | 配置 |
|------|------|------|
| 日志 | Zap（JSON 结构化） | `logger` 和 `logmanager` |
| 指标 | Prometheus | `prometheus` |
| 追踪 | OpenTelemetry | `otel` |

## 日志配置

### 基本日志

```yaml
logger:
  mode: production     # development 或 production
  level: info          # debug, info, warn, error
  encoding: json       # json 或 console
```

### 日志管理器

日志管理器控制日志传播和事件流：

```yaml
logmanager:
  propagate_downstream: true   # 传播到子组件
  stream_to_events: false      # 转发日志到事件总线
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

启用 `stream_to_events` 后，日志条目会成为事件，进程可通过事件总线订阅。

### 自动上下文

所有日志自动包含：

- `pid` - 进程 ID
- `location` - 入口 ID 和行号（例如 `app.api:handler:45`）

## Prometheus 指标

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

指标在配置的地址上通过 `/metrics` 暴露。

### 抓取配置

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Lua 指标 API 参见 [Metrics 模块](lua/system/metrics.md)。

## OpenTelemetry

OTEL 提供分布式追踪和可选的指标导出。

### 基本配置

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc 或 http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # 允许非 TLS 连接
  sample_rate: 1.0             # 0.0 到 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### 追踪源

为特定组件启用追踪：

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # HTTP 请求追踪
  http:
    enabled: true
    extract_headers: true      # 读取传入的追踪上下文
    inject_headers: true       # 写入传出的追踪上下文

  # 进程生命周期追踪
  process:
    enabled: true
    trace_lifecycle: true      # 追踪 spawn/exit 事件

  # 队列消息追踪
  queue:
    enabled: true

  # 函数调用追踪
  interceptor:
    enabled: true
    order: 0                   # 拦截器执行顺序
```

### Temporal 工作流

为 Temporal 工作流启用追踪：

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

启用后，Temporal SDK 的追踪拦截器会为客户端和工作线程操作注册。

追踪的操作：
- 工作流启动和完成
- Activity 执行
- 子工作流调用
- 信号和查询处理

### 追踪内容

| 组件 | Span 名称 | 属性 |
|------|-----------|------|
| HTTP 请求 | `{METHOD} {route}` | http.method, http.url, http.host |
| 函数调用 | 函数 ID | process.pid, frame.id |
| 进程生命周期 | `{source}.started/terminated` | process.pid |
| 队列消息 | 消息主题 | 头部中的追踪上下文 |
| Temporal 工作流 | Workflow/Activity 名称 | workflow.id, run.id |

### 上下文传播

追踪上下文自动传播：

- **HTTP → 函数**：W3C Trace Context 头部
- **函数 → 函数**：帧上下文继承
- **进程 → 进程**：Spawn 上下文
- **队列发布 → 消费**：消息头部

### 环境变量

OTEL 可通过环境变量配置：

| 变量 | 说明 |
|------|------|
| `OTEL_SDK_DISABLED` | 设为 `true` 禁用 OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 收集器端点 |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` 或 `http/protobuf` |
| `OTEL_SERVICE_NAME` | 服务名称 |
| `OTEL_SERVICE_VERSION` | 服务版本 |
| `OTEL_TRACES_SAMPLER_ARG` | 采样率（0.0-1.0） |
| `OTEL_PROPAGATORS` | 传播器列表 |

## 运行时统计

`system` 模块提供内部运行时统计：

```lua
local system = require("system")

-- 内存统计
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects 等

-- Goroutine 计数
local count = system.runtime.goroutines()

-- 监督器状态
local states = system.supervisor.states()
```

## 参见

- [Logger 模块](lua/system/logger.md) - Lua 日志 API
- [Metrics 模块](lua/system/metrics.md) - Lua 指标 API
- [System 模块](lua/system/system.md) - 运行时统计
