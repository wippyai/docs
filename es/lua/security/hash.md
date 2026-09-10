---
title: "Funciones Hash"
description: "Funciones hash criptograficas y autenticación de mensajes HMAC."
---

# Funciones hash
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

El módulo `hash` calcula hashes criptográficos, valores HMAC, claves derivadas mediante PBKDF2 y hashes FNV-1 no criptográficos. Esta página es una referencia de API de llamadas aisladas. Las entradas literales ilustran usos correctos; cuando los datos, secretos, contraseñas o sales procedan de la aplicación, captura y maneja el segundo retorno `error` documentado antes de consumir el resultado.

Un hash no es cifrado y no oculta entradas de baja entropía. No registres contraseñas, claves HMAC, claves derivadas ni resúmenes sin procesar que dependan de secretos. Usa HMAC-SHA256 o HMAC-SHA512 para nuevos diseños de autenticación de mensajes y PBKDF2 con una sal aleatoria única para verificadores de contraseñas.

## Carga

```lua
local hash = require("hash")
```

## Hashes criptográficos

### MD5

MD5 no es resistente a colisiones. Úsalo solo por compatibilidad con protocolos que requieran MD5, no para tomar decisiones de seguridad.

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-1

SHA-1 no es resistente a colisiones. Úsalo solo por compatibilidad con protocolos que requieran SHA-1, no para tomar decisiones de seguridad.

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

## HMAC

### HMAC-MD5

Usa HMAC-MD5 solo por compatibilidad con un protocolo que lo requiera; prefiere HMAC-SHA256 o HMAC-SHA512 para nuevos diseños.

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### HMAC-SHA1

Usa HMAC-SHA1 solo por compatibilidad con un protocolo que lo requiera; prefiere HMAC-SHA256 o HMAC-SHA512 para nuevos diseños.

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Mensaje a autenticar |
| `secret` | string | Clave secreta |
| `raw` | boolean? | Devolver bytes crudos en lugar de hex |

**Devuelve:** `string, error`

## Hashes no criptográficos

### FNV-1 de 32 bits

Calcula un hash para usos como tablas hash y particionamiento.

```lua
local n = hash.fnv32("data")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |

**Devuelve:** `number, error`

### FNV-1 de 64 bits

Calcula un hash más ancho para usos como tablas hash y particionamiento, lo que reduce la probabilidad de colisiones.

```lua
local n = hash.fnv64("data")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a hashear |

**Devuelve:** `number, error`

## Derivacion de Claves

### PBKDF2

```lua
local key, err = hash.pbkdf2(password, salt, iterations, key_length)
local key, err = hash.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `password` | string | Contraseña/frase de paso (no vacía) |
| `salt` | string | Valor de salt (no vacío) |
| `iterations` | integer | Cantidad de iteraciones (1 a 10.000.000) |
| `key_length` | integer | Longitud deseada de la clave en bytes |
| `hash` | string? | `sha256` o `sha512` (predeterminado: `sha256`) |

**Devuelve:** `string, error` (bytes crudos de la clave)

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Entrada no es string | `errors.INVALID` | no |
| Secreto no es string (HMAC) | `errors.INVALID` | no |
| Contraseña/salt vacíos, iteraciones no positivas o excesivas, hash no soportado (PBKDF2) | `errors.INVALID` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
