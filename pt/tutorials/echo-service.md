# Echo Service

Construa um serviço de echo distribuído demonstrando processos, channels, corrotinas, passagem de mensagens e supervisão.

## Visão Geral

Este tutorial cria um cliente CLI que envia mensagens para um serviço de relay, que cria workers para processar cada mensagem. Ele demonstra:

- **Criação de processos** - Criar processos filhos dinamicamente
- **Passagem de mensagens** - Comunicação entre processos via send/receive
- **Channels e select** - Multiplexação de múltiplas fontes de eventos
- **Corrotinas** - Execução concorrente dentro de um processo
- **Registro de processos** - Encontrar processos por nome
- **Monitoramento** - Rastrear ciclo de vida de processos filhos

## Arquitetura

```mermaid
flowchart TB
    subgraph terminal["terminal.host"]
        CLI["CLI Process"]
    end

    subgraph processes["process.host"]
        Relay["Relay Process<br/>(+ stats coroutine)"]
        W1["Worker 1"]
        W2["Worker 2"]
        W3["Worker N"]
    end

    CLI -->|"send('relay', 'echo', msg)"| Relay
    Relay -->|"spawn_monitored(worker)"| W1
    Relay -->|"spawn_monitored(...)"| W2
    Relay -->|"spawn_monitored(...)"| W3
    W1 -->|"send(sender, 'echo_response')"| CLI
    W2 -->|"send(...)"| CLI
    W3 -->|"send(...)"| CLI
```

## Estrutura do Projeto

```
echo-service/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── cli.lua
    ├── relay.lua
    └── worker.lua
```

## Definições de Entradas

Crie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - process
      - time
      - channel

  - name: relay
    kind: process.lua
    source: file://relay.lua
    method: main
    modules:
      - process
      - logger
      - channel
      - time

  - name: relay-service
    kind: process.service
    process: app:relay
    host: app:processes
    lifecycle:
      auto_start: true

  - name: worker
    kind: process.lua
    source: file://worker.lua
    method: main
    modules:
      - process
      - time
```

## O Processo Relay

O relay se registra, trata mensagens, cria workers e executa uma corrotina de estatísticas.

Crie `src/relay.lua`:

```lua
local logger = require("logger")
local time = require("time")

local stats = {
    messages = 0,
    workers_spawned = 0
}

local function stats_reporter()
    while true do
        time.sleep("5s")
        logger:info("stats", {
            messages = stats.messages,
            workers_spawned = stats.workers_spawned
        })
    end
end

local function main()
    local inbox = process.inbox()
    local events = process.events()

    process.registry.register("relay")
    logger:info("relay started", {pid = process.pid()})

    coroutine.spawn(stats_reporter)

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local event = r.value
            if event.kind == process.event.EXIT then
                logger:info("worker exited", {
                    from = event.from,
                    result = event.result
                })
            end
        else
            local msg = r.value
            if msg:topic() == "echo" then
                local echo = msg:payload():data()
                stats.messages = stats.messages + 1

                local worker_pid, err = process.spawn_monitored(
                    "app:worker",
                    "app:processes",
                    echo.sender,
                    echo.data
                )

                if err then
                    logger:error("spawn failed", {error = err})
                else
                    stats.workers_spawned = stats.workers_spawned + 1
                end
            end
        end
    end
end

return { main = main }
```

### Padrões-Chave {id="relay-key-patterns"}

**Spawn de Corrotina**

```lua
coroutine.spawn(stats_reporter)
```

Cria uma corrotina concorrente compartilhando memória com a função principal. Corrotinas cedem em operações de I/O como `time.sleep`.

**Channel Select**

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive()
}
```

Aguarda múltiplos channels. `r.channel` identifica qual disparou, `r.value` contém os dados.

**Extração de Payload**

```lua
local echo = msg:payload():data()
```

Mensagens tem `msg:topic()` para a string do tópico e `msg:payload():data()` para o payload.

**Spawn com Monitoramento**

```lua
local worker_pid, err = process.spawn_monitored("app:worker", "app:processes", ...)
```

Combina spawn e monitor. Quando o worker termina, recebemos um evento EXIT.

## O Processo Worker

Workers recebem argumentos diretamente e enviam respostas ao remetente.

Crie `src/worker.lua`:

```lua
local time = require("time")

local function main(sender_pid, data)
    time.sleep("100ms")

    local response = {
        data = string.upper(data),
        worker = process.pid()
    }

    process.send(sender_pid, "echo_response", response)

    return 0
end

return { main = main }
```

## O Processo CLI

O CLI envia mensagens por nome registrado e aguarda respostas com timeout.

Crie `src/cli.lua`:

```lua
local io = require("io")
local time = require("time")

local reset = "\027[0m"
local function dim(s) return "\027[2m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end

local function main()
    local inbox = process.inbox()

    -- Aguardar relay se registrar
    time.sleep("200ms")

    io.print(cyan("Echo Client"))
    io.print(dim("Type messages to echo. Ctrl+C to exit.\n"))

    while true do
        io.write(yellow("> "))
        local input = io.readline()

        if not input or #input == 0 then
            break
        end

        local msg = {
            sender = process.pid(),
            data = input
        }
        local ok, err = process.send("relay", "echo", msg)
        if err then
            io.print(dim("  error: relay not available"))
        else
            local timeout = time.after("2s")
            local r = channel.select {
                inbox:case_receive(),
                timeout:case_receive()
            }

            if r.channel == timeout then
                io.print(dim("  timeout"))
            else
                local msg = r.value
                if msg:topic() == "echo_response" then
                    local resp = msg:payload():data()
                    io.print(green("  " .. resp.data))
                    io.print(dim("  from worker: " .. resp.worker))
                end
            end
        end
    end

    io.print("\nGoodbye!")
    return 0
end

return { main = main }
```

### Padrões-Chave {id="cli-key-patterns"}

**Enviar por Nome**

```lua
process.send("relay", "echo", msg)
```

`process.send` aceita nomes registrados diretamente. Retorna erro se não encontrado.

**Padrão de Timeout**

```lua
local timeout = time.after("2s")
local r = channel.select {
    inbox:case_receive(),
    timeout:case_receive()
}
if r.channel == timeout then
    -- timeout
end
```

## Executando

```bash
wippy init
wippy run -x app:terminal/app:cli
```

Exemplo de saída:

```
Echo Client
Type messages to echo. Ctrl+C to exit.

> hello world
  HELLO WORLD
  from worker: {app:processes|0x00004}
```

## Resumo de Conceitos

| Conceito | API |
|----------|-----|
| Criação de processo | `process.spawn_monitored(entry, host, ...)` |
| Passagem de mensagens | `process.send(dest, topic, data)` |
| Inbox | `process.inbox()` |
| Eventos | `process.events()` |
| Registro | `process.registry.register(name)` |
| Channel select | `channel.select {...}` |
| Timeout | `time.after(duration)` |
| Corrotinas | `coroutine.spawn(fn)` |

## Próximos Passos

- [Process Management](lua/core/process.md)
- [Channels](lua/core/channel.md)
- [Time and Duration](lua/core/time.md)
