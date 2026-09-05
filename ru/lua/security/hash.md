---
title: "Хеш-функции"
description: "Криптографические хеш-функции и аутентификация сообщений HMAC."
---

# Хеш-функции
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Криптографические хеш-функции и аутентификация сообщений HMAC.

## Подключение

```lua
local hash = require("hash")
```

## Криптографические хеши

### MD5

```lua
local hex = hash.md5("data")
local raw = hash.md5("data", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для хеширования |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

### SHA-1

```lua
local hex = hash.sha1("data")
local raw = hash.sha1("data", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для хеширования |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

### SHA-256

```lua
local hex = hash.sha256("data")
local raw = hash.sha256("data", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для хеширования |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

### SHA-512

```lua
local hex = hash.sha512("data")
local raw = hash.sha512("data", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для хеширования |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

## Аутентификация HMAC

### HMAC-MD5

```lua
local hex = hash.hmac_md5("message", "secret")
local raw = hash.hmac_md5("message", "secret", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сообщение для аутентификации |
| `secret` | string | Секретный ключ |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

### HMAC-SHA1

```lua
local hex = hash.hmac_sha1("message", "secret")
local raw = hash.hmac_sha1("message", "secret", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сообщение для аутентификации |
| `secret` | string | Секретный ключ |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

### HMAC-SHA256

```lua
local hex = hash.hmac_sha256("message", "secret")
local raw = hash.hmac_sha256("message", "secret", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сообщение для аутентификации |
| `secret` | string | Секретный ключ |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

### HMAC-SHA512

```lua
local hex = hash.hmac_sha512("message", "secret")
local raw = hash.hmac_sha512("message", "secret", true)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сообщение для аутентификации |
| `secret` | string | Секретный ключ |
| `raw` | boolean? | Вернуть сырые байты вместо hex |

**Возвращает:** `string, error`

## Некриптографические хеши

### FNV-32

Быстрый хеш для хеш-таблиц и партиционирования:

```lua
local n = hash.fnv32("data")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для хеширования |

**Возвращает:** `number, error`

### FNV-64

Быстрый хеш с большим выходом для меньшего числа коллизий:

```lua
local n = hash.fnv64("data")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для хеширования |

**Возвращает:** `number, error`

## Вывод ключей

### PBKDF2

```lua
local key, err = hash.pbkdf2(password, salt, iterations, key_length)
local key, err = hash.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `password` | string | Пароль/парольная фраза (непустая) |
| `salt` | string | Значение соли (непустое) |
| `iterations` | integer | Число итераций (от 1 до 10 000 000) |
| `key_length` | integer | Требуемая длина ключа в байтах |
| `hash` | string? | `sha256` или `sha512` (по умолчанию: `sha256`) |

**Возвращает:** `string, error` (сырые байты ключа)

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Вход не является строкой | `errors.INVALID` | нет |
| Секрет не является строкой (HMAC) | `errors.INVALID` | нет |
| Пустой пароль/соль, неположительное или чрезмерное число итераций, неподдерживаемый хеш (PBKDF2) | `errors.INVALID` | нет |

Подробнее см. [Обработка ошибок](lua/core/errors.md).
