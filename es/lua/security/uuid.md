---
title: "Generación de UUID"
description: "Genera, valida, inspecciona, analiza y formatea UUID."
---

# Generación de UUID
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `uuid` genera, valida, inspecciona, analiza y formatea UUID. En workflows deterministas, la generación v1, v4 y v7 se ejecuta como un efecto secundario registrado y devuelve el valor registrado durante la repetición. La generación v3 y v5 basada en namespace es determinista y se ejecuta directamente.

Esta página es una referencia de API de llamadas aisladas. Los valores como `namespace`, `name`, `input` e `id` proceden de la aplicación contenedora. Captura y maneja el segundo retorno `error` antes de consumir resultados generados, analizados, inspeccionados o formateados. Los UUID son identificadores, no credenciales de portador; no uses ninguna versión de UUID como token de autenticación ni secreto.

## Carga

```lua
local uuid = require("uuid")
```

## UUID no deterministas

### Versión 1

UUID basado en tiempo con marca de tiempo e ID de nodo.

La versión 1 expone su hora de creación y el identificador del nodo. Evítala cuando esos datos sean sensibles; prefiere v4 si solo necesitas un identificador opaco.

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

UUID ordenado por tiempo que codifica su hora de creación para indexación cronológica. No confíes en él como secuencia estrictamente monótona, en especial para valores generados dentro del mismo intervalo temporal.

```lua
local id, err = uuid.v7()
```

**Devuelve:** `string, error`

## UUID deterministas

### Versión 3

UUID determinista a partir de un namespace y un nombre mediante MD5.

```lua
local id, err = uuid.v3(namespace, name)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `namespace` | string | Cadena UUID válida |
| `name` | string | Valor que se resumirá |

**Devuelve:** `string, error`

### Versión 5

UUID determinista a partir de un namespace y un nombre mediante SHA-1.

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
if err then
    return nil, err
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `namespace` | string | Cadena UUID válida |
| `name` | string | Valor que se resumirá |

**Devuelve:** `string, error`

## Inspección

### `validate`

```lua
local valid = uuid.validate(input)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `input` | any | Valor a verificar |

**Devuelve:** `boolean, nil`. Las entradas que no sean cadenas o tengan formato incorrecto devuelven `false`; la validación no genera un error estructurado.

### `version`

```lua
local ver, err = uuid.version(id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | Cadena UUID válida |

**Devuelve:** `integer, error`

### `variant`

```lua
local var, err = uuid.variant(id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | Cadena UUID válida |

**Devuelve:** `string, error` (RFC4122, Reserved, Microsoft, Future, NCS, o Invalid)

### `parse`

```lua
local info, err = uuid.parse(id)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | Cadena UUID válida |

**Devuelve:** `table, error`

Campos de tabla devuelta:
- `version` (integer): versión del UUID (1, 3, 4, 5 o 7)
- `variant` (string): RFC4122, Reserved, Microsoft, Future, NCS, o Invalid
- `timestamp` (integer): marca de tiempo Unix (solo v1 y v7)
- `node` (string): identificador de nodo sin procesar de seis bytes (solo v1); codifícalo antes de mostrarlo o almacenarlo como texto

### `format`

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uuid` | string | Cadena UUID válida |
| `format` | string? | standard (predeterminado), simple o urn |

**Devuelve:** `string, error`

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Tipo de entrada no válido | `errors.INVALID` | no |
| Formato UUID no válido | `errors.INVALID` | no |
| Tipo de formato no compatible | `errors.INVALID` | no |
| Error de generación | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
