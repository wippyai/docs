---
title: "Cifrado y firma"
description: "Genera valores aleatorios, autentica datos, cifra contenido, verifica JWT y deriva claves."
---

# Cifrado y firma
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

El módulo `crypto` genera valores aleatorios, calcula HMAC, cifra y descifra datos, codifica y verifica JWT y deriva claves. En workflows deterministas, la generación aleatoria y el cifrado —que crea un nonce aleatorio— se ejecutan como efectos secundarios registrados; la repetición devuelve los bytes registrados. Las demás operaciones, incluidos HMAC, descifrado, procesamiento de JWT, PBKDF2 y comparación, se ejecutan directamente.

Esta página es una referencia de API. Cada bloque de código es una llamada aislada, no un sistema completo de gestión de claves o autenticación. Los nombres como `data`, `key`, `aad`, `payload` y `token` son valores proporcionados por la aplicación. Carga claves y contraseñas a través del límite de gestión de secretos de la aplicación; no las codifiques de forma fija, registres ni devuelvas en diagnósticos. Antes de consumir cualquier resultado `value, error` mostrado aquí, propaga o maneja el error.

## Carga

```lua
local crypto = require("crypto")
```

## Generación aleatoria

### Bytes aleatorios

```lua
local bytes, err = crypto.random.bytes(32)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `length` | integer | Número de bytes (1 a 1,048,576) |

**Devuelve:** `string, error`

### Cadena aleatoria

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `length` | integer | Longitud de salida en bytes (1 a 1,048,576) |
| `charset` | string? | Alfabeto de bytes ASCII que se utilizará (predeterminado: alfanumérico) |

**Devuelve:** `string, error`

La implementación selecciona bytes del alfabeto suministrado. Un alfabeto que no sea ASCII puede dividirse en UTF-8 no válido, y la selección modular solo es exactamente uniforme cuando la longitud en bytes del alfabeto divide 256. Para material secreto aleatorio uniforme, usa `crypto.random.bytes` y codifica el resultado para el formato de transporte requerido.

### UUID aleatorio

```lua
local id, err = crypto.random.uuid()
```

**Devuelve:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave HMAC |
| `data` | string | Datos a autenticar |

**Devuelve:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave HMAC |
| `data` | string | Datos a autenticar |

**Devuelve:** `string, error`

## Cifrado

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Texto plano a cifrar |
| `key` | string | 16, 24, o 32 bytes (AES-128/192/256) |
| `aad` | string? | Datos autenticados adicionales |

**Devuelve:** `string, error` (nonce prepuesto)

Ambas funciones de cifrado generan un nonce y lo anteponen al texto cifrado. No lo elimines ni reutilices, y usa los mismos AAD durante el descifrado. El texto cifrado no es un valor de registro libre de secretos: puede revelar información de longitud y correlación.

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Texto plano a cifrar |
| `key` | string | Debe ser 32 bytes |
| `aad` | string? | Datos autenticados adicionales |

**Devuelve:** `string, error` (nonce prepuesto)

## Descifrado

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos cifrados de encrypt.aes |
| `key` | string | Misma clave usada para cifrado |
| `aad` | string? | Debe coincidir con AAD usado en cifrado |

**Devuelve:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos cifrados de encrypt.chacha20 |
| `key` | string | Misma clave usada para cifrado |
| `aad` | string? | Debe coincidir con AAD usado en cifrado |

**Devuelve:** `string, error`

## JWT

### Codificar

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `payload` | table | Claims JWT (`_header` para cabecera personalizada) |
| `key` | string | Secreto (HMAC) o clave privada PEM (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (predeterminado: HS256) |

**Devuelve:** `string, error`

Pasa solo uno de los nombres de algoritmo documentados. En esta versión del runtime, un valor no compatible pasado a `encode` recurre a HS256 en lugar de devolver un error. Valida cualquier algoritmo configurable antes de esta llamada y no copies campos no fiables en `_header`; en particular, no permitas que la entrada sobrescriba cabeceras JWT reservadas como `alg`.

### Verificar

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `token` | string | Token JWT a verificar |
| `key` | string | Secreto (HMAC) o clave pública PEM (RSA) |
| `alg` | string? | Algoritmo esperado (predeterminado: HS256) |
| `require_exp` | boolean? | Exigir una claim `exp` (predeterminado: true) |

**Devuelve:** `table, error`

Cuando están presentes, `exp` y `nbf` se validan con el reloj de pared actual de la biblioteca JWT, no con la referencia temporal del workflow. Establecer `require_exp = false` permite que falte una claim `exp`; no desactiva la validación de una claim presente. No uses ninguno de estos resultados dependientes del tiempo para controlar una repetición sensible del workflow; realiza la comprobación en una actividad o valida el tiempo con un valor explícitamente seguro para la repetición.

Pasa siempre el algoritmo esperado por el emisor; la verificación restringe el token a ese método exacto. Trata las claims devueltas como datos autenticados, no como entrada de aplicación autorizada automáticamente, y valida aun así el emisor, la audiencia, el sujeto y las restricciones específicas de la aplicación.

## Derivación de claves

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `password` | string | Contraseña o frase de paso |
| `salt` | string | Valor de sal |
| `iterations` | integer | Conteo de iteraciones (max 10,000,000) |
| `key_length` | integer | Longitud de clave deseada en bytes |
| `hash` | string? | sha256 o sha512 (predeterminado: sha256) |

**Devuelve:** `string, error`

La clave derivada son bytes sin procesar. Usa una sal aleatoria nueva para cada verificador de contraseña almacenado y guarda la sal y los parámetros del factor de trabajo junto al verificador; la sal no necesita ser secreta. No uses una sal fija de ejemplo para almacenar contraseñas en producción.

## Utilidad

### Comparación en tiempo constante

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `a` | string | Primer string |
| `b` | string | Segundo string |

**Devuelve:** `boolean`

El resultado es `false` cuando las longitudes difieren. La garantía de comparación en tiempo constante subyacente se aplica a entradas de igual longitud, por lo que debes comparar resúmenes de longitud fija u otros secretos de igual longitud.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Longitud no válida | `errors.INVALID` | no |
| Clave vacía | `errors.INVALID` | no |
| Tamaño de clave no válido | `errors.INVALID` | no |
| Descifrado fallido | `errors.INTERNAL` | no |
| Token expirado | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
