---
title: "Потоки"
description: "Операции чтения/записи потоков для эффективной обработки данных. Объекты Stream получаются из других модулей (HTTP, файловая система и т.д.)."
---

# Потоки
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Операции чтения/записи потоков для эффективной обработки данных. Объекты Stream получаются из других модулей (HTTP, файловая система и т.д.).

## Загрузка

```lua
-- Из тела HTTP-запроса
local stream = req:stream()

-- Из файловой системы
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## Чтение

```lua
local chunk, err = stream:read(size)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `size` | integer | Байт для чтения (0 = чанк по умолчанию 32KB) |

**Возвращает:** `string, error` — `nil, nil` при EOF

## Запись

```lua
local bytes, err = stream:write(data)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для записи |

**Возвращает:** `integer, error` — записанные байты

## Позиционирование

```lua
local pos, err = stream:seek(whence, offset)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `whence` | string | `"set"`, `"cur"` или `"end"` |
| `offset` | integer | Смещение в байтах |

**Возвращает:** `integer, error` — новая позиция

## Сброс буфера

```lua
local ok, err = stream:flush()
```

Сбросить буферизованные данные в базовое хранилище.

## Информация о потоке

```lua
local info, err = stream:stat()
```

| Поле | Тип | Описание |
|------|-----|----------|
| `size` | integer | Общий размер (-1 если неизвестен) |
| `position` | integer | Текущая позиция |
| `readable` | boolean | Можно читать |
| `writable` | boolean | Можно писать |
| `seekable` | boolean | Можно позиционировать |

## Закрытие

```lua
local ok, err = stream:close()
```

Закрыть поток и освободить ресурсы. Безопасно вызывать несколько раз.

## Scanner

Создать токенизатор для содержимого потока:

```lua
local scanner, err = stream:scanner(split)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### Методы Scanner

```lua
local has_more, err = scanner:scan()  -- перейти к следующему токену
local token = scanner:text()           -- текущий токен
local err_msg = scanner:err()          -- ошибка сканера, если есть
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then break end  -- EOF
    process(scanner:text())
end
```

## Ошибки

| Условие | Kind |
|---------|------|
| Неверный тип whence/split | `INVALID` |
| Поток закрыт | `INTERNAL` |
| Не читаемый/записываемый | `INTERNAL` |
| Ошибка чтения/записи | `INTERNAL` |
