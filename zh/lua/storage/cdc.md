---
title: "CDC"
description: "订阅来自 db.cdc.postgres 和 db.cdc.sqlite 源的变更数据捕获（Change Data Capture）流。列出已配置的源、打开一个流，并通过通道接收行级变更事件。该 API 与驱动无关：两种 kind 返回相同的源信息和相同的变更事件，仅在它们发布的能力上有所不同。"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

订阅来自 [`db.cdc.postgres`](system/cdc.md) 和 [`db.cdc.sqlite`](system/cdc.md) 源的变更数据捕获（Change Data Capture）流。列出已配置的源、打开一个流，并通过通道接收行级变更事件。该 API 与驱动无关：两种 kind 返回相同的源信息和相同的变更事件，仅在它们发布的[能力](system/cdc.md#capabilities)上有所不同。

## 加载

```lua
local cdc = require("cdc")
```

## list_sources

列出调用者被允许看到的已配置 CDC 源：

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

调用者不具备 `cdc.source` 权限的源会被省略，而不是作为错误报告。

**返回：** `table, error`

## source

按名称（其条目 ID）获取单个源：

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- 没有这样的源
end
```

**返回：** `table, error`（源信息，未找到时为 `nil`）

## stream

在某个源上打开变更流。返回一个 `cdc.Stream`，其通道传递变更事件：

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `name` | string | 必填 | 源名称（条目 ID） |
| `opts.tables` | []string | - | 过滤为这些表（省略则为所有被捕获的表） |
| `opts.ops` | []string | - | 过滤为这些操作：`insert`、`update`、`delete`、`truncate` |
| `opts.buffer` | int | 64 | 积压条目容量（1-65536） |
| `opts.max_bytes` | int | 1048576 | 该订阅者的积压字节预算（1 MiB） |
| `opts.snapshot` | bool | 条目默认值 | 为该流请求快照/实时交接 |
| `opts.after` | string | - | 来自前一个事件 `cursor` 的不透明恢复游标 |

未知的选项键会以 `errors.INVALID` 被拒绝。表名会不区分大小写地同时与限定关系名和裸表名匹配。快照行仅按 `tables` 过滤；`ops` 适用于实时变更。

当 `opts.snapshot` 为 true 或源条目的 `snapshot` 字段被设置时，流会收到一个快照；快照行先以 `op = "snapshot"` 到达，随后流无缝地继续进入实时变更。`opts.after` 保留给能够从游标恢复的驱动——目前发布的每个驱动对它都返回 `errors.INVALID`（"cdc operation is not supported by this source"），包括报告了 `capture_resume` 的 `db.cdc.postgres`。

过滤器只会收窄投递范围。对源的访问由 `cdc.subscribe` 权限授予，绝不由过滤器授予。

**返回：** `Stream, error`

## Stream 方法

### channel

返回接收变更事件的通道。第一次调用会订阅该源（会让出）；后续调用返回同一个通道。`:receive()` 会阻塞直到下一个变更到达，或在流结束时返回 `nil`：

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- 流已关闭

    if change.op == "snapshot" then
        seed_row(change.table, change.after)
    elseif change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

流是惰性的：先构造它，然后在生成它应观察的写入之前调用 `channel()`。这是实时观察，而不是重放订阅之前所做的变更。

当源以失败终止一个流时，通道会在关闭之前投递一个错误值。`receive` 是 `channel` 的别名。

### close

停止订阅并释放该流。幂等；在任务作用域结束时也会自动关闭。`release` 是 `close` 的别名。

```lua
stream:close()
```

## 变更事件

在通道上收到的每条消息都是一个变更表：

| 字段 | 描述 |
|-------|-------------|
| `op` | 操作：`insert`、`update`、`delete`、`snapshot` 或 `truncate` |
| `schema` | 表 schema |
| `table` | 表名 |
| `relation` | 限定关系名 |
| `before` | 变更之前的行状态（`update`、`delete`）。只有当源具备 `before_images` 能力时才保证是完整的行镜像；`db.cdc.postgres` 用 WAL 中携带的旧元组来填充它，而这由表的 `REPLICA IDENTITY` 控制 |
| `after` | 变更之后的行状态（`insert`、`update`、`snapshot`；`delete` 时不存在） |
| `source` | 源条目 ID |
| `source_id` | 源条目 ID，作为注册表 ID |
| `generation` | 产生该事件的源代次 |
| `cursor` | 源内不透明的每事件位置 |
| `transaction` | 事务标识符，当驱动报告时 |
| `lsn` | 变更的日志序列号（`db.cdc.postgres`） |
| `commit_lsn` | 提交事务的 LSN（适用时） |
| `xid` | 事务 ID（适用时） |
| `unchanged` | 值未被传输的列（未变更的 TOAST 值） |
| `error` | 事件上携带的驱动报告的错误描述 |

`before` 和 `after` 是以列名为键的行映射。

## 源信息

`cdc.source` 和 `cdc.list_sources` 的每个条目返回同样的记录：

| 字段 | 描述 |
|-------|-------------|
| `id` | 条目 ID |
| `kind` | `db.cdc.postgres` 或 `db.cdc.sqlite` |
| `name` | 源名称（条目 ID） |
| `state` | `unknown`、`starting`、`running`、`faulted` 或 `stopped` |
| `generation` | 当前源代次 |
| `epoch` | 与 `generation` 相同的值 |
| `engine` | 引擎名称，当驱动报告时 |
| `db_resource` | 被观察的 SQL 资源条目 ID（`db.cdc.sqlite`） |
| `slot` | 复制槽名称（`db.cdc.postgres`） |
| `publication` | Postgres publication，当配置时 |
| `tables` | 被捕获的表，当配置时 |
| `streaming` | `db.cdc.sqlite`：源是否正在运行；`db.cdc.postgres`：条目的 `streaming` 协议设置 |
| `failover` | 故障转移槽模式（`db.cdc.postgres`） |
| `temporary` | 临时槽（`db.cdc.postgres`） |
| `snapshot` | 条目级快照默认值 |
| `faulted` | 源是否处于 `faulted` 状态 |
| `error` | 最近一次源错误，当有记录时 |
| `admission` | `active`、`snapshots`、`reserved_bytes`、`rejected` |
| `capabilities` | `snapshot`、`capture_resume`、`replayable`、`captures_external_writes`、`before_images`、`coalesced` |

请基于 `capabilities` 而不是 `kind` 来分支：

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- before 不保证是完整的行镜像；请自行保留最后已知状态
end
```

字段语义参见 [CDC 源](system/cdc.md#source-info)。

## 权限

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `cdc.source` | 源条目 ID | `cdc.source`；同时过滤 `cdc.list_sources` |
| `cdc.subscribe` | 源条目 ID | `cdc.stream`，在订阅建立时会再次检查 |

被拒绝的操作返回 `errors.PERMISSION_DENIED`。

## 错误

| 条件 | 类型 |
|-----------|------|
| 没有上下文 | `errors.INTERNAL` |
| 需要源名称 | `errors.INVALID` |
| 无效或未知的流选项 | `errors.INVALID` |
| 在没有 `capture_resume` 的源上使用 `after` | `errors.INVALID` |
| 源未注册 | `errors.NOT_FOUND` |
| 源未启动或正在被替换 | `errors.UNAVAILABLE` |
| 订阅容量耗尽 | `errors.UNAVAILABLE` |
| 权限被拒绝 | `errors.PERMISSION_DENIED` |

参见[错误处理](lua/core/errors.md)了解错误处理方法。

## 另请参阅

- [变更数据捕获](system/cdc.md) - 源配置与能力
- [通道](lua/core/channel.md) - 通道语义
- [数据库](system/database.md) - SQL 数据库服务
