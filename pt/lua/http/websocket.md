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

### Conexão Basica

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### Com Opções

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
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `url` | string | URL WebSocket (ws:// ou wss://) |
| `options` | table | Opções de conexão (opcional) |

**Retorna:** `Client, error`

### Opções de Conexão

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
local ok, err = client:send("Hello, Server!")
if err then
    return nil, err
end

-- Enviar JSON
client:send(json.encode({
    type = "subscribe",
    channel = "orders"
}))
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

O método `channel()` retorna um channel para receber mensagens. Funciona com `channel.select` para multiplexação.

### Recepcao Basica

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" ou "binary"
    print("Data:", msg.data)
end
```

### Loop de Mensagens

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Conexão fechada
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### Com Select

```lua
local ch = client:channel()
local timeout = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout = time.after("30s")
    else
        local data = json.decode(r.value.data)
        process(data)
    end
end
```

### Objeto Message

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | `"text"` ou `"binary"` |
| `data` | string | Conteudo da mensagem |

## Fechando Conexão

```lua
-- Fechamento normal (código 1000)
client:close()

-- Com código e motivo
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- Fechamento por erro
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `code` | number | Código de fechamento (1000-4999), padrão 1000 |
| `reason` | string | Motivo do fechamento (opcional) |

**Retorna:** `boolean, error`

## Constantes

### Tipos de Mensagem

```lua
-- Numerico (para send)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- String (campo type da mensagem recebida)
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### Modos de Compressao

```lua
websocket.COMPRESSION.DISABLED         -- 0 (sem compressao)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (janela deslizante)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (por mensagem)
```

### Codigos de Fechamento

| Constante | Código | Descrição |
|-----------|--------|-----------|
| `NORMAL` | 1000 | Fechamento normal |
| `GOING_AWAY` | 1001 | Servidor desligando |
| `PROTOCOL_ERROR` | 1002 | Erro de protocolo |
| `UNSUPPORTED_DATA` | 1003 | Tipo de dados não suportado |
| `NO_STATUS` | 1005 | Nenhum status recebido |
| `ABNORMAL_CLOSURE` | 1006 | Conexão perdida |
| `INVALID_PAYLOAD` | 1007 | Payload de frame inválido |
| `POLICY_VIOLATION` | 1008 | Violação de política |
| `MESSAGE_TOO_BIG` | 1009 | Mensagem muito grande |
| `INTERNAL_ERROR` | 1011 | Erro do servidor |
| `SERVICE_RESTART` | 1012 | Servidor reiniciando |
| `TRY_AGAIN_LATER` | 1013 | Servidor sobrecarregado |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## Exemplos

### Chat em Tempo Real

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Entrar na sala
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- Loop de mensagens
    local ch = client:channel()
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data = json.decode(msg.data)
        on_message(data)
    end

    client:close()
end
```

### Stream de Precos com Keep-Alive

```lua
local client = websocket.connect("wss://stream.example.com/prices")

client:send(json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
}))

local ch = client:channel()
local heartbeat = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat = time.after("30s")
    elseif not r.ok then
        break  -- Conexão fechada
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## Permissões

Conexoes WebSocket estao sujeitas a avaliação de política de segurança.

### Acoes de Segurança

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `websocket.connect` | - | Permitir/negar conexoes WebSocket |
| `websocket.connect.url` | URL | Permitir/negar conexoes para URLs específicas |

Veja [Security Model](system/security.md) para configuração de políticas.

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

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
