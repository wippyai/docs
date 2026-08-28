---
title: "Cliente WebSocket"
description: "Conecta con servidores WebSocket, envía y recibe mensajes, usa compresión y cierra conexiones."
---

# Cliente WebSocket
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `websocket` crea conexiones cliente bidireccionales con servidores WebSocket.

Esta referencia contiene recetas parciales de conexión y suscripción. Las URLs,
tokens, handlers y datos proceden de la aplicación. Los ejemplos de ciclo de vida
cierran el cliente en cada salida terminal o error comprobado; los fragmentos pequeños
presuponen que un propietario circundante realiza esa limpieza.

## Carga

```lua
local websocket = require("websocket")
```

Añade `websocket` a `modules:` antes de requerirlo. El global `channel` siempre está
disponible; las recetas de JSON y timeout también requieren `json` y `time`.

## Conexión

### `connect`

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

Pasa una tabla de opciones para configurar la conexión:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `url` | string | URL WebSocket (ws:// o wss://) |
| `options` | table | Opciones de conexión (opcional) |

**Devuelve:** `Client, error`

#### Opciones de conexión

| Opcion | Tipo | Descripción |
|--------|------|-------------|
| `headers` | table | Cabeceras HTTP de cadena a cadena; se ignoran otras entradas |
| `protocols` | table | Subprotocolos string; se ignoran entradas no string |
| `dial_timeout` | number/string | Timeout; `0` no impone deadline global, pero siguen los defaults del transporte |
| `read_timeout` | number/string | Timeout por mensaje; `0` lo desactiva |
| `write_timeout` | number/string | Aceptado por Lua pero no aplicado en `v0.3.32a` |
| `compression` | number/string | `0`/`"disabled"`, `1`/`"context_takeover"` o `2`/`"no_context_takeover"` |
| `compression_threshold` | number | Tamaño mínimo (0-104857600); `0` usa 128 o 512 bytes según el modo |
| `read_limit` | number | Máximo entrante (0-134217728); `0` usa 16 MiB |
| `channel_capacity` | number | Buffer entrante del servicio (1-10000); default 16 |

**Formato de timeout:** Los números son milisegundos; los strings usan duración Go, como `"5s"` o `"1m"`.
Los strings no válidos y valores no compatibles se ignoran y conservan el default.

## Enviar Mensajes

### Mensajes de texto

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

### Mensajes binarios

Envíe un mensaje binario indicando `websocket.BINARY`.

```lua
client:send(binary_data, websocket.BINARY)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Contenido del mensaje |
| `type` | number | `websocket.TEXT` (1) o `websocket.BINARY` (2) |

Si `type` falta o no es `websocket.TEXT` ni `websocket.BINARY`, se envía texto. La
llamada hace yield hasta completar y no devuelve valores. El entorno de ejecución `v0.3.32a` no expone a Lua
los fallos de transporte del envío.

### Ping

```lua
client:ping()
```

La llamada hace yield hasta completar y no devuelve valores. El entorno de ejecución `v0.3.32a` no expone a Lua
los fallos de transporte del ping.

## Recibir Mensajes

`channel()` devuelve el canal de recepción y `receive()` es un alias. La primera
llamada hace yield mientras se crea la suscripción; después devuelve el mismo canal.
Un fallo devuelve `nil, error`. Puede usarse con `channel.select`.

### Recepcion Basica

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

### Bucle de Mensajes

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

### Con selección :id=con-select

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

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | string | `"text"` o `"binary"` |
| `data` | string? | Contenido del mensaje (nil para tipos de payload desconocidos) |

## Cerrar Conexión

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")
if close_err then return nil, close_err end

-- Omitting both arguments also uses normal close code 1000.
-- Use INTERNAL_ERROR with an application-owned reason for a failed session.
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `code` | number | Código de cierre (1000-4999), predeterminado 1000 |
| `reason` | string | Razon de cierre (opcional) |

La llamada hace yield. Un éxito no devuelve valores y un fallo devuelve `nil, error`;
captura dos resultados porque el error es el segundo. Códigos fuera del rango se
ignoran y se usa `1000`.

El cliente es propietario del canal; no lo cierres directamente. Un evento terminal
remoto lo cierra. `client:close()` cancela la suscripción y detiene el productor, así
que úsalo pronto en vez de depender de la limpieza al terminar el proceso.

## Constantes

### Tipos de Mensaje

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

Los mensajes recibidos solo usan `"text"` y `"binary"`. El transporte maneja ping y
pong, y un evento terminal cierra el canal sin producir un mensaje `"close"`.

### Modos de Compresion

```lua
websocket.COMPRESSION.DISABLED         -- 0 (no compression)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (sliding window)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (per-message)
```

### Codigos de Cierre

| Constante | Código | Descripción |
|-----------|--------|-------------|
| `NORMAL` | 1000 | Cierre normal |
| `GOING_AWAY` | 1001 | Servidor apagandose |
| `PROTOCOL_ERROR` | 1002 | Error de protocolo |
| `UNSUPPORTED_DATA` | 1003 | Tipo de datos no soportado |
| `RESERVED` | 1004 | Reservado |
| `NO_STATUS` | 1005 | Sin estado recibido |
| `ABNORMAL_CLOSURE` | 1006 | Conexión perdida |
| `INVALID_PAYLOAD` | 1007 | Payload de frame invalido |
| `POLICY_VIOLATION` | 1008 | Violacion de politica |
| `MESSAGE_TOO_BIG` | 1009 | Mensaje muy grande |
| `MANDATORY_EXTENSION` | 1010 | Extension requerida no negociada |
| `INTERNAL_ERROR` | 1011 | Error del servidor |
| `SERVICE_RESTART` | 1012 | Servidor reiniciando |
| `TRY_AGAIN_LATER` | 1013 | Servidor sobrecargado |
| `BAD_GATEWAY` | 1014 | Error de gateway |
| `TLS_HANDSHAKE` | 1015 | Fallo de handshake TLS |

```lua
local _, close_err = client:close(websocket.CLOSE_CODES.NORMAL, "Done")
if close_err then return nil, close_err end
```

## Ejemplos

### Chat en Tiempo Real

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

### Stream de Precios con Keep-Alive

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

## Permisos

Las conexiones WebSocket estan sujetas a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `websocket.connect` | - | Permitir/denegar conexiones WebSocket |
| `websocket.connect.url` | URL | Permitir/denegar conexiones a URLs especificas |

Consulta [Modelo de seguridad](system/security.md) para configurar políticas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Conexiones deshabilitadas | `errors.PERMISSION_DENIED` | no |
| URL no permitida | `errors.PERMISSION_DENIED` | no |
| Sin contexto | `errors.INTERNAL` | no |
| Conexión fallida | `errors.INTERNAL` | si |
| ID de conexión invalido | `errors.INTERNAL` | no |
| Fallo de suscripción | `errors.INTERNAL` | sí |
| Falta contexto de proceso durante la suscripción | `errors.INTERNAL` | no |
| Fallo de cierre | `errors.INTERNAL` | no |

Una URL vacía, opciones que no sean una tabla, tipos de argumentos no válidos y la
falta de contexto o PID al pedir el canal lanzan errores Lua, no errores estructurados.
El entorno de ejecución `v0.3.32a` no expone a Lua los fallos de transporte de send o ping.

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

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
