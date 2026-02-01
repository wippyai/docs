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

## 获取条目

```lua
local entry, err = registry.get("app.lib:assert")
```

**权限:** 条目 ID 上的 `registry.get`

## 查找条目

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
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
| `snap:get(id)` | `Entry, error` | 按 ID 获取单个条目 |
| `snap:find(filter)` | `Entry[]` | 过滤条目 |
| `snap:namespace(ns)` | `Entry[]` | 命名空间中的条目 |
| `snap:version()` | `Version` | 快照版本 |
| `snap:changes()` | `Changes` | 创建变更集 |

## 版本

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- 数字 ID
print(version:string())   -- 显示字符串
local prev = version:previous()  -- 上一版本或 nil
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

### Changes 方法

| 方法 | 描述 |
|--------|-------------|
| `changes:create(entry)` | 添加创建操作 |
| `changes:update(entry)` | 添加更新操作 |
| `changes:delete(id)` | 添加删除操作（字符串或 `{ns, name}`） |
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

## 权限

| 权限 | 资源 | 描述 |
|------------|----------|-------------|
| `registry.get` | 条目 ID | 读取条目（也过滤 find/entries 结果） |
| `registry.apply` | - | 应用变更集 |
| `registry.apply_version` | - | 应用/回滚版本 |

## 错误

| 条件 | 类型 |
|-----------|------|
| 条目未找到 | `errors.NOT_FOUND` |
| 版本未找到 | `errors.NOT_FOUND` |
| 权限被拒绝 | `errors.PERMISSION_DENIED` |
| 无效参数 | `errors.INVALID` |
| 无变更可应用 | `errors.INVALID` |
| 注册表不可用 | `errors.INTERNAL` |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
