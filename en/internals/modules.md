# Lua Modules

Runtime modules extend the Lua environment with new functionality. Modules can provide deterministic utilities, I/O operations, or async commands that yield to external systems.

> The Lua runtime implementation may change in future versions.

## Module Definition

Every module uses `luaapi.ModuleDef`:

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // Type definitions for tooling
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

The `Build` function returns:
- Module table with exported functions
- List of yield types for async operations (or nil)

Module tables are built once and cached for reuse across all Lua states.

## Module Classification

The `Class` field determines where the module can be used:

| Class | Description |
|-------|-------------|
| `ClassDeterministic` | Same input always produces same output |
| `ClassNondeterministic` | Output varies (time, random) |
| `ClassIO` | External I/O operations |
| `ClassNetwork` | Network operations |
| `ClassStorage` | Data persistence |
| `ClassWorkflow` | Workflow-safe operations |

Modules tagged only with `ClassDeterministic` are workflow-safe. Adding I/O or network classes restricts the module to functions and processes.

## Exposing Functions

Functions have signature `func(l *lua.LState) int` where the return value is the number of values pushed onto the stack:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Required argument
    greeting := l.OptString(2, "Hello") // Optional with default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Method | Description |
|--------|-------------|
| `l.CheckString(n)` | Required string at position n |
| `l.CheckInt(n)` | Required integer |
| `l.CheckNumber(n)` | Required number |
| `l.CheckTable(n)` | Required table |
| `l.OptString(n, def)` | Optional string with default |
| `l.OptInt(n, def)` | Optional int with default |

## Tables

Tables passed between Go and Lua are mutable by default. Module export tables should be marked immutable:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevent Lua from modifying exports
```

Data tables remain mutable for normal use:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Type System

Modules use two separate but complementary typing mechanisms.

### Type Definitions (Tooling)

The `Types` field provides type signatures for IDE support and documentation:

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

**Available type constructs:**

| Type | Description |
|------|-------------|
| `types.String` | String primitive |
| `types.Number` | Numeric value |
| `types.Boolean` | Boolean value |
| `types.Any` | Any Lua value |
| `types.LuaError` | Error type |
| `types.Optional(t)` | Optional value of type t |
| `types.InterfaceType` | Object with methods |
| `types.FunctionType` | Function signature with params/returns |
| `types.RecordType` | Struct-like type with fields |
| `types.TableType` | Table with key/value types |

Function signatures support variadic parameters:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

See the `types` package in go-lua for the complete type system.

### UserData Bindings (Runtime)

`RegisterTypeMethods` creates the actual Go-to-Lua bindings:

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // Metamethods
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // Regular methods
            "set_value": objectSetValue,
        },
    )
}
```

Metatables are immutable and cached globally for thread-safe reuse.

| System | Purpose | Defines |
|--------|---------|---------|
| Type Definitions | IDE, docs, type checking | Signatures |
| UserData Bindings | Runtime method calls | Executable functions |

## Async Operations

For operations that wait on external systems, return a yield instead of a result. The yield is dispatched to a Go handler and the process resumes when the handler completes.

### Defining Yields

Declare yield types in the module's `Build` function:

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

### Creating a Yield

Return -1 to signal a yield instead of normal return values:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Signal yield, not stack count
}
```

### Yield Implementation

Yields bridge Lua values and dispatcher commands:

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

The dispatcher routes the command to a handler. See [Command Dispatch](internal-dispatch.md) for implementing handlers.

## Error Handling

Return errors as the second value using structured errors:

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

## Security

Check permissions before performing sensitive operations:

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // Proceed with operation
}
```

## Testing

Basic module tests verify structure and synchronous functions:

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

### Testing Modules with Yields

To test Lua code that uses yielding functions, create a minimal scheduler with the required dispatchers:

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

    // Register dispatchers for yields your module uses
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

Create processes from Lua scripts with the modules you're testing:

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
    // Assert on result
}
```

See `runtime/lua/modules/time/integration_test.go` for a complete example.

## See Also

- [Command Dispatch](internal-dispatch.md) - Handling yield commands
- [Scheduler](internal-scheduler.md) - Process execution
