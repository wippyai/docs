---
title: "Lua 모듈"
description: "동기 함수, userdata, yield, 오류, 보안 검사, 테스트를 포함하는 typed Lua 런타임 모듈을 정의합니다."
---

# Lua 모듈

런타임 모듈은 Lua 환경에 결정론적 유틸리티, I/O 작업, 비동기 명령을 추가합니다.

이 페이지는 Go extension 레퍼런스입니다. 코드 조각은 부분적인 package 수준 예제이며, 각 섹션에서 이름으로 참조하는 import, command API, dispatcher, security resource, test fixture가 있다고 가정합니다.

## 모듈 정의

모든 모듈은 `luaapi.ModuleDef`를 사용합니다:

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

`Build` 함수는 반환합니다:
- 내보낸 함수가 있는 모듈 테이블
- 비동기 작업을 위한 yield 타입 목록 (또는 nil)

모듈 테이블은 한 번 빌드되고 모든 Lua 상태에서 재사용을 위해 캐시됩니다.

## 모듈 분류

`Class` 필드는 모듈을 사용할 수 있는 위치를 결정합니다:

| 클래스 | 설명 |
|-------|-------------|
| `ClassDeterministic` | 같은 입력은 항상 같은 출력 생성 |
| `ClassNondeterministic` | 출력이 다름 (시간, 랜덤) |
| `ClassIO` | 외부 I/O 작업 |
| `ClassNetwork` | 네트워크 작업 |
| `ClassEncoding` | 인코딩 및 디코딩 작업 |
| `ClassTime` | 시간 관련 작업 |
| `ClassProcess` | 프로세스 관련 작업 |
| `ClassSecurity` | 보안 관련 작업 |
| `ClassStorage` | 데이터 지속성 |
| `ClassWorkflow` | 워크플로우 안전 작업 |

워크플로우 compile은 `ClassDeterministic` 또는 `ClassWorkflow` 중 하나 이상을 가진 모듈을 허용합니다. class filtering은 포함 방식이므로 module class 중 하나라도 허용되면 통과합니다.

## 함수 노출

함수는 `func(l *lua.LState) int` 시그니처를 가지며 반환 값은 스택에 푸시된 값의 수입니다:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Required argument
    greeting := l.OptString(2, "Hello") // Optional with default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| 메서드 | 설명 |
|--------|-------------|
| `l.CheckString(n)` | 위치 n의 필수 문자열 |
| `l.CheckInt(n)` | 필수 정수 |
| `l.CheckNumber(n)` | 필수 숫자 |
| `l.CheckTable(n)` | 필수 테이블 |
| `l.OptString(n, def)` | 기본값이 있는 선택적 문자열 |
| `l.OptInt(n, def)` | 기본값이 있는 선택적 정수 |

## 테이블

Go와 Lua 사이에 전달되는 테이블은 기본적으로 가변입니다. 모듈 내보내기 테이블은 불변으로 표시해야 합니다:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevent Lua from modifying exports
```

데이터 테이블은 일반 사용을 위해 가변으로 유지됩니다:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## 타입 시스템

모듈은 두 개의 별도이지만 상호 보완적인 타이핑 메커니즘을 사용합니다.

### 타입 정의 (도구)

`Types` 필드는 IDE 지원 및 문서화를 위한 type signature를 제공합니다. type은 `typ` package의 fluent builder로 만듭니다.

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

**사용 가능한 타입 구조:**

| 타입 | 설명 |
|------|-------------|
| `typ.String` | 문자열 원시 타입 |
| `typ.Number` | 숫자 값 |
| `typ.Integer` | 정수 값 |
| `typ.Boolean` | 불리언 값 |
| `typ.Any` | 모든 Lua 값 |
| `typ.Self` | 메서드 수신자 타입 |
| `typ.LuaError` | 오류 타입 |
| `typ.NewOptional(t)` | 타입 t의 선택적 값 |
| `typ.NewInterface(name, methods)` | 메서드가 있는 객체 |
| `typ.Func()` | 함수 시그니처 빌더 |
| `typ.NewRecord()` | `.Field`/`.OptField`를 사용하는 구조체 형태의 타입 빌더 |
| `typ.NewArray(t)` | 요소 타입 t의 배열 |
| `typ.NewMap(k, v)` | 키/값 타입을 가진 맵 |

함수 builder는 `Param`, `OptParam`, `Variadic`, `Returns`를 chain합니다.

```go
// (string, ...any) -> (string, error?)
typ.Func().
    Param("first", typ.String).
    Variadic(typ.Any).
    Returns(typ.String, typ.NewOptional(typ.LuaError)).
    Build()
```

record는 `Field`로 필수 필드, `OptField`로 선택적 필드를 선언합니다.

```go
typ.NewRecord().
    Field("key", typ.String).
    Field("value", typ.Any).
    OptField("ttl", typ.Number).
    Build()
```

추가 builder와 type 정의는 go-lua의 `typ` package를 참고하세요.

### UserData 바인딩 (런타임)

`RegisterTypeMethods`는 실제 Go-to-Lua 바인딩을 생성합니다:

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

메타테이블은 불변이고 스레드 안전 재사용을 위해 전역적으로 캐시됩니다.

| 시스템 | 목적 | 정의 |
|--------|---------|---------|
| 타입 정의 | IDE, 문서, 타입 검사 | 시그니처 |
| UserData 바인딩 | 런타임 메서드 호출 | 실행 가능한 함수 |

## 비동기 작업

외부 시스템을 기다리는 작업의 경우 결과 대신 yield를 반환합니다. yield는 Go 핸들러로 디스패치되고 핸들러가 완료되면 프로세스가 재개됩니다.

### Yield 정의

모듈의 `Build` 함수에서 yield 타입을 선언합니다:

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

### Yield 생성

일반 반환 값 대신 yield를 시그널하려면 -1을 반환합니다:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Signal yield, not stack count
}
```

### Yield 구현

Yield는 Lua 값과 디스패처 명령을 브릿지합니다:

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

dispatcher는 command를 handler로 라우팅합니다. handler 구현은 [명령 디스패치](./dispatch.md)를 참고하세요.

## 에러 처리

구조화된 에러를 사용하여 두 번째 값으로 에러를 반환합니다:

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

## 보안

민감한 작업을 수행하기 전에 권한을 확인합니다:

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

## 테스팅

기본 모듈 테스트는 구조와 동기 함수를 검증합니다:

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

### Yield가 있는 모듈 테스팅

yield 함수를 사용하는 Lua 코드를 테스트하려면 필요한 디스패처가 있는 최소 스케줄러를 생성합니다:

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

script가 사용하는 module로 process를 만드세요. 이 예제는 위에서 등록한 clock dispatcher가 실제 yield를 처리하도록 time module을 사용합니다.

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

통합 테스트 예제는 `runtime/lua/modules/time/integration_test.go`를 참고하세요.

## 참고

- [명령 디스패치](./dispatch.md) - yield 명령 처리
- [스케줄러](./scheduler.md) - 프로세스 실행
