---
title: "Облачное хранилище"
description: "Доступ к S3-совместимому объектному хранилищу. Загрузка, скачивание, перечисление и управление объектами, presigned URL для скачивания, загрузки и…"
---

# Облачное хранилище
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Доступ к S3-совместимому объектному хранилищу. Загрузка, скачивание, перечисление и управление объектами, presigned URL для скачивания, загрузки и частей multipart, а также чтение объектов с произвольным доступом.

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

Попытка выполняется для каждого ключа. Удаление несуществующего ключа ошибкой не является. Если провайдер сообщает о сбоях по отдельным ключам, вызов возвращает одну ошибку, перечисляющую каждый сбойный ключ и код ошибки провайдера.

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

## Multipart-загрузки

Одиночный presigned PUT ограничивает объект 5 ГиБ. Presigned multipart-загрузка разбивает более крупный объект на части, которые клиент загружает напрямую, а затем собирает их на стороне сервера. Multipart — это возможность провайдера: S3 её реализует, а провайдеры без неё возвращают `errors.UNAVAILABLE`.

```lua
local storage = cloudstorage.get("app.infra:files")

local mp, err = storage:create_multipart_upload("backups/huge.zip", {
    content_type = "application/zip",
    metadata = { source = "uploader" },
})
if err then return nil, err end

local urls, err = storage:presigned_part_urls("backups/huge.zip", mp.upload_id, {
    count = 3,
    expiration = 900,
})
if err then
    storage:abort_multipart_upload("backups/huge.zip", mp.upload_id)
    return nil, err
end

-- Клиент выполняет PUT по каждому url и возвращает ETag из заголовков ответа.
local done, err = storage:complete_multipart_upload("backups/huge.zip", mp.upload_id, {
    { part_number = 1, etag = etag1 },
    { part_number = 2, etag = etag2 },
    { part_number = 3, etag = etag3 },
})

storage:release()
```

### create_multipart_upload

Начинает multipart-загрузку для ключа.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ итогового объекта |
| `options` | table | `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata`, `headers` — та же семантика, что и у `upload_object` |

**Возвращает:** `table, error` — таблица несёт `upload_id`, идентифицирующий загрузку для всех последующих вызовов частей, завершения и отмены.

Условные записи (`if_match`, `if_none_match`, `only_if_absent`) не входят в протокол multipart и здесь не принимаются.

### presigned_part_urls

Генерирует presigned PUT URL для частей выполняющейся загрузки. На каждый URL выполняется обычный HTTP PUT; загружающая сторона должна сохранить заголовок ответа `ETag` каждой части для `complete_multipart_upload`.

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `key` | string | обязательно | Ключ объекта |
| `upload_id` | string | обязательно | Из `create_multipart_upload` |
| `options.parts` | int[] | - | Явные номера частей (1–10000, без дубликатов) |
| `options.count` | int | - | Подписать части `1..count` |
| `options.headers` | table | - | Заголовки, обязательные для каждого запроса части; они подписываются и должны быть отправлены загружающей стороной |
| `options.expiration` | int | 3600 | Секунд до истечения URL |

Ровно один из `parts` или `count` обязателен, и один вызов подписывает не более 1000 URL — для очень крупных объектов подписывайте постранично.

**Возвращает:** `table, error` — массив `{ part_number, url }`.

Каждая часть, кроме последней, должна быть не меньше 5 МиБ; провайдер проверяет это при завершении.

### complete_multipart_upload

Собирает итоговый объект из загруженных частей. Части можно сообщать в любом порядке — перед завершением они сортируются по номеру.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ объекта |
| `upload_id` | string | Из `create_multipart_upload` |
| `parts` | table | Массив `{ part_number = int, etag = string }` |

**Возвращает:** `table, error` — `etag`, а также `version_id` и `location`, если провайдер их сообщает. Неизвестный upload ID возвращает `errors.NOT_FOUND`.

### abort_multipart_upload

Отбрасывает выполняющуюся загрузку и освобождает её сохранённые части.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ объекта |
| `upload_id` | string | Из `create_multipart_upload` |

**Возвращает:** `boolean, error`

Загрузка, которая так и не была завершена, хранит свои части — и тарифицируется — пока не будет отменена. Отменяйте её на каждом пути сбоя и настройте правило жизненного цикла бакета как подстраховку — см. [Cloud Storage](system/cloudstorage.md#multipart-uploads).

## Чтение по диапазонам

`open_reader` открывает произвольный доступ к объекту через ranged GET — без локального промежуточного хранения и без полной загрузки. Основной потребитель — [`archive.open`](lua/data/archive.md), который читает многогигабайтные архивы прямо из объектного хранилища с ограниченным потреблением памяти.

```lua
local archive = require("archive")
local storage = cloudstorage.get("app.infra:files")

local reader, err = storage:open_reader("uploads/huge.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4,
})
if err then return nil, err end

local r = assert(archive.open(reader))
for e in r:entries() do
    print(e.name, e.size)
end
r:close()
reader:close()

storage:release()
```

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `key` | string | обязательно | Ключ объекта |
| `options.block_size` | int | 8388608 | Единица ranged GET в байтах (от 64 КиБ до 128 МиБ) |
| `options.cache_blocks` | int | 4 | Число резидентных LRU-блоков (от 1 до 64) |

`block_size * cache_blocks` не может превышать 256 МиБ. Отсутствующий объект возвращает `errors.NOT_FOUND`.

**Возвращает:** `Reader, error`

ETag объекта закрепляется при открытии reader'а и отправляется как `If-Match` при каждом чтении диапазона, поэтому объект, перезаписанный посреди чтения, приводит к `errors.CONFLICT` вместо выдачи смеси двух поколений объекта. Провайдер, не способный предоставить ETag, возвращает `errors.UNAVAILABLE`; reader никогда не отдаёт незакреплённый объект.

Промахи кэша выполняют блокирующий сетевой ввод-вывод в вызывающей задаче и сериализуют параллельных читателей, поэтому последовательный доступ по записям — как в архиве — и есть предполагаемая форма использования.

### Методы Reader

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `size()` | `integer` | Размер объекта в байтах, из stat при открытии |
| `key()` | `string` | Ключ объекта, из которого читает reader |
| `close()` | `boolean, error` | Освободить кэш блоков; идемпотентно |

Reader закрывается автоматически в области задачи, если не закрыт явно.

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
| `create_multipart_upload(key, opts?)` | `table, error` | Начать presigned multipart-загрузку |
| `presigned_part_urls(key, upload_id, opts)` | `table, error` | Подписать PUT URL для частей загрузки |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Собрать объект из загруженных частей |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Отбросить выполняющуюся multipart-загрузку |
| `open_reader(key, opts?)` | `Reader, error` | Открыть reader произвольного доступа по диапазонам |
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
| Неизвестный upload ID | `errors.NOT_FOUND` | нет |
| Условное предусловие не выполнено | `errors.CONFLICT` | нет |
| Объект перезаписан во время чтения по диапазону | `errors.CONFLICT` | нет |
| Провайдер не поддерживает multipart-загрузки | `errors.UNAVAILABLE` | нет |
| Провайдер не предоставляет ETag для `open_reader` | `errors.UNAVAILABLE` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Операция не удалась | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
