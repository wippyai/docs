---
title: "Scheduler"
description: "Scheduler 使用工作窃取设计执行进程。Worker 维护本地双端队列，空闲时相互窃取任务。"
---

# Scheduler

Scheduler 使用工作窃取设计执行进程。Worker 维护本地双端队列，空闲时相互窃取任务。

## Process 接口

Scheduler 可以与任何实现 `Process` 接口的类型协作：

```go
type Process interface {
    Init(ctx context.Context, method string, input payload.Payloads) error
    Step(events []Event, out *StepOutput) error
    Close()
}
```

| 方法 | 用途 |
|--------|---------|
| `Init` | 使用入口方法名和输入参数准备进程 |
| `Step` | 使用传入事件推进状态机，将 yield 写入输出 |
| `Close` | 释放资源 |

`Init` 中的 `method` 参数指定要调用的入口点。一个进程实例可以暴露多个入口点，调用者选择执行哪一个。这也用于验证 scheduler 正确启动了进程。

Scheduler 反复调用 `Step()`，传递事件（yield 完成、消息）并收集 yield（要分发的命令）。进程将其状态和任何 yield 写入 `StepOutput` 缓冲区。

```go
type Event struct {
    Type  EventType  // EventYieldComplete 或 EventMessage
    Tag   uint64     // yield 完成的关联标签
    Data  any        // 结果数据或消息负载
    Error error      // yield 失败时的错误
}
```

## 结构

Scheduler 默认生成 `GOMAXPROCS` 个 worker。每个 worker 有一个本地双端队列用于缓存友好的 LIFO 访问，以及一个 per-worker 的 MPSC 注入队列，用于与该 worker 有亲和性的异步完成。全局 FIFO 队列处理新提交和无亲和性的重新入队。进程通过 PID 跟踪以进行消息路由。

## 工作查找

```mermaid
flowchart TD
    W[Worker 需要工作] --> L{本地双端队列?}
    L -->|有项目| LP[从底部 LIFO 弹出]
    L -->|空| I{注入队列?}
    I -->|有项目| IP[弹出 + 转移最多 16 个到本地]
    I -->|空| G{全局队列?}
    G -->|有项目| GP[弹出 + 批量转移最多 16 个]
    G -->|空| S[从随机受害者窃取]
    S --> SH[StealHalfInto 受害者的双端队列]
```

Worker 按优先级顺序检查来源：

| 优先级 | 来源 | 模式 |
|----------|--------|---------|
| 1 | 本地双端队列 | LIFO 弹出，无锁，缓存友好 |
| 2 | 注入队列 | MPSC 弹出有亲和性的异步完成，转移最多 16 个到本地 |
| 3 | 全局队列 | FIFO 弹出并批量转移 |
| 4 | 其他 worker | 从受害者双端队列窃取一半 |

从注入队列或全局队列弹出时，worker 取一个项目，并将最多 16 个额外项目转移到本地双端队列。

## Chase-Lev 双端队列

每个 worker 拥有一个 Chase-Lev 工作窃取双端队列：

```go
type Deque struct {
    buffer atomic.Pointer[dequeBuffer]
    top    atomic.Int64  // 窃取者从这里偷（CAS）
    bottom atomic.Int64  // 所有者在这里推/弹
}
```

所有者从底部推入和弹出（LIFO），无需同步。窃取者使用 CAS 从顶部偷取（FIFO）。这使所有者能够缓存友好地访问最近推入的项目，同时将较旧的工作分配给窃取者。

`StealHalfInto` 在一次 CAS 操作中取走一半项目，减少竞争。

## 自适应自旋

在阻塞于条件变量之前，worker 自适应地自旋：

| 自旋次数 | 动作 |
|------------|--------|
| < 4 | 紧密循环 |
| 4-15 | 让出线程（`runtime.Gosched`） |
| >= 16 | 阻塞于条件变量 |

## 进程状态

```mermaid
stateDiagram-v2
    [*] --> Ready: Submit
    Ready --> Running: worker 的 CAS
    Running --> Complete: done
    Running --> Blocked: yield 命令
    Running --> Idle: 等待消息
    Blocked --> Ready: CompleteYield
    Idle --> Ready: Send 到达
```

| 状态 | 描述 |
|-------|-------------|
| Ready | 排队等待执行 |
| Running | Worker 正在执行 Step() |
| Blocked | 等待 yield 完成 |
| Idle | 等待消息 |
| Complete | 执行完成 |

唤醒标志处理竞态：如果 handler 在 worker 仍拥有进程（Running）时调用 `CompleteYield`，它会设置标志。Worker 在分发后检查标志，如果设置则重新入队。

## 事件队列

每个进程有一个 MPSC（多生产者，单消费者）事件队列：

- **生产者**：命令 handler（`CompleteYield`），消息发送者（`Send`）
- **消费者**：Worker 在 `Step()` 中消费事件

一个世代计数器守护该队列。每个生产者都绑定到它观察到的世代；`Reset` 会递增它，因此上一次执行遗留的发送者无法向被复用的队列中推入内容。

普通事件流量不设上限。计量按消息选择性启用：携带 `MaxItems` 或 `MaxBytes` 的消息会按主题预算准入，同一主题上出现过的最严格限制生效。消息会一直持有其预留额度，直到消费进程释放它，终止消息则从不占用积压容量。

当某个主题的预算耗尽时，队列会在溢出消息的位置追加一条合成消息，内容为 `message queue limit exceeded`，其后跟一个终止负载。该主题上的后续流量会被丢弃，直到队列被重置，因此有界订阅会以错误终止消息结束，而不会无限增长。

## 消息路由

Scheduler 实现 `relay.Receiver` 将消息路由到进程。`Send` 以后台上下文委托给 `SendContext`；`SendContext` 在查找目标之前和准入之前都会检查取消状态，因为准入本身是非阻塞的，一旦成功便不可逆。

两者都会在 `byPID` 映射中查找目标 PID，并在处理器当前世代下将消息包推入进程队列。准入有三种结果：

| 结果 | 含义 | 消息包所有权 |
|------|------|--------------|
| Accepted | 队列接收了该消息包 | 队列，由 scheduler 在处理后释放 |
| Dropped | 某个按主题的预算溢出，队列只保留了自己的溢出终止消息 | 调用方，立即释放 |
| Rejected | 队列已关闭或世代已过期 | 调用方；`SendContext` 返回 `ErrProcessClosed` |

被接受或被丢弃的推入随后会在进程空闲或阻塞时唤醒它。它通过 injectOrGlobal 重新入队：当进程有已知的 worker 亲和性时推入最后一个 worker 的专属注入队列，否则回退到全局队列。

## 关闭

关闭时，scheduler 向所有运行中的进程发送取消事件，并等待它们完成或超时。一旦没有剩余工作，worker 退出。

## 另请参阅

- [Command Dispatch](internals/dispatch.md) - yield 如何到达 handler
- [Process Model](concepts/process-model.md) - 高级概念
