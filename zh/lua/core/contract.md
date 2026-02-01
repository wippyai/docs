# Contract
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

通过类型化契约调用服务。调用远程 API、工作流和函数，支持模式验证和异步执行。

## 加载

```lua
local contract = require("contract")
```

## 打开绑定

直接通过 ID 打开绑定：

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
```

带作用域上下文或查询参数：

```lua
-- 带作用域表
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- 带查询参数（自动转换："true"→bool，数字→int/float）
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `binding_id` | string | 绑定 ID，支持查询参数 |
| `scope` | table | 上下文值（可选，覆盖查询参数） |

**返回:** `Instance, error`

## 获取 Contract

获取 contract 定义用于内省：

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### 方法定义

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `name` | string | 方法名称 |
| `description` | string | 方法描述 |
| `input_schemas` | table[] | 输入模式定义 |
| `output_schemas` | table[] | 输出模式定义 |

## 查找实现

列出实现某个 contract 的所有绑定：

```lua
local bindings, err = contract.find_implementations("app.services:greeter")

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

或通过 contract 对象：

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
```

## 检查实现

检查实例是否实现某个 contract：

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## 调用方法

同步调用 - 阻塞直到完成：

```lua
local calc, err = contract.open("app.services:calculator")

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## 异步调用

添加 `_async` 后缀进行异步执行：

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- 做其他工作...

-- 等待结果
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

参见 [Future](lua/core/future.md) 了解 future 方法。

## 通过 Contract 打开

通过 contract 对象打开绑定：

```lua
local c, err = contract.get("app.services:user")

-- 默认绑定
local instance, err = c:open()

-- 特定绑定
local instance, err = c:open("app.services:user_impl")

-- 带作用域
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## 添加上下文

创建带预配置上下文的包装器：

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## 安全上下文

设置授权的 actor 和 scope：

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## 权限

| 权限 | 资源 | 函数 |
|------------|----------|-----------|
| `contract.get` | contract id | `get()` |
| `contract.open` | binding id | `open()`、`Contract:open()` |
| `contract.implementations` | contract id | `find_implementations()`、`Contract:implementations()` |
| `contract.call` | 方法名 | 同步和异步方法调用 |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`、`Contract:with_scope()` |

## 错误

| 条件 | 类型 |
|-----------|------|
| 无效绑定 ID 格式 | `errors.INVALID` |
| Contract 未找到 | `errors.NOT_FOUND` |
| 绑定未找到 | `errors.NOT_FOUND` |
| 方法未找到 | `errors.NOT_FOUND` |
| 无默认绑定 | `errors.NOT_FOUND` |
| 权限被拒绝 | `errors.PERMISSION_DENIED` |
| 调用失败 | `errors.INTERNAL` |
