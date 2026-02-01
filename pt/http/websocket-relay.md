# Relay WebSocket

O middleware de relay WebSocket atualiza conexões HTTP para WebSocket e retransmite mensagens para um processo alvo.

## Como Funciona

1. Handler HTTP define header `X-WS-Relay` com PID do processo alvo
2. Middleware atualiza conexão para WebSocket
3. Relay anexa ao processo alvo e o monitora
4. Mensagens fluem bidirecionalmente entre cliente e processo

<warning>
A conexão WebSocket está vinculada ao processo alvo. Se o processo sair, a conexão fecha automaticamente.
</warning>

## Semântica de Processo

Conexões WebSocket são processos completos com seu próprio PID. Elas se integram com o sistema de processos:

- **Endereçável** - Qualquer processo pode enviar mensagens para um PID WebSocket
- **Monitorável** - Processos podem monitorar conexões WebSocket para eventos de saída
- **Linkável** - Conexões WebSocket podem ser vinculadas a outros processos
- **Eventos EXIT** - Quando a conexão fecha, monitores recebem notificações de saída

```lua
-- Monitora uma conexão WebSocket de outro processo
process.monitor(websocket_pid)

-- Envia mensagem para cliente WebSocket de qualquer processo
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
```

<tip>
O relay monitora o processo alvo. Se o alvo sair, a conexão WebSocket fecha automaticamente e o cliente recebe um frame de fechamento.
</tip>

## Transferência de Conexão

Conexões podem ser transferidas para um processo diferente enviando uma mensagem de controle:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
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
    local req = http.request()
    local res = http.response()

    -- Cria processo handler
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- Configura relay
    res:header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = req:query("user_id")
        }
    }))
end
```

### Campos de Configuração do Relay

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `target_pid` | string | obrigatório | PID do processo para receber mensagens |
| `message_topic` | string | `ws.message` | Tópico para mensagens do cliente |
| `heartbeat_interval` | duration | - | Frequência de heartbeat (ex: `30s`) |
| `metadata` | object | - | Anexado a todas as mensagens |

## Tópicos de Mensagens

O relay envia estas mensagens para o processo alvo:

| Tópico | Quando | Payload |
|--------|--------|---------|
| `ws.join` | Cliente conecta | `client_pid`, `metadata` |
| `ws.message` | Cliente envia mensagem | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | Periódico (se configurado) | `client_pid`, `uptime`, `message_count` |
| `ws.leave` | Cliente desconecta | `client_pid`, `reason`, `metadata` |

## Recebendo Mensagens

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "ws.join" then
            -- Cliente conectou
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Trata mensagem do cliente
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- Cliente desconectou
            cleanup(data.client_pid)
        end
    end
end
```

## Enviando para o Cliente

Envia mensagens de volta usando o PID do cliente:

```lua
-- Envia mensagem de texto
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- Envia binário
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- Fecha conexão
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Sessão encerrada"
})
```

## Broadcast

Rastreie PIDs de clientes para broadcast para múltiplos clientes:

```lua
local clients = {}

-- No join
clients[client_pid] = true

-- No leave
clients[client_pid] = nil

-- Broadcast
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "ws.send", {type = "text", data = data})
    end
end
```

<tip>
Para cenários complexos de múltiplas salas, crie um processo handler separado por sala ou use um processo gerenciador central que rastreia membros de salas.
</tip>

## Veja Também

- [Middleware](http-middleware.md) - Configuração de middleware
- [Processo](lua-process.md) - Mensagens de processo
- [Cliente WebSocket](lua-websocket.md) - Conexões WebSocket de saída
