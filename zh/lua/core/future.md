# Future
<secondary-label ref="function"/>
<secondary-label ref="process"/>

异步操作结果。Future 由 `funcs.async()` 和 contract 异步调用返回。

## 加载

不是可加载模块。Future 由异步操作创建：

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## 响应通道

获取用于接收结果的通道：

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` 是 `response()` 的别名。

## 完成检查

非阻塞检查 future 是否已完成：

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## 取消检查

检查是否调用了 `cancel()`：

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## 获取结果

获取缓存的结果（非阻塞）：

```lua
local val, err = future:result()
```

**返回:**
- 未完成: `nil, nil`
- 已取消: `nil, error`（类型 `CANCELED`）
- 错误: `nil, error`
- 成功: `Payload, nil` 或 `table, nil`（多个 payload）

## 获取错误

获取 future 失败时的错误：

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**返回:** `error, boolean`

## 取消

取消异步操作（尽力而为）：

```lua
future:cancel()
```

如果操作已在进行中，仍可能完成。

## 超时模式

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## 先完成优先

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- 取消较慢的那个
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## 错误

| 条件 | 类型 |
|-----------|------|
| 操作被取消 | `CANCELED` |
| 异步操作失败 | 各异 |
