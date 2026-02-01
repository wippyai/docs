# Process Host

Process Host 使用工作窃取调度器管理 Lua 进程执行。

<note>
每个 host 独立调度进程。负载不会在 host 之间自动分配。
</note>

## Entry 类型

| Kind | 描述 |
|------|------|
| `process.host` | 带调度器的进程执行 host |

## 配置

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `workers` | int | NumCPU | Worker goroutine 数量 |
| `queue_size` | int | 1024 | 全局队列容量 |
| `local_queue_size` | int | 256 | 每个 worker 的本地队列大小 |

## 调度器

调度器使用工作窃取机制：每个 worker 有一个本地双端队列，空闲的 worker 从全局队列或其他 worker 窃取任务。这会自动平衡负载。

- **Workers** 并发执行进程
- **全局队列** 在所有 worker 繁忙时保存待处理的进程
- **本地队列** 通过将工作保持在 worker 附近来减少竞争

## 进程类型

Process Host 执行以下类型的 entry：

| Kind | 描述 |
|------|------|
| `lua.process` | 基于源码的 Lua 进程 |
| `lua.process.bytecode` | 预编译的 Lua 字节码 |

<note>
未来版本计划支持更多进程类型。
</note>

进程独立运行，拥有自己的上下文，通过消息通信，并受监督以实现容错。
