---
title: "Módulos Lua"
description: "Define módulos de runtime Lua tipados con funciones síncronas, userdata, yields, errores, controles de seguridad y pruebas."
---

# Módulos Lua

Los módulos de runtime añaden al entorno Lua utilidades determinísticas, operaciones de E/S o comandos asíncronos.

Esta página es una referencia de extensión de Go. Sus fragmentos son ejemplos parciales a nivel de paquete y presuponen las importaciones, la API de comandos, el despachador, los recursos de seguridad y los datos de prueba indicados en cada sección.

## Definición de Módulo

Cada módulo usa `luaapi.ModuleDef`:

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

La función `Build` devuelve:
- Tabla del módulo con funciones exportadas
- Lista de tipos de yield para operaciones asíncronas (o nil)

Las tablas de los módulos se construyen una vez y se almacenan en caché para su reutilización en todos los estados Lua.

## Clasificación de Módulos

El campo `Class` determina dónde se puede usar el módulo:

| Clase | Descripción |
|-------|-------------|
| `ClassDeterministic` | La misma entrada siempre produce la misma salida |
| `ClassNondeterministic` | La salida varía (tiempo, aleatoriedad) |
| `ClassIO` | Operaciones de I/O externas |
| `ClassNetwork` | Operaciones de red |
| `ClassEncoding` | Operaciones de codificación y decodificación |
| `ClassTime` | Operaciones relacionadas con el tiempo |
| `ClassProcess` | Operaciones relacionadas con procesos |
| `ClassSecurity` | Operaciones relacionadas con seguridad |
| `ClassStorage` | Persistencia de datos |
| `ClassWorkflow` | Operaciones seguras para workflows |

La compilación de workflows permite módulos que tengan al menos una de las clases `ClassDeterministic` o `ClassWorkflow`. El filtrado de clases es inclusivo: un módulo pasa cuando cualquiera de sus clases está permitida.

## Exponer Funciones

Las funciones tienen la firma `func(l *lua.LState) int`, donde el valor de retorno es el número de valores apilados en la pila:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Required argument
    greeting := l.OptString(2, "Hello") // Optional with default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Método | Descripción |
|--------|-------------|
| `l.CheckString(n)` | String requerido en la posición n |
| `l.CheckInt(n)` | Entero requerido |
| `l.CheckNumber(n)` | Número requerido |
| `l.CheckTable(n)` | Tabla requerida |
| `l.OptString(n, def)` | String opcional con valor por defecto |
| `l.OptInt(n, def)` | Entero opcional con valor por defecto |

## Tablas

Las tablas que se pasan entre Go y Lua son mutables por defecto. Las tablas de exportación de módulos deben marcarse como inmutables:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevent Lua from modifying exports
```

Las tablas de datos permanecen mutables para su uso normal:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Sistema de Tipos

Los módulos usan dos mecanismos de tipado separados pero complementarios.

### Definiciones de Tipos (Herramientas)

El campo `Types` proporciona firmas de tipo para compatibilidad con el IDE y la documentación. Los tipos se construyen con los constructores fluidos del paquete `typ`:

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

**Constructos de tipo disponibles:**

| Tipo | Descripción |
|------|-------------|
| `typ.String` | Primitivo string |
| `typ.Number` | Valor numérico |
| `typ.Integer` | Valor entero |
| `typ.Boolean` | Valor booleano |
| `typ.Any` | Cualquier valor Lua |
| `typ.Self` | Tipo receptor de los métodos |
| `typ.LuaError` | Tipo error |
| `typ.NewOptional(t)` | Valor opcional de tipo t |
| `typ.NewInterface(name, methods)` | Objeto con métodos |
| `typ.Func()` | Constructor de firma de función |
| `typ.NewRecord()` | Constructor de tipo similar a una estructura (campos mediante `.Field`/`.OptField`) |
| `typ.NewArray(t)` | Array de elementos de tipo t |
| `typ.NewMap(k, v)` | Mapa con tipos de clave y valor |

Los constructores de funciones encadenan `Param`, `OptParam`, `Variadic` y `Returns`:

```go
// (string, ...any) -> (string, error?)
typ.Func().
    Param("first", typ.String).
    Variadic(typ.Any).
    Returns(typ.String, typ.NewOptional(typ.LuaError)).
    Build()
```

Los records declaran campos con `Field` (obligatorio) y `OptField` (opcional):

```go
typ.NewRecord().
    Field("key", typ.String).
    Field("value", typ.Any).
    OptField("ttl", typ.Number).
    Build()
```

Consulte el paquete `typ` en go-lua para ver constructores y definiciones de tipo adicionales.

### Bindings UserData (Runtime)

`RegisterTypeMethods` crea los bindings reales de Go a Lua:

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

Las metatablas son inmutables y se cachean globalmente para una reutilización segura entre hilos.

| Sistema | Propósito | Define |
|---------|-----------|--------|
| Definiciones de Tipos | IDE, docs, verificación de tipos | Firmas |
| Bindings UserData | Llamadas a métodos en runtime | Funciones ejecutables |

## Operaciones Asíncronas

Para operaciones que esperan en sistemas externos, devuelva una cesión en lugar de un resultado. La cesión se despacha a un controlador de Go y el proceso se reanuda cuando el controlador termina.

### Definir Yields

Declare los tipos de yield en la función `Build` del módulo:

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

### Crear un Yield

Devuelva -1 para indicar un yield en lugar de valores de retorno normales:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Signal yield, not stack count
}
```

### Implementación del Yield

Las cesiones conectan los valores de Lua con los comandos del despachador:

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

El despachador enruta el comando a un controlador. Consulte [Despacho de comandos](./dispatch.md) para implementar controladores.

## Manejo de Errores

Devuelva errores como segundo valor usando errores estructurados:

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

## Seguridad

Verifique los permisos antes de realizar operaciones sensibles:

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

## Pruebas

Las pruebas básicas de módulo verifican la estructura y las funciones síncronas:

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

### Probar Módulos con Yields

Para probar código Lua que usa funciones con cesión, cree un planificador mínimo con los despachadores requeridos:

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

Cree un proceso con el módulo que usa el script. Este ejemplo emplea el módulo de tiempo para que el despachador de reloj registrado anteriormente gestione una cesión real:

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

Consulte `runtime/lua/modules/time/integration_test.go` para ver un ejemplo de prueba de integración.

## Véase También

- [Despacho de Comandos](./dispatch.md) - Manejo de comandos de yield
- [Planificador](./scheduler.md) - Ejecución de procesos
