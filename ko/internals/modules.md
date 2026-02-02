# Lua 모듈

런타임 모듈은 새로운 기능으로 Lua 환경을 확장합니다. 모듈은 결정론적 유틸리티, I/O 작업, 또는 외부 시스템으로 yield하는 비동기 명령을 제공할 수 있습니다.

> Lua 런타임 구현은 향후 버전에서 변경될 수 있습니다.

## 모듈 정의

모든 모듈은 `luaapi.ModuleDef`를 사용합니다:

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "내 커스텀 모듈",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // 도구를 위한 타입 정의
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
| `ClassStorage` | 데이터 지속성 |
| `ClassWorkflow` | 워크플로우 안전 작업 |

`ClassDeterministic`만 태그된 모듈은 워크플로우 안전합니다. I/O나 네트워크 클래스를 추가하면 모듈이 함수와 프로세스로 제한됩니다.

## 함수 노출

함수는 `func(l *lua.LState) int` 시그니처를 가지며 반환 값은 스택에 푸시된 값의 수입니다:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // 필수 인자
    greeting := l.OptString(2, "Hello") // 기본값이 있는 선택적

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
mod.Immutable = true  // Lua가 내보내기를 수정하는 것 방지
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

`Types` 필드는 IDE 지원 및 문서화를 위한 타입 시그니처를 제공합니다:

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

**사용 가능한 타입 구조:**

| 타입 | 설명 |
|------|-------------|
| `types.String` | 문자열 프리미티브 |
| `types.Number` | 숫자 값 |
| `types.Boolean` | 불리언 값 |
| `types.Any` | 모든 Lua 값 |
| `types.LuaError` | 에러 타입 |
| `types.Optional(t)` | 타입 t의 선택적 값 |
| `types.InterfaceType` | 메서드가 있는 객체 |
| `types.FunctionType` | 파라미터/반환이 있는 함수 시그니처 |
| `types.RecordType` | 필드가 있는 구조체 유사 타입 |
| `types.TableType` | 키/값 타입이 있는 테이블 |

함수 시그니처는 가변 파라미터를 지원합니다:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

전체 타입 시스템은 go-lua의 `types` 패키지를 참조하세요.

### UserData 바인딩 (런타임)

`RegisterTypeMethods`는 실제 Go-to-Lua 바인딩을 생성합니다:

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // 메타메서드
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // 일반 메서드
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
    return -1  // 스택 카운트가 아닌 yield 시그널
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

디스패처는 명령을 핸들러로 라우팅합니다. 핸들러 구현은 [명령 디스패치](internals/dispatch.md)를 참조하세요.

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

    // 작업 진행
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
    mu      sync.Mutex
    pending map[string]chan *runtime.Result
}

func newTestScheduler() *testScheduler {
    ts := &testScheduler{pending: make(map[string]chan *runtime.Result)}
    reg := scheduler.NewRegistry()

    // 모듈이 사용하는 yield를 위한 디스패처 등록
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

테스트하는 모듈로 Lua 스크립트에서 프로세스를 생성합니다:

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
    // 결과에 대해 Assert
}
```

완전한 예제는 `runtime/lua/modules/time/integration_test.go`를 참조하세요.

## 참고

- [명령 디스패치](internals/dispatch.md) - yield 명령 처리
- [스케줄러](internals/scheduler.md) - 프로세스 실행
