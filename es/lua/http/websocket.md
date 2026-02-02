# Cliente WebSocket
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Cliente WebSocket para comunicación bidireccional en tiempo real con servidores.

## Carga

```lua
local websocket = require("websocket")
```

## Conexión

### Conexión Basica

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### Con Opciones

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `url` | string | URL WebSocket (ws:// o wss://) |
| `options` | table | Opciones de conexión (opcional) |

**Devuelve:** `Client, error`

### Opciones de Conexión

| Opcion | Tipo | Descripción |
|--------|------|-------------|
| `headers` | table | Cabeceras HTTP para handshake |
| `protocols` | table | Subprotocolos WebSocket |
| `dial_timeout` | number/string | Timeout de conexión (ms o "5s") |
| `read_timeout` | number/string | Timeout de lectura |
| `write_timeout` | number/string | Timeout de escritura |
| `compression` | number | Modo de compresion (ver Constantes) |
| `compression_threshold` | number | Tamano minimo para comprimir (0-100MB) |
| `read_limit` | number | Tamano maximo de mensaje (0-128MB) |
| `channel_capacity` | number | Buffer de canal de recepcion (1-10000) |

**Formato de timeout:** Numeros son milisegundos, strings usan formato de duración Go ("5s", "1m").

## Enviar Mensajes

### Mensajes de Texto

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

### Mensajes Binarios

```lua
client:send(binary_data, websocket.BINARY)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Contenido del mensaje |
| `type` | number | `websocket.TEXT` (1) o `websocket.BINARY` (2) |

**Devuelve:** `boolean, error`

### Ping

```lua
client:ping()
```

**Devuelve:** `boolean, error`

## Recibir Mensajes

El método `channel()` devuelve un canal para recibir mensajes. Funciona con `channel.select` para multiplexado.

### Recepcion Basica

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" o "binary"
    print("Data:", msg.data)
end
```

### Bucle de Mensajes

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Conexión cerrada
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### Con Select

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

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | string | `"text"` o `"binary"` |
| `data` | string | Contenido del mensaje |

## Cerrar Conexión

```lua
-- Cierre normal (código 1000)
client:close()

-- Con código y razon
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- Cierre de error
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `code` | number | Código de cierre (1000-4999), predeterminado 1000 |
| `reason` | string | Razon de cierre (opcional) |

**Devuelve:** `boolean, error`

## Constantes

### Tipos de Mensaje

```lua
-- Numerico (para enviar)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- String (campo type de mensaje recibido)
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### Modos de Compresion

```lua
websocket.COMPRESSION.DISABLED         -- 0 (sin compresion)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (ventana deslizante)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (por mensaje)
```

### Codigos de Cierre

| Constante | Código | Descripción |
|-----------|--------|-------------|
| `NORMAL` | 1000 | Cierre normal |
| `GOING_AWAY` | 1001 | Servidor apagandose |
| `PROTOCOL_ERROR` | 1002 | Error de protocolo |
| `UNSUPPORTED_DATA` | 1003 | Tipo de datos no soportado |
| `NO_STATUS` | 1005 | Sin estado recibido |
| `ABNORMAL_CLOSURE` | 1006 | Conexión perdida |
| `INVALID_PAYLOAD` | 1007 | Payload de frame invalido |
| `POLICY_VIOLATION` | 1008 | Violacion de politica |
| `MESSAGE_TOO_BIG` | 1009 | Mensaje muy grande |
| `INTERNAL_ERROR` | 1011 | Error del servidor |
| `SERVICE_RESTART` | 1012 | Servidor reiniciando |
| `TRY_AGAIN_LATER` | 1013 | Servidor sobrecargado |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## Ejemplos

### Chat en Tiempo Real

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Unirse a sala
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- Bucle de mensajes
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

### Stream de Precios con Keep-Alive

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
        break  -- Conexión cerrada
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## Permisos

Las conexiones WebSocket estan sujetas a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `websocket.connect` | - | Permitir/denegar conexiones WebSocket |
| `websocket.connect.url` | URL | Permitir/denegar conexiones a URLs especificas |

Consulte [Modelo de Seguridad](system/security.md) para configuración de politicas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Conexiones deshabilitadas | `errors.PERMISSION_DENIED` | no |
| URL no permitida | `errors.PERMISSION_DENIED` | no |
| Sin contexto | `errors.INTERNAL` | no |
| Conexión fallida | `errors.INTERNAL` | si |
| ID de conexión invalido | `errors.INTERNAL` | no |

```lua
local client, err = websocket.connect(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Acceso denegado:", err:message())
    elseif err:retryable() then
        print("Error temporal:", err:message())
    end
    return nil, err
end
```

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
