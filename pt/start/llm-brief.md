---
title: "Resumo para LLM"
description: "Esta página é para agentes de IA e LLMs. Se você está construindo sobre o Wippy ou gerando código para um projeto Wippy, leia isto primeiro."
---

# Resumo para LLM

Esta página é para agentes de IA e LLMs. Se você está construindo sobre o Wippy ou gerando código para um projeto Wippy, leia isto primeiro.

## O que é o Wippy

O Wippy é um runtime de aplicação de binário único construído sobre o modelo de atores. Ele executa código Lua em processos isolados com troca de mensagens — sem memória compartilhada, sem locks. Existem três modelos de computação: funções (sem estado, com escopo de requisição), processos (atores de longa duração com estado) e workflows (atores duráveis apoiados pelo Temporal que sobrevivem a falhas). O sistema é projetado para que agentes possam gerar código, registrá-lo e melhorar aplicações sem redeploy.

## Modelo mental

Tudo no Wippy é uma **entrada de registro** (registry entry). As entradas têm um ID (`namespace:name`), um tipo (que determina o comportamento), metadados e dados. Arquivos YAML são uma forma de declarar entradas, mas o registro é a fonte da verdade em tempo de execução e as entradas podem ser criadas, atualizadas ou excluídas enquanto o sistema está em execução.

Os tipos determinam o que uma entrada faz:

- `function.lua` — função invocável sem estado
- `process.lua` — ator de longa duração
- `workflow.lua` — workflow durável (Temporal)
- `http.service` — servidor HTTP
- `http.router` — grupo de rotas com middleware
- `http.endpoint` — manipulador HTTP
- `db.sql.postgres` / `mysql` / `sqlite` — conexão com banco de dados
- `store.memory` / `store.sql` — armazenamento chave-valor
- `queue.queue` — fila de mensagens
- `process.host` — host de execução de processos
- `process.service` — processo supervisionado
- `contract.definition` / `contract.binding` — interfaces de serviço tipadas
- `registry.entry` — dados de configuração

## Estrutura do projeto

```
myapp/
├── .wippy.yaml              # Runtime configuration
├── wippy.lock               # Source directories
└── src/
    ├── _index.yaml          # Entry definitions (namespace: app)
    ├── api/
    │   ├── _index.yaml      # namespace: app.api
    │   └── handler.lua
    └── workers/
        ├── _index.yaml      # namespace: app.workers
        └── task.lua
```

As definições de entradas ficam em arquivos `_index.yaml`:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    source: file://handler.lua
    method: get_user
    modules: [sql, json]

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      router: app:api_router
    method: GET
    path: /users/{id}
    func: app.api:get_user
```

## Escrevendo funções

As funções não têm estado. Elas recebem argumentos, executam trabalho e retornam resultados. Elas herdam o contexto do chamador e são canceladas se o chamador cancelar.

```lua
local sql = require("sql")
local json = require("json")
local http = require("http")

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", id)
    if err then return nil, err end
    if #rows == 0 then return nil, errors.new(errors.NOT_FOUND, "user not found") end

    return rows[1]
end

return get_user
```

Para manipuladores HTTP, use o módulo `http`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local id = req:param("id")
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        res:set_status(404)
        res:write_json({error = err:message()})
        return
    end

    res:write_json(user)
end

return handler
```

## Escrevendo processos

Processos são atores. Eles têm seu próprio PID, recebem mensagens por meio de uma caixa de entrada e mantêm estado entre mensagens. Eles cedem (yield) em I/O bloqueante, permitindo que milhares rodem concorrentemente.

```lua
local function worker(initial_config)
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local ev = r.value
            if ev.type == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()
            handle_message(topic, data)
        end
    end
end

return worker
```

Gere processos a partir de outro código:

```lua
local pid = process.spawn("app.workers:task", "app:process_host", config)
process.send(pid, "work", {item_id = 123})
```

## Escrevendo workflows

Workflows são duráveis — sobrevivem a falhas e reinícios. O código se parece com Lua normal. O runtime registra automaticamente os resultados de chamadas de função, sleeps e valores aleatórios para que o replay seja determinístico.

```lua
local function order_flow(order)
    local inventory = funcs.call("app:reserve_inventory", order.items)
    if not inventory then
        return nil, errors.new("out of stock")
    end

    local payment = funcs.call("app:charge_payment", order.total)
    if not payment then
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("payment failed")
    end

    -- Wait for approval signal (can block for days)
    local msg = process.inbox():receive()
    if not msg:payload():data().approved then
        funcs.call("app:refund_payment", payment.id)
        funcs.call("app:release_inventory", inventory.id)
        return nil, errors.new("rejected")
    end

    return funcs.call("app:fulfill_order", order.id)
end

return order_flow
```

## APIs principais

### Chamando funções

```lua
local funcs = require("funcs")

-- Synchronous
local result, err = funcs.call("namespace:function_name", arg1, arg2)

-- Asynchronous (returns Future)
local future = funcs.async("namespace:function_name", arg1)
local result, err = future:result()

-- With context
local exec = funcs.new():with_context({user_id = "123"})
exec:call("namespace:function_name")
```

### Comunicação entre processos

```lua
-- Send message (fire-and-forget)
process.send(pid, "topic", data)

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
local topic = msg:topic()
local data = msg:payload():data()

-- Monitor another process (receive EXIT on death)
process.monitor(pid)

-- Link processes (bidirectional failure notification)
process.spawn_linked("namespace:name", "host")
```

### Canais

Canais no estilo Go para comunicação entre corrotinas:

```lua
local ch = channel.new(10)  -- buffered
ch:send(value)
local val, ok = ch:receive()

-- Select on multiple channels
local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive(),
    timeout:case_receive()
}
```

### Tratamento de erros

As funções retornam pares `result, error`. Erros são objetos tipados:

```lua
local result, err = some_operation()
if err then
    if errors.is(err, errors.NOT_FOUND) then
        -- handle not found
    end
    return nil, errors.wrap(err, "context message")
end
```

Tipos de erro: `UNKNOWN`, `INVALID`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `TIMEOUT`, `CANCELED`, `UNAVAILABLE`, `INTERNAL`, `CONFLICT`, `RATE_LIMITED`.

### Acesso a dados

```lua
-- SQL
local sql = require("sql")
local db = sql.get("app:main_db")
local rows, err = db:query("SELECT * FROM users WHERE active = $1", true)
db:execute("INSERT INTO users (name) VALUES ($1)", name)

-- Key-value store
local store = require("store")
local cache = store.get("app:cache")
cache:set("key", value, 3600)  -- TTL in seconds
local val = cache:get("key")

-- Queue
local queue = require("queue")
queue.publish("app:tasks", {task = "process", id = 123})

-- Filesystem
local fs = require("fs")
local vol = fs.get("app:storage")
local data = vol:readfile("path/to/file.txt")
vol:writefile("output.txt", content)
```

### Cliente HTTP

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
local body = resp.body
```

### Segurança

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
local allowed = security.can("read", "resource:users")

-- Token management
local ts = security.token_store("app:tokens")
local token = ts:create(actor, scope, {expiration = "24h"})
local validated_actor, validated_scope = ts:validate(token)
```

### Tempo

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout = time.after("30s")  -- channel that fires once
local ticker = time.ticker("10s")  -- repeating channel
```

### Registro

```lua
local registry = require("registry")

local entry = registry.get("app.api:get_user")
local tests = registry.find({["meta.type"] = "test"})

-- Create entries at runtime
local snap = registry.snapshot()
local changes = snap:changes()
changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
changes:apply()
```

### Eventos

```lua
local events = require("events")

-- Publish
events.send("orders", "order.created", "/orders/123", {order_id = "123"})

-- Subscribe (wildcards supported)
local sub = events.subscribe("orders.*")
local ch = sub:channel()
local evt = ch:receive()
```

## Controle de acesso a módulos

Cada entrada declara quais módulos ela pode `require()`. Módulos não listados simplesmente não estão disponíveis — não existe `os.execute`, `io.open`, `debug.*` ou `package.*` a menos que você os conceda explicitamente. O runtime não escaneia nem valida o código-fonte; ele controla o acesso no nível do módulo. Se um módulo não está na lista, ele não existe para essa entrada.

```yaml
modules: [sql, json, http, time, funcs, store]
```

É assim também que o determinismo de workflows funciona — entradas de workflow recebem apenas módulos determinísticos. O runtime intercepta `time.now()`, `uuid.v4()` e outras chamadas não-determinísticas no nível do módulo, registrando resultados para replay.

## Módulos do framework

O Wippy tem módulos de framework instalados via dependências:

- **wippy/llm** — integração com LLM (OpenAI, Anthropic, Google). `llm.generate()`, saída estruturada, embeddings, streaming.
- **wippy/agent** — framework de agentes com uso de ferramentas, delegação, traits, memória. Agentes definidos como entradas do registro.
- **wippy/test** — testes BDD. Blocos `describe/it`, asserções, mocking.
- **wippy/dataflow** — orquestração de workflows baseada em DAG. Nós Function, Agent, Cycle, Parallel.
- **wippy/relay** — relay WebSocket com hub central, hubs por usuário, roteamento de plugins.
- **wippy/views** — sistema de páginas e componentes com renderização de templates.
- **wippy/facade** — fachada iframe frontend com ponte de autenticação.

## Convenções

- IDs de entrada usam o formato `namespace:name`
- Nomes usam pontos para separação semântica, sublinhados para palavras: `get_user.endpoint`
- Funções retornam `result, error` — sempre verifique o erro
- Processos se comunicam via troca de mensagens, nunca por estado compartilhado
- Use `channel.select` para multiplexar múltiplas fontes de eventos
- Árvores de supervisão lidam com falhas — projete para "let it crash"
- Contexto (trace IDs, info do usuário, segurança) se propaga automaticamente através de chamadas de função
- Workflows não devem usar operações não-determinísticas diretamente — o runtime lida com isso para `funcs.call`, `time.sleep`, `uuid.v4`, `time.now`

## Documentação

A documentação completa está disponível em [wippy.ai/docs](https://wippy.ai/docs). Endpoints amigáveis para LLMs:

- Explorar estrutura: `https://wippy.ai/llm/toc`
- Busca: `https://wippy.ai/llm/search?q=query`
- Obter página: `https://wippy.ai/llm/path/en/<path>`
- Obter em lote: `https://wippy.ai/llm/context?paths=path1,path2`
