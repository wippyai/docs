# Processos e Mensagens

Crie processos isolados e comunique-se via passagem de mensagens.

## Visão Geral

Processos fornecem unidades de execução isoladas que se comunicam através de passagem de mensagens. Cada processo tem sua própria caixa de entrada e pode se inscrever em tópicos de mensagens específicos.

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
    return false, "spawn failed: " .. err
end

-- pid é um identificador string para o processo criado
print("Started worker:", pid)
```

Parâmetros:
- Referência de entrada (ex: `"app.test.process:echo_worker"`)
- Referência do host (ex: `"app:processes"`)
- Argumentos opcionais passados para a função main do worker

### Obtendo Seu Próprio PID

```lua
local my_pid = process.pid()
-- Retorna o PID string do processo atual
```

## Passagem de Mensagens

Mensagens usam um sistema de roteamento baseado em tópicos. Envie mensagens para PIDs com um tópico, depois receba via inscrição de tópico ou caixa de entrada.

### Enviando Mensagens

```lua
-- Enviar para processo por PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- send retorna (bool, error)
```

### Recebendo via Inscrição de Tópico

Inscreva-se em tópicos específicos usando `process.listen()`:

```lua
-- Worker que escuta mensagens no tópico "messages"
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msg é o payload diretamente
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
            -- Mensagens para "specific_topic" chegam aqui
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Mensagens para QUALQUER OUTRO tópico chegam aqui
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### Modo de Mensagem para Info do Remetente

Use `{ message = true }` para acessar PID do remetente e tópico:

```lua
-- Worker que ecoa mensagens de volta ao remetente
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
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
    return false, "spawn failed: " .. err
end

-- Aguardar evento EXIT
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
    if event.error then
        print("Exit error:", event.error)
    end
    -- Acesse valor de retorno via event.result
end
```

### Monitoramento Explícito

Monitore um processo já em execução:

```lua
local events_ch = process.events()

-- Spawn sem monitoramento
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- Adicionar monitoramento explicitamente
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- Agora receberá eventos EXIT para este worker
```

Parar monitoramento:

```lua
local ok, err = process.unmonitor(worker_pid)
```

## Vinculação de Processos

Vincule processos para gerenciamento coordenado de ciclo de vida. Processos vinculados recebem eventos LINK_DOWN quando processos vinculados falham.

### Spawn de Processo Vinculado

```lua
-- Filho termina se pai falhar (a menos que trap_links esteja definido)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### Vinculação Explícita

```lua
-- Vincular a processo existente
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- Desvincular
local ok, err = process.unlink(target_pid)
```

### Tratando Eventos LINK_DOWN

Por padrão, LINK_DOWN causa a falha do processo. Ative `trap_links` para recebê-lo como um evento:

```lua
local function main()
    -- Ativar trap_links para receber eventos LINK_DOWN em vez de falhar
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- Verificar que trap_links está ativado
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn de processo vinculado que vai falhar
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- Aguardar evento LINK_DOWN
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
        -- Tratar graciosamente em vez de falhar
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

    -- Registrar processo atual com um nome
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- Lookup do nome registrado
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- Verificar que resolve para nosso PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### Desregistrando Nomes

```lua
-- Desregistrar explicitamente
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup após desregistrar retorna nil + error
local pid, err = process.registry.lookup(test_name)
-- pid será nil, err será non-nil
```

Nomes são automaticamente liberados quando o processo termina.

## Exemplo Completo: Pool de Workers Monitorados

Este exemplo mostra um processo pai criando múltiplos workers monitorados e rastreando sua conclusão.

```lua
-- Processo pai
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Rastrear workers criados
    local workers = {}
    local worker_count = 5

    -- Criar múltiplos workers monitorados
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Aguardar todos os workers completarem
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
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
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
    -- Simular trabalho
    time.sleep("100ms")

    -- Processar tarefa
    local result = task.value * 2

    return result
end

return { main = main }
```

## Resumo

Criação de processos:
- `process.spawn()` - Spawn básico, retorna PID
- `process.spawn_monitored()` - Spawn com monitoramento automático
- `process.spawn_linked()` - Spawn com acoplamento de ciclo de vida
- `process.pid()` - Obter PID do processo atual

Mensagens:
- `process.send(pid, topic, payload)` - Enviar mensagem para PID
- `process.listen(topic)` - Inscrever em tópico, receber payloads
- `process.listen(topic, { message = true })` - Receber mensagem completa com `:from()`, `:payload()`, `:topic()`
- `process.inbox()` - Receber mensagens não correspondidas por listeners

Monitoramento:
- `process.events()` - Channel para eventos EXIT e LINK_DOWN
- `process.monitor(pid)` - Monitorar processo existente
- `process.unmonitor(pid)` - Parar monitoramento

Vinculação:
- `process.link(pid)` - Vincular a processo
- `process.unlink(pid)` - Desvincular de processo
- `process.set_options({ trap_links = true })` - Receber LINK_DOWN como evento em vez de falhar
- `process.get_options()` - Obter opções do processo atual

Registro:
- `process.registry.register(name)` - Registrar nome para processo atual
- `process.registry.lookup(name)` - Encontrar PID por nome
- `process.registry.unregister(name)` - Remover registro de nome

## Veja Também

- [Process Module Reference](lua-process.md) - Documentação completa da API
- [Channels](channels.md) - Operações de channel para tratamento de mensagens
