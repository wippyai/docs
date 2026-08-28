---
title: "Módulos Lua"
description: "Defina módulos tipados do runtime Lua com funções síncronas, userdata, yields, erros, verificações de segurança e testes."
---

# Módulos Lua

Módulos do runtime adicionam utilitários determinísticos, operações de I/O ou comandos assíncronos ao ambiente Lua.

Esta página é uma referência de extensão em Go. Seus exemplos são fragmentos parciais no nível de pacote e pressupõem os imports, a API de comandos, o dispatcher, os recursos de segurança e as fixtures de teste nomeados em cada seção.

## Definição de Módulo

Todo módulo usa `luaapi.ModuleDef`:

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

A função `Build` retorna:
- Tabela do módulo com funções exportadas
- Lista de tipos de yield para operações assíncronas (ou nil)

Tabelas de módulo são construídas uma vez e cacheadas para reuso em todos os estados Lua.

## Classificação de Módulo

O campo `Class` determina onde o módulo pode ser usado:

| Classe | Descrição |
|--------|-----------|
| `ClassDeterministic` | Mesma entrada sempre produz mesma saída |
| `ClassNondeterministic` | Saída varia (tempo, aleatório) |
| `ClassIO` | Operações de I/O externas |
| `ClassNetwork` | Operações de rede |
| `ClassEncoding` | Operações de codificação e decodificação |
| `ClassTime` | Operações relacionadas a tempo |
| `ClassProcess` | Operações relacionadas a processos |
| `ClassSecurity` | Operações relacionadas a segurança |
| `ClassStorage` | Persistência de dados |
| `ClassWorkflow` | Operações seguras para workflow |

A compilação de workflows permite módulos que tenham pelo menos uma das classes `ClassDeterministic` ou `ClassWorkflow`. O filtro de classes é inclusivo: um módulo é aceito quando qualquer uma de suas classes é permitida.

## Expondo Funções

Funções tem assinatura `func(l *lua.LState) int` onde o valor de retorno é o número de valores empurrados na stack:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Required argument
    greeting := l.OptString(2, "Hello") // Optional with default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Método | Descrição |
|--------|-----------|
| `l.CheckString(n)` | String obrigatória na posição n |
| `l.CheckInt(n)` | Inteiro obrigatório |
| `l.CheckNumber(n)` | Número obrigatório |
| `l.CheckTable(n)` | Tabela obrigatória |
| `l.OptString(n, def)` | String opcional com padrão |
| `l.OptInt(n, def)` | Int opcional com padrão |

## Tabelas

Tabelas passadas entre Go e Lua são mutáveis por padrão. Tabelas de exportação de módulo devem ser marcadas imutáveis:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevent Lua from modifying exports
```

Tabelas de dados permanecem mutáveis para uso normal:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Sistema de Tipos

Módulos usam dois mecanismos de tipagem separados mas complementares.

### Definições de Tipo (Ferramentas)

O campo `Types` fornece assinaturas de tipo para suporte de IDE e documentação. Os tipos são construídos com os builders fluentes do pacote `typ`:

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

**Construtos de tipo disponíveis:**

| Tipo | Descrição |
|------|-----------|
| `typ.String` | Primitivo string |
| `typ.Number` | Valor numérico |
| `typ.Integer` | Valor inteiro |
| `typ.Boolean` | Valor booleano |
| `typ.Any` | Qualquer valor Lua |
| `typ.Self` | Tipo receiver para métodos |
| `typ.LuaError` | Tipo de erro |
| `typ.NewOptional(t)` | Valor opcional do tipo t |
| `typ.NewInterface(name, methods)` | Objeto com métodos |
| `typ.Func()` | Builder de assinatura de função |
| `typ.NewRecord()` | Builder de tipo semelhante a struct (campos por `.Field`/`.OptField`) |
| `typ.NewArray(t)` | Array de elementos do tipo t |
| `typ.NewMap(k, v)` | Map com tipos de chave e valor |

Os builders de funções encadeiam `Param`, `OptParam`, `Variadic` e `Returns`:

```go
// (string, ...any) -> (string, error?)
typ.Func().
    Param("first", typ.String).
    Variadic(typ.Any).
    Returns(typ.String, typ.NewOptional(typ.LuaError)).
    Build()
```

Records declaram campos com `Field` (obrigatório) e `OptField` (opcional):

```go
typ.NewRecord().
    Field("key", typ.String).
    Field("value", typ.Any).
    OptField("ttl", typ.Number).
    Build()
```

Consulte o pacote `typ` do go-lua para outros builders e definições de tipos.

### Bindings de UserData (runtime)

`RegisterTypeMethods` cria os bindings reais Go-para-Lua:

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

Metatables são imutáveis e cacheadas globalmente para reuso thread-safe.

| Sistema | Propósito | Define |
|---------|-----------|--------|
| Definições de Tipo | IDE, docs, checagem de tipo | Assinaturas |
| Bindings UserData | Chamadas de método em runtime | Funções executáveis |

## Operações Assíncronas

Para operações que aguardam sistemas externos, retorne um yield em vez de um resultado. O yield é despachado para um handler Go e o processo retoma quando o handler completa.

### Definindo Yields

Declare tipos de yield na função `Build` do módulo:

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

### Criando um Yield

Retorne -1 para sinalizar um yield em vez de valores de retorno normais:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Signal yield, not stack count
}
```

### Implementação de Yield

Yields fazem ponte entre valores Lua e comandos do dispatcher:

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

O dispatcher roteia o comando para um handler. Consulte [Despacho de comandos](internals/dispatch.md) para implementar handlers.

## Tratamento de Erros

Retorne erros como segundo valor usando erros estruturados:

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

## Segurança

Verifique permissões antes de realizar operações sensíveis:

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

## Testes

Testes básicos de módulo verificam estrutura e funções síncronas:

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

### Testando Módulos com Yields

Para testar código Lua que usa funções que cedem, crie um scheduler mínimo com os dispatchers necessários:

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

Crie um processo com o módulo usado pelo script. Este exemplo usa o módulo de tempo para que o dispatcher de clock registrado acima trate um yield real:

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

Consulte `runtime/lua/modules/time/integration_test.go` para um exemplo de teste de integração.

## Consulte também

- [Despacho de comandos](internals/dispatch.md) — Tratamento de comandos yield
- [Scheduler](internals/scheduler.md) — Execução de processos
