# Generacion de UUID
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Generar identificadores unicos universales. Adaptado para workflows - los UUIDs aleatorios devuelven valores consistentes en replay.

## Carga

```lua
local uuid = require("uuid")
```

## UUIDs Aleatorios

### Version 1

UUID basado en tiempo con marca de tiempo e ID de nodo.

```lua
local id, err = uuid.v1()
```

**Devuelve:** `string, error`

### Version 4

UUID aleatorio.

```lua
local id, err = uuid.v4()
```

**Devuelve:** `string, error`

### Version 7

UUID ordenado por tiempo. Ordenable por tiempo de creacion.

```lua
local id, err = uuid.v7()
```

**Devuelve:** `string, error`

## UUIDs Deterministicos

### Version 3

UUID deterministico desde namespace y nombre usando MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `namespace` | string | String UUID valido |
| `name` | string | Valor a hashear |

**Devuelve:** `string, error`

### Version 5

UUID deterministico desde namespace y nombre usando SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `namespace` | string | String UUID valido |
| `name` | string | Valor a hashear |

**Devuelve:** `string, error`

## Inspeccion

### Validar

```lua
local valid = uuid.validate(input)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `input` | any | Valor a verificar |

**Devuelve:** `boolean`

### Obtener Version

```lua
local ver, err = uuid.version(id)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |

**Devuelve:** `integer, error`

### Obtener Variante

```lua
local var, err = uuid.variant(id)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |

**Devuelve:** `string, error` (RFC4122, Microsoft, NCS, o Invalid)

### Parsear

```lua
local info, err = uuid.parse(id)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |

**Devuelve:** `table, error`

Campos de tabla devuelta:
- `version` (integer): Version UUID (1, 3, 4, 5, o 7)
- `variant` (string): RFC4122, Microsoft, NCS, o Invalid
- `timestamp` (integer): Marca de tiempo Unix (solo v1 y v7)
- `node` (string): ID de nodo (solo v1)

### Formatear

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |
| `format` | string? | standard (predeterminado), simple, o urn |

**Devuelve:** `string, error`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Tipo de entrada invalido | `errors.INVALID` | no |
| Formato UUID invalido | `errors.INVALID` | no |
| Tipo de formato no soportado | `errors.INVALID` | no |
| Generacion fallida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
