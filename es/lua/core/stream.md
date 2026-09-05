---
title: "Streams"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/"
---

# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Operaciones de lectura/escritura de streams para manejar datos eficientemente. Los objetos stream se obtienen de otros modulos (HTTP, sistema de archivos, etc.).

## Carga

```lua
-- Desde cuerpo de solicitud HTTP
local stream = req:stream()

-- Desde sistema de archivos
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
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

## Flush

```lua
local ok, err = stream:flush()
```

Vaciar datos almacenados en buffer al almacenamiento subyacente.

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

Cerrar stream y liberar recursos. Seguro llamar multiples veces.

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

## Errores

| Condición | Tipo |
|-----------|------|
| Tipo de whence/split invalido | `INVALID` |
| Stream cerrado | `INTERNAL` |
| No es legible/escribible | `INTERNAL` |
| Fallo de lectura/escritura | `INTERNAL` |
