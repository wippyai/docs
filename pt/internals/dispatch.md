---
title: "Despacho de Comandos"
description: "Como yields de processos são roteados para handlers de comandos e retornam por eventos de conclusão correlacionados."
---

# Despacho de Comandos

O despacho de comandos roteia yields de processos para handlers e devolve resultados correlacionados pelas filas de eventos dos processos.

Esta é uma referência de extensão e implementação. Os fragmentos de comando e dispatcher personalizados pressupõem um pacote Go, um grafo de boot, uma API de comandos e tratamento de erros específico do serviço já existentes.

## Fluxo

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

## Registro de comandos

O registro armazena handlers em uma estrutura híbrida:

```go
type Registry struct {
    handlers [256]Handler         // System commands: O(1) index
    extended map[CommandID]Handler // Extended commands: map lookup
    frozen   atomic.Bool          // Lock-free after boot
}
```

Comandos do sistema (0–255) usam indexação de array. Comandos estendidos usam consulta ao mapa. Depois de `Freeze()`, todas as consultas dispensam locks.

### Faixas de IDs de comandos

| Faixa | Módulo | Exemplos |
|-------|--------|----------|
| 1-9 | process | Send, Spawn, Terminate, Cancel, Monitor, Unmonitor, Link, Unlink, Exec |
| 10, 14, 16, 18-23 | clock | Sleep e operações de ticker e timer |
| 30-34 | socket | Connect, Listen, Accept, Bind, Resolve |
| 50-57 | stream | Operações Read, Write, Close, Seek, Flush, Stat e Scanner |
| 60-61 | http | Request, RequestBatch |
| 70-78 | tty | E/S de terminal |
| 80-85 | websocket | Connect, Send, Receive, Close, Ping, Subscribe |
| 90-91 | event | Subscribe, Send |
| 100-111 | sql | Query, Execute, Prepare e operações de statement e transação |
| 120-126 | store | Get, Set, Delete, Has, Entry, List, Put |
| 130-132 | security | ValidateToken, CreateToken, RevokeToken |
| 140-142 | function | Call, AsyncStart, AsyncCancel |
| 150 | exec | ProcessWait |
| 160-169 | cloudstorage | Operações de objetos e multipart |
| 170-171 | eval | Compile, Run |
| 172 | cdc | Subscribe |
| 173-174 | cloudstorage | AbortMultipartUpload, OpenReader |
| 180-183 | workflow | SideEffect, Exec, Version, UpsertAttrs |
| 190-193 | contract | Open, Call, AsyncCall, AsyncCancel |
| 200-211 | pg (grupo de processos) | Join, Leave, GetMembers, GetLocalMembers, WhichGroups, Broadcast, BroadcastLocal, WhichLocalGroups, Monitor, Events, JoinGroups, LeaveGroups |
| 256+ | custom | Serviços definidos pelo usuário |

Os pacotes reservam a propriedade dos IDs de comandos em `init()` com `MustRegisterCommands()`; colisões de propriedade causam panic durante a inicialização dos pacotes. Durante o carregamento dos componentes, cada serviço associa seus handlers por meio de `Registrar.Register`. O dispatcher só é congelado depois que esses handlers são instalados.

## Definindo Comandos

Comandos são estruturas de dados com um `CommandID` único:

```go
const MyCommand dispatcher.CommandID = 256

type MyCmd struct {
    Input  string
    Option int
}

func (c *MyCmd) CmdID() dispatcher.CommandID { return MyCommand }
```

Reserve o ID do comando durante a inicialização do pacote:

```go
func init() {
    dispatcher.MustRegisterCommands("myservice", MyCommand)
}
```

## Dispatchers

Um dispatcher agrupa handlers relacionados. Ele implementa `RegisterAll` para registrar handlers e métodos de ciclo de vida para setup/teardown:

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

Registre como componente de boot:

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

## Yields e Correlação

Quando um processo precisa de trabalho assíncrono, ele cede um comando com uma tag de correlação:

```go
type Yield struct {
    Cmd Command
    Tag uint64    // Process-local counter for correlation
}
```

O worker extrai yields de `StepOutput` após cada passo e os despacha para handlers. Cada tag identifica unicamente a requisição para que resultados possam ser correspondidos de volta.

## Consulte também

- [Scheduler](internals/scheduler.md) — Execução de processos
- [Módulos](internals/modules.md) — Integração de módulos Lua
- [Modelo de processos](concepts/process-model.md) — Conceitos de alto nível
