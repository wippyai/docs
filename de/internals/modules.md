---
title: "Lua-Module"
description: "Typisierte Lua-Runtime-Module mit synchronen Funktionen, Userdata, Yields, Fehlern, Sicherheitsprüfungen und Tests definieren."
---

# Lua-Module

Runtime-Module erweitern die Lua-Umgebung um deterministische Hilfsfunktionen, E/A-Operationen oder asynchrone Commands.

Diese Seite ist eine Go-Erweiterungsreferenz. Ihre Ausschnitte sind unvollständige Beispiele auf Paketebene und setzen die jeweils genannten Imports, Command-API, Dispatcher, Security-Ressourcen und Test-Fixtures voraus.

## Modul-Definition

Jedes Modul verwendet `luaapi.ModuleDef`:

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
| `ClassIO` | Externe E/A-Operationen |
| `ClassNetwork` | Netzwerkoperationen |
| `ClassEncoding` | Kodierungs- und Dekodierungsoperationen |
| `ClassTime` | Zeitbezogene Operationen |
| `ClassProcess` | Prozessbezogene Operationen |
| `ClassSecurity` | Sicherheitsbezogene Operationen |
| `ClassStorage` | Datenpersistenz |
| `ClassWorkflow` | Workflow-sichere Operationen |

Die Workflow-Kompilierung erlaubt Module, die mindestens `ClassDeterministic` oder `ClassWorkflow` tragen. Die Klassenfilterung ist inklusiv: Ein Modul wird zugelassen, wenn eine seiner Klassen erlaubt ist.

## Funktionen exponieren

Funktionen haben Signatur `func(l *lua.LState) int` wobei der Rückgabewert die Anzahl auf den Stack gepushter Werte ist:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Required argument
    greeting := l.OptString(2, "Hello") // Optional with default

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
| `l.OptString(n, def)` | Optionale Zeichenkette mit Standardwert |
| `l.OptInt(n, def)` | Optionale Ganzzahl mit Standardwert |

## Tabellen

Tabellen, die zwischen Go und Lua übergeben werden, sind standardmäßig mutable. Modul-Export-Tabellen sollten als immutable markiert werden:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Prevent Lua from modifying exports
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

Das Feld `Types` stellt Typsignaturen für IDE-Unterstützung und Dokumentation bereit. Typen werden mit der Fluent API des Pakets `typ` aufgebaut:

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

**Verfügbare Typkonstrukte:**

| Typ | Beschreibung |
|-----|--------------|
| `typ.String` | Zeichenkettenprimitiv |
| `typ.Number` | Numerischer Wert |
| `typ.Integer` | Ganzzahliger Wert |
| `typ.Boolean` | Boolescher Wert |
| `typ.Any` | Beliebiger Lua-Wert |
| `typ.Self` | Empfängertyp für Methoden |
| `typ.LuaError` | Fehlertyp |
| `typ.NewOptional(t)` | Optionaler Wert vom Typ `t` |
| `typ.NewInterface(name, methods)` | Objekt mit Methoden |
| `typ.Func()` | Builder für Funktionssignaturen |
| `typ.NewRecord()` | Builder für strukturähnliche Typen; Felder über `.Field` und `.OptField` |
| `typ.NewArray(t)` | Array mit Elementtyp `t` |
| `typ.NewMap(k, v)` | Map mit Schlüsseltyp `k` und Werttyp `v` |

Funktions-Builder verketten `Param`, `OptParam`, `Variadic` und `Returns`:

```go
// (string, ...any) -> (string, error?)
typ.Func().
    Param("first", typ.String).
    Variadic(typ.Any).
    Returns(typ.String, typ.NewOptional(typ.LuaError)).
    Build()
```

Records deklarieren Pflichtfelder mit `Field` und optionale Felder mit `OptField`:

```go
typ.NewRecord().
    Field("key", typ.String).
    Field("value", typ.Any).
    OptField("ttl", typ.Number).
    Build()
```

Weitere Builder und Typdefinitionen enthält das Paket `typ` in go-lua.

### UserData-Bindings (Runtime)

`RegisterTypeMethods` erstellt die tatsächlichen Go-zu-Lua-Bindings:

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
    return -1  // Signal yield, not stack count
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

Der Dispatcher leitet den Command an einen Handler weiter. Hinweise zur Handler-Implementierung finden Sie unter [Command-Dispatch](internals/dispatch.md).

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

    // Proceed with operation
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

Um Lua-Code mit yieldenden Funktionen zu testen, erstellen Sie einen minimalen Scheduler mit den erforderlichen Dispatchern:

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

Erstellen Sie einen Prozess mit dem im Skript verwendeten Modul. Dieses Beispiel nutzt das Zeitmodul, sodass der oben registrierte Clock-Dispatcher einen echten Yield verarbeitet:

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

Siehe `runtime/lua/modules/time/integration_test.go` für ein vollständiges Beispiel.

## Siehe auch

- [Command-Dispatch](internals/dispatch.md) – Yield-Commands behandeln
- [Scheduler](internals/scheduler.md) – Prozessausführung
