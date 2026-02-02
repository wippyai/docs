# Canales y Corrutinas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Canales estilo Go para comunicación entre corrutinas. Crear canales con o sin buffer, enviar y recibir valores, y coordinar entre procesos concurrentes usando sentencias select.

El global `channel` siempre esta disponible.

## Crear Canales

Los canales sin buffer (tamano 0) requieren que tanto el emisor como el receptor esten listos antes de que la transferencia complete. Los canales con buffer permiten que los envios completen inmediatamente mientras haya espacio disponible:

```lua
-- Sin buffer: sincroniza emisor y receptor
local sync_ch = channel.new()

-- Con buffer: encolar hasta 10 mensajes
local work_queue = channel.new(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `size` | integer | Capacidad del buffer (por defecto: 0 para sin buffer) |

**Devuelve:** `channel`

## Enviar Valores

Enviar un valor al canal. Bloquea hasta que un receptor este listo (sin buffer) o haya espacio en el buffer (con buffer):

```lua
-- Enviar trabajo a un pool de trabajadores
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Bloquea si buffer lleno
end
jobs:close()  -- Senalar que no hay mas trabajo
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `value` | any | Valor a enviar |

**Devuelve:** `boolean`

Genera error si el canal esta cerrado.

## Recibir Valores

Recibir un valor del canal. Bloquea hasta que un valor este disponible o el canal este cerrado:

```lua
-- Trabajador consumiendo de cola de trabajos
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- Canal cerrado, no mas trabajo
    end
    process(job)
end
```

**Devuelve:** `any, boolean`

- `value, true` - Recibio un valor
- `nil, false` - Canal cerrado y vacio

## Cerrar Canales

Cerrar el canal. Los emisores pendientes obtienen un error, los receptores pendientes obtienen `nil, false`. Genera error si ya esta cerrado:

```lua
local results = channel.new(10)

-- Productor llena resultados
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Senalar completacion
```

## Seleccionar de Multiples Canales

Esperar en multiples operaciones de canal simultaneamente. Esencial para manejar multiples fuentes de eventos, implementar timeouts y construir sistemas responsivos:

```lua
local result = channel.select(cases)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `cases` | table | Array de casos select |
| `default` | boolean | Si true, devuelve inmediatamente cuando ningun caso este listo |

**Devuelve:** `table` con campos: `channel`, `value`, `ok`, `default`

### Patrón de Timeout

Esperar resultado con timeout usando `time.after()`.

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### Patrón Fan-in

Fusionar multiples fuentes en un manejador.

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### Verificacion No Bloqueante

Verificar si hay datos disponibles sin bloquear.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nada disponible, hacer algo mas
else
    process(r.value)
end
```

## Crear Casos Select

Crear casos para usar con `channel.select`:

```lua
-- Caso send - completa cuando el canal puede aceptar valor
ch:case_send(value)

-- Caso receive - completa cuando hay valor disponible
ch:case_receive()
```

## Patrón de Pool de Trabajadores

```lua
local work = channel.new(100)
local results = channel.new(100)

-- Crear trabajadores
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- Alimentar trabajo
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Recolectar resultados
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Enviar en canal cerrado | error de runtime | no |
| Cerrar canal cerrado | error de runtime | no |
| Caso invalido en select | error de runtime | no |

## Vea También

- [Gestión de Procesos](lua/core/process.md) - Creacion de procesos y comunicación
- [Cola de Mensajes](lua/storage/queue.md) - Mensajeria basada en colas
- [Funciones](lua/core/funcs.md) - Invocacion de funciones
