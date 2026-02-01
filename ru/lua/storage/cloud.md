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

**Возвращает:** `boolean, error`

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

**Возвращает:** `boolean, error`

## Перечисление объектов

Список объектов с опциональной фильтрацией по префиксу:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
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

**Возвращает:** `table, error`

Результат содержит `objects`, `is_truncated`, `next_continuation_token`.

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
| `upload_object(key, content)` | `boolean, error` | Загрузить строку или файл |
| `download_object(key, writer, opts?)` | `boolean, error` | Скачать в файловый writer |
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
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Операция не удалась | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
