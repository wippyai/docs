---
title: "Streams"
description: "Operaciones de lectura/escritura de streams para manejar datos eficientemente. Los objetos stream se obtienen de otros modulos (HTTP, sistema de…"
---

# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Los streams proporcionan E/S incremental para HTTP, el sistema de archivos y otros
módulos. Los módulos propietarios de los datos subyacentes crean los objetos stream.
Esta página es una referencia de API; el bucle del scanner usa un callback
`process(token)` definido por la aplicación.

## Obtener un stream

```lua
-- From HTTP request body
local stream, err = req:stream()
if err then return nil, err end

-- From filesystem
local fs = require("fs")
local volume, err = fs.get("app:data")
if err then return nil, err end

local stream, err = volume:open("/file.txt", "r")
if err then return nil, err end
```

## Lectura

```lua
local chunk, err = stream:read(size)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `size` | integer | Bytes a leer (0 = fragmento por defecto de 32KB) |

**Devuelve:** `string, error` — `nil, nil` en EOF

## Escritura

```lua
local bytes, err = stream:write(data)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a escribir |

**Devuelve:** `integer, error` — bytes escritos

## Posicionamiento

```lua
local pos, err = stream:seek(whence, offset)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `whence` | string | `"set"`, `"cur"`, o `"end"` |
| `offset` | integer | Desplazamiento en bytes |

**Devuelve:** `integer, error` — nueva posicion

## Vaciar buffers

```lua
local ok, err = stream:flush()
```

`flush` escribe los datos almacenados en buffer en el destino subyacente.

## Información de Stream

```lua
local info, err = stream:stat()
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `size` | integer | Tamano total (-1 si desconocido) |
| `position` | integer | Posicion actual |
| `readable` | boolean | Puede leer |
| `writable` | boolean | Puede escribir |
| `seekable` | boolean | Puede posicionarse |

## Cierre

```lua
local ok, err = stream:close()
```

`close` libera los recursos del stream y puede llamarse más de una vez.

## Scanner

Crear un tokenizador para contenido de stream:

```lua
local scanner, err = stream:scanner(split)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### Metodos de Scanner

```lua
local has_more, err = scanner:scan()  -- avanzar al siguiente token
local token = scanner:text()           -- token actual
local err_msg = scanner:err()          -- error del scanner si lo hay
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then break end  -- EOF
    process(scanner:text())
end
```

Cuando `scan()` devuelve `false`, comprueba `scanner:err()` antes de tratar el
resultado como EOF. Los fallos de tokenización y de lectura subyacente se almacenan
en el scanner y no aparecen en el segundo valor devuelto por `scan()`.

## Errores

| Condición | Tipo |
|-----------|------|
| Tipo de whence/split invalido | lanzado como error de Lua (no devuelto) |
| Stream cerrado | `INTERNAL` |
| No es legible/escribible | `INTERNAL` |
| Fallo de lectura/escritura | `INTERNAL` |
