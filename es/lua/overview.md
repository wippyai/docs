# Runtime de Lua

El runtime de computacion principal de Wippy optimizado para cargas de trabajo de I/O y logica de negocio. El codigo se ejecuta en procesos aislados que se comunican mediante paso de mensajes, sin memoria compartida ni bloqueos.

Wippy esta disenado como un runtime poliglota. Aunque Lua es el lenguaje principal, versiones futuras soportaran lenguajes adicionales a traves de WebAssembly e integracion con Temporal para cargas de trabajo intensivas en computo o especializadas.

## Procesos

Su codigo Lua se ejecuta dentro de **procesos**, contextos de ejecucion aislados gestionados por el planificador. Cada proceso:

- Tiene su propio espacio de memoria
- Cede el control en operaciones bloqueantes (I/O, canales)
- Puede ser monitoreado y supervisado
- Escala a miles por maquina

<note>
Un proceso Lua tipico tiene una sobrecarga de memoria base de aproximadamente 13 KB.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

Consulte [Gestion de Procesos](lua-process.md) para creacion, enlace y supervision.

## Canales

Canales estilo Go para comunicacion:

```lua
local ch = channel.new()        -- sin buffer
local buffered = channel.new(10)

ch:send(value)                  -- bloquea hasta que se reciba
local val, ok = ch:receive()    -- bloquea hasta que este listo
```

Consulte [Canales](lua-channel.md) para select y patrones.

## Corrutinas

Dentro de un proceso, cree corrutinas ligeras:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continua inmediatamente
```

Las corrutinas creadas son gestionadas por el planificador, sin yield/resume manual.

## Select

Maneje multiples fuentes de eventos:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- tiempo agotado
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globales

Estos estan siempre disponibles sin require:

- `process` - gestion de procesos y mensajeria
- `channel` - canales estilo Go
- `os` - funciones de tiempo y sistema
- `coroutine` - concurrencia ligera

## Modulos

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Los modulos disponibles dependen de la configuracion de entrada. Consulte [Definiciones de Entrada](lua-entries.md).

## Bibliotecas Externas

Wippy usa sintaxis Lua 5.3 con un [sistema de tipos gradual](lua-types.md) inspirado en Luau. Los tipos son valores de primera clase en tiempo de ejecucion, invocables para validacion, pasables como argumentos e introspectables, reemplazando la necesidad de bibliotecas de esquemas como Zod o Pydantic.

Las bibliotecas Lua externas (LuaRocks, etc.) no estan soportadas. El runtime proporciona su propio sistema de modulos con extensiones incorporadas para I/O, redes e integracion de sistema.

Para extensiones personalizadas, consulte [Modulos](internal-modules.md) en la documentacion de internos.

## Manejo de Errores

Las funciones devuelven pares `resultado, error`:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Consulte [Manejo de Errores](lua-errors.md) para patrones.

## Siguiente

- [Definiciones de Entrada](lua-entries.md) - Configurar puntos de entrada
- [Canales](lua-channel.md) - Patrones de canales
- [Gestion de Procesos](lua-process.md) - Creacion y supervision
- [Funciones](lua-funcs.md) - Llamadas entre procesos
