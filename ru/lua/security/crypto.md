# Шифрование и подпись
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Криптографические операции: шифрование, HMAC, JWT и деривация ключей. Адаптировано для использования в workflow.

## Подключение

```lua
local crypto = require("crypto")
```

## Генерация случайных данных

### Случайные байты

```lua
local bytes, err = crypto.random.bytes(32)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `length` | integer | Количество байт (1 – 1 048 576) |

**Возвращает:** `string, error`

### Случайная строка

```lua
local str, err = crypto.random.string(32)
local str, err = crypto.random.string(32, "0123456789abcdef")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `length` | integer | Длина строки (1 – 1 048 576) |
| `charset` | string? | Набор символов (по умолчанию буквы и цифры) |

**Возвращает:** `string, error`

### Случайный UUID

```lua
local id, err = crypto.random.uuid()
```

**Возвращает:** `string, error`

## HMAC

### HMAC-SHA256

```lua
local hex, err = crypto.hmac.sha256(key, data)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ HMAC |
| `data` | string | Данные для аутентификации |

**Возвращает:** `string, error`

### HMAC-SHA512

```lua
local hex, err = crypto.hmac.sha512(key, data)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ HMAC |
| `data` | string | Данные для аутентификации |

**Возвращает:** `string, error`

## Шифрование

### AES-GCM {id="encrypt-aes-gcm"}

```lua
local encrypted, err = crypto.encrypt.aes(data, key)
local encrypted, err = crypto.encrypt.aes(data, key, aad)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Открытый текст |
| `key` | string | 16, 24 или 32 байта (AES-128/192/256) |
| `aad` | string? | Дополнительные аутентифицируемые данные |

**Возвращает:** `string, error` — nonce в начале результата

### ChaCha20-Poly1305 {id="encrypt-chacha20"}

```lua
local encrypted, err = crypto.encrypt.chacha20(data, key)
local encrypted, err = crypto.encrypt.chacha20(data, key, aad)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Открытый текст |
| `key` | string | Ровно 32 байта |
| `aad` | string? | Дополнительные аутентифицируемые данные |

**Возвращает:** `string, error`

## Расшифрование

### AES-GCM {id="decrypt-aes-gcm"}

```lua
local plaintext, err = crypto.decrypt.aes(encrypted, key)
local plaintext, err = crypto.decrypt.aes(encrypted, key, aad)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Зашифрованные данные из encrypt.aes |
| `key` | string | Тот же ключ, что при шифровании |
| `aad` | string? | Должен совпадать с AAD при шифровании |

**Возвращает:** `string, error`

### ChaCha20-Poly1305 {id="decrypt-chacha20"}

```lua
local plaintext, err = crypto.decrypt.chacha20(encrypted, key)
local plaintext, err = crypto.decrypt.chacha20(encrypted, key, aad)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Зашифрованные данные из encrypt.chacha20 |
| `key` | string | Тот же ключ, что при шифровании |
| `aad` | string? | Должен совпадать с AAD при шифровании |

**Возвращает:** `string, error`

## JWT

### Кодирование

```lua
local token, err = crypto.jwt.encode(payload, secret)
local token, err = crypto.jwt.encode(payload, secret, "HS256")
local token, err = crypto.jwt.encode(payload, private_key_pem, "RS256")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `payload` | table | JWT claims (поле `_header` для пользовательского заголовка) |
| `key` | string | Секрет (HMAC) или приватный ключ PEM (RSA) |
| `alg` | string? | HS256, HS384, HS512, RS256 (по умолчанию HS256) |

**Возвращает:** `string, error`

### Проверка

```lua
local claims, err = crypto.jwt.verify(token, secret)
local claims, err = crypto.jwt.verify(token, secret, "HS256", false)
local claims, err = crypto.jwt.verify(token, public_key_pem, "RS256")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `token` | string | JWT-токен для проверки |
| `key` | string | Секрет (HMAC) или публичный ключ PEM (RSA) |
| `alg` | string? | Ожидаемый алгоритм (по умолчанию HS256) |
| `require_exp` | boolean? | Проверять срок действия (по умолчанию true) |

**Возвращает:** `table, error`

## Деривация ключей

### PBKDF2

```lua
local key, err = crypto.pbkdf2(password, salt, iterations, key_length)
local key, err = crypto.pbkdf2(password, salt, iterations, key_length, "sha512")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `password` | string | Пароль или парольная фраза |
| `salt` | string | Соль |
| `iterations` | integer | Количество итераций (максимум 10 000 000) |
| `key_length` | integer | Желаемая длина ключа в байтах |
| `hash` | string? | sha256 или sha512 (по умолчанию sha256) |

**Возвращает:** `string, error`

## Утилиты

### Сравнение с постоянным временем

```lua
local equal = crypto.constant_time_compare(a, b)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `a` | string | Первая строка |
| `b` | string | Вторая строка |

**Возвращает:** `boolean`

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Неверная длина | `errors.INVALID` | нет |
| Пустой ключ | `errors.INVALID` | нет |
| Неверный размер ключа | `errors.INVALID` | нет |
| Ошибка расшифрования | `errors.INTERNAL` | нет |
| Токен просрочен | `errors.INTERNAL` | нет |

Подробнее см. [Обработка ошибок](lua/core/errors.md).
