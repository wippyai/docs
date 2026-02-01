# Lua Modules

运行时模块使用新功能扩展 Lua 环境。模块可以提供确定性工具、I/O 操作或 yield 到外部系统的异步命令。

> Lua 运行时实现可能在未来版本中更改。

## Module 定义

每个模块使用 `luaapi.ModuleDef`：

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // 用于工具的类型定义
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

`Build` 函数返回：
- 包含导出函数的模块表
- 异步操作的 yield 类型列表（或 nil）

模块表构建一次并缓存，供所有 Lua 状态重用。

## Module 分类

`Class` 字段决定模块可以在哪里使用：

| Class | 描述 |
|-------|-------------|
| `ClassDeterministic` | 相同输入总是产生相同输出 |
| `ClassNondeterministic` | 输出变化（时间、随机） |
| `ClassIO` | 外部 I/O 操作 |
| `ClassNetwork` | 网络操作 |
| `ClassStorage` | 数据持久化 |
| `ClassWorkflow` | workflow 安全操作 |

仅标记 `ClassDeterministic` 的模块是 workflow 安全的。添加 I/O 或网络类会将模块限制为 function 和 process。

## 暴露函数

函数签名为 `func(l *lua.LState) int`，返回值是推入栈的值的数量：

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // 必需参数
    greeting := l.OptString(2, "Hello") // 带默认值的可选参数

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| 方法 | 描述 |
|--------|-------------|
| `l.CheckString(n)` | 位置 n 的必需 string |
| `l.CheckInt(n)` | 必需 integer |
| `l.CheckNumber(n)` | 必需 number |
| `l.CheckTable(n)` | 必需 table |
| `l.OptString(n, def)` | 带默认值的可选 string |
| `l.OptInt(n, def)` | 带默认值的可选 int |

## Table

在 Go 和 Lua 之间传递的 table 默认是可变的。模块导出表应标记为不可变：

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // 防止 Lua 修改导出
```

数据 table 保持可变以供正常使用：

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## 类型系统

模块使用两个独立但互补的类型机制。

### 类型定义（工具）

`Types` 字段为 IDE 支持和文档提供类型签名：

```go
func ModuleTypes() *types.TypeManifest {
    m := types.NewManifest("mymodule")

    objectType := &types.InterfaceType{
        Name: "mymodule.Object",
        Methods: map[string]*types.FunctionType{
            "get_value": types.NewFunction(nil, []types.Type{types.String}),
            "set_value": types.NewFunction([]types.Type{types.String}, nil),
        },
    }

    m.DefineType("Object", objectType)
    m.SetExport(moduleType)
    return m
}
```

**可用的类型构造：**

| 类型 | 描述 |
|------|-------------|
| `types.String` | String 原语 |
| `types.Number` | 数值 |
| `types.Boolean` | 布尔值 |
| `types.Any` | 任意 Lua 值 |
| `types.LuaError` | 错误类型 |
| `types.Optional(t)` | 类型 t 的可选值 |
| `types.InterfaceType` | 带方法的对象 |
| `types.FunctionType` | 带参数/返回值的函数签名 |
| `types.RecordType` | 带字段的类结构体类型 |
| `types.TableType` | 带键/值类型的 table |

函数签名支持可变参数：

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

完整类型系统请参见 go-lua 中的 `types` 包。

### UserData 绑定（运行时）

`RegisterTypeMethods` 创建实际的 Go 到 Lua 绑定：

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // 元方法
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // 常规方法
            "set_value": objectSetValue,
        },
    )
}
```

元表是不可变的并全局缓存以供线程安全重用。

| 系统 | 用途 | 定义 |
|--------|---------|---------|
| 类型定义 | IDE、文档、类型检查 | 签名 |
| UserData 绑定 | 运行时方法调用 | 可执行函数 |

## 异步操作

对于等待外部系统的操作，返回 yield 而不是结果。Yield 被分发到 Go handler，handler 完成时进程恢复。

### 定义 Yield

在模块的 `Build` 函数中声明 yield 类型：

```go
Build: func() (*lua.LTable, []luaapi.YieldType) {
    mod := lua.CreateTable(0, 1)
    mod.RawSetString("fetch", lua.LGoFunc(fetchFunc))
    mod.Immutable = true

    yields := []luaapi.YieldType{
        {Sample: &FetchYield{}, CmdID: myapi.FetchCommand},
    }

    return mod, yields
}
```

### 创建 Yield

返回 -1 以信号 yield 而不是正常返回值：

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // 信号 yield，不是栈计数
}
```

### Yield 实现

Yield 桥接 Lua 值和 dispatcher 命令：

```go
type FetchYield struct {
    *myapi.FetchCmd
}

func (y *FetchYield) String() string              { return "<fetch_yield>" }
func (y *FetchYield) Type() lua.LValueType        { return lua.LTUserData }
func (y *FetchYield) CmdID() dispatcher.CommandID { return myapi.FetchCommand }
func (y *FetchYield) ToCommand() dispatcher.Command { return y.FetchCmd }
func (y *FetchYield) Release() { releaseFetchYield(y) }

func (y *FetchYield) HandleResult(l *lua.LState, data any, err error) []lua.LValue {
    if err != nil {
        return []lua.LValue{lua.LNil, lua.NewLuaError(l, err.Error())}
    }
    resp := data.(*myapi.FetchResponse)
    return []lua.LValue{lua.LString(resp.Body), lua.LNil}
}
```

Dispatcher 将命令路由到 handler。实现 handler 请参见 [Command Dispatch](internals/dispatch.md)。

## 错误处理

使用结构化错误将错误作为第二个值返回：

```go
func myFunc(l *lua.LState) int {
    result, err := doSomething()
    if err != nil {
        lerr := lua.NewLuaError(l, err.Error()).
            WithKind(lua.Internal).
            WithRetryable(true)
        l.Push(lua.LNil)
        l.Push(lerr)
        return 2
    }

    l.Push(lua.LString(result))
    l.Push(lua.LNil)
    return 2
}
```

## 安全

在执行敏感操作前检查权限：

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // 继续操作
}
```

## 测试

基本模块测试验证结构和同步函数：

```go
func TestModule(t *testing.T) {
    l := lua.NewState()
    defer l.Close()

    mod, _ := Module.Build()
    l.SetGlobal("mymodule", mod)

    err := l.DoString(`
        local m = mymodule
        assert(m.hello() == "Hello, World!")
    `)
    if err != nil {
        t.Fatal(err)
    }
}
```

### 测试带 Yield 的模块

要测试使用 yield 函数的 Lua 代码，创建一个带必需 dispatcher 的最小 scheduler：

```go
type testScheduler struct {
    *actor.Scheduler
    clock   *clock.Dispatcher
    mu      sync.Mutex
    pending map[string]chan *runtime.Result
}

func newTestScheduler() *testScheduler {
    ts := &testScheduler{pending: make(map[string]chan *runtime.Result)}
    reg := scheduler.NewRegistry()

    // 为模块使用的 yield 注册 dispatcher
    clockSvc := clock.NewDispatcher()
    clockSvc.RegisterAll(func(id dispatcher.CommandID, h dispatcher.Handler) {
        reg.Register(id, h)
    })
    ts.clock = clockSvc

    ts.Scheduler = actor.NewScheduler(reg, actor.WithWorkers(4), actor.WithLifecycle(ts))
    return ts
}

func (ts *testScheduler) OnComplete(_ context.Context, p pid.PID, result *runtime.Result) {
    ts.mu.Lock()
    ch, ok := ts.pending[p.UniqID]
    delete(ts.pending, p.UniqID)
    ts.mu.Unlock()
    if ok {
        ch <- result
    }
}

func (ts *testScheduler) Execute(ctx context.Context, p pid.PID, proc process.Process,
    method string, input payload.Payloads) (*runtime.Result, error) {
    resultCh := make(chan *runtime.Result, 1)
    ts.mu.Lock()
    ts.pending[p.UniqID] = resultCh
    ts.mu.Unlock()

    _, err := ts.Scheduler.Submit(ctx, p, proc, method, input)
    if err != nil {
        return nil, err
    }

    select {
    case result := <-resultCh:
        return result, nil
    case <-ctx.Done():
        return nil, ctx.Err()
    }
}
```

使用要测试的模块从 Lua 脚本创建进程：

```go
func bindMyModule(l *lua.LState) {
    tbl, _ := mymodule.Module.Build()
    l.SetGlobal(mymodule.Module.Name, tbl)
}

func newLuaProcess(script string) *engine.Process {
    proto, _ := lua.CompileString(script, "test.lua")
    return engine.NewProcess(
        engine.WithProto(proto),
        engine.WithModuleBinder(bindMyModule),
    )
}

func TestMyModuleYields(t *testing.T) {
    sched := newTestScheduler()
    sched.Start()
    defer sched.Stop()

    script := `
        local result = mymodule.fetch("http://example.com")
        return result.status
    `

    ctx, _ := ctxapi.OpenFrameContext(context.Background())
    proc := newLuaProcess(script)

    result, err := sched.Execute(ctx, pid.PID{UniqID: "test"}, proc, "", nil)
    if err != nil {
        t.Fatal(err)
    }
    // 断言结果
}
```

完整示例请参见 `runtime/lua/modules/time/integration_test.go`。

## 另请参阅

- [Command Dispatch](internals/dispatch.md) - 处理 yield 命令
- [Scheduler](internals/scheduler.md) - 进程执行
