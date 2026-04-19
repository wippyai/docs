# Módulos Lua

Los módulos de runtime extienden el entorno Lua con nueva funcionalidad. Los módulos pueden proveer utilidades determinísticas, operaciones I/O o comandos asíncronos que hacen yield a sistemas externos.

> La implementación del runtime Lua puede cambiar en futuras versiones.

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
| `ClassStorage` | Persistencia de datos |
| `ClassWorkflow` | Operaciones seguras para workflows |

Los módulos marcados solo con `ClassDeterministic` son seguros para workflows. Añadir clases de I/O o red restringe el módulo a funciones y procesos.

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

El campo `Types` proporciona firmas de tipo para soporte en IDE y documentación:

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

**Constructores de tipo disponibles:**

| Tipo | Descripción |
|------|-------------|
| `types.String` | Primitivo string |
| `types.Number` | Valor numérico |
| `types.Boolean` | Valor booleano |
| `types.Any` | Cualquier valor Lua |
| `types.LuaError` | Tipo error |
| `types.Optional(t)` | Valor opcional de tipo t |
| `types.InterfaceType` | Objeto con métodos |
| `types.FunctionType` | Firma de función con parámetros/retornos |
| `types.RecordType` | Tipo tipo struct con campos |
| `types.TableType` | Tabla con tipos de clave/valor |

Las firmas de función soportan parámetros variádicos:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

Consulte el paquete `types` en go-lua para el sistema de tipos completo.

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

Para operaciones que esperan en sistemas externos, devuelva un yield en lugar de un resultado. El yield se despacha a un handler Go y el proceso se reanuda cuando el handler termina.

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

Los yields conectan los valores Lua con los comandos del dispatcher:

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

El dispatcher enruta el comando a un handler. Consulte [Despacho de Comandos](internals/dispatch.md) para implementar handlers.

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

Para probar código Lua que usa funciones con yield, cree un planificador mínimo con los dispatchers requeridos:

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

Cree procesos desde scripts Lua con los módulos que esté probando:

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

Consulte `runtime/lua/modules/time/integration_test.go` para un ejemplo completo.

## Véase También

- [Despacho de Comandos](internals/dispatch.md) - Manejo de comandos de yield
- [Planificador](internals/scheduler.md) - Ejecución de procesos
