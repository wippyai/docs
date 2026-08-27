---
title: "WebSocket Relay"
description: "El middleware WebSocket relay actualiza conexiones HTTP a WebSocket y retransmite mensajes a un proceso destino."
---

# WebSocket Relay

El middleware `websocket_relay` actualiza conexiones HTTP a WebSocket y retransmite mensajes a un proceso destino.

**Clasificación: referencia de protocolo con recetas parciales de integración.** Los bloques presuponen un servidor HTTP, un router, un host de procesos, un proceso de destino y un contexto de seguridad. Los handlers de mensajes de la aplicación y la limpieza del estado del cliente siguen siendo responsabilidad de la aplicación.

## Cómo Funciona

1. El manejador HTTP establece el header `X-WS-Relay` con el PID del proceso destino
2. El middleware actualiza la conexión a WebSocket
3. El relay se adjunta al proceso destino y lo monitorea
4. Los mensajes fluyen bidireccionalmente entre cliente y proceso

## Semántica de Procesos

Las conexiones WebSocket son procesos completos con su propio PID. Se integran con el sistema de procesos:

- **Direccionable** - Cualquier proceso puede enviar mensajes a un PID de WebSocket
- **Monitoreable** - Los procesos pueden monitorear conexiones WebSocket para eventos de salida
- **Enlazable** - Las conexiones WebSocket pueden enlazarse a otros procesos
- **Eventos EXIT** - Cuando la conexión se cierra, los monitores reciben notificaciones de salida

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
El relay monitorea el proceso destino. Si el destino termina, la conexión WebSocket se cierra automáticamente y el cliente recibe un frame de cierre.
</tip>

## Transferencia de Conexión

Las conexiones pueden transferirse a un proceso diferente enviando un mensaje de control:

```lua
local _, transfer_err = process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
if transfer_err then return nil, transfer_err end
```

## Configuración

Agregar como middleware post-match en un router:

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

| Opción | Descripción |
|--------|-------------|
| `wsrelay.allowed.origins` | Orígenes permitidos separados por coma |

<note>
Si no se configuran orígenes, solo se permiten solicitudes del mismo origen.
</note>

## Configuración del Handler

El manejador HTTP genera un proceso y configura el relay:

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

### Campos de Configuración del Relay

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|-------------|-------------|
| `target_pid` | string | requerido | PID del proceso que recibe mensajes |
| `message_topic` | string | `ws.message` | Tópico para mensajes del cliente |
| `heartbeat_interval` | duration | `30s` | Frecuencia del heartbeat (p. ej., `30s`) |
| `metadata` | object | - | Se adjunta a las notificaciones de unión, salida y heartbeat |

## Tópicos de Mensajes

El relay envía estos mensajes al proceso destino:

| Tópico | Cuándo | Payload |
|--------|--------|---------|
| `ws.join` | Cliente conecta | JSON `{client_pid, metadata}` |
| `ws.message` (o tu `message_topic`) | Cliente envía mensaje | Payload sin procesar del cliente (frame de texto → formato String, frame binario → formato Bytes); `payload:data()` devuelve una cadena Lua para ambos formatos y el PID de origen es el PID del cliente |
| `ws.heartbeat` | Periódico (cada 30 s de forma predeterminada; intervalo reemplazable mediante `heartbeat_interval`) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | Cliente desconecta | JSON `{client_pid, metadata}` |

## Recibir Mensajes

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

## Enviar al Cliente

Envía mensajes de vuelta usando el PID del cliente. Cualquier tópico elegido se envuelve como JSON `{topic, data}` y se reenvía al WebSocket. Cada mensaje del servidor al cliente se envía como un único frame de texto WebSocket que contiene el envoltorio. Las tablas permanecen como objetos JSON en `data` y las cadenas siguen siendo cadenas. Los payloads que llegan al relay en formato Bytes se codifican en base64 dentro de `data`; no se envían como frames binarios separados. `process.send` de Lua exporta sus argumentos como payloads en formato Lua, por lo que una cadena Lua no toma la rama del formato Bytes.

```lua
-- Send a structured message (any topic name)
local _, send_err = process.send(client_pid, "update", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Close connection (payload is the close reason string)
local _, close_err = process.send(client_pid, "ws.close", "Session ended")
if close_err then return nil, close_err end
```

Los tópicos reservados de servidor -> cliente son `ws.control` (reconfiguración del relay) y `ws.close` (cerrar la conexión).

## Broadcasting

Rastree PIDs de clientes para hacer broadcast a múltiples clientes:

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
Para escenarios complejos con múltiples salas, genere un proceso manejador separado por sala o use un proceso administrador central que rastree membresías de salas.
</tip>

## Véase también

- [Middleware](./middleware.md) - Configuración de middleware
- [Procesos](../lua/core/process.md) - Mensajería de procesos
- [Cliente WebSocket](../lua/http/websocket.md) - Conexiones WebSocket salientes
