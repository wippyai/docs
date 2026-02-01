# Modulos Lua

Los modulos de runtime extienden el entorno Lua con nueva funcionalidad. Los modulos pueden proporcionar utilidades deterministicas, operaciones I/O, o comandos async que hacen yield a sistemas externos.

> La implementacion del runtime Lua puede cambiar en futuras versiones.

## Definicion de Modulo

Cada modulo usa `luaapi.ModuleDef`:

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "Mi modulo personalizado",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // Definiciones de tipo para herramientas
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

La funcion `Build` retorna:
- Tabla de modulo con funciones exportadas
- Lista de tipos de yield para operaciones async (o nil)

Las tablas de modulo se construyen una vez y se cachean para reutilizacion en todos los estados Lua.

## Clasificacion de Modulos

El campo `Class` determina donde puede usarse el modulo:

| Clase | Descripcion |
|-------|-------------|
| `ClassDeterministic` | La misma entrada siempre produce la misma salida |
| `ClassNondeterministic` | La salida varia (tiempo, random) |
| `ClassIO` | Operaciones I/O externas |
| `ClassNetwork` | Operaciones de red |
| `ClassStorage` | Persistencia de datos |
| `ClassWorkflow` | Operaciones seguras para workflow |

Modulos marcados solo con `ClassDeterministic` son seguros para workflow. Agregar clases de I/O o network restringe el modulo a funciones y procesos.

## Exponer Funciones

Las funciones tienen signature `func(l *lua.LState) int` donde el valor de retorno es el numero de valores pusheados al stack:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Argumento requerido
    greeting := l.OptString(2, "Hello") // Opcional con default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Metodo | Descripcion |
|--------|-------------|
| `l.CheckString(n)` | String requerido en posicion n |
| `l.CheckInt(n)` | Entero requerido |
| `l.CheckNumber(n)` | Numero requerido |
| `l.CheckTable(n)` | Tabla requerida |
| `l.OptString(n, def)` | String opcional con default |
| `l.OptInt(n, def)` | Int opcional con default |

## Tablas

Las tablas pasadas entre Go y Lua son mutables por defecto. Las tablas de exportacion de modulo deben marcarse como inmutables:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevenir que Lua modifique exports
```

Las tablas de datos permanecen mutables para uso normal:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Sistema de Tipos

Los modulos usan dos mecanismos de tipado separados pero complementarios.

### Definiciones de Tipo (Herramientas)

El campo `Types` proporciona signatures de tipo para soporte de IDE y documentacion:

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

**Constructos de tipo disponibles:**

| Tipo | Descripcion |
|------|-------------|
| `types.String` | Primitivo string |
| `types.Number` | Valor numerico |
| `types.Boolean` | Valor booleano |
| `types.Any` | Cualquier valor Lua |
| `types.LuaError` | Tipo de error |
| `types.Optional(t)` | Valor opcional de tipo t |
| `types.InterfaceType` | Objeto con metodos |
| `types.FunctionType` | Signature de funcion con params/returns |
| `types.RecordType` | Tipo similar a struct con campos |
| `types.TableType` | Tabla con tipos key/value |

Signatures de funcion soportan parametros variadicos:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

Ver el paquete `types` en go-lua para el sistema de tipos completo.

### Bindings UserData (Runtime)

`RegisterTypeMethods` crea los bindings reales Go-a-Lua:

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

Las metatables son inmutables y cacheadas globalmente para reutilizacion thread-safe.

| Sistema | Proposito | Define |
|---------|-----------|--------|
| Definiciones de Tipo | IDE, docs, type checking | Signatures |
| Bindings UserData | Llamadas a metodos en runtime | Funciones ejecutables |

## Operaciones Async

Para operaciones que esperan en sistemas externos, retorne un yield en lugar de un resultado. El yield es despachado a un handler Go y el proceso resume cuando el handler completa.

### Definir Yields

Declare tipos de yield en la funcion `Build` del modulo:

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

Retorne -1 para senalar un yield en lugar de valores de retorno normales:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Senalar yield, no conteo de stack
}
```

### Implementacion de Yield

Los yields conectan valores Lua y comandos dispatcher:

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

El dispatcher enruta el comando a un handler. Ver [Command Dispatch](internal-dispatch.md) para implementar handlers.

## Manejo de Errores

Retorne errores como segundo valor usando errores estructurados:

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

Verifique permisos antes de realizar operaciones sensibles:

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // Proceder con operacion
}
```

## Ver Tambien

- [Command Dispatch](internal-dispatch.md) - Manejar comandos de yield
- [Scheduler](internal-scheduler.md) - Ejecucion de procesos
