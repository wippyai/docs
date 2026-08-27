---
title: "Eventos enviados por el servidor"
description: "Transmite eventos de handlers de corta duración o eventos duraderos respaldados por procesos mediante Server-Sent Events."
---

# Server-Sent Events

El middleware SSE transmite eventos desde el servidor a clientes HTTP usando el protocolo [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

Hay dos mecanismos disponibles: **streaming directo** desde un handler HTTP, y **relay respaldado por procesos** mediante el middleware `sse_relay`.

**Clasificación: referencia del protocolo con recetas de integración parciales.**
Los bloques del relay suponen que ya existen un servidor HTTP, un router, un host
de procesos, un proceso objetivo y un contexto de seguridad. Los callbacks de la
aplicación y el comportamiento del cliente quedan fuera de estos fragmentos.

## Streaming Directo

Use `res:write_event()` para enviar eventos SSE directamente desde un handler HTTP. La respuesta cambia automáticamente al modo SSE en la primera llamada, estableciendo las cabeceras apropiadas.

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

Cada evento requiere los campos `name` y `data`. El valor de `data` se codifica como JSON automáticamente.

<tip>
El streaming directo es adecuado para flujos de solicitud-respuesta de corta duración como actualizaciones de progreso. Para conexiones de larga duración gestionadas por procesos en segundo plano, use el SSE Relay.
</tip>

## SSE Relay

El middleware SSE Relay crea streams SSE de larga duración respaldados por procesos. Sigue el mismo patrón de relay que [WebSocket Relay](./websocket-relay.md).

### Cómo Funciona

1. El handler HTTP establece la cabecera `X-SSE-Relay` con una configuración de relay JSON
2. El middleware intercepta la respuesta y crea una sesión SSE
3. La sesión se registra como un proceso con su propio PID
4. Los mensajes enviados al PID de la sesión se reenvían como eventos SSE al cliente

## Semántica de Procesos

Los streams SSE son procesos completos con su propio PID. Se integran con el sistema de procesos:

- **Direccionables** — Cualquier proceso puede enviar mensajes al PID de un stream
- **Monitoreables** — Los procesos pueden monitorear streams SSE para eventos de salida
- **Vinculables** — Los streams SSE pueden vincularse a otros procesos
- **Eventos EXIT** — Cuando un stream se cierra, los monitores reciben notificaciones de salida

```lua
-- Send event to SSE client from any process
local _, send_err = process.send(stream_pid, "sse.message", {event = "update", value = 42})
if send_err then return nil, send_err end

-- Monitor an SSE stream
local _, monitor_err = process.monitor(stream_pid)
if monitor_err then return nil, monitor_err end
```

<tip>
El relay monitorea el proceso objetivo. Si el objetivo termina, el stream SSE se cierra automáticamente y el cliente recibe un evento `done`.
</tip>

## Configuración

Agregar como middleware post-match en un router:

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

| Opción | Descripción |
|--------|-------------|
| `sserelay.allowed.origins` | Orígenes permitidos separados por comas (admite comodines) |

<note>
Si no se configuran orígenes, solo se permiten solicitudes del mismo origen.
</note>

## Configuración del Handler

El handler HTTP genera un proceso y configura el relay:

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

### Campos de Configuración del Relay

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `target_pid` | string | — | PID del proceso que recibe los mensajes (omitir para modo desacoplado) |
| `message_topic` | string | `sse.message` | Filtro de tópico para eventos reenviados |
| `heartbeat_interval` | duration | `30s` | Frecuencia de heartbeat (ej. `30s`, `1m`) |
| `idle_timeout` | duration | — | Cerrar stream tras inactividad |
| `hard_timeout` | duration | — | Cerrar stream tras duración absoluta |
| `metadata` | object | — | Adjuntado a mensajes de join/leave/heartbeat |

## Modo Gestionado vs Desacoplado

### Modo Gestionado

Cuando `target_pid` está establecido, el relay opera en modo gestionado:

- Monitorea el proceso objetivo
- Envía `sse.join` al conectarse y `sse.leave` al desconectarse
- Cierra el stream automáticamente si el objetivo termina

### Modo Desacoplado

Cuando `target_pid` se omite, el relay arranca en modo desacoplado:

- Emite un evento `ready` al cliente con `stream_pid` y `message_topic`
- No se monitorea ningún proceso inicialmente
- Un proceso puede vincularse después enviando un mensaje `sse.control`

Dentro de un handler que haya importado `json` y obtenido el objeto de respuesta
como `res`, configure el modo desacoplado y compruebe ambas operaciones:

```lua
-- Detached setup: no target_pid
local relay_config, encode_err = json.encode({
    heartbeat_interval = "30s"
})
if encode_err then return nil, encode_err end

local header_err = res:set_header("X-SSE-Relay", relay_config)
if header_err then return nil, header_err end
```

El cliente recibe un evento `ready`:

```json
{"stream_pid": "{n1@app:processes|sse-1}", "message_topic": "sse.message"}
```

## Tópicos de Mensajes

El relay usa estos tópicos para la comunicación entre el stream y el proceso objetivo:

| Tópico | Dirección | Cuándo | Carga útil |
|--------|-----------|--------|------------|
| `sse.join` | stream → objetivo | El cliente se conecta | `client_pid`, `metadata` |
| `sse.message` | objetivo → stream | Tópico de evento por defecto | Reenviado como evento SSE |
| `sse.heartbeat` | stream → objetivo | Periódico (si está configurado) | `client_pid`, `uptime`, `message_count`, `metadata` |
| `sse.leave` | stream → objetivo | El cliente se desconecta | `client_pid`, `metadata` |
| `sse.control` | cualquiera → stream | Comando de control | Campos de configuración del relay |
| `sse.close` | cualquiera → stream | Cierre forzado | Cadena opcional de motivo |

## Recepción en el Proceso Objetivo

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

## Envío de Eventos

Envíe eventos al cliente enviando mensajes al PID del stream:

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

Los eventos enviados en el `message_topic` configurado se reenvían al cliente como eventos SSE. El nombre del tópico se convierte en el nombre del evento SSE.

## Transferencia de Conexión

Envíe un mensaje de control para cambiar dinámicamente el proceso objetivo, el filtro de tópico o los timeouts:

```lua
local _, transfer_err = process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
if transfer_err then return nil, transfer_err end
```

Cuando cambia el objetivo, el relay primero monitorea y envía `sse.join` al nuevo objetivo; después deja de monitorear y envía `sse.leave` al anterior. Establezca `target_pid` en una cadena vacía para desvincular sin volver a vincular.

## Véase También

- [Middleware](./middleware.md) — Configuración de middleware
- [WebSocket Relay](./websocket-relay.md) — Equivalente WebSocket
- [Process](../lua/core/process.md) — Mensajería de procesos
