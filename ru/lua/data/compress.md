# Сжатие данных
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Сжатие и распаковка данных с использованием алгоритмов gzip, deflate, zlib, brotli и zstd.

## Загрузка

```lua
local compress = require("compress")
```

## GZIP

Наиболее широко поддерживаемый формат (RFC 1952).

### Сжатие {id="gzip-compress"}

```lua
-- Сжатие для HTTP-ответа
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Установка заголовка Content-Encoding
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- Максимальное сжатие для хранения
local archived = compress.gzip.encode(data, {level = 9})

-- Быстрое сжатие для реального времени
local fast = compress.gzip.encode(data, {level = 1})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для сжатия |
| `options` | table? | Опции кодирования (опционально) |

#### Опции {id="gzip-compress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | integer | Уровень сжатия 1-9 (по умолчанию: 6) |

**Возвращает:** `string, error`

### Распаковка {id="gzip-decompress"}

```lua
-- Распаковка HTTP-запроса
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- Распаковка с ограничением размера (защита от zip-бомб)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сжатые GZIP-данные |
| `options` | table? | Опции декодирования (опционально) |

#### Опции {id="gzip-decompress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `max_size` | integer | Макс. размер после распаковки в байтах (по умолчанию: 128MB, макс: 1GB) |

**Возвращает:** `string, error`

## Brotli

Лучшая степень сжатия для текста (RFC 7932).

### Сжатие {id="brotli-compress"}

```lua
-- Лучше всего подходит для статических ресурсов и текста
local compressed = compress.brotli.encode(html_content, {level = 11})

-- Кэширование сжатых ресурсов
cache:set("static:" .. hash, compressed)

-- Умеренное сжатие для API-ответов
local compressed = compress.brotli.encode(json_data, {level = 4})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для сжатия |
| `options` | table? | Опции кодирования (опционально) |

#### Опции {id="brotli-compress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | integer | Уровень сжатия 0-11 (по умолчанию: 6) |

**Возвращает:** `string, error`

### Распаковка {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- С ограничением размера
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сжатые Brotli-данные |
| `options` | table? | Опции декодирования (опционально) |

#### Опции {id="brotli-decompress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `max_size` | integer | Макс. размер после распаковки в байтах (по умолчанию: 128MB, макс: 1GB) |

**Возвращает:** `string, error`

## Zstandard

Быстрое сжатие с хорошим соотношением (RFC 8878).

### Сжатие {id="zstd-compress"}

```lua
-- Хороший баланс скорости и степени сжатия
local compressed = compress.zstd.encode(binary_data)

-- Высокое сжатие для архивов
local archived = compress.zstd.encode(data, {level = 19})

-- Быстрый режим для потоковой передачи
local fast = compress.zstd.encode(data, {level = 1})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для сжатия |
| `options` | table? | Опции кодирования (опционально) |

#### Опции {id="zstd-compress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | integer | Уровень сжатия 1-22 (по умолчанию: 3) |

**Возвращает:** `string, error`

### Распаковка {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сжатые Zstandard-данные |
| `options` | table? | Опции декодирования (опционально) |

#### Опции {id="zstd-decompress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `max_size` | integer | Макс. размер после распаковки в байтах (по умолчанию: 128MB, макс: 1GB) |

**Возвращает:** `string, error`

## Deflate

Чистое DEFLATE-сжатие (RFC 1951). Используется внутри других форматов.

### Сжатие {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для сжатия |
| `options` | table? | Опции кодирования (опционально) |

#### Опции {id="deflate-compress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | integer | Уровень сжатия 1-9 (по умолчанию: 6) |

**Возвращает:** `string, error`

### Распаковка {id="deflate-decompress"}

```lua
local decompressed = compress.deflate.decode(compressed)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сжатые DEFLATE-данные |
| `options` | table? | Опции декодирования (опционально) |

#### Опции {id="deflate-decompress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `max_size` | integer | Макс. размер после распаковки в байтах (по умолчанию: 128MB, макс: 1GB) |

**Возвращает:** `string, error`

## Zlib

DEFLATE с заголовком и контрольной суммой (RFC 1950).

### Сжатие {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для сжатия |
| `options` | table? | Опции кодирования (опционально) |

#### Опции {id="zlib-compress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | integer | Уровень сжатия 1-9 (по умолчанию: 6) |

**Возвращает:** `string, error`

### Распаковка {id="zlib-decompress"}

```lua
local decompressed = compress.zlib.decode(compressed)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Сжатые Zlib-данные |
| `options` | table? | Опции декодирования (опционально) |

#### Опции {id="zlib-decompress-options"}

| Поле | Тип | Описание |
|------|-----|----------|
| `max_size` | integer | Макс. размер после распаковки в байтах (по умолчанию: 128MB, макс: 1GB) |

**Возвращает:** `string, error`

## Выбор алгоритма

| Алгоритм | Применение | Скорость | Степень | Диапазон уровней |
|----------|------------|----------|---------|------------------|
| gzip | HTTP, широкая совместимость | Средняя | Хорошая | 1-9 |
| brotli | Статические ресурсы, текст | Низкая | Лучшая | 0-11 |
| zstd | Большие файлы, потоки | Высокая | Хорошая | 1-22 |
| deflate/zlib | Низкоуровневые протоколы | Средняя | Хорошая | 1-9 |

```lua
-- HTTP-ответ на основе Accept-Encoding
local accept = req:header("Accept-Encoding") or ""
local body = json.encode(response_data)

if accept:find("br") then
    res:set_header("Content-Encoding", "br")
    res:write(compress.brotli.encode(body))
elseif accept:find("gzip") then
    res:set_header("Content-Encoding", "gzip")
    res:write(compress.gzip.encode(body))
else
    res:write(body)
end
```

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ввод | `errors.INVALID` | нет |
| Уровень вне диапазона | `errors.INVALID` | нет |
| Некорректные сжатые данные | `errors.INVALID` | нет |
| Распакованный размер превышает лимит | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
