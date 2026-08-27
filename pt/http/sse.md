---
title: "Server-Sent Events"
description: "Transmita eventos curtos de handlers ou eventos de longa duração apoiados por processos por Server-Sent Events."
---

# Server-Sent Events

O middleware SSE transmite eventos do servidor para clientes HTTP usando o protocolo [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

Dois mecanismos estão disponíveis: **streaming direto** a partir de um handler HTTP e **relay baseado em processo** via o middleware `sse_relay`.

**Classificação: referência de protocolo com receitas parciais de integração.** Os blocos de relay pressupõem que já existam um servidor HTTP, roteador, host de processos, processo alvo e contexto de segurança. Callbacks da aplicação e o comportamento do cliente ficam fora desses trechos.

## Streaming Direto

Use `res:write_event()` para enviar eventos SSE diretamente de um handler HTTP. A resposta automaticamente alterna para o modo SSE na primeira chamada, definindo os cabeçalhos apropriados.

```lua
local http = require("http")

local function handler()
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local err = res:write_event({name = "status", data = {state = "started"}})
    if err then return nil, err end
    err = res:write_event({name = "progress", data = {percent = 50}})
    if err then return nil, err end
    err = res:write_event({name = "status", data = {state = "complete"}})
    if err then return nil, err end
    return true
end
```

Cada evento exige um campo `name` e `data`. O valor de `data` é codificado como JSON automaticamente.

<tip>
O streaming direto é adequado para fluxos de requisição-resposta de curta duração, como atualizações de progresso. Para conexões de longa duração gerenciadas por processos em segundo plano, use o SSE Relay.
</tip>

## SSE Relay

O middleware SSE Relay cria streams SSE de longa duração apoiados por processos. Ele segue o mesmo padrão de relay do [WebSocket Relay](./websocket-relay.md).

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
-- Send event to SSE client from any process
local _, send_err = process.send(stream_pid, "sse.message", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Monitor an SSE stream
local _, monitor_err = process.monitor(stream_pid)
if monitor_err then return nil, monitor_err end
```

<tip>
O relay monitora o processo alvo. Se o alvo sair, o stream SSE fecha automaticamente e o cliente recebe um evento `done`.
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
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, query_err = req:query("user_id")
    if query_err then return nil, query_err end

    -- Spawn handler process
    local pid, spawn_err = process.spawn("app.sse:handler", "app:processes")
    if spawn_err then return nil, spawn_err end

    -- Configure relay
    local relay_config, encode_err = json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = user_id
        }
    })
    if encode_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or encode_err
    end

    local header_err = res:set_header("X-SSE-Relay", relay_config)
    if header_err then
        local _, terminate_err = process.terminate(pid)
        return nil, terminate_err or header_err
    end
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

Dentro de um handler que importou `json` e obteve o objeto de resposta como `res`, configure o modo desanexado e verifique as duas operações:

```lua
-- Detached setup: no target_pid
local relay_config, encode_err = json.encode({
    heartbeat_interval = "30s"
})
if encode_err then return nil, encode_err end

local header_err = res:set_header("X-SSE-Relay", relay_config)
if header_err then return nil, header_err end
```

O cliente recebe um evento `ready`:

```json
{"stream_pid": "{n1@app:processes|sse-1}", "message_topic": "sse.message"}
```

## Tópicos de Mensagens

O relay usa estes tópicos para comunicação entre o stream e o processo alvo:

| Tópico | Direção | Quando | Payload |
|-------|-----------|------|---------|
| `sse.join` | stream → alvo | Cliente conecta | `client_pid`, `metadata` |
| `sse.message` | alvo → stream | Tópico de evento padrão | Encaminhado como evento SSE |
| `sse.heartbeat` | stream → alvo | Periódico (se configurado) | `client_pid`, `uptime`, `message_count`, `metadata` |
| `sse.leave` | stream → alvo | Cliente desconecta | `client_pid`, `metadata` |
| `sse.control` | qualquer → stream | Comando de controle | Campos de configuração do relay |
| `sse.close` | qualquer → stream | Forçar fechamento | String de motivo opcional |

## Recebendo no Processo Alvo

```lua
local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data, payload_err = msg:payload():data()
        if payload_err then return nil, payload_err end

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Periodic health check

        elseif topic == "sse.leave" then
            -- Release application state associated with data.client_pid.
        end
    end
end
```

## Enviando Eventos

Envie eventos ao cliente enviando mensagens para o PID do stream:

```lua
-- Send on the default message topic
local _, send_err = process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})
if send_err then return nil, send_err end

-- Force close the stream
local _, close_err = process.send(stream_pid, "sse.close", "session expired")
if close_err then return nil, close_err end
```

Eventos enviados no `message_topic` configurado são encaminhados ao cliente como eventos SSE. O nome do tópico se torna o nome do evento SSE.

## Transferência de Conexão

Envie uma mensagem de controle para alterar dinamicamente o processo alvo, o filtro de tópico ou os timeouts:

```lua
local _, transfer_err = process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
if transfer_err then return nil, transfer_err end
```

Quando o alvo muda, o relay primeiro monitora o novo alvo e envia `sse.join` para ele; em seguida, para de monitorar o alvo antigo e envia `sse.leave` para ele. Defina `target_pid` como string vazia para desanexar sem reanexar.

## Veja Também

- [Middleware](./middleware.md) — Configuração de middleware
- [WebSocket Relay](./websocket-relay.md) — Equivalente WebSocket
- [Processo](../lua/core/process.md) — Mensageria de processos
