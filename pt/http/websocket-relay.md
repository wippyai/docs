---
title: "Relay WebSocket"
description: "O middleware de relay WebSocket faz upgrade de conexões HTTP para WebSocket e retransmite mensagens para um processo alvo."
---

# Relay WebSocket

O middleware `websocket_relay` faz o upgrade de uma conexão HTTP e retransmite mensagens WebSocket para um processo alvo.

**Classificação: referência de protocolo com receitas parciais de integração.** Os blocos pressupõem um servidor HTTP, roteador, host de processos, processo alvo e contexto de segurança. Os handlers de mensagens e a limpeza do estado do cliente pertencem à aplicação.

## Como Funciona

1. Handler HTTP define header `X-WS-Relay` com PID do processo alvo
2. Middleware atualiza conexão para WebSocket
3. Relay anexa ao processo alvo e o monitora
4. Mensagens fluem bidirecionalmente entre cliente e processo

## Semântica de Processo

Conexões WebSocket são processos completos com seu próprio PID. Elas se integram com o sistema de processos:

- **Endereçável** - Qualquer processo pode enviar mensagens para um PID WebSocket
- **Monitorável** - Processos podem monitorar conexões WebSocket para eventos de saída
- **Linkável** - Conexões WebSocket podem ser vinculadas a outros processos
- **Eventos EXIT** - Quando a conexão fecha, monitores recebem notificações de saída

```lua
-- Monitor a WebSocket connection from another process
local _, monitor_err = process.monitor(websocket_pid)
if monitor_err then return nil, monitor_err end

-- Send a message to the WebSocket client from any process.
-- The relay wraps it as {topic, data} JSON; the topic name is arbitrary.
local _, send_err = process.send(websocket_pid, "update", "hello")
if send_err then return nil, send_err end
```

<tip>
O relay monitora o processo alvo. Se o alvo sair, a conexão WebSocket fecha automaticamente e o cliente recebe um frame de fechamento.
</tip>

## Transferência de Conexão

Conexões podem ser transferidas para um processo diferente enviando uma mensagem de controle:

```lua
local _, transfer_err = process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
if transfer_err then return nil, transfer_err end
```

## Configuração

Adicione como middleware pós-match em um roteador:

```yaml
- name: ws_router
  kind: http.router
  meta:
    server: gateway
  prefix: /ws
  post_middleware:
    - websocket_relay
  post_options:
    wsrelay.allowed.origins: "https://app.example.com"
```

| Opção | Descrição |
|-------|-----------|
| `wsrelay.allowed.origins` | Origens permitidas separadas por vírgula |

<note>
Se nenhuma origem configurada, apenas requisições same-origin são permitidas.
</note>

## Configuração do Handler

O handler HTTP cria um processo e configura o relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, query_err = req:query("user_id")
    if query_err then return nil, query_err end

    -- Spawn handler process
    local pid, spawn_err = process.spawn("app.ws:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-WS-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
end
```

### Campos de Configuração do Relay

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `target_pid` | string | obrigatório | PID do processo para receber mensagens |
| `message_topic` | string | `ws.message` | Tópico para mensagens do cliente |
| `heartbeat_interval` | duration | `30s` | Frequência de heartbeat (por exemplo, `30s`) |
| `metadata` | object | - | Anexado às notificações de join, leave e heartbeat |

## Tópicos de Mensagens

O relay envia estas mensagens para o processo alvo:

| Tópico | Quando | Payload |
|--------|--------|---------|
| `ws.join` | Cliente conecta | JSON `{client_pid, metadata}` |
| `ws.message` (ou seu `message_topic`) | Cliente envia mensagem | Payload bruto do cliente (frame de texto → formato String; frame binário → formato Bytes); `payload:data()` retorna uma string Lua em ambos os casos e o PID de origem é o PID do cliente |
| `ws.heartbeat` | Periódico (a cada 30s por padrão; intervalo substituível por `heartbeat_interval`) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | Cliente desconecta | JSON `{client_pid, metadata}` |

## Recebendo Mensagens

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- client connection PID

        if topic == "ws.join" then
            -- Client connected — payload is {client_pid, metadata}
            local data, payload_err = msg:payload():data()
            if payload_err then return nil, payload_err end
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Raw client message; from() is the client PID
            local incoming = msg:payload()
            local frame_format = incoming:get_format()     -- "text/plain" or "application/octet-stream"
            local body, payload_err = incoming:data()      -- Lua string in either case
            if payload_err then return nil, payload_err end
            -- Decode or dispatch `body` according to `frame_format` and the
            -- application's protocol.

        elseif topic == "ws.leave" then
            -- Client disconnected — payload is {client_pid, metadata}
            -- Release application state associated with `from`.
        end
    end
end
```

## Enviando para o Cliente

Envie mensagens de volta usando o PID do cliente. Qualquer tópico escolhido é encapsulado como JSON `{topic, data}` e encaminhado ao WebSocket. Toda mensagem do servidor para o cliente é enviada como um único frame de texto WebSocket contendo o wrapper. Tabelas permanecem objetos JSON em `data`, e strings permanecem strings. Payloads que chegam ao relay no formato Bytes são codificados em base64 em `data`; não são enviados como frames binários separados. `process.send` em Lua exporta seus argumentos como payloads no formato Lua, portanto uma string Lua não segue o caminho de Bytes.

```lua
-- Send a structured message (any topic name)
local _, send_err = process.send(client_pid, "update", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Close connection (payload is the close reason string)
local _, close_err = process.send(client_pid, "ws.close", "Session ended")
if close_err then return nil, close_err end
```

Os tópicos reservados de servidor -> cliente são `ws.control` (reconfiguração do relay) e `ws.close` (fechar a conexão).

## Broadcast

Rastreie PIDs de clientes para broadcast para múltiplos clientes:

```lua
local clients = {}

-- On join
clients[client_pid] = true

-- On leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    for pid, _ in pairs(clients) do
        local _, send_err = process.send(pid, "broadcast", message)
        if send_err then return nil, send_err end
    end
    return true
end
```

<tip>
Para cenários complexos de múltiplas salas, crie um processo handler separado por sala ou use um processo gerenciador central que rastreia membros de salas.
</tip>

## Veja Também

- [Middleware](./middleware.md) - Configuração de middleware
- [Processo](../lua/core/process.md) - Mensagens de processo
- [Cliente WebSocket](../lua/http/websocket.md) - Conexões WebSocket de saída
