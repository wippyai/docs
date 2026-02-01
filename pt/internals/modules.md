# Modulos Lua

Modulos de runtime estendem o ambiente Lua com novas funcionalidades. Modulos podem fornecer utilitarios deterministicos, operacoes de I/O ou comandos assincronos que cedem para sistemas externos.

> A implementacao do runtime Lua pode mudar em versoes futuras.

## Definicao de Modulo

Todo modulo usa `luaapi.ModuleDef`:

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // Definicoes de tipo para ferramentas
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

A funcao `Build` retorna:
- Tabela do modulo com funcoes exportadas
- Lista de tipos de yield para operacoes assincronas (ou nil)

Tabelas de modulo sao construidas uma vez e cacheadas para reuso em todos os estados Lua.

## Classificacao de Modulo

O campo `Class` determina onde o modulo pode ser usado:

| Classe | Descricao |
|--------|-----------|
| `ClassDeterministic` | Mesma entrada sempre produz mesma saida |
| `ClassNondeterministic` | Saida varia (tempo, aleatorio) |
| `ClassIO` | Operacoes de I/O externas |
| `ClassNetwork` | Operacoes de rede |
| `ClassStorage` | Persistencia de dados |
| `ClassWorkflow` | Operacoes seguras para workflow |

Modulos marcados apenas com `ClassDeterministic` sao workflow-safe. Adicionar classes de I/O ou rede restringe o modulo a funcoes e processos.

## Expondo Funcoes

Funcoes tem assinatura `func(l *lua.LState) int` onde o valor de retorno e o numero de valores empurrados na stack:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Argumento obrigatorio
    greeting := l.OptString(2, "Hello") // Opcional com padrao

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Metodo | Descricao |
|--------|-----------|
| `l.CheckString(n)` | String obrigatoria na posicao n |
| `l.CheckInt(n)` | Inteiro obrigatorio |
| `l.CheckNumber(n)` | Numero obrigatorio |
| `l.CheckTable(n)` | Tabela obrigatoria |
| `l.OptString(n, def)` | String opcional com padrao |
| `l.OptInt(n, def)` | Int opcional com padrao |

## Tabelas

Tabelas passadas entre Go e Lua sao mutaveis por padrao. Tabelas de exportacao de modulo devem ser marcadas imutaveis:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Previne Lua de modificar exports
```

Tabelas de dados permanecem mutaveis para uso normal:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Sistema de Tipos

Modulos usam dois mecanismos de tipagem separados mas complementares.

### Definicoes de Tipo (Ferramentas)

O campo `Types` fornece assinaturas de tipo para suporte de IDE e documentacao:

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

**Construtos de tipo disponiveis:**

| Tipo | Descricao |
|------|-----------|
| `types.String` | Primitivo string |
| `types.Number` | Valor numerico |
| `types.Boolean` | Valor booleano |
| `types.Any` | Qualquer valor Lua |
| `types.LuaError` | Tipo de erro |
| `types.Optional(t)` | Valor opcional do tipo t |
| `types.InterfaceType` | Objeto com metodos |
| `types.FunctionType` | Assinatura de funcao com params/returns |
| `types.RecordType` | Tipo struct-like com campos |
| `types.TableType` | Tabela com tipos de key/value |

Assinaturas de funcao suportam parametros variadicos:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

Veja o pacote `types` em go-lua para o sistema de tipos completo.

### Bindings UserData (Runtime)

`RegisterTypeMethods` cria os bindings reais Go-para-Lua:

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // Metametodos
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // Metodos regulares
            "set_value": objectSetValue,
        },
    )
}
```

Metatables sao imutaveis e cacheadas globalmente para reuso thread-safe.

| Sistema | Proposito | Define |
|---------|-----------|--------|
| Definicoes de Tipo | IDE, docs, checagem de tipo | Assinaturas |
| Bindings UserData | Chamadas de metodo em runtime | Funcoes executaveis |

## Operacoes Assincronas

Para operacoes que aguardam sistemas externos, retorne um yield em vez de um resultado. O yield e despachado para um handler Go e o processo retoma quando o handler completa.

### Definindo Yields

Declare tipos de yield na funcao `Build` do modulo:

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
    return -1  // Sinalizar yield, nao contagem de stack
}
```

### Implementacao de Yield

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

O dispatcher roteia o comando para um handler. Veja [Command Dispatch](internal-dispatch.md) para implementar handlers.

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

## Seguranca

Verifique permissoes antes de realizar operacoes sensiveis:

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // Prosseguir com operacao
}
```

## Testes

Testes basicos de modulo verificam estrutura e funcoes sincronas:

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

### Testando Modulos com Yields

Para testar codigo Lua que usa funcoes que cedem, crie um scheduler minimo com os dispatchers necessarios:

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

    // Registrar dispatchers para yields que seu modulo usa
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

Crie processos de scripts Lua com os modulos que voce esta testando:

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
    // Assert no result
}
```

Veja `runtime/lua/modules/time/integration_test.go` para um exemplo completo.

## Veja Tambem

- [Command Dispatch](internal-dispatch.md) - Tratamento de comandos yield
- [Scheduler](internal-scheduler.md) - Execucao de processos
