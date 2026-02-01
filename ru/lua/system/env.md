# Переменные окружения
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Доступ к переменным окружения для конфигурации, секретов и настроек среды выполнения.

Переменные должны быть определены в [Environment System](system/env.md) перед использованием. Система контролирует, какие бэкенды хранения (ОС, файл, память) предоставляют значения и являются ли переменные только для чтения.

## Загрузка

```lua
local env = require("env")
```

## get

Получить значение переменной окружения.

```lua
-- Получить строку подключения к БД
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- Получить со значением по умолчанию
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- Получить секреты
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- Конфигурация
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Имя переменной |

**Возвращает:** `string, error`

Возвращает `nil, error` если переменная не существует.

## set

Установить переменную окружения.

```lua
-- Установить конфигурацию среды выполнения
env.set("APP_MODE", "production")

-- Переопределить для тестирования
env.set("API_URL", "http://localhost:8080")

-- Установить по условию
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Имя переменной |
| `value` | string | Устанавливаемое значение |

**Возвращает:** `boolean, error`

## get_all

Получить все доступные переменные окружения.

```lua
local vars = env.get_all()

-- Логировать конфигурацию (не логируйте секреты)
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- Проверить обязательные переменные
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
    end
end
```

**Возвращает:** `table, error`

## Разрешения

Доступ к окружению подчиняется вычислению политики безопасности.

### Действия безопасности

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `env.get` | Имя переменной | Чтение переменной окружения |
| `env.set` | Имя переменной | Запись переменной окружения |
| `env.get_all` | `*` | Список всех переменных |

### Проверка доступа

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

См. [Модель безопасности](system/security.md) для настройки политик.

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ключ | `errors.INVALID` | нет |
| Переменная не найдена | `errors.NOT_FOUND` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.

## См. также

- [Environment System](system/env.md) — настройка бэкендов хранения и определений переменных
