---
title: "Cliente WebSocket"
description: "Conecte-se a servidores WebSocket, envie e receba mensagens, use compressão e feche conexões."
---

# Cliente WebSocket
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Cliente WebSocket para comunicação bidirecional em tempo real com servidores.

## Carregamento

```lua
local websocket = require("websocket")
```

## Conectando

### `connect`

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

```lua
local client, err = websocket.connect("wss://api.example.com/ws", {
    headers = {
        ["Authorization"] = "Bearer " .. token
    },
    protocols = {"graphql-ws"},
    dial_timeout = "10s",
    read_timeout = "30s",
    compression = websocket.COMPRESSION.CONTEXT_TAKEOVER
})
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `url` | string | URL WebSocket (ws:// ou wss://) |
| `options` | table | Opções de conexão (opcional) |

**Retorna:** `Client, error`

#### Opções de Conexão

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `headers` | table | Headers HTTP para handshake |
| `protocols` | table | Subprotocolos WebSocket |
| `dial_timeout` | number/string | Timeout de conexão (ms ou "5s") |
| `read_timeout` | number/string | Timeout de leitura |
| `write_timeout` | number/string | Timeout de escrita |
| `compression` | number | Modo de compressao (veja Constantes) |
| `compression_threshold` | number | Tamanho minimo para comprimir (0-100MB) |
| `read_limit` | number | Tamanho maximo de mensagem (0-128MB) |
| `channel_capacity` | number | Buffer do channel de recepcao (1-10000) |

**Formato de timeout:** Numeros sao milissegundos, strings usam formato de duração Go ("5s", "1m").

## Enviando Mensagens

### Mensagens de Texto

```lua
local json = require("json")

client:send("Hello, Server!")

-- Send JSON
local payload, encode_err = json.encode({
    type = "subscribe",
    channel = "orders"
})
if encode_err then return nil, encode_err end
client:send(payload)
```

### Mensagens Binarias

```lua
client:send(binary_data, websocket.BINARY)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Conteudo da mensagem |
| `type` | number | `websocket.TEXT` (1) ou `websocket.BINARY` (2) |

**Retorna:** `boolean, error`

### Ping

```lua
client:ping()
```

**Retorna:** `boolean, error`

## Recebendo Mensagens

O método `channel()` retorna um channel para receber mensagens. `receive()` é um alias para `channel()`. Funciona com `channel.select` para multiplexação.

### Recepcao Basica

```lua
local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" or "binary"
    print("Data:", msg.data)
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Loop de Mensagens

```lua
local json = require("json")

local ch, err = client:channel()
if err then
    client:close()
    return nil, err
end

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Connection closed
    end

    if msg.type == "text" then
        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        handle_message(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Com Select

```lua
local json = require("json")
local time = require("time")

local ch, ch_err = client:channel()
if ch_err then
    client:close()
    return nil, ch_err
end

local timeout, timeout_err = time.after("30s")
if timeout_err then
    client:close()
    return nil, timeout_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout, timeout_err = time.after("30s")
        if timeout_err then
            client:close()
            return nil, timeout_err
        end
    elseif not r.ok then
        break
    else
        local data, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        process(data)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

### Objeto Message

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | `"text"` ou `"binary"` |
| `data` | string? | Conteudo da mensagem (nil para tipos de payload desconhecidos) |

## Fechando Conexão

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")
if close_err then return nil, close_err end

-- Omitting both arguments also uses normal close code 1000.
-- Use INTERNAL_ERROR with an application-owned reason for a failed session.
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `code` | number | Código de fechamento (1000-4999), padrão 1000 |
| `reason` | string | Motivo do fechamento (opcional) |

**Retorna:** `boolean, error`

## Constantes

### Tipos de Mensagem

```lua
-- Numeric (for send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- Compatibility string constants
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### Modos de Compressao

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### Codigos de Fechamento

| Constante | Código | Descrição |
|-----------|--------|-----------|
| `NORMAL` | 1000 | Fechamento normal |
| `GOING_AWAY` | 1001 | Servidor desligando |
| `PROTOCOL_ERROR` | 1002 | Erro de protocolo |
| `UNSUPPORTED_DATA` | 1003 | Tipo de dados não suportado |
| `RESERVED` | 1004 | Reservado |
| `NO_STATUS` | 1005 | Nenhum status recebido |
| `ABNORMAL_CLOSURE` | 1006 | Conexão perdida |
| `INVALID_PAYLOAD` | 1007 | Payload de frame inválido |
| `POLICY_VIOLATION` | 1008 | Violação de política |
| `MESSAGE_TOO_BIG` | 1009 | Mensagem muito grande |
| `MANDATORY_EXTENSION` | 1010 | Extensão obrigatória não negociada |
| `INTERNAL_ERROR` | 1011 | Erro do servidor |
| `SERVICE_RESTART` | 1012 | Servidor reiniciando |
| `TRY_AGAIN_LATER` | 1013 | Servidor sobrecarregado |
| `BAD_GATEWAY` | 1014 | Erro de gateway |
| `TLS_HANDSHAKE` | 1015 | Falha no handshake TLS |

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Done")
if close_err then return nil, close_err end
```

## Exemplos

### Chat em Tempo Real

```lua
local json = require("json")

local function connect_chat(room_id, token, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Join room. Runtime v0.3.32a does not expose transport send failures.
    local join_payload, encode_err = json.encode({
        type = "join",
        room = room_id
    })
    if encode_err then
        client:close()
        return nil, encode_err
    end
    client:send(join_payload)

    -- Message loop
    local ch, channel_err = client:channel()
    if channel_err then
        client:close()
        return nil, channel_err
    end
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data, decode_err = json.decode(msg.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        on_message(data)
    end

    local _, close_err = client:close()
    if close_err then return nil, close_err end
    return true
end
```

### Stream de Precos com Keep-Alive

```lua
local json = require("json")
local time = require("time")

local client, err = websocket.connect("wss://stream.example.com/prices")
if err then
    return nil, err
end

local subscribe_payload, encode_err = json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
})
if encode_err then
    client:close()
    return nil, encode_err
end
client:send(subscribe_payload)

local ch, channel_err = client:channel()
if channel_err then
    client:close()
    return nil, channel_err
end

local heartbeat, heartbeat_err = time.after("30s")
if heartbeat_err then
    client:close()
    return nil, heartbeat_err
end

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat, heartbeat_err = time.after("30s")
        if heartbeat_err then
            client:close()
            return nil, heartbeat_err
        end
    elseif not r.ok then
        break  -- Connection closed
    else
        local price, decode_err = json.decode(r.value.data)
        if decode_err then
            client:close()
            return nil, decode_err
        end
        update_price(price.symbol, price.value)
    end
end

local _, close_err = client:close()
if close_err then return nil, close_err end
```

## Permissões

Conexoes WebSocket estao sujeitas a avaliação de política de segurança.

### Acoes de Segurança

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `websocket.connect` | - | Permitir/negar conexoes WebSocket |
| `websocket.connect.url` | URL | Permitir/negar conexoes para URLs específicas |

Veja [Modelo de Segurança](../../system/security.md) para configurar as políticas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Conexoes desabilitadas | `errors.PERMISSION_DENIED` | não |
| URL não permitida | `errors.PERMISSION_DENIED` | não |
| Sem contexto | `errors.INTERNAL` | não |
| Conexão falhou | `errors.INTERNAL` | sim |
| ID de conexão inválido | `errors.INTERNAL` | não |

```lua
local client, err = websocket.connect(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
