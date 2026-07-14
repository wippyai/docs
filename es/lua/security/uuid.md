---
title: "Generacion de UUID"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='workflow'/"
---

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

### Versión 1

UUID basado en tiempo con marca de tiempo e ID de nodo.

```lua
local id, err = uuid.v1()
```

**Devuelve:** `string, error`

### Versión 4

UUID aleatorio.

```lua
local id, err = uuid.v4()
```

**Devuelve:** `string, error`

### Versión 7

UUID ordenado por tiempo. Ordenable por tiempo de creacion.

```lua
local id, err = uuid.v7()
```

**Devuelve:** `string, error`

## UUIDs Deterministicos

### Versión 3

UUID deterministico desde namespace y nombre usando MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `namespace` | string | String UUID valido |
| `name` | string | Valor a hashear |

**Devuelve:** `string, error`

### Versión 5

UUID deterministico desde namespace y nombre usando SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `namespace` | string | String UUID valido |
| `name` | string | Valor a hashear |

**Devuelve:** `string, error`

## Inspeccion

### Validar

```lua
local valid = uuid.validate(input)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `input` | any | Valor a verificar |

**Devuelve:** `boolean, error`

### Obtener Versión

```lua
local ver, err = uuid.versión(id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |

**Devuelve:** `integer, error`

### Obtener Variante

```lua
local var, err = uuid.variant(id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |

**Devuelve:** `string, error` (RFC4122, Reserved, Microsoft, Future, NCS, o Invalid)

### Parsear

```lua
local info, err = uuid.parse(id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |

**Devuelve:** `table, error`

Campos de tabla devuelta:
- `versión` (integer): Versión UUID (1, 3, 4, 5, o 7)
- `variant` (string): RFC4122, Reserved, Microsoft, Future, NCS, o Invalid
- `timestamp` (integer): Marca de tiempo Unix (solo v1 y v7)
- `node` (string): ID de nodo (solo v1)

### Formatear

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | String UUID valido |
| `format` | string? | standard (predeterminado), simple, o urn |

**Devuelve:** `string, error`

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Tipo de entrada invalido | `errors.INVALID` | no |
| Formato UUID invalido | `errors.INVALID` | no |
| Tipo de formato no soportado | `errors.INVALID` | no |
| Generacion fallida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
