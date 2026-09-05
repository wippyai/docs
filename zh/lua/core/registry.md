---
title: "条目注册表"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

# 条目注册表
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

查询和修改已注册条目。访问元数据、快照和版本历史。

## 加载

```lua
local registry = require("registry")
```

## 条目结构

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: 条目类型
    meta = {type = "test"},    -- table: 可搜索元数据
    data = {...}               -- any: 条目负载
}
```

从 `registry.get`、`registry.find`、`snap:entries()`、`snap:get()`、`snap:namespace()` 和 `snap:find()` 读回的条目只携带这四个面向作者的字段。

`dependency_root` 是 `changes:create()` 和 `changes:update()` 接受的写入侧字段。它是一个布尔值，将 `ns.dependency` 条目标记为部署根。条目 API 从不返回它；registry 所有的状态通过 [`snap:state()`](lua/core/registry.md#snapshot-state) 读取。

## 获取条目

```lua
local entry, err = registry.get("app.lib:assert")
```

**权限:** 条目 ID 上的 `registry.get`

## 查找条目

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

过滤字段与条目元数据匹配。

## 解析 ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## 快照

注册表的时间点视图：

```lua
local snap, err = registry.snapshot()           -- 当前状态
local snap, err = registry.snapshot_at(5)       -- 版本 5 时
```

### 快照方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `snap:entries()` | `Entry[], error` | 所有可访问条目 |
| `snap:state()` | `State, error` | 带 registry 所有元数据的条目，以及解析出的模块图 |
| `snap:get(id)` | `Entry, error` | 按 ID 获取单个条目 |
| `snap:find(filter)` | `Entry[]` | 过滤条目 |
| `snap:namespace(ns)` | `Entry[]` | 命名空间中的条目 |
| `snap:version()` | `Version` | 快照版本 |
| `snap:changes()` | `Changes` | 创建变更集 |

### 快照状态

`snap:state()` 返回条目状态以及为该快照版本选定的模块图。registry 所有的来源信息携带在每个条目上，而不是合并进 `meta`，因此不会与作者编写的元数据混淆。

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

`state.entries` 中的每个条目都有那四个面向作者的字段，另加：

- `registry.owner` - 提供该条目的部署来源
- `registry.root` - 当条目是部署选中的依赖声明时为 `true`

`state.resolution` 描述 `registry.snapshot()` 视图的模块图。在本身不携带依赖图的快照上它不存在，包括 `registry.snapshot_at()` 和 overlay 快照：

| 字段 | 类型 | 描述 |
|------|------|------|
| `digest` | string | 完整不可变选择结果的内容摘要 |
| `input_digest` | string | 已声明根集合的摘要 |
| `baseline_digest` | string | 求解该图所依据的部署基线的摘要；未绑定时省略 |
| `roots` | array | 作为求解器输入的、作者编写的依赖声明 |
| `references` | array | 被折叠到同一组件已有根中的、形如根的声明；为空时省略 |
| `modules` | array | 选定的模块 |

`roots` 和 `references` 中的条目有 `id`、`component` 和 `version`。`modules` 中的条目有 `name` 和 `version`，并在设置时附带 `version_id`、`source`、`digest`、`size_bytes` 和 `protected`。

## 版本

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- 数字 ID
print(version:string())   -- 显示字符串
local prev = version:previous()  -- 上一版本或 nil
local next = version:next()      -- 下一版本或 nil
```

## 历史

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## 变更集

构建并应用修改：

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**权限:** `changes:apply()` 需要 `registry.apply`

### 删除条目

`changes:delete()` 接受 ID 字符串、带有 `id` 字符串的表、带有 `ns` 和 `name` 字符串的表，或由上述任意形式组成的数组。数组可以嵌套，重复的 ID 会合并为单个删除操作。

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

空列表、自引用的表，以及既不是字符串也不是表的值，都会以 `errors.INVALID` 被拒绝。

### Changes 方法

| 方法 | 描述 |
|--------|-------------|
| `changes:create(entry)` | 添加创建操作 |
| `changes:update(entry)` | 添加更新操作 |
| `changes:delete(id)` | 添加删除操作 |
| `changes:ops()` | 获取待处理操作 |
| `changes:apply()` | 应用变更，返回新 Version |

## 应用版本

回滚或前进到特定版本：

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**权限:** `registry.apply_version`

## 构建差异

计算状态转换所需的操作：

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create"、"entry.update"、"entry.delete"
end
```

## Overlay

Overlay 是由一个逻辑身份拥有的、进程本地的一组 registry 条目。Overlay 条目参与普通的拓扑和 handler 转换，因此服务会像对持久条目一样为它们启动和停止，但它们从不推进 registry 历史，也从不出现在版本中。它们只存在于运行中的进程内，冷启动后为空，因此由所属的控制服务在启动时重新协调。

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**返回：** `Snapshot, error`

该快照通过常规方法暴露该所有者的 overlay 条目，并从 `snap:version()` 报告当前 registry 版本。它还会在打开的那一刻捕获 overlay 世代，这正是写入安全的依据。

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

在 overlay 快照上调用 `changes:apply()` 会写入 overlay 并返回当前 registry 版本。不会创建历史版本，因此除非同时发生了持久变更，返回的版本不会改变。

### 并发

每个 overlay 都带有一个世代计数器，每次成功应用都会递增。只有当世代仍与打开快照时捕获的一致时，`changes:apply()` 才会成功。对同一 overlay 的并发应用会以标记为可重试的 `errors.CONFLICT` 失败：重新打开该 overlay 并重建变更集。

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### 限制

- 所有者字符串为必填项，且不能为空白。
- 变更集必须非空，且不得两次指定同一条目。
- 当 ID 已存在于持久状态或任何 overlay 中时，`create` 会失败。
- `update` 和 `delete` 只能作用于该所有者创建的条目；任何其他 ID 都会以 `errors.NOT_FOUND` 失败。
- Overlay 条目不能设置 `dependency_root` 或任何其他 registry 所有的元数据。
- Overlay 条目不能使用被 registry 指令占用的类型，例如 `ns.dependency`。
- 移除仍有存续条目依赖的条目的删除操作会被拒绝。
- 依赖不能跨越 overlay 所有者边界，持久条目也不能依赖 overlay 条目。

其余的都表现为 `errors.CONFLICT` 或 `errors.INVALID`，且都不可重试：只有上面的世代不匹配可以重试。

**权限：** 打开和读取需要该所有者上的 `registry.overlay.get`，写入需要该所有者上的 `registry.overlay.apply`，以及变更集中每个条目 ID 上的 `registry.overlay.<create|update|delete>.<kind>`。

## 权限

| 权限 | 资源 | 描述 |
|------------|----------|-------------|
| `registry.get` | 条目 ID | 读取条目（也过滤 find/entries 结果） |
| `registry.apply` | - | 应用变更集 |
| `registry.apply_version` | - | 应用/回滚版本 |
| `registry.overlay.get` | 所有者 ID | 打开并读取 overlay 快照 |
| `registry.overlay.apply` | 所有者 ID | 应用 overlay 变更集 |
| `registry.overlay.create.<kind>` | 条目 ID | 创建该类型的 overlay 条目 |
| `registry.overlay.update.<kind>` | 条目 ID | 更新该类型的 overlay 条目 |
| `registry.overlay.delete.<kind>` | 条目 ID | 删除该类型的 overlay 条目 |

## 错误

| 条件 | 类型 |
|-----------|------|
| 条目未找到 | `errors.NOT_FOUND` |
| 版本未找到 | `errors.NOT_FOUND` |
| 权限被拒绝 | `errors.PERMISSION_DENIED` |
| 无效参数 | `errors.INVALID` |
| 无变更可应用 | `errors.INVALID` |
| 应用期间 overlay 发生变更 | `errors.CONFLICT`（可重试） |
| Overlay 条目归属他处或与持久状态冲突 | `errors.CONFLICT` |
| 注册表不可用 | `errors.INTERNAL` |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
