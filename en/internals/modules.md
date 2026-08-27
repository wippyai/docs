---
title: "Lua Modules"
description: "Define typed Lua runtime modules with synchronous functions, userdata, yields, errors, security checks, and tests."
---

# Lua Modules

Runtime modules add deterministic utilities, I/O operations, or asynchronous commands to the Lua environment.

This page is a Go extension reference. Its snippets are partial package-level examples and assume the imports, command API, dispatcher, security resources, and test fixtures named in each section.

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
| `ClassEncoding` | Encoding and decoding operations |
| `ClassTime` | Time-related operations |
| `ClassProcess` | Process-related operations |
| `ClassSecurity` | Security-related operations |
| `ClassStorage` | Data persistence |
| `ClassWorkflow` | Workflow-safe operations |

Workflow compilation allows modules carrying at least one of `ClassDeterministic` or `ClassWorkflow`. Class filtering is inclusive: a module passes when any of its classes is allowed.

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

The `Types` field provides type signatures for IDE support and documentation. Types are built with the `typ` package's fluent builders:

```go
import (
    "github.com/wippyai/go-lua/types/io"
    "github.com/wippyai/go-lua/types/typ"
)

func ModuleTypes() *io.Manifest {
    m := io.NewManifest("mymodule")

    objectType := typ.NewInterface("mymodule.Object", []typ.Method{
        {Name: "get_value", Type: typ.Func().Param("self", typ.Self).
            Returns(typ.String, typ.NewOptional(typ.LuaError)).Build()},
        {Name: "set_value", Type: typ.Func().Param("self", typ.Self).
            Param("value", typ.String).Returns(typ.NewOptional(typ.LuaError)).Build()},
    })

    m.DefineType("Object", objectType)
    m.SetExport(objectType)
    return m
}
```

**Available type constructs:**

| Type | Description |
|------|-------------|
| `typ.String` | String primitive |
| `typ.Number` | Numeric value |
| `typ.Integer` | Integer value |
| `typ.Boolean` | Boolean value |
| `typ.Any` | Any Lua value |
| `typ.Self` | Receiver type for methods |
| `typ.LuaError` | Error type |
| `typ.NewOptional(t)` | Optional value of type t |
| `typ.NewInterface(name, methods)` | Object with methods |
| `typ.Func()` | Function signature builder |
| `typ.NewRecord()` | Struct-like type builder (fields via `.Field`/`.OptField`) |
| `typ.NewArray(t)` | Array of element type t |
| `typ.NewMap(k, v)` | Map with key/value types |

Function builders chain `Param`, `OptParam`, `Variadic`, and `Returns`:

```go
// (string, ...any) -> (string, error?)
typ.Func().
    Param("first", typ.String).
    Variadic(typ.Any).
    Returns(typ.String, typ.NewOptional(typ.LuaError)).
    Build()
```

Records declare fields with `Field` (required) and `OptField` (optional):

```go
typ.NewRecord().
    Field("key", typ.String).
    Field("value", typ.Any).
    OptField("ttl", typ.Number).
    Build()
```

See the `typ` package in go-lua for additional builders and type definitions.

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

The dispatcher routes the command to a handler. See [Command Dispatch](./dispatch.md) for implementing handlers.

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
    node    *sysrelay.Node
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

    // Clock events return through the relay to the process host named by PID.Host.
    ts.node = sysrelay.NewNode("module-test-node")
    if err := ts.node.RegisterHost("module.test", ts.Scheduler); err != nil {
        panic(err)
    }
    return ts
}

// Stop wraps Scheduler.Stop, which requires a context.
func (ts *testScheduler) Stop() {
    ts.Scheduler.Stop(context.Background())
    _ = ts.clock.Stop(context.Background())
}

// OnStart satisfies process.Lifecycle alongside OnComplete.
func (ts *testScheduler) OnStart(context.Context, pid.PID, process.Process) error { return nil }

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

    // relay.WithNode requires an application context. Preserve the caller's
    // frame context while attaching the relay used by the clock dispatcher.
    if ctxapi.AppFromContext(ctx) == nil {
        ctx = ctxapi.WithAppContext(ctx, ctxapi.NewAppContext())
    }
    ctx = relayapi.WithNode(ctx, ts.node)

    _, err := ts.Scheduler.Submit(ctx, p, proc, method, input)
    if err != nil {
        ts.mu.Lock()
        delete(ts.pending, p.UniqID)
        ts.mu.Unlock()
        return nil, err
    }

    select {
    case result := <-resultCh:
        return result, nil
    case <-ctx.Done():
        ts.mu.Lock()
        delete(ts.pending, p.UniqID)
        ts.mu.Unlock()
        return nil, ctx.Err()
    }
}

func testPID() pid.PID {
    return pid.PID{Host: "module.test", UniqID: "test"}.Precomputed()
}
```

Create a process with the module used by the script. This example uses the time module so the clock dispatcher registered above handles a real yield:

```go
func bindTimeModule(l *lua.LState) error {
    tbl, _ := timemod.Module.Build()
    l.SetGlobal(timemod.Module.Name, tbl)
    return nil
}

func newLuaProcessWithChannels(script string) (*engine.Process, error) {
    proto, err := lua.CompileString(script, "test.lua")
    if err != nil {
        return nil, err
    }
    proc, err := engine.NewProcess(
        engine.WithProto(proto),
        engine.WithModuleBinder(func(l *lua.LState) error {
            engine.LoadModuleDef(l, engine.ChannelModule)
            return nil
        }),
        engine.WithModuleBinder(bindTimeModule),
    )
    if err != nil {
        return nil, err
    }
    return proc, nil
}

func TestYieldDispatcher(t *testing.T) {
    sched := newTestScheduler()
    sched.Start()
    defer sched.Stop()

    script := `
        local ticker, ticker_err = time.ticker(10 * time.MILLISECOND)
        if ticker_err then error(ticker_err) end

        local _, open = ticker:response():receive()
        local stopped = ticker:stop()
        if not stopped then error("ticker did not stop") end
        if not open then error("ticker channel closed before the first tick") end
        return "tick"
    `

    ctx, _ := ctxapi.OpenFrameContext(context.Background())
    if err := runtime.SetFramePID(ctx, testPID()); err != nil {
        t.Fatal(err)
    }

    proc, err := newLuaProcessWithChannels(script)
    if err != nil {
        t.Fatal(err)
    }

    started := time.Now()
    result, err := sched.Execute(ctx, testPID(), proc, "", nil)
    if err != nil {
        t.Fatal(err)
    }
    if result == nil {
        t.Fatal("nil result")
    }
    if result.Error != nil {
        t.Fatalf("script failed: %v", result.Error)
    }
    if elapsed := time.Since(started); elapsed < 5*time.Millisecond {
        t.Fatalf("yield completed before the clock fired: %v", elapsed)
    }
}
```

See `runtime/lua/modules/time/integration_test.go` for an integration-test example.

## See Also

- [Command Dispatch](./dispatch.md) - Handling yield commands
- [Scheduler](./scheduler.md) - Process execution
