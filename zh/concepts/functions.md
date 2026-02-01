# 函数

函数是同步、无状态的入口点。你调用它们，它们执行，它们返回结果。当函数运行时，它继承调用者的上下文——如果调用者取消，函数也会取消。这使函数成为 HTTP 处理器、API 端点以及任何应在请求生命周期内完成的操作的理想选择。

## 调用函数

使用 `funcs.call()` 同步调用函数：

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

对于非阻塞执行，使用 `funcs.async()`：

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

参见 [funcs 模块](lua/core/funcs.md) 了解完整 API。

## 上下文传播

每次调用创建一个具有自己上下文作用域的帧。子函数无需显式传递即可继承父上下文：

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

在调用时添加上下文：

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

安全上下文以相同方式传播。被调用的函数可以看到调用者的 Actor 并可以检查权限。参见 [security 模块](lua/security/security.md) 了解访问控制 API。

## 注册表定义

在注册表级别，函数记录看起来像这样：

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

函数可以被其他运行时组件调用——HTTP 处理器、队列消费者、计划任务——并根据调用者的安全上下文进行权限检查。

## 池

函数在管理执行的池上运行。池类型决定扩展行为。

**Inline** 在调用者的 goroutine 中运行。无并发，零分配开销。用于嵌入式上下文。

**Static** 维护固定数量的工作线程。当所有工作线程忙碌时请求排队。可预测的资源使用。

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** 从空开始，按需创建工作线程。空闲工作线程在超时后销毁。对于可变流量很高效。

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** 根据吞吐量自动扩展。控制器测量性能并调整工作线程数量以优化当前负载。

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
如果不指定池类型，运行时会根据你的配置选择一个。设置 <code>workers</code> 使用 static，<code>max_size</code> 使用 lazy，或显式设置 <code>type</code> 以完全控制。
</tip>

## 拦截器

函数调用通过拦截器链。拦截器处理横切关注点而不触及业务逻辑。

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

内置拦截器包括带指数退避的重试。你可以添加自定义拦截器用于日志记录、指标、追踪、授权、熔断或请求转换。

链在每次调用前后运行。每个拦截器可以修改请求、短路执行或包装响应。

## 契约

函数可以将其输入/输出模式公开为契约。契约定义方法签名，支持运行时验证和文档生成。

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

这种抽象让你可以在不更改调用代码的情况下替换实现——对于测试、多租户部署或渐进迁移很有用。

## 函数 vs 进程

函数继承调用者上下文并绑定到调用者生命周期。当调用者取消时，函数取消。这支持边缘执行——直接在 HTTP 处理器和队列消费者中运行。

进程独立运行，具有宿主上下文。它们比创建者存活更久，通过消息通信。将进程用于后台工作；将函数用于请求作用域的操作。
