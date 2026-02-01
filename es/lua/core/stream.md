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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `size` | integer | Bytes a leer (0 = leer todo disponible) |

**Devuelve:** `string, error` - nil en EOF

```lua
-- Leer todos los datos restantes
local data, err = stream:read_all()
```

## Escritura

```lua
local bytes, err = stream:write(data)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a escribir |

**Devuelve:** `integer, error` - bytes escritos

## Posicionamiento

```lua
local pos, err = stream:seek(whence, offset)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `whence` | string | `"set"`, `"cur"`, o `"end"` |
| `offset` | integer | Desplazamiento en bytes |

**Devuelve:** `integer, error` - nueva posicion

## Flush

```lua
local ok, err = stream:flush()
```

Vaciar datos almacenados en buffer al almacenamiento subyacente.

## Informacion de Stream

```lua
local info, err = stream:stat()
```

| Campo | Tipo | Descripcion |
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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### Metodos de Scanner

```lua
local has_more = scanner:scan()  -- Avanzar al siguiente token
local token = scanner:text()      -- Obtener token actual
local err_msg = scanner:err()     -- Obtener error si hay alguno
```

```lua
while scanner:scan() do
    local line = scanner:text()
    process(line)
end
if scanner:err() then
    return nil, errors.new("INTERNAL", scanner:err())
end
```

## Errores

| Condicion | Tipo |
|-----------|------|
| Tipo de whence/split invalido | `INVALID` |
| Stream cerrado | `INTERNAL` |
| No es legible/escribible | `INTERNAL` |
| Fallo de lectura/escritura | `INTERNAL` |
