# Lua-Module

Runtime-Module erweitern die Lua-Umgebung mit neuer Funktionalität. Module können deterministische Utilities, I/O-Operationen oder asynchrone Commands bereitstellen, die an externe Systeme yielden.

> Die Lua-Runtime-Implementierung kann sich in zukünftigen Versionen ändern.

## Modul-Definition

Jedes Modul verwendet `luaapi.ModuleDef`:

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // Typ-Definitionen für Tooling
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

Die `Build`-Funktion gibt zurück:
- Modul-Tabelle mit exportierten Funktionen
- Liste von Yield-Typen für asynchrone Operationen (oder nil)

Modul-Tabellen werden einmal erstellt und für Wiederverwendung über alle Lua-States gecacht.

## Modul-Klassifikation

Das `Class`-Feld bestimmt wo das Modul verwendet werden kann:

| Klasse | Beschreibung |
|--------|--------------|
| `ClassDeterministic` | Selbe Eingabe produziert immer selbe Ausgabe |
| `ClassNondeterministic` | Ausgabe variiert (Zeit, Zufall) |
| `ClassIO` | Externe I/O-Operationen |
| `ClassNetwork` | Netzwerkoperationen |
| `ClassStorage` | Datenpersistenz |
| `ClassWorkflow` | Workflow-sichere Operationen |

Module nur mit `ClassDeterministic` getaggt sind workflow-sicher. Hinzufügen von I/O- oder Netzwerkklassen beschränkt das Modul auf Funktionen und Prozesse.

## Funktionen exponieren

Funktionen haben Signatur `func(l *lua.LState) int` wobei der Rückgabewert die Anzahl auf den Stack gepushter Werte ist:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Erforderliches Argument
    greeting := l.OptString(2, "Hello") // Optional mit Default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Methode | Beschreibung |
|---------|--------------|
| `l.CheckString(n)` | Erforderlicher String an Position n |
| `l.CheckInt(n)` | Erforderliche Ganzzahl |
| `l.CheckNumber(n)` | Erforderliche Zahl |
| `l.CheckTable(n)` | Erforderliche Tabelle |
| `l.OptString(n, def)` | Optionaler String mit Default |
| `l.OptInt(n, def)` | Optionale Ganzzahl mit Default |

## Tabellen

Tabellen, die zwischen Go und Lua übergeben werden, sind standardmäßig mutable. Modul-Export-Tabellen sollten als immutable markiert werden:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Verhindert dass Lua Exports modifiziert
```

Daten-Tabellen bleiben für normale Nutzung mutable:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Typsystem

Module verwenden zwei separate aber komplementäre Typisierungsmechanismen.

### Typ-Definitionen (Tooling)

Das `Types`-Feld stellt Typsignaturen für IDE-Support und Dokumentation bereit:

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

**Verfügbare Typkonstrukte:**

| Typ | Beschreibung |
|-----|--------------|
| `types.String` | String-Primitiv |
| `types.Number` | Numerischer Wert |
| `types.Boolean` | Boolean-Wert |
| `types.Any` | Jeder Lua-Wert |
| `types.LuaError` | Fehlertyp |
| `types.Optional(t)` | Optionaler Wert vom Typ t |
| `types.InterfaceType` | Objekt mit Methoden |
| `types.FunctionType` | Funktionssignatur mit Params/Returns |
| `types.RecordType` | Struct-ähnlicher Typ mit Feldern |
| `types.TableType` | Tabelle mit Key/Value-Typen |

Funktionssignaturen unterstützen variadische Parameter:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

Siehe das `types`-Paket in go-lua für das vollständige Typsystem.

### UserData-Bindings (Runtime)

`RegisterTypeMethods` erstellt die tatsächlichen Go-zu-Lua-Bindings:

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // Metamethoden
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // Reguläre Methoden
            "set_value": objectSetValue,
        },
    )
}
```

Metatables sind immutable und global gecacht für thread-sichere Wiederverwendung.

| System | Zweck | Definiert |
|--------|-------|-----------|
| Typ-Definitionen | IDE, Docs, Type-Checking | Signaturen |
| UserData-Bindings | Runtime-Methodenaufrufe | Ausführbare Funktionen |

## Asynchrone Operationen

Für Operationen die auf externe Systeme warten, geben Sie einen Yield statt eines Ergebnisses zurück. Der Yield wird an einen Go-Handler dispatcht und der Prozess wird fortgesetzt wenn der Handler abschließt.

### Yields definieren

Deklarieren Sie Yield-Typen in der `Build`-Funktion des Moduls:

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

### Yield erstellen

Geben Sie -1 zurück um einen Yield statt normaler Rückgabewerte zu signalisieren:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Signalisiert Yield, nicht Stack-Anzahl
}
```

### Yield-Implementierung

Yields verbinden Lua-Werte und Dispatcher-Commands:

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

Der Dispatcher routet den Command an einen Handler. Siehe [Command-Dispatch](internal-dispatch.md) für Handler-Implementierung.

## Fehlerbehandlung

Geben Sie Fehler als zweiten Wert mit strukturierten Fehlern zurück:

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

## Sicherheit

Prüfen Sie Berechtigungen vor sensiblen Operationen:

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // Mit Operation fortfahren
}
```

## Testen

Einfache Modul-Tests verifizieren Struktur und synchrone Funktionen:

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

### Module mit Yields testen

Um Lua-Code zu testen der yielding Funktionen verwendet, erstellen Sie einen minimalen Scheduler mit den erforderlichen Dispatchern:

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

    // Dispatcher für Yields registrieren die Ihr Modul verwendet
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

Erstellen Sie Prozesse aus Lua-Scripts mit den Modulen die Sie testen:

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
    // Auf result assertieren
}
```

Siehe `runtime/lua/modules/time/integration_test.go` für ein vollständiges Beispiel.

## Siehe auch

- [Command-Dispatch](internal-dispatch.md) - Yield-Commands behandeln
- [Scheduler](internal-scheduler.md) - Prozessausführung
