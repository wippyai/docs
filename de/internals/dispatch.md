---
title: "Command-Dispatch"
description: "Wie Prozess-Yields an Command-Handler geleitet und korrelierte Ergebnisse über Prozess-Event-Queues zurückgegeben werden."
---

# Command-Dispatch

Der Command-Dispatch leitet Prozess-Yields an Handler und gibt korrelierte Ergebnisse über die Event-Queues der Prozesse zurück.

Diese Seite ist eine Erweiterungs- und Implementierungsreferenz. Die Ausschnitte für eigene Commands und Dispatcher setzen ein vorhandenes Go-Paket, einen Boot-Graphen, eine Command-API und dienstspezifische Fehlerbehandlung voraus.

## Fluss

```mermaid
sequenceDiagram
    participant P as Process
    participant W as Worker
    participant R as Registry
    participant H as Handler

    P->>W: yield(command, tag)
    W->>R: getHandler(cmdID)
    R-->>W: handler
    W->>H: Handle(cmd, tag, receiver)
    H-->>H: async work
    H->>W: CompleteYield(tag, result)
    W->>P: queue event, wake
    P->>P: resume with result
```

## Command-Registry

Die Registry speichert Handler in einer hybriden Struktur:

```go
type Registry struct {
    handlers [256]Handler         // System commands: O(1) index
    extended map[CommandID]Handler // Extended commands: map lookup
    frozen   atomic.Bool          // Lock-free after boot
}
```

System-Commands (0-255) verwenden Array-Indexierung. Erweiterte Commands verwenden Map-Lookup. Nach `Freeze()` sind alle Lookups lock-frei.

### Command-ID-Bereiche

| Bereich | Modul | Beispiele |
|---------|-------|-----------|
| 1-9 | process | Send, Spawn, Terminate, Cancel, Monitor, Unmonitor, Link, Unlink, Exec |
| 10, 14, 16, 18-23 | clock | Sleep-, Ticker- und Timer-Operationen |
| 30-34 | socket | Connect, Listen, Accept, Bind, Resolve |
| 50-57 | stream | Read, Write, Close, Seek, Flush, Stat und Scanner-Operationen |
| 60-61 | http | Request, RequestBatch |
| 70-78 | tty | Terminal-E/A |
| 80-85 | websocket | Connect, Send, Receive, Close, Ping, Subscribe |
| 90-91 | event | Subscribe, Send |
| 100-111 | sql | Query, Execute, Prepare sowie Statement- und Transaktionsoperationen |
| 120-126 | store | Get, Set, Delete, Has, Entry, List, Put |
| 130-132 | security | ValidateToken, CreateToken, RevokeToken |
| 140-142 | function | Call, AsyncStart, AsyncCancel |
| 150 | exec | ProcessWait |
| 160-169 | cloudstorage | Objekt- und Multipart-Operationen |
| 170-171 | eval | Compile, Run |
| 172 | cdc | Subscribe |
| 173-174 | cloudstorage | AbortMultipartUpload, OpenReader |
| 180-183 | workflow | SideEffect, Exec, Version, UpsertAttrs |
| 190-193 | contract | Open, Call, AsyncCall, AsyncCancel |
| 200-211 | pg (Prozessgruppe) | Join, Leave, GetMembers, GetLocalMembers, WhichGroups, Broadcast, BroadcastLocal, WhichLocalGroups, Monitor, Events, JoinGroups, LeaveGroups |
| 256+ | custom | Benutzerdefinierte Services |

Pakete reservieren die Eigentümerschaft ihrer Command-IDs aus `init()` heraus mit `MustRegisterCommands()`. Kollisionen führen bereits bei der Paketinitialisierung zu einer Panic. Während des Ladens der Komponenten bindet jeder Dienst seine Handler über `Registrar.Register`. Erst nachdem diese Handler installiert sind, wird der Dispatcher eingefroren.

## Commands definieren

Commands sind Datenstrukturen mit einer eindeutigen `CommandID`:

```go
const MyCommand dispatcher.CommandID = 256

type MyCmd struct {
    Input  string
    Option int
}

func (c *MyCmd) CmdID() dispatcher.CommandID { return MyCommand }
```

Reservieren Sie die Command-ID bei der Paketinitialisierung:

```go
func init() {
    dispatcher.MustRegisterCommands("myservice", MyCommand)
}
```

## Dispatcher

Ein Dispatcher gruppiert verwandte Handler. Er implementiert `RegisterAll` um Handler zu registrieren und Lebenszyklus-Methoden für Setup/Teardown:

```go
type Handler interface {
    Handle(ctx context.Context, cmd Command, tag uint64, receiver ResultReceiver) error
}

type ResultReceiver interface {
    CompleteYield(tag uint64, data any, err error)
}
```

```go
type Dispatcher struct {
    // service state
}

func (d *Dispatcher) RegisterAll(register func(id dispatcher.CommandID, h dispatcher.Handler)) {
    register(myapi.MyCommand, dispatcher.HandlerFunc(d.handleMyCommand))
}

func (d *Dispatcher) handleMyCommand(ctx context.Context, cmd Command, tag uint64, receiver ResultReceiver) error {
    c := cmd.(*myapi.MyCmd)
    go func() {
        result := doWork(c)
        if ctx.Err() == nil {
            receiver.CompleteYield(tag, result, nil)
        }
    }()
    return nil
}
```

Als Boot-Komponente registrieren:

```go
func MyDispatcher() boot.Component {
    return boot.New(boot.P{
        Name:      "dispatcher.myservice",
        DependsOn: []boot.Name{DispatcherName},
        Load: func(ctx context.Context) (context.Context, error) {
            reg := dispatcher.GetRegistrar(ctx)
            svc := myservice.NewDispatcher()
            svc.RegisterAll(reg.Register)
            return ctx, nil
        },
    })
}
```

## Yields und Korrelation

Wenn ein Prozess asynchrone Arbeit benötigt, yieldet er einen Command mit einem Korrelationstag:

```go
type Yield struct {
    Cmd Command
    Tag uint64    // Process-local counter for correlation
}
```

Der Worker extrahiert Yields aus `StepOutput` nach jedem Step und dispatcht sie an Handler. Jedes Tag identifiziert die Anfrage eindeutig, sodass Ergebnisse zurückgemappt werden können.

## Siehe auch

- [Scheduler](./scheduler.md) – Prozessausführung
- [Module](./modules.md) – Integration von Lua-Modulen
- [Prozessmodell](../concepts/process-model.md) – übergeordnete Konzepte
