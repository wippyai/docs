---
title: "Introdução a Processos e Mensageria"
description: "Revise APIs de criação de processos, mensagens, monitoramento, linking e registro de nomes."
---

# Introdução a Processos e Mensageria

Aprenda as APIs de processos para criar trabalho isolado, trocar mensagens, monitorar ciclos de vida, vincular falhas e registrar nomes.

## Visão Geral

Processos fornecem unidades de execução isoladas que se comunicam através de passagem de mensagens. Cada processo tem sua própria caixa de entrada e pode se inscrever em tópicos de mensagens específicos.

**Classificação:** introdução de referência/API. Cada trecho ilustra uma operação isolada; esta página não é um projeto autônomo. Para uma aplicação completa, consulte [Serviço Echo](tutorials/echo-service.md).

## Contexto e Dependências

Os exemplos pressupõem uma entrada Lua executável e um `process.host` ativo registrado como `app:processes`. IDs como `app.test.process:echo_worker` representam entradas que o projeto deve definir. As APIs `process` e `channel` são globais; o acesso `process.*` é idiomático, e `require("process")` também funciona sem declaração de módulo. Trechos com `time.after()` exigem `local time = require("time")` e `time` na lista `modules` da entrada.

Criação, envio, monitoramento, linking, cancelamento, término e mutações no registro são operações protegidas. Dê à entrada um ator e políticas apenas para as operações e recursos necessários; caso contrário, o modo estrito nega o acesso.

Conceitos-chave:
- Criar processos com `process.spawn()` e variantes
- Enviar mensagens para PIDs ou nomes registrados via tópicos
- Receber mensagens usando `process.listen()` ou `process.inbox()`
- Monitorar ciclo de vida de processos com eventos
- Vincular processos para tratamento coordenado de falhas

## Criando Processos

Crie um novo processo a partir de uma referência de entrada.

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

Parâmetros:
- Referência de entrada (ex: `"app.test.process:echo_worker"`)
- Referência do host (ex: `"app:processes"`)
- Argumentos opcionais passados para a função main do worker

### Obtendo Seu Próprio PID

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## Passagem de Mensagens

Mensagens usam um sistema de roteamento baseado em tópicos. Envie mensagens para PIDs com um tópico, depois receba via inscrição de tópico ou caixa de entrada.

### Enviando Mensagens

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. tostring(err)
end

-- send returns (bool, error)
```

### Recebendo via Inscrição de Tópico

Inscreva-se em tópicos específicos usando `process.listen()`:

```lua
-- Worker that listens for messages on "messages" topic
local function main()
    local ch = process.listen("messages")

    local msg, ok = ch:receive()
    if ok then
        -- msg is the payload directly
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### Recebendo via Caixa de Entrada

A caixa de entrada recebe mensagens que não correspondem a nenhum listener de tópico:

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- Messages to "specific_topic" arrive here
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Messages to any OTHER topic arrive here
            local msg = result.value
            print("Inbox got:", msg:topic(), msg:payload():data())
        end
    end
end
```

### Modo de Mensagem para Info do Remetente

Use `{ message = true }` para acessar PID do remetente e tópico:

```lua
-- Worker that echoes messages back to sender
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local data = msg:payload():data()

        if sender then
            local _, send_err = process.send(sender, "reply", data)
            if send_err then
                return false, "reply failed: " .. tostring(send_err)
            end
        end
        return true
    end

    return false
end

return { main = main }
```

## Monitorando Processos

Monitore processos para receber eventos EXIT quando eles terminarem.

### Spawn com Monitoramento

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Wait for EXIT event
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.result and event.result.error then
        print("Exit error:", event.result.error)
    elseif event.result then
        print("Return value:", event.result.value)
    end
end
```

### Monitoramento Explícito

Monitore um processo já em execução:

```lua
local events_ch = process.events()

-- Spawn without monitoring
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Add monitoring explicitly
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. tostring(monitor_err)
end

-- Now will receive EXIT events for this worker
```

Parar monitoramento:

```lua
local ok, err = process.unmonitor(worker_pid)
if err then
    return false, "unmonitor failed: " .. tostring(err)
end
```

## Vinculação de Processos

Vincule processos para coordenar seus ciclos de vida. Uma saída anormal termina peers vinculados por padrão. Um peer com `trap_links=true` continua executando e recebe um evento `LINK_DOWN`.

### Spawn de Processo Vinculado

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. tostring(err)
end
```

### Vinculação Explícita

```lua
-- Link to existing process
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. tostring(err)
end

-- Unlink
local ok, err = process.unlink(target_pid)
if err then
    return false, "unlink failed: " .. tostring(err)
end
```

### Tratando Eventos LINK_DOWN

Por padrão, uma saída anormal de um peer vinculado termina o processo atual; nenhum evento Lua `LINK_DOWN` é entregue. Ative `trap_links` para continuar executando e receber esse evento:

```lua
local function main()
    -- Enable trap_links to receive LINK_DOWN events instead of crashing
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. tostring(err)
    end

    -- Verify trap_links is enabled
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn a linked process that will fail
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. tostring(err2)
    end

    -- Wait for LINK_DOWN event
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- Handle gracefully instead of crashing
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## Registro de Processos

Registre nomes para processos para permitir lookups e mensagens baseados em nome.

### Registrando Nomes

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- Register current process with a name
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. tostring(err)
    end

    -- Lookup the registered name
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. tostring(lookup_err)
    end

    -- Verify it resolves to our PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Desregistrando Nomes

```lua
-- Unregister explicitly
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup after unregister returns nil + error
local pid, err = process.registry.lookup(test_name)
-- pid will be nil, err will be non-nil
```

Nomes são automaticamente liberados quando o processo termina.

## Exemplo: Pool de Workers Monitorados

Este exemplo parcial mostra um processo pai criando vários workers monitorados e acompanhando sua conclusão. Para usá-lo, defina as entradas pai e `app.test.process:task_worker`, o host `app:processes`, as políticas necessárias e `time` nos módulos de ambas as entradas.

```lua
-- Parent process
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Track spawned workers
    local workers = {}
    local worker_count = 5

    -- Spawn multiple monitored workers
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. tostring(err)
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Wait for all workers to complete
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.result and event.result.error then
                    print("Worker " .. worker.task_id .. " failed:", event.result.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result and event.result.value)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

Processo worker:

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- Simulate work
    time.sleep("100ms")

    -- Process task
    local result = task.value * 2

    return result
end

return { main = main }
```

## Próximos Passos

- [Referência do Módulo Process](lua/core/process.md) - Documentação da API de processos
- [Canais](tutorials/channels.md) - Operações de canal para tratamento de mensagens
