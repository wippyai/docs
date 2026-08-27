---
title: "Cliente WebSocket"
description: "Conecte-se a servidores WebSocket, envie e receba mensagens, use compressão e feche conexões."
---

# Cliente WebSocket
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

O módulo `websocket` cria conexões cliente bidirecionais com servidores WebSocket.

Esta página é uma referência de API com receitas parciais de conexão e assinatura. URLs de endpoints, tokens, handlers de mensagens e dados da aplicação vêm da aplicação ao redor. Os exemplos de ciclo de vida fecham o cliente em todo caminho terminal ou de erro verificado; os exemplos menores de métodos pressupõem que um proprietário externo faça essa limpeza.

## Carregamento

```lua
local websocket = require("websocket")
```

Adicione `websocket` à lista `modules:` da entrada executável antes de importá-lo. O global `channel` está sempre disponível; as receitas com JSON e timeout também exigem `json` e `time`.

## Conectando

### `connect`

Abre uma conexão WebSocket com as opções padrão:

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

Passe uma tabela de opções para configurar a conexão:

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
| `headers` | table | Headers HTTP string-para-string do handshake; outras entradas são ignoradas |
| `protocols` | table | Strings de subprotocolos WebSocket; entradas que não são strings são ignoradas |
| `dial_timeout` | number/string | Timeout da conexão; `0` não aplica um prazo global do runtime, mas os padrões do transporte HTTP subjacente continuam valendo |
| `read_timeout` | number/string | Timeout por mensagem; `0` o desativa |
| `write_timeout` | number/string | Aceito pela API Lua, mas não aplicado pelo runtime `v0.3.32a` |
| `compression` | number/string | `0`/`"disabled"`, `1`/`"context_takeover"` ou `2`/`"no_context_takeover"`; desativado por padrão |
| `compression_threshold` | number | Tamanho mínimo para comprimir, em bytes (0-104857600); `0` usa 128 bytes com context takeover ou 512 sem context takeover |
| `read_limit` | number | Tamanho máximo de mensagem recebida, em bytes (0-134217728); `0` usa 16 MiB |
| `channel_capacity` | number | Buffer de mensagens recebidas no serviço (1-10000); padrão 16 |

**Formato de timeout:** números representam milissegundos. Strings usam a sintaxe de duração Go, como `"5s"` ou `"1m"`.

Strings de timeout inválidas e valores de opções fora dos limites ou não aceitos são ignorados, mantendo o padrão correspondente.

## Enviando Mensagens

### Mensagens de Texto

Envia uma mensagem de texto.

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

Envia uma mensagem binária especificando `websocket.BINARY`.

```lua
client:send(binary_data, websocket.BINARY)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Conteudo da mensagem |
| `type` | number | `websocket.TEXT` (1) ou `websocket.BINARY` (2) |

Se `type` estiver ausente ou não for `websocket.TEXT` nem `websocket.BINARY`, o runtime envia uma mensagem de texto. A chamada cede a execução até o envio terminar e não retorna valores. No runtime `v0.3.32a`, falhas de transporte durante o envio não são retornadas ao Lua.

### Ping

Envia um frame de ping.

```lua
client:ping()
```

A chamada cede a execução até o comando de ping terminar e não retorna valores. No runtime `v0.3.32a`, falhas de transporte no ping não são retornadas ao Lua.

## Recebendo Mensagens

`channel()` retorna o channel de recebimento, e `receive()` é um alias. A primeira chamada cede a execução enquanto o runtime cria a assinatura; chamadas posteriores retornam o mesmo channel imediatamente. Uma falha na assinatura retorna `nil, error`. O channel pode ser usado com `channel.select`.

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

Fecha a conexão com código de status e motivo opcionais:

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

A chamada cede a execução até o comando de fechamento terminar. Em caso de sucesso, não retorna valores; uma falha retorna `nil, error`. Capture dois resultados ao verificar a chamada, pois o erro é o segundo. Valores fora do intervalo numérico aceito são ignorados e o código padrão `1000` é usado.

O channel de recebimento pertence ao cliente; não o feche diretamente. Um evento terminal remoto fecha o channel. Chamar `client:close()` cancela a assinatura do channel de recebimento e interrompe o produtor no cliente; faça isso prontamente, em vez de depender da limpeza no encerramento do processo.

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

Os objetos de mensagem do channel de recebimento usam somente `"text"` e `"binary"`. Frames de ping e pong são processados pelo transporte, e um evento terminal fecha o channel em vez de produzir um objeto de mensagem `"close"`.

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
| Falha na assinatura | `errors.INTERNAL` | sim |
| Contexto de processo ausente durante a assinatura | `errors.INTERNAL` | não |
| Falha ao fechar | `errors.INTERNAL` | não |

Uma URL vazia, um valor de opções que não seja tabela, tipos de argumentos inválidos e a ausência de contexto de execução ou PID de processo ao solicitar o channel geram erros Lua. Eles não são retornados como erros estruturados. O runtime `v0.3.32a` não expõe falhas de transporte de envio ou ping aos chamadores Lua.

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
