---
title: "变更数据捕获"
description: "使用 db.cdc.postgres 和 db.cdc.sqlite 从 Postgres 逻辑复制或 SQLite 流式传输行级变更。"
---

# 变更数据捕获

从数据库流式传输行级变更。CDC 源捕获插入、更新和删除，可选地先向每个订阅者交付一份现有行的一致性快照，并把所有内容作为与驱动无关的变更事件投递。源可通过其条目 ID 寻址，并从 Lua 通过 [`cdc` 模块](lua/storage/cdc.md)消费。

## 条目 Kind

| Kind | 描述 |
|------|-------------|
| `db.cdc.postgres` | Postgres 逻辑复制（`pgoutput` 插件） |
| `db.cdc.sqlite` | 通过 `db.sql.sqlite` 资源观察到的 SQLite 写入 |

两种 kind 暴露相同的 Lua API、相同的源信息记录和相同的变更事件形状。不同之处在于保证集合，它按源以[能力](#capabilities)的形式发布。

## Postgres 配置

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `host` | string | 必填 | Postgres 主机 |
| `port` | int | 必填 | Postgres 端口（必须 > 0） |
| `database` | string | 必填 | 数据库名 |
| `username` | string | 必填 | 复制用户（必须具有 `REPLICATION` 权限） |
| `password` | string | 必填 | 密码（内联或 `${env:NAME}`） |
| `slot_name` | string | 必填 | 逻辑复制槽名称 |
| `publication` | string | - | Postgres publication；当 `tables` 为空时必填 |
| `tables` | []string | - | 要捕获的表（`schema.table`）；省略则使用 publication 的表 |
| `snapshot` | bool | false | 按订阅者快照交接的条目默认值 |
| `streaming` | bool | false | 使用流式 `pgoutput` 协议版本 |
| `temporary` | bool | false | 使用临时复制槽（断开连接时移除） |
| `failover` | bool | false | 启用故障转移槽模式（与 `temporary` 互斥） |
| `standby_interval` | duration | - | 备用状态消息间隔（例如 `10s`） |
| `status_interval` | duration | - | 向服务器发送状态更新的间隔 |
| `snapshot_fetch_size` | int | - | 每个快照批次获取的行数（必须 >= 0） |
| `max_transaction_changes` | int | 1000000 | 解码单个事务时缓冲的最大变更数 |
| `max_transaction_bytes` | int | 268435456 | 解码单个事务时缓冲的最大逻辑字节数（256 MiB） |
| `max_inflight_changes` | int | 1000000 | 所有进行中事务合计持有的最大变更数 |
| `max_inflight_bytes` | int | 268435456 | 所有进行中事务合计持有的最大逻辑字节数（256 MiB） |
| `subscriptions` | object | - | 订阅准入限制，参见[订阅限制](#subscription-limits) |
| `options` | map | - | 额外的连接选项 |
| `lifecycle` | object | - | 生命周期配置 |

任何 `max_*` 字段为零表示选择默认值；解码器绝不会无界。负值会被拒绝。

凭据在解码时通过[环境注册表](system/env.md)解析 `${env:NAME}` 占位符。

## SQLite 配置

SQLite 源不会打开自己的数据库。它借用一个已存在的 [`db.sql.sqlite`](system/database.md) 资源并订阅该资源的已提交变更观察者，因此它精确地捕获通过该 Wippy SQL 资源所做的写入——由另一个进程、另一个连接或外部工具所做的写入不会被观察到。

```yaml
- name: cdcdb
  kind: db.sql.sqlite
  file: /var/data/app.db
  lifecycle:
    auto_start: true

- name: changes
  kind: db.cdc.sqlite
  db_resource: app:cdcdb
  tables:
    - users
    - orders
  snapshot: true
  status_interval: "30s"
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `db_resource` | string | 必填 | 要观察的 `db.sql.sqlite` 资源的条目 ID |
| `name` | string | - | 被接受；源名称始终是条目 ID |
| `tables` | []string | - | 要捕获的表；省略则为所有表 |
| `snapshot` | bool | false | 按订阅者快照交接的条目默认值 |
| `status_interval` | duration | `30s` | 状态更新间隔 |
| `subscriptions` | object | - | 订阅准入限制，参见[订阅限制](#subscription-limits) |
| `lifecycle` | object | - | 生命周期配置 |

源把该 SQL 资源声明为生命周期依赖，因此监管器会先启动数据库，并在数据库代次被替换时重启该源。

<note>
SQLite 捕获需要使用 <code>sqlite_preupdate_hook</code> 构建标签构建的运行时。官方构建包含它。没有该标签时驱动会失败即关闭：创建 <code>db.cdc.sqlite</code> 条目会返回 <code>sqlite cdc requires the sqlite_preupdate_hook build tag</code>，而不是启动一个什么都捕获不到的源。
</note>

## 订阅限制

每个源准入有限数量的订阅者，并预先为它们的最坏情况积压做预留。快照槽位会一直保持预留，直到启用快照的流关闭。

```yaml
subscriptions:
  max_subscriptions: 1024
  max_snapshot_subscriptions: 4
  max_bytes: 268435456
```

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `max_subscriptions` | int | 1024 | 源准入的并发订阅数 |
| `max_snapshot_subscriptions` | int | 4 | 启用快照的并发订阅数 |
| `max_bytes` | int | 268435456 | 预留的订阅者积压总字节数（256 MiB） |

零表示选择默认值；负值会被拒绝。耗尽某个限制会使订阅以可重试的 `errors.UNAVAILABLE` 失败。

## 工作原理

1. Postgres 源以复制用户身份连接，并创建（或恢复）由 `slot_name` 指定的槽。SQLite 源借用其 `db_resource` 并订阅该资源的已提交变更观察者。
2. 行变更被解码为与驱动无关的变更事件，`op` 为 `insert`、`update`、`delete` 或 `truncate`。
3. 流启用了 `snapshot` 的订阅者——来自条目的 `snapshot` 字段或流上的 `opts.snapshot`——首先以 `op = "snapshot"` 的事件收到现有行，然后无缝地继续进入实时变更。
4. Postgres 源定期确认 LSN，以便服务器可以释放 WAL 段（`standby_interval`）。
5. 源以其条目 ID 注册；Lua 代码用 [`cdc.stream`](lua/storage/cdc.md) 订阅。

## 能力

每个源都发布它所保证的内容，因此消费者应基于能力而不是条目 kind 来分支。

| 能力 | `db.cdc.postgres` | `db.cdc.sqlite` | 含义 |
|------------|:-----------------:|:---------------:|---------|
| `snapshot` | 是 | 是 | 支持原子的快照/实时交接 |
| `capture_resume` | 是，除非 `temporary` | 否 | 源进度在重新连接后仍然保留 |
| `replayable` | 否 | 否 | 单个订阅者可以重放过去的事件 |
| `captures_external_writes` | 是 | 否 | 捕获在本运行时之外所做的写入 |
| `before_images` | 否 | 是 | 投递变更前的行镜像 |
| `coalesced` | 否 | 是 | 一个事务内对同一行的重复写入可能合并后到达 |

能力标志描述的是源的进度，而不是持久投递：没有任何驱动会为落后或断开连接的单个订阅者重放事件。

## 源信息

每个源由一条信息记录描述，由 `cdc.source` 和 `cdc.list_sources` 返回。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `id` | string | 条目 ID |
| `kind` | string | `db.cdc.postgres` 或 `db.cdc.sqlite` |
| `name` | string | 源名称（条目 ID） |
| `state` | string | `unknown`、`starting`、`running`、`faulted` 或 `stopped` |
| `generation` | string | 当前源代次；源被替换时改变 |
| `epoch` | string | 与 `generation` 相同的值 |
| `engine` | string | 引擎名称（`sqlite`） |
| `db_resource` | string | 被观察的 SQL 资源条目 ID（`db.cdc.sqlite`） |
| `slot` | string | 复制槽名称（`db.cdc.postgres`） |
| `publication` | string | Postgres publication，当配置时 |
| `tables` | []string | 被捕获的表，当配置时 |
| `streaming` | bool | 源当前是否正在运行 |
| `failover` | bool | 故障转移槽模式（`db.cdc.postgres`） |
| `temporary` | bool | 临时槽（`db.cdc.postgres`） |
| `snapshot` | bool | 条目级快照默认值 |
| `faulted` | bool | 源是否处于 `faulted` 状态 |
| `error` | string | 最近一次源错误，当有记录时 |
| `admission` | object | `active`、`snapshots`、`reserved_bytes`、`rejected` |
| `capabilities` | object | 参见[能力](#capabilities) |

`admission` 统计的是预留，而不是队列填充量：`active` 是已准入的订阅数，`snapshots` 是其中启用快照的子集，`reserved_bytes` 是预留的积压预算，`rejected` 是被限制拒绝的订阅累计数量。

## 权限

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `cdc.source` | 源条目 ID | 读取源信息；同时过滤 `cdc.list_sources` |
| `cdc.subscribe` | 源条目 ID | 打开变更流 |

CDC 授权与数据库访问是分开的：一个源可以暴露每一个被捕获的行，包括变更前镜像。流过滤器只会收窄投递范围；它们绝不授予对源的访问权限。

```yaml
- name: cdc_reader
  kind: security.policy
  policy:
    effect: allow
    actions: [cdc.source, cdc.subscribe]
    resources: [app:changes]
```

## 另请参阅

- [CDC 模块](lua/storage/cdc.md) - Lua 流式 API
- [数据库](system/database.md) - SQL 数据库服务
- [环境](system/env.md) - 通过 `${env:NAME}` 解析凭据
- [安全](system/security.md) - 策略与操作
