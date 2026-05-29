# 进程组

进程组让进程加入命名组并接收发给组的广播，成员资格在集群的每个节点上追踪。模型遵循 Erlang/OTP `pg`：组在首次加入时创建，进程可以属于多个组（也可以多次加入同一组），成员资格是去中心化的——每个节点维护自身状态并通过节点间网格与对等节点协调。

Lua API 文档在[进程组](lua/core/pg.md)中；本页介绍作用域入口类型及其配置。集群的整体成员资格模型参见[集群指南](guides/cluster.md)。

## 入口类型

| 类型 | 描述 |
|------|------|
| `pg.scope` | 拥有独立成员资格状态和集群网格的独立进程组命名空间 |

每个作用域相互隔离：一个作用域中的组和成员对另一个作用域不可见。进程通过入口 ID 打开作用域（`pg.open("app:pg")`）并在其中操作。

```yaml
- name: pg
  kind: pg.scope
  lifecycle:
    auto_start: true
```

## 配置

所有字段均为可选，默认值针对典型集群场景进行了调优。

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `protocol_timeout` | duration | 5s | 节点间同步/发现操作的超时时间 |
| `broadcast_timeout` | duration | 5s | 向单个成员投递广播的超时时间 |
| `anti_entropy_interval` | duration | 30s | 协调循环的节拍；每次 tick 同步一个对等节点（0 表示禁用） |
| `circuit_breaker_failures` | int | 3 | 触发熔断器打开前对某节点的连续发送失败次数 |
| `circuit_breaker_reset_time` | duration | 10s | 熔断器打开后等待多久进入半开状态进行测试发送 |
| `max_retries` | int | 3 | 广播失败的重试次数（0 表示禁用重试） |
| `retry_base_delay` | duration | 100ms | 重试间的初始退避延迟 |
| `retry_max_delay` | duration | 1s | 最大退避延迟 |
| `action_queue_size` | int | 256 | 记录"接近容量"警告的深度阈值 |
| `action_queue_max_size` | int | 1024 | 内部事件循环队列的硬性容量上限；队满时丢弃操作 |
| `monitor_buffer` | int | 64 | 每个订阅的事件通道容量；订阅者缓冲区满时丢弃事件 |
| `max_groups` | int | 0 | 最大不同组数（0 = 无限制） |
| `max_members_per_group` | int | 0 | 每组最大成员数（含多重加入计数，0 = 无限制） |

```yaml
- name: pg
  kind: pg.scope
  anti_entropy_interval: 30s
  circuit_breaker_failures: 3
  max_members_per_group: 10000
  lifecycle:
    auto_start: true
```

## 工作原理

**单写者状态。** 每个作用域运行一个单 goroutine 的事件循环（gen_server 模式）。所有变更通过它串行化；成员和组的读取从原子发布的快照中提供，因此永远不会阻塞循环。

**加入/离开传播。** 本地加入或离开操作先应用到循环，然后扇出到存活成员对等节点与任何先前发现的远程节点的并集。向该并集发送，确保新加入或尚未收敛的节点仍能收到变更。

**广播。** `broadcast` 在循环内快照完整的跨集群成员列表，然后在循环外向每个成员投递，避免慢接收者阻塞作用域。`broadcast_local` 仅对本地节点上的成员执行相同操作。

**监控和事件。** 订阅和快照当前成员在一个事件循环 tick 内完成，因此订阅者永远不会遗漏或重复计算与订阅竞争的变更。订阅者接收 `member.joined` / `member.left` 事件；加入 N 次的进程的离开事件会报告该 PID N 次，保留多重性。

**反熵与发现。** 启动时，作用域向一小部分随机对等节点发送发现消息（有上限以避免多节点同时重启时的 N² 风暴）。节点加入时接收完整的状态同步。随后反熵循环定期向一个对等节点推送完整同步，使对等节点遗漏的广播最终收敛。接收方进行差异同步——只有实际添加或移除的成员才会触发事件。

**熔断器。** 每个节点的熔断器追踪连续发送失败次数。超过 `circuit_breaker_failures` 次后打开，向该节点的发送被跳过，直到 `circuit_breaker_reset_time` 到期时允许一次测试发送。命中开路熔断器的加入/离开广播会以指数退避重试，最多 `max_retries` 次。

## 可观测性

存活健康检查（`pg.broadcast_recent.<scope>`）在作用域较长时间内未见到广播流量时报告不健康，可发现卡死的事件循环或持续分区。参见[可观测性指南](guides/observability.md)。

## 另请参阅

- [进程组](lua/core/pg.md) - Lua API
- [集群](guides/cluster.md) - 成员资格与集群模型
- [进程模型](concepts/process-model.md) - 进程、PID 和消息传递
