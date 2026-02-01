# Relay WebSocket

O middleware de relay WebSocket atualiza conexoes HTTP para WebSocket e retransmite mensagens para um processo alvo.

## Como Funciona

1. Handler HTTP define header `X-WS-Relay` com PID do processo alvo
2. Middleware atualiza conexao para WebSocket
3. Relay anexa ao processo alvo e o monitora
4. Mensagens fluem bidirecionalmente entre cliente e processo

<warning>
A conexao WebSocket esta vinculada ao processo alvo. Se o processo sair, a conexao fecha automaticamente.
</warning>

## Semantica de Processo

Conexoes WebSocket sao processos completos com seu proprio PID. Elas se integram com o sistema de processos:

- **Enderecavel** - Qualquer processo pode enviar mensagens para um PID WebSocket
- **Monitoravel** - Processos podem monitorar conexoes WebSocket para eventos de saida
- **Linkavel** - Conexoes WebSocket podem ser vinculadas a outros processos
- **Eventos EXIT** - Quando a conexao fecha, monitores recebem notificacoes de saida

```lua
-- Monitora uma conexao WebSocket de outro processo
process.monitor(websocket_pid)

-- Envia mensagem para cliente WebSocket de qualquer processo
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
```

<tip>
O relay monitora o processo alvo. Se o alvo sair, a conexao WebSocket fecha automaticamente e o cliente recebe um frame de fechamento.
</tip>

## Transferencia de Conexao

Conexoes podem ser transferidas para um processo diferente enviando uma mensagem de controle:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
```

## Configuracao

Adicione como middleware pos-match em um roteador:

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

| Opcao | Descricao |
|-------|-----------|
| `wsrelay.allowed.origins` | Origens permitidas separadas por virgula |

<note>
Se nenhuma origem configurada, apenas requisicoes same-origin sao permitidas.
</note>

## Configuracao do Handler

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

### Campos de Configuracao do Relay

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `target_pid` | string | obrigatorio | PID do processo para receber mensagens |
| `message_topic` | string | `ws.message` | Topico para mensagens do cliente |
| `heartbeat_interval` | duration | - | Frequencia de heartbeat (ex: `30s`) |
| `metadata` | object | - | Anexado a todas as mensagens |

## Topicos de Mensagens

O relay envia estas mensagens para o processo alvo:

| Topico | Quando | Payload |
|--------|--------|---------|
| `ws.join` | Cliente conecta | `client_pid`, `metadata` |
| `ws.message` | Cliente envia mensagem | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | Periodico (se configurado) | `client_pid`, `uptime`, `message_count` |
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

-- Envia binario
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- Fecha conexao
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Sessao encerrada"
})
```

## Broadcast

Rastreie PIDs de clientes para broadcast para multiplos clientes:

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
Para cenarios complexos de multiplas salas, crie um processo handler separado por sala ou use um processo gerenciador central que rastreia membros de salas.
</tip>

## Veja Tambem

- [Middleware](http-middleware.md) - Configuracao de middleware
- [Processo](lua-process.md) - Mensagens de processo
- [Cliente WebSocket](lua-websocket.md) - Conexoes WebSocket de saida
