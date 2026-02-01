# 错误处理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

带分类和重试元数据的结构化错误处理。全局 `errors` 表无需 require 即可使用。

## 创建错误

```lua
-- 简单消息（类型默认为 UNKNOWN）
local err = errors.new("something went wrong")

-- 指定类型
local err = errors.new(errors.NOT_FOUND, "user not found")

-- 完整构造函数
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## 包装错误

添加上下文同时保留类型、可重试性和详情：

```lua
local data, err = db.query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## 错误方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `err:kind()` | string | 错误类别 |
| `err:message()` | string | 错误消息 |
| `err:retryable()` | boolean/nil | 操作是否可重试 |
| `err:details()` | table/nil | 结构化元数据 |
| `err:stack()` | string | Lua 堆栈跟踪 |
| `tostring(err)` | string | 完整表示 |

## 检查类型

```lua
if errors.is(err, errors.INVALID) then
    -- 处理无效输入
end

-- 或直接比较
if err:kind() == errors.NOT_FOUND then
    -- 处理资源缺失
end
```

## 错误类型

| 常量 | 使用场景 |
|----------|----------|
| `errors.NOT_FOUND` | 资源不存在 |
| `errors.ALREADY_EXISTS` | 资源已存在 |
| `errors.INVALID` | 错误的输入或参数 |
| `errors.PERMISSION_DENIED` | 访问被拒绝 |
| `errors.UNAVAILABLE` | 服务暂时不可用 |
| `errors.INTERNAL` | 内部错误 |
| `errors.CANCELED` | 操作已取消 |
| `errors.CONFLICT` | 资源状态冲突 |
| `errors.TIMEOUT` | 操作超时 |
| `errors.RATE_LIMITED` | 请求过多 |
| `errors.UNKNOWN` | 未指定错误 |

## 调用栈

获取结构化调用栈：

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## 可重试错误

| 通常可重试 | 不可重试 |
|---------------------|---------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- 可以安全重试
end
```

## 错误详情

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
