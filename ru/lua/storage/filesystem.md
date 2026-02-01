# Файловая система
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Чтение, запись и управление файлами в изолированных томах файловой системы.

Настройку файловой системы см. в [Filesystem](system-filesystem.md).

## Загрузка

```lua
local fs = require("fs")
```

## Получение тома

Получить том файловой системы по ID реестра:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content = vol:readfile("/config.json")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | ID тома в реестре |

**Возвращает:** `FS, error`

<note>
Тома не требуют явного освобождения. Они управляются на системном уровне и становятся недоступны при отключении файловой системы от реестра.
</note>

## Чтение файлов

Чтение всего содержимого файла:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

Для больших файлов используйте потоковое чтение через `open()`:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## Запись файлов

Запись данных в файл:

```lua
local vol = fs.get("app:data")

-- Перезапись (по умолчанию)
vol:writefile("/config.json", json.encode(config))

-- Дозапись
vol:writefile("/logs/app.log", message .. "\n", "a")

-- Эксклюзивная запись (ошибка если существует)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| Режим | Описание |
|-------|----------|
| `"w"` | Перезапись (по умолчанию) |
| `"a"` | Дозапись |
| `"wx"` | Эксклюзивная запись (ошибка если файл существует) |

Для потоковой записи:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## Проверка путей

```lua
local vol = fs.get("app:data")

-- Проверка существования
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- Проверка директории
if vol:isdir(path) then
    process_directory(path)
end

-- Получение информации о файле
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Поля stat:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Операции с директориями

```lua
local vol = fs.get("app:data")

-- Создание директории
vol:mkdir("/uploads/" .. user_id)

-- Список содержимого директории
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- Удаление файла или пустой директории
vol:remove("/temp/file.txt")
```

Поля записи: `name`, `type` ("file" или "directory")

## Методы файлового дескриптора

При использовании `vol:open()` для потоковой работы:

| Метод | Описание |
|-------|----------|
| `read(size?)` | Прочитать байты (по умолчанию: 4096) |
| `write(data)` | Записать строковые данные |
| `seek(whence, offset)` | Установить позицию ("set", "cur", "end") |
| `sync()` | Сбросить в хранилище |
| `close()` | Освободить дескриптор |
| `scanner(split?)` | Создать сканер строк/слов |

Всегда вызывайте `close()` после работы с дескриптором.

## Scanner

Для построчной обработки:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- пропустить заголовок

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

Режимы разбиения: `"lines"` (по умолчанию), `"words"`, `"bytes"`, `"runes"`

## Константы

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- от начала
fs.seek.CUR       -- от текущей позиции
fs.seek.END       -- от конца
```

## Методы FS

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `readfile(path)` | `string, error` | Прочитать весь файл |
| `writefile(path, data, mode?)` | `boolean, error` | Записать файл |
| `exists(path)` | `boolean, error` | Проверить существование пути |
| `stat(path)` | `table, error` | Получить информацию о файле |
| `isdir(path)` | `boolean, error` | Проверить директорию |
| `mkdir(path)` | `boolean, error` | Создать директорию |
| `remove(path)` | `boolean, error` | Удалить файл/пустую директорию |
| `readdir(path)` | `iterator` | Список содержимого директории |
| `open(path, mode)` | `File, error` | Открыть дескриптор файла |
| `chdir(path)` | `boolean, error` | Сменить рабочую директорию |
| `pwd()` | `string` | Получить рабочую директорию |

## Разрешения

Доступ к файловой системе подчиняется вычислению политики безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `fs.get` | ID тома | Получить том файловой системы |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой путь | `errors.INVALID` | нет |
| Некорректный режим | `errors.INVALID` | нет |
| Файл закрыт | `errors.INVALID` | нет |
| Путь не найден | `errors.NOT_FOUND` | нет |
| Путь уже существует | `errors.ALREADY_EXISTS` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
