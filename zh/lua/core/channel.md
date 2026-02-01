# 通道与协程
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Go 风格的通道用于协程间通信。创建有缓冲或无缓冲通道，发送和接收值，使用 select 语句协调并发进程。

`channel` 全局变量始终可用。

## 创建通道

无缓冲通道（大小为 0）要求发送方和接收方都准备好后才能完成传输。有缓冲通道允许在有空间时立即完成发送：

```lua
-- 无缓冲：同步发送方和接收方
local sync_ch = channel.new()

-- 有缓冲：最多排队 10 条消息
local work_queue = channel.new(10)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `size` | integer | 缓冲容量（默认：0 表示无缓冲） |

**返回:** `channel`

## 发送值

向通道发送值。阻塞直到接收方准备好（无缓冲）或有缓冲空间（有缓冲）：

```lua
-- 向工作池发送工作
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- 缓冲满时阻塞
end
jobs:close()  -- 表示没有更多工作
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `value` | any | 要发送的值 |

**返回:** `boolean`

通道关闭时抛出错误。

## 接收值

从通道接收值。阻塞直到有值可用或通道关闭：

```lua
-- 工作者从任务队列消费
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- 通道已关闭，没有更多工作
    end
    process(job)
end
```

**返回:** `any, boolean`

- `value, true` - 接收到值
- `nil, false` - 通道已关闭且为空

## 关闭通道

关闭通道。等待中的发送方收到错误，等待中的接收方收到 `nil, false`。已关闭时抛出错误：

```lua
local results = channel.new(10)

-- 生产者填充结果
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- 表示完成
```

## 从多个通道选择

同时等待多个通道操作。对于处理多个事件源、实现超时和构建响应式系统至关重要：

```lua
local result = channel.select(cases)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `cases` | table | select case 数组 |
| `default` | boolean | 若为 true，无 case 就绪时立即返回 |

**返回:** 包含字段的 `table`：`channel`、`value`、`ok`、`default`

### 超时模式

使用 `time.after()` 等待结果并设置超时。

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### 扇入模式

将多个源合并到一个处理器。

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### 非阻塞检查

检查数据是否可用而不阻塞。

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- 没有可用数据，做其他事情
else
    process(r.value)
end
```

## 创建 Select Case

创建用于 `channel.select` 的 case：

```lua
-- 发送 case - 通道可接受值时完成
ch:case_send(value)

-- 接收 case - 值可用时完成
ch:case_receive()
```

## 工作池模式

```lua
local work = channel.new(100)
local results = channel.new(100)

-- 启动工作者
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- 分发工作
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- 收集结果
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 向已关闭通道发送 | 运行时错误 | 否 |
| 关闭已关闭通道 | 运行时错误 | 否 |
| select 中无效 case | 运行时错误 | 否 |

## 参见

- [进程管理](lua/core/process.md) - 进程启动和通信
- [消息队列](lua/storage/queue.md) - 基于队列的消息传递
- [函数调用](lua/core/funcs.md) - 函数调用
