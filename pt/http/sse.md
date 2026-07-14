---
title: "Server-Sent Events"
description: "O middleware SSE transmite eventos do servidor para clientes HTTP usando o protocolo Server-Sent Events."
---

# Server-Sent Events

O middleware SSE transmite eventos do servidor para clientes HTTP usando o protocolo [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

Dois mecanismos estão disponíveis: **streaming direto** a partir de um handler HTTP e **relay baseado em processo** via o middleware `sse_relay`.

## Streaming Direto

Use `res:write_event()` para enviar eventos SSE diretamente de um handler HTTP. A resposta automaticamente alterna para o modo SSE na primeira chamada, definindo os cabeçalhos apropriados.

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

Cada evento exige um campo `name` e `data`. O valor de `data` é codificado como JSON automaticamente.

<tip>
O streaming direto é adequado para fluxos de requisição-resposta de curta duração, como atualizações de progresso. Para conexões de longa duração gerenciadas por processos em segundo plano, use o SSE Relay.
</tip>

## SSE Relay

O middleware SSE Relay cria streams SSE de longa duração apoiados por processos. Ele segue o mesmo padrão de relay do [WebSocket Relay](http/websocket-relay.md).

### Como Funciona

1. O handler HTTP define o cabeçalho `X-SSE-Relay` com uma configuração de relay JSON
2. O middleware intercepta a resposta e cria uma sessão SSE
3. A sessão é registrada como um processo com seu próprio PID
4. Mensagens enviadas ao PID da sessão são encaminhadas como eventos SSE para o cliente

## Semântica de Processos

Streams SSE são processos completos com seu próprio PID. Eles se integram ao sistema de processos:

- **Endereçáveis** — Qualquer processo pode enviar mensagens para um PID de stream
- **Monitoráveis** — Processos podem monitorar streams SSE para eventos de saída
- **Vinculáveis** — Streams SSE podem ser vinculados a outros processos
- **Eventos EXIT** — Quando um stream fecha, monitores recebem notificações de saída

```lua
-- Envia evento ao cliente SSE a partir de qualquer processo
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- Monitora um stream SSE
process.monitor(stream_pid)
```

<tip>
O relay monitora o processo alvo. Se o alvo sair, o stream SSE fecha automaticamente e o cliente recebe um evento <code>done</code>.
</tip>

## Configuração

Adicione como middleware pós-correspondência em um roteador:

```yaml
- name: sse_router
  kind: http.router
  meta:
    server: gateway
  prefix: /sse
  post_middleware:
    - sse_relay
  post_options:
    sserelay.allowed.origins: "https://app.example.com"
```

| Opção | Descrição |
|--------|-------------|
| `sserelay.allowed.origins` | Origens permitidas separadas por vírgula (suporta curingas) |

<note>
Se nenhuma origem for configurada, apenas requisições de mesma origem são permitidas.
</note>

## Configuração do Handler

O handler HTTP gera um processo e configura o relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- Gera o processo handler
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- Configura o relay
    res:set_header("X-SSE-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = http.request():query("user_id")
        }
    }))
end
```

### Campos da Configuração de Relay

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `target_pid` | string | — | PID do processo que recebe mensagens (omita para modo desanexado) |
| `message_topic` | string | `sse.message` | Filtro de tópico para eventos encaminhados |
| `heartbeat_interval` | duration | `30s` | Frequência de heartbeat (ex: `30s`, `1m`) |
| `idle_timeout` | duration | — | Fecha o stream após inatividade |
| `hard_timeout` | duration | — | Fecha o stream após duração absoluta |
| `metadata` | object | — | Anexado a mensagens de join/leave/heartbeat |

## Modo Gerenciado vs Desanexado

### Modo Gerenciado

Quando `target_pid` está definido, o relay opera em modo gerenciado:

- Monitora o processo alvo
- Envia `sse.join` ao conectar e `sse.leave` ao desconectar
- Fecha o stream automaticamente se o alvo sair

### Modo Desanexado

Quando `target_pid` é omitido, o relay inicia em modo desanexado:

- Emite um evento `ready` ao cliente com `stream_pid` e `message_topic`
- Nenhum processo é monitorado inicialmente
- Um processo pode anexar-se posteriormente enviando uma mensagem `sse.control`

```lua
-- Configuração desanexada: sem target_pid
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

O cliente recebe um evento `ready`:

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## Tópicos de Mensagens

O relay usa estes tópicos para comunicação entre o stream e o processo alvo:

| Tópico | Direção | Quando | Payload |
|-------|-----------|------|---------|
| `sse.join` | stream → alvo | Cliente conecta | `client_pid`, `metadata` |
| `sse.message` | alvo → stream | Tópico de evento padrão | Encaminhado como evento SSE |
| `sse.heartbeat` | stream → alvo | Periódico (se configurado) | `client_pid`, `uptime`, `message_count` |
| `sse.leave` | stream → alvo | Cliente desconecta | `client_pid`, `metadata` |
| `sse.control` | qualquer → stream | Comando de controle | Campos de configuração do relay |
| `sse.close` | qualquer → stream | Forçar fechamento | String de motivo opcional |

## Recebendo no Processo Alvo

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Verificação periódica de saúde

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## Enviando Eventos

Envie eventos ao cliente enviando mensagens para o PID do stream:

```lua
-- Envia no tópico de mensagem padrão
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- Força o fechamento do stream
process.send(stream_pid, "sse.close", "session expired")
```

Eventos enviados no `message_topic` configurado são encaminhados ao cliente como eventos SSE. O nome do tópico se torna o nome do evento SSE.

## Transferência de Conexão

Envie uma mensagem de controle para alterar dinamicamente o processo alvo, o filtro de tópico ou os timeouts:

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

Quando o alvo muda, o relay envia `sse.leave` para o alvo antigo e `sse.join` para o novo. Defina `target_pid` como string vazia para desanexar sem reanexar.

## Veja Também

- [Middleware](http/middleware.md) — Configuração de middleware
- [WebSocket Relay](http/websocket-relay.md) — Equivalente WebSocket
- [Process](lua/core/process.md) — Mensageria de processos
