# 通道和并发

进程内并发编程的 Go 风格通道。

## 创建通道

通道是协程的通信管道。使用 `channel.new(capacity)` 创建：

```lua
local ch = channel.new(1)  -- 缓冲通道，容量 1
```

### 缓冲通道

缓冲通道允许在缓冲区满之前不阻塞地发送：

```lua
local ch = channel.new(3)  -- 缓冲区可容纳 3 个项目

-- 不阻塞地发送
ch:send(1)
ch:send(2)
ch:send(3)

-- 按 FIFO 顺序接收
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### 无缓冲通道

无缓冲通道（容量 0）同步发送者和接收者：

```lua
local ch = channel.new(0)  -- 无缓冲
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- 阻塞直到接收者就绪
    done:send(true)
end)

local val = ch:receive()  -- 接收 "from spawn"
local completed = done:receive()
```

## Channel Select

`channel.select` 等待多个通道，返回第一个就绪的操作：

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result 是一个包含 channel, value, ok 的表
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### 带发送的 Select

使用 `case_send` 尝试非阻塞发送：

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true（发送成功）

local v = ch:receive()  -- "sent"
```

## 生产者-消费者模式

单生产者，单消费者：

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- 消费者
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- 生产者
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Ping-Pong 模式

同步两个协程：

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## 扇出模式

一个生产者，多个消费者：

```lua
local work = channel.new(10)
local results = channel.new(10)

-- 生成 3 个工作者
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- 发送工作
for i = 1, 6 do
    work:send(i)
end
work:close()

-- 收集结果
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## 扇入模式

多个生产者，单个消费者：

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- 生成生产者
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- 收集所有消息
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- 验证所有生产者都发送了其项目
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## 关闭通道

关闭通道以发出完成信号。当通道关闭且为空时，接收者得到 `ok = false`：

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- 通道已关闭
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- 发出没有更多值的信号

local total = done:receive()
```

## 通道方法

可用操作：

- `channel.new(capacity)` - 创建指定缓冲区大小的通道
- `ch:send(value)` - 发送值（缓冲区满时阻塞）
- `ch:receive()` - 接收值，返回 `value, ok`
- `ch:close()` - 关闭通道
- `ch:case_send(value)` - 为 select 创建发送 case
- `ch:case_receive()` - 为 select 创建接收 case
- `channel.select{cases...}` - 等待多个操作

## 下一步

- [通道模块参考](lua/core/channel.md) - 完整 API 文档
- [进程](tutorials/processes.md) - 进程间通信
