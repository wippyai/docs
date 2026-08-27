---
title: "E/S de Terminal"
description: "Lee la entrada del terminal y escribe en la salida estándar y la salida de error estándar."
---

# E/S de Terminal
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

El módulo `io` lee de la entrada estándar y escribe en la salida estándar y la salida de error estándar en aplicaciones de terminal.

Esta es una referencia de API. Sus fragmentos son llamadas aisladas; un proceso de terminal debe propagar los errores Lua estructurados devueltos cuando el resultado afecte al flujo de control.

<note>
Este módulo solo está disponible para procesos ejecutados en un <a href="../../system/terminal.md">Terminal Host</a>, no para funciones regulares.
</note>

## Carga

```lua
local io = require("io")
```

## Escribir a Stdout

Escribir strings a stdout sin nueva linea:

```lua
local ok, err = io.write("text", "more")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | any | Número variable de valores a escribir (convertidos a string) |

**Devuelve:** `boolean, error`

## Print con Nueva Linea

Escribir valores a stdout con tabs entre ellos y nueva linea al final:

```lua
io.print("value1", "value2", 123)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | any | Número variable de valores a imprimir |

**Devuelve:** `boolean, error`

Cuando la búsqueda del contexto de terminal tiene éxito, los errores de escritura se ignoran y la función devuelve `true`. Si falta el contexto de terminal, devuelve `nil, "no terminal context"`.

## Escribir a Stderr

Escribir valores a stderr con tabs entre ellos y nueva linea al final:

```lua
io.eprint("Error:", message)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | any | Número variable de valores a imprimir |

**Devuelve:** `boolean, error`

Cuando la búsqueda del contexto de terminal tiene éxito, los errores de escritura se ignoran y la función devuelve `true`. Si falta el contexto de terminal, devuelve `nil, "no terminal context"`.

## Leer Bytes

Leer hasta `n` bytes desde stdin:

```lua
local data, err = io.read(1024)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `n` | integer | Número de bytes a leer (predeterminado: 1024, valores <= 0 se convierten en 1024) |

**Devuelve:** `string, error`. Una lectura correcta puede devolver menos de `n` bytes o una cadena vacía.

## Leer una Linea

Leer una linea desde stdin hasta nueva linea:

```lua
local line, err = io.readline()
```

**Devuelve:** `string, error`. Se eliminan los caracteres finales `\n` y `\r`. Un EOF después de una entrada parcial devuelve esa línea parcial; un EOF sin entrada devuelve `nil` y un error estructurado.

## Modo Raw

Activa o desactiva el modo raw del terminal (deshabilita el buffering por líneas y el eco):

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `enable` | boolean | `true` para activar, `false` para desactivar (por defecto: `true`) |

**Devuelve:** `boolean, error`. La llamada es un no-op correcto cuando la salida estándar no implementa `Sync()`.

El modo raw usa conteo de referencias — cada `io.raw(true)` debe emparejarse con un `io.raw(false)`. El terminal se restablece automáticamente al modo normal al salir el proceso.

## Vaciar Salida

Vaciar buffer de stdout:

```lua
local ok, err = io.flush()
```

**Devuelve:** `boolean, error`

## Argumentos de Linea de Comandos

Obtener argumentos de linea de comandos:

```lua
local args = io.args()
```

**Devuelve:** `string[]`

`io.args()` nunca falla. Devuelve una tabla vacía cuando no hay contexto de terminal disponible.

## Errores

Este módulo devuelve errores Lua estructurados. La ausencia de contexto de terminal usa `errors.UNAVAILABLE`; los fallos directos de write/flush y de respuesta yield no válida usan `errors.INTERNAL`. Los fallos de read, readline y raw mode respaldados por el dispatcher conservan los metadatos del error subyacente cuando están disponibles. `io.args()` no devuelve errores.
