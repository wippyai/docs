---
title: "进程组"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

# 进程组
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

将进程加入命名组并向集群中所有成员广播。以 Erlang/OTP `pg` 为模型：组是动态的，进程可以属于多个组，成员资格在集群范围内追踪，并具有最终一致性。

有关作用域入口类型及其配置，参见[进程组](system/process-groups.md)。有关更广泛的集群模型，参见[集群指南](guides/cluster.md)。

## 加载

```lua
local pg = require("pg")
```

## 打开作用域

进程组存在于**作用域**中——一个 `pg.scope` 注册表入口。打开它以获取操作所用的实例：

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | 作用域入口 ID（格式：`"namespace:name"`） |

**返回:** `pg.Instance, error`

**权限:** 作用域 `id` 上的 `pg.open`

进程退出时实例自动释放；调用 `release()` 可提前释放。所有其他操作均为实例上的方法，使用 `:` 调用。

## 加入和离开

```lua
local ok, err = group:join("workers")           -- 单个组
local ok, err = group:join({"workers", "all"})  -- 批量
local ok, err = group:leave("workers")
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `group` | string \| string[] | 组名，或批量操作的名称列表 |

**返回:** `boolean, error`

进程可多次加入同一组；必须离开相同次数才能完全退出（多重加入语义）。`leave` 在批量操作中尽力执行，仅在进程不是任何指定组的成员时才返回错误。

**权限:** 每个组名上的 `pg.join` / `pg.leave`

## 列出成员

```lua
local members, err = group:get_members("workers")        -- 所有节点
local local_members, err = group:get_local_members("workers")  -- 仅此节点
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `group` | string | 组名 |

**返回:** `string[], error` — PID 字符串数组（未知组返回空数组）

**权限:** 组名上的 `pg.get_members` / `pg.get_local_members`

## 列出组

```lua
local groups, err = group:which_groups()         -- 集群中所有组
local local_groups, err = group:which_local_groups()  -- 有本地成员的组
```

**返回:** `string[], error` — 当前至少有一个成员的组名

**权限:** `pg.which_groups` / `pg.which_local_groups`

## 广播

向组的所有成员发送消息。每个成员以调用进程为发送方在 `topic` 下接收——通过 `process.listen(topic)` 处理。

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- 所有节点
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- 仅此节点
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `group` | string | 目标组 |
| `topic` | string | 消息主题 |
| `...` | any | 零个或多个负载值 |

**返回:** `boolean, error`

**权限:** 组名上的 `pg.broadcast` / `pg.broadcast_local`

## 监控组

`monitor` 订阅单个组的加入/离开事件，并原子性地返回当前成员——快照与订阅之间不会遗漏任何成员变更。

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- 订阅时的当前成员
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- 取消订阅；sub:close({flush = true}) 先排空队列中的事件
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `group` | string | 要监控的组 |

**返回:** `pg.Subscription, string[], error` — 订阅对象和当前成员快照

**权限:** 组名上的 `pg.monitor`

## 监控所有组

`events` 订阅作用域内所有组的成员变更，并返回所有组到其成员的快照。

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**返回:** `pg.Subscription, table, error`

**权限:** `pg.events`

### 事件字段

订阅通道传递的事件包含：

| 字段 | 类型 | 描述 |
|------|------|------|
| `system` | string | 始终为 `"pg"` |
| `kind` | string | `"member.joined"` 或 `"member.left"` |
| `path` | string | 组名 |
| `data` | table | `{Group = string, PIDs = string[]}` — 受影响的成员 |

订阅通道有缓冲（容量 64）；若消费者速度过慢填满缓冲区，该订阅的后续事件将被丢弃。

## 释放

```lua
group:release()
```

立即释放实例。幂等；释放后每个方法都返回错误。进程退出时清理也会自动运行。

**返回:** `boolean`

## 权限

| 权限 | 方法 | 资源 |
|------|------|------|
| `pg.open` | `pg.open()` | 作用域 id |
| `pg.join` | `join()` | 组名 |
| `pg.leave` | `leave()` | 组名 |
| `pg.get_members` | `get_members()` | 组名 |
| `pg.get_local_members` | `get_local_members()` | 组名 |
| `pg.which_groups` | `which_groups()` | （作用域） |
| `pg.which_local_groups` | `which_local_groups()` | （作用域） |
| `pg.broadcast` | `broadcast()` | 组名 |
| `pg.broadcast_local` | `broadcast_local()` | 组名 |
| `pg.monitor` | `monitor()` | 组名 |
| `pg.events` | `events()` | （作用域） |

## 错误

| 条件 | 类型 |
|------|------|
| 权限被拒绝 | `errors.PERMISSION_DENIED` |
| 参数缺失或为空 | `errors.INVALID` |
| 作用域未找到 | `errors.NOT_FOUND` |
| 离开未加入的组 | `errors.INVALID` |
| 实例已释放 | `errors.INVALID` |

错误处理参见[错误处理](lua/core/errors.md)。

## 另请参阅

- [进程组](system/process-groups.md) - 作用域入口类型与配置
- [集群](guides/cluster.md) - 成员资格与集群模型
- [进程管理](lua/core/process.md) - 启动和向单个进程发送消息
