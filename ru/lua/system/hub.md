---
title: "Hub"
description: "Доступ только для чтения к каталогу модулей Wippy Hub: получение списка модулей, поиск, запрос метаданных, версий, зависимостей и README."
---

# Hub

Доступ только для чтения к каталогу модулей Wippy Hub: получение списка модулей, поиск, запрос метаданных, версий, зависимостей и README.

## Загрузка

```lua
local hub = require("hub")
```

## Параметры вызова

Каждый вызов принимает необязательную таблицу опций. Ключи, общие для всех вызовов:

| Ключ | Тип | Описание |
|-----|------|-------------|
| `registry` | string | Переопределение URL реестра |
| `token` | string | Переопределение API-токена |
| `timeout` | duration/number | Тайм-аут запроса (например, `"3m"` или секунды) |

Вызовы с поддержкой пагинации также принимают `page` и `page_size`.

## Модули

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| Функция | Описание |
|----------|-------------|
| `hub.modules.list(opts?)` | Список модулей с фильтрами |
| `hub.modules.search(query, opts?)` | Поиск по строке запроса |
| `hub.modules.get(module, opts?)` | Получить модуль по `org/name` или по id модуля |
| `hub.modules.readme(module, opts?)` | Получить README; возвращает `{content, filename, version}` |

### Опции List/Search

| Опция | Значения |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | массив строк |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
print(readme.content)
```

Опция `version` принимает либо строку версии, либо таблицу вида `{id, version, label}`.

## Версии

```lua
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| Функция | Описание |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Список версий модуля |
| `hub.versions.get(module, version, opts?)` | Получить конкретную версию |
| `hub.versions.inspect(module, version, opts?)` | Проверить артефакт версии (скачивает и читает бандл) |
| `hub.versions.open(module, version, opts?)` | Открыть артефакт версии как хэндл пакета |

### Хэндл пакета

`hub.versions.open` скачивает артефакт и возвращает хэндл с полями `version`, `digest`, `packed`:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")

local entries, err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }

pkg:close()
```

| Метод | Описание |
|-------|----------|
| `pkg:metadata()` | Карта метаданных пакета |
| `pkg:entries(opts?)` | Записи реестра в артефакте; `opts.kind` фильтрует, `opts.include_data` (по умолчанию true) управляет полем `data` |
| `pkg:resources()` | Список встроенных ресурсов |
| `pkg:fs(resource)` | Файловый хэндл встроенного ресурса |
| `pkg:close()` | Освободить хэндл |

Поле `data` записи возвращается как есть — ссылки `${env:...}` не разрешаются.

## Зависимости

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| Функция | Описание |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Зависимости версии модуля |
| `hub.dependents.get(module, opts?)` | Модули, зависящие от данного |

## Файлы

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| Функция | Описание |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | Список файлов версии (`version` обязателен); возвращает `{items, total, page, page_size}` |

## Аутентификация

Установить токен реестра в работающий процесс — каждый потребитель hub подхватит его при следующем вызове, без перезапуска:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

| Функция | Описание |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Проверить токен в реестре и при успехе установить его как переопределение среды выполнения |
| `hub.auth.status(registry?)` | Проверить текущие учётные данные вживую |
| `hub.auth.logout(registry?)` | Сбросить переопределение токена среды выполнения |

`status` содержит `authenticated`, `registry` и `orgs`; поля идентичности (`username`, `user_id`, `scope`, `expires_at`, `expired`) присутствуют только при аутентификации. Токен, не прошедший проверку, не сохраняется — `authenticate` возвращает `authenticated = false`. Переопределение имеет приоритет над `WIPPY_TOKEN` и сохранёнными учётными данными.

**Разрешения:** `hub.auth.authenticate`, `hub.auth.status`, `hub.auth.logout`

## См. также

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
