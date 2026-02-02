# WebSocket Relay

El middleware WebSocket relay actualiza conexiones HTTP a WebSocket y retransmite mensajes a un proceso destino.

## Cómo Funciona

1. El manejador HTTP establece el header `X-WS-Relay` con el PID del proceso destino
2. El middleware actualiza la conexión a WebSocket
3. El relay se adjunta al proceso destino y lo monitorea
4. Los mensajes fluyen bidireccionalmente entre cliente y proceso

<warning>
La conexión WebSocket está vinculada al proceso destino. Si el proceso termina, la conexión se cierra automáticamente.
</warning>

## Semántica de Procesos

Las conexiones WebSocket son procesos completos con su propio PID. Se integran con el sistema de procesos:

- **Direccionable** - Cualquier proceso puede enviar mensajes a un PID de WebSocket
- **Monitoreable** - Los procesos pueden monitorear conexiones WebSocket para eventos de salida
- **Enlazable** - Las conexiones WebSocket pueden enlazarse a otros procesos
- **Eventos EXIT** - Cuando la conexión se cierra, los monitores reciben notificaciones de salida

```lua
-- Monitorear una conexión WebSocket desde otro proceso
process.monitor(websocket_pid)

-- Enviar mensaje a cliente WebSocket desde cualquier proceso
process.send(websocket_pid, "ws.send", {type = "text", data = "hello"})
```

<tip>
El relay monitorea el proceso destino. Si el destino termina, la conexión WebSocket se cierra automáticamente y el cliente recibe un frame de cierre.
</tip>

## Transferencia de Conexión

Las conexiones pueden transferirse a un proceso diferente enviando un mensaje de control:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
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
    local req = http.request()
    local res = http.response()

    -- Generar proceso manejador
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- Configurar relay
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

### Campos de Configuración del Relay

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|-------------|-------------|
| `target_pid` | string | requerido | PID del proceso que recibe mensajes |
| `message_topic` | string | `ws.message` | Tópico para mensajes del cliente |
| `heartbeat_interval` | duration | - | Frecuencia de heartbeat (ej. `30s`) |
| `metadata` | object | - | Adjunto a todos los mensajes |

## Tópicos de Mensajes

El relay envía estos mensajes al proceso destino:

| Tópico | Cuándo | Payload |
|--------|--------|---------|
| `ws.join` | Cliente conecta | `client_pid`, `metadata` |
| `ws.message` | Cliente envía mensaje | `client_pid`, `type`, `data`, `metadata` |
| `ws.heartbeat` | Periódico (si configurado) | `client_pid`, `uptime`, `message_count` |
| `ws.leave` | Cliente desconecta | `client_pid`, `reason`, `metadata` |

## Recibir Mensajes

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
            -- Cliente conectado
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Manejar mensaje del cliente
            local content = json.decode(data.data)
            handle_message(data.client_pid, content)

        elseif topic == "ws.leave" then
            -- Cliente desconectado
            cleanup(data.client_pid)
        end
    end
end
```

## Enviar al Cliente

Envíe mensajes de vuelta usando el PID del cliente:

```lua
-- Enviar mensaje de texto
process.send(client_pid, "ws.send", {
    type = "text",
    data = json.encode({event = "update", value = 42})
})

-- Enviar binario
process.send(client_pid, "ws.send", {
    type = "binary",
    data = binary_content
})

-- Cerrar conexión
process.send(client_pid, "ws.close", {
    code = 1000,
    reason = "Sesión terminada"
})
```

## Broadcasting

Rastree PIDs de clientes para hacer broadcast a múltiples clientes:

```lua
local clients = {}

-- Al unirse
clients[client_pid] = true

-- Al salir
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
Para escenarios complejos con múltiples salas, genere un proceso manejador separado por sala o use un proceso administrador central que rastree membresías de salas.
</tip>

## Ver También

- [Middleware](http/middleware.md) - Configuración de middleware
- [Procesos](lua/core/process.md) - Mensajería de procesos
- [Cliente WebSocket](lua/http/websocket.md) - Conexiones WebSocket salientes
