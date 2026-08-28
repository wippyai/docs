---
title: "Logging"
description: "Escribe mensajes de log estructurados y crea loggers hijos con contexto persistente."
---

# Logging
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

El módulo `logger` escribe mensajes estructurados en los niveles debug, info, warn y error.

Esta es una referencia de API. Cada fragmento es una operación de logging aislada y supone un contexto de ejecución con la configuración de logger deseada.

Las llamadas de logging no devuelven valores. Cuando el contexto de ejecución los proporciona, cada llamada también añade el `pid` del proceso y la `location` de origen derivada del frame actual.

## Carga

```lua
local logger = require("logger")
```

## Niveles de Log

### `logger:debug`

Escribe un mensaje de nivel debug.

```lua
logger:debug("message", {key = "value"})
```

### `logger:info`

Escribe un mensaje de nivel info.

```lua
logger:info("message", {key = "value"})
```

### `logger:warn`

Escribe un mensaje de nivel warning.

```lua
logger:warn("message", {key = "value"})
```

### `logger:error`

Escribe un mensaje de nivel error.

```lua
logger:error("message", {key = "value"})
```

Los cuatro métodos de nivel de log aceptan los mismos parámetros:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `message` | string | Mensaje de log |
| `fields` | table? | Pares clave-valor contextuales |

Solo las claves string se convierten en nombres de campos. Strings, números, enteros, booleanos, errores y valores Lua estructurados se convierten en campos de log; las claves que no son strings se ignoran.

En `logger:error`, un campo llamado `error` se emite como campo de error y se elimina de la tabla proporcionada antes de procesar los demás campos. No reutilice esa tabla si necesita conservar la entrada `error`.

## Personalizacion de Logger

### `logger:with`

Crear un logger hijo con campos persistentes.

```lua
local function request_logger(request_id)
    return logger:with({request_id = request_id})
end

request_logger("req-123"):info("message")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `fields` | table | Campos a adjuntar a todos los logs |

**Devuelve:** `Logger`

El logger original no cambia. Los loggers hijos pueden encadenarse con llamadas adicionales a `with` y `named`.

### `logger:named`

Crear un logger hijo nombrado.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre del logger |

**Devuelve:** `Logger`

Un nombre vacío genera un error de argumento Lua. No se devuelve como un valor estructurado `errors.INVALID`.

Los métodos de logging no devuelven errores estructurados. Los tipos de argumento no válidos generan errores de argumento Lua. Si no hay un logger adjunto al contexto de ejecución, el módulo usa un logger no-op y descarta el mensaje.
