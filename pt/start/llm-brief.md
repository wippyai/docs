---
title: "Resumo para LLM"
description: "Conceitos centrais, estrutura de projeto, APIs e convenções do Wippy para agentes que geram código Wippy."
---

# Resumo para LLM

Use este resumo como contexto inicial ao gerar código para um projeto Wippy.

**Classificação: referência para geração.** Os blocos abaixo são padrões de contrato específicos, não um único projeto executável. IDs de registro, schemas, políticas e valores específicos da aplicação, como `user_id`, `config` e `content`, precisam ser definidos pelo projeto que os utiliza.

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
    modules: [sql]

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

local function get_user(id)
    local db, err = sql.get("app:main_db")
    if err then return nil, err end

    local rows, err = db:query("SELECT * FROM users WHERE id = $1", {id})
    if err then
        local _, release_err = db:release()
        return nil, release_err or err
    end

    local _, release_err = db:release()
    if release_err then return nil, release_err end
    if #rows == 0 then
        return nil, errors.new({kind = errors.NOT_FOUND, message = "user not found"})
    end

    return rows[1]
end

return get_user
```

Para manipuladores HTTP, use o módulo `http`:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.api:get_user", id)
    if err then
        local status_err
        if errors.is(err, errors.NOT_FOUND) then
            status_err = res:set_status(404)
        else
            status_err = res:set_status(500)
        end
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = err:message()})
        if write_err then return nil, write_err end
        return true
    end

    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
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

        if not r.ok then break end

        if r.channel == events then
            local ev = r.value
            if ev.kind == process.event.CANCEL then
                break
            end
        elseif r.channel == inbox then
            local msg = r.value
            local topic = msg:topic()
            local data, err = msg:payload():data()
            if err then return nil, err end

            if topic == "work" then
                -- Perform the application-specific work here.
                print(data.item_id)
            end
        end
    end
end

return worker
```

Gere processos a partir de outro código:

```lua
local pid, err = process.spawn("app.workers:task", "app:process_host", config)
if err then return nil, err end

local ok, send_err = process.send(pid, "work", {item_id = 123})
if send_err then return nil, send_err end
return ok
```

## Escrevendo workflows

Workflows mantêm o histórico de execução para que possam continuar após falhas ou reinicializações. O código do workflow usa a sintaxe normal de Lua, enquanto o runtime registra resultados de funções, sleeps e valores aleatórios para permitir replay determinístico.

Cada destino de `funcs.call()` abaixo precisa ser registrado como atividade no mesmo worker Temporal por meio de `meta.temporal.activity.worker`. Consulte [Atividades](../temporal/activities.md) para conhecer os metadados de função exigidos.

```lua
local funcs = require("funcs")

local function compensate(inventory, payment)
    local _, refund_err = funcs.call("app:refund_payment", payment.id)
    local _, release_err = funcs.call("app:release_inventory", inventory.id)
    return refund_err or release_err
end

local function order_flow(order)
    local inventory, err = funcs.call("app:reserve_inventory", order.items)
    if err then return nil, err end

    local payment, payment_err = funcs.call("app:charge_payment", order.total)
    if payment_err then
        local _, release_err = funcs.call("app:release_inventory", inventory.id)
        return nil, release_err or payment_err
    end

    -- Wait for approval signal (can block for days)
    local msg, open = process.inbox():receive()
    if not open then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("workflow inbox closed")
    end

    local decision, payload_err = msg:payload():data()
    if payload_err then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or payload_err
    end
    if not decision.approved then
        local compensation_err = compensate(inventory, payment)
        return nil, compensation_err or errors.new("rejected")
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
if err then return nil, err end

-- Asynchronous (returns Future)
local future, future_err = funcs.async("namespace:function_name", arg1)
if future_err then return nil, future_err end
local response_ch = future:response()
local _, response_open = response_ch:receive()
if not response_open then
    return nil, errors.new("future response channel closed")
end
local async_payload, async_err = future:result()
if async_err then return nil, async_err end
local async_result, decode_err = async_payload:data()
if decode_err then return nil, decode_err end

-- With context
local contextual_exec, contextual_err = funcs.new():with_context({user_id = "123"})
if contextual_err then return nil, contextual_err end
local contextual_result, contextual_err = contextual_exec:call("namespace:function_name")
if contextual_err then return nil, contextual_err end
```

### Comunicação entre processos

```lua
-- Send message (fire-and-forget)
local ok, err = process.send(pid, "topic", data)
if err then return nil, err end

-- Receive messages
local inbox = process.inbox()
local msg, ok = inbox:receive()
if not ok then return nil, errors.new("process inbox closed") end
local topic = msg:topic()
local data, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

-- Monitor another process (receive EXIT on death)
local monitored, monitor_err = process.monitor(pid)
if monitor_err then return nil, monitor_err end

-- Link processes (bidirectional failure notification)
local linked_pid, spawn_err = process.spawn_linked("namespace:name", "host")
if spawn_err then return nil, spawn_err end
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
local db, db_err = sql.get("app:main_db")
if db_err then return nil, db_err end
local rows, err = db:query("SELECT * FROM users WHERE active = $1", {true})
if err then
    local _, release_err = db:release()
    return nil, release_err or err
end
local _, release_err = db:release()
if release_err then return nil, release_err end

-- Key-value store
local store = require("store")
local cache, cache_err = store.get("app:cache")
if cache_err then return nil, cache_err end
local stored, set_err = cache:set("key", value, 3600)  -- TTL in seconds
if set_err then
    cache:release()
    return nil, set_err
end
local val, get_err = cache:get("key")
cache:release()
if get_err then return nil, get_err end

-- Queue
local queue = require("queue")
local published, publish_err = queue.publish("app:tasks", {task = "process", id = 123})
if publish_err then return nil, publish_err end

-- Filesystem
local fs = require("fs")
local vol, volume_err = fs.get("app:storage")
if volume_err then return nil, volume_err end
local data, read_err = vol:readfile("path/to/file.txt")
if read_err then return nil, read_err end
local written, write_err = vol:writefile("output.txt", content)
if write_err then return nil, write_err end
```

### Cliente HTTP

```lua
local http_client = require("http_client")

local resp, err = http_client.get("https://api.example.com/data", {
    headers = {Authorization = "Bearer token"},
    timeout = "10s"
})
if err then return nil, err end
local body = resp.body
```

### Segurança

```lua
local security = require("security")

local actor = security.actor()       -- who is calling
local scope = security.scope()       -- what permissions apply
if not actor then return nil, errors.new("security actor unavailable") end
if not scope then return nil, errors.new("security scope unavailable") end
local allowed = security.can("read", "resource:users")

-- Token management
local ts, store_err = security.token_store("app:tokens")
if store_err then return nil, store_err end
local token, create_err = ts:create(actor, scope, {expiration = "24h"})
if create_err then
    ts:close()
    return nil, create_err
end
local validated_actor, validated_scope, validate_err = ts:validate(token)
ts:close()
if validate_err then return nil, validate_err end
```

### Tempo

```lua
local time = require("time")

time.sleep("5s")
local now = time.now()
local timeout, timeout_err = time.after("30s")  -- channel that fires once
if timeout_err then return nil, timeout_err end
local ticker, ticker_err = time.ticker("10s")  -- repeating channel
if ticker_err then return nil, ticker_err end
-- Stop the ticker when its consumer finishes.
ticker:stop()
```

### Registro

```lua
local registry = require("registry")

local entry, entry_err = registry.get("app.api:get_user")
if entry_err then return nil, entry_err end
local tests, find_err = registry.find({["meta.type"] = "test"})
if find_err then return nil, find_err end

-- Create entries at runtime
local snap, snapshot_err = registry.snapshot()
if snapshot_err then return nil, snapshot_err end
local changes, changes_err = snap:changes()
if changes_err then return nil, changes_err end
local _, create_err = changes:create({id = "app:new_func", kind = "function.lua", data = {...}})
if create_err then return nil, create_err end
local version, apply_err = changes:apply()
if apply_err then return nil, apply_err end
```

### Eventos

```lua
local events = require("events")

-- Publish
local sent, send_err = events.send("orders", "order.created", "/orders/123", {order_id = "123"})
if send_err then return nil, send_err end

-- Subscribe (wildcards supported)
local sub, subscribe_err = events.subscribe("orders.*")
if subscribe_err then return nil, subscribe_err end
local ch = sub:channel()
local evt, open = ch:receive()
sub:close()
if not open then return nil, errors.new("event subscription closed") end
```

## Controle de acesso a módulos

Cada entrada recebe o ambiente-base restrito e as bibliotecas padrão, e entradas executáveis também recebem o módulo ambiente `process`. Adicione módulos de runtime não ambientes a `modules:` e bibliotecas baseadas no registro a `imports:`. Módulos não ambientes que não forem declarados ficam indisponíveis. Recursos Lua do host como `os.execute`, `io.open`, `debug.*`, carregamento de módulos nativos e resolução arbitrária de `package.path` não são expostos como módulos de runtime opcionais. O runtime controla a disponibilidade pelo carregador de módulos, em vez de percorrer o código-fonte.

```yaml
modules: [sql, json, http, time, funcs, store]
```

Entradas de workflow recebem somente módulos determinísticos. O runtime intercepta `time.now()`, `uuid.v4()` e outras chamadas não determinísticas no nível do módulo, registrando resultados para replay.

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

A documentação completa está disponível em [docs.wippy.ai](https://docs.wippy.ai). Endpoints amigáveis para LLMs:

- Explorar estrutura: `https://wippy.ai/llm/toc`
- Busca: `https://wippy.ai/llm/search?q=query`
- Obter página: `https://wippy.ai/llm/path/en/<path>`
- Obter em lote: `https://wippy.ai/llm/context?paths=path1,path2`
