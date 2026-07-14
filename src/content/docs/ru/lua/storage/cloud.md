---
title: "Облачное хранилище"
---

# Облачное хранилище
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Доступ к S3-совместимому объектному хранилищу. Загрузка, скачивание, перечисление и управление файлами с поддержкой presigned URL.

Настройку хранилища см. в [Cloud Storage](system/cloudstorage.md).

## Загрузка

```lua
local cloudstorage = require("cloudstorage")
```

## Получение хранилища

Получить ресурс облачного хранилища по ID реестра:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | ID ресурса хранилища |

**Возвращает:** `Storage, error`

## Загрузка объектов

Загрузка содержимого из строки или файла:

```lua
local storage = cloudstorage.get("app.infra:files")

-- Загрузка строкового содержимого
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- Загрузка из файла
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ/путь объекта |
| `content` | string или Reader | Содержимое как строка или файловый reader |
| `options` | table | Опциональные метаданные и опции условной записи |

**Возвращает:** `boolean, error`

### Опции загрузки

Прикрепите метаданные или защитите запись с помощью таблицы опций:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
```

| Опция | Тип | Описание |
|-------|-----|----------|
| `content_type` | string | MIME-тип |
| `cache_control` | string | Заголовок Cache-Control |
| `content_disposition` | string | Заголовок Content-Disposition |
| `content_encoding` | string | Заголовок Content-Encoding |
| `metadata` | table | Пользовательские метаданные (строковые ключи/значения), хранятся как `x-amz-meta-*` |
| `headers` | table | Дополнительные заголовки запроса (строковые ключи/значения) |
| `if_match` | string | Записать, только если текущий ETag объекта совпадает |
| `if_none_match` | string | Записать, только если ни один объект не совпадает с ETag (`"*"` означает любой) |
| `only_if_absent` | boolean | Записать, только если ключ не существует (алиас для `if_none_match = "*"`) |

Условная запись, не прошедшая своё предусловие, возвращает ошибку `precondition_failed`.

## Скачивание объектов

Скачать объект в файловый writer:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- Скачивание части (первый 1KB)
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ объекта для скачивания |
| `writer` | Writer | Файловый writer назначения |
| `options.range` | string | Диапазон байт (например, "bytes=0-1023") |
| `options.if_match` | string | Скачать, только если ETag объекта совпадает |
| `options.if_none_match` | string | Скачать, только если ETag не совпадает |

**Возвращает:** `boolean, error`

Непройденное предусловие (`if_match`/`if_none_match`) возвращает ошибку `precondition_failed`.

## Перечисление объектов

Список объектов с опциональной фильтрацией по префиксу:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Пагинация для больших результатов
local token = nil
repeat
    local result = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    for _, obj in ipairs(result.objects) do
        process(obj)
    end
    token = result.next_continuation_token
until not result.is_truncated

storage:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `options.prefix` | string | Фильтр по префиксу ключа |
| `options.max_keys` | integer | Максимум объектов для возврата |
| `options.continuation_token` | string | Токен пагинации |
| `options.include_owner` | boolean | Включить `owner` каждого объекта (`id`, `display_name`) |
| `options.include_versions` | boolean | Перечислить версии объектов; каждый элемент включает `version_id` |

**Возвращает:** `table, error`

Результат содержит `objects`, `is_truncated`, `next_continuation_token`. Каждый объект имеет `key`, `size`, `etag`, `storage_class`, а также опциональные `last_modified`, `version_id` и `owner`.

<note>
В результатах списка <code>content_type</code> всегда пуст — операции списка S3 его не возвращают. Используйте <code>head_object</code>, чтобы прочитать content type и метаданные объекта.
</note>

## Метаданные объекта

Получить метаданные одного объекта без скачивания его тела:

```lua
local storage = cloudstorage.get("app.infra:files")

local meta, err = storage:head_object("reports/daily.json")
if err then
    return nil, err
end

print(meta.size, meta.etag, meta.content_type)
for k, v in pairs(meta.metadata) do
    print("meta", k, v)
end

storage:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ объекта |

**Возвращает:** `table, error`

Поля результата:

| Поле | Тип | Описание |
|------|-----|----------|
| `size` | integer | Размер объекта в байтах |
| `etag` | string | Entity tag |
| `content_type` | string | MIME-тип |
| `cache_control` | string | Заголовок Cache-Control |
| `content_disposition` | string | Заголовок Content-Disposition |
| `content_encoding` | string | Заголовок Content-Encoding |
| `storage_class` | string | Класс хранения |
| `version_id` | string | ID версии (присутствует при включённом версионировании) |
| `last_modified` | integer | Время последнего изменения (Unix-секунды) |
| `metadata` | table | Пользовательские метаданные (`x-amz-meta-*`) |
| `headers` | table | Сырые заголовки ответа (ключи в нижнем регистре) |

Отсутствующий объект возвращает ошибку `not_found`.

## Удаление объектов

Удалить несколько объектов:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `keys` | string[] | Массив ключей объектов для удаления |

**Возвращает:** `boolean, error`

## URL для скачивания

Создать временный URL для скачивания объекта без учётных данных. Полезно для передачи файлов внешним пользователям или отдачи контента через приложение.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_get_url("reports/quarterly.pdf", {
    expiration = 3600
})

storage:release()

if err then
    return nil, err
end

-- Вернуть URL клиенту для прямого скачивания
return {download_url = url}
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ объекта |
| `options.expiration` | integer | Секунд до истечения URL (по умолчанию: 3600) |

**Возвращает:** `string, error`

## URL для загрузки

Создать временный URL для загрузки объекта без учётных данных. Позволяет клиентам загружать файлы напрямую в хранилище без проксирования через сервер.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_put_url("uploads/user-123/avatar.jpg", {
    expiration = 600,
    content_type = "image/jpeg",
    content_length = 1024 * 1024
})

storage:release()

if err then
    return nil, err
end

-- Вернуть URL клиенту для прямой загрузки
return {upload_url = url}
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ объекта |
| `options.expiration` | integer | Секунд до истечения URL (по умолчанию: 3600) |
| `options.content_type` | string | Обязательный content type для загрузки |
| `options.content_length` | integer | Максимальный размер загрузки в байтах |

**Возвращает:** `string, error`

## Методы Storage

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `upload_object(key, content, opts?)` | `boolean, error` | Загрузить строку или файл |
| `download_object(key, writer, opts?)` | `boolean, error` | Скачать в файловый writer |
| `head_object(key)` | `table, error` | Получить метаданные объекта |
| `list_objects(opts?)` | `table, error` | Список объектов с фильтром по префиксу |
| `delete_objects(keys)` | `boolean, error` | Удалить несколько объектов |
| `presigned_get_url(key, opts?)` | `string, error` | Сгенерировать временный URL для скачивания |
| `presigned_put_url(key, opts?)` | `string, error` | Сгенерировать временный URL для загрузки |
| `release()` | `boolean` | Освободить ресурс хранилища |

## Разрешения

Операции облачного хранилища подчиняются вычислению политики безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `cloudstorage.get` | ID хранилища | Получить ресурс хранилища |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ID ресурса | `errors.INVALID` | нет |
| Ресурс не найден | `errors.NOT_FOUND` | нет |
| Не ресурс облачного хранилища | `errors.INVALID` | нет |
| Хранилище освобождено | `errors.INVALID` | нет |
| Пустой ключ | `errors.INVALID` | нет |
| Содержимое nil | `errors.INVALID` | нет |
| Writer некорректен | `errors.INVALID` | нет |
| Объект не найден | `errors.NOT_FOUND` | нет |
| Условное предусловие не выполнено | `errors.CONFLICT` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Операция не удалась | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
