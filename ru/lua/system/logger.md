# Логирование
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Структурированное логирование с уровнями debug, info, warn и error.

## Загрузка

```lua
local logger = require("logger")
```

## Уровни логирования

### Debug

```lua
logger:debug("message", {key = "value"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `message` | string | Сообщение лога |
| `fields` | table? | Контекстные пары ключ-значение |

### Info

```lua
logger:info("message", {key = "value"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `message` | string | Сообщение лога |
| `fields` | table? | Контекстные пары ключ-значение |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `message` | string | Сообщение лога |
| `fields` | table? | Контекстные пары ключ-значение |

### Error

```lua
logger:error("message", {key = "value"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `message` | string | Сообщение лога |
| `fields` | table? | Контекстные пары ключ-значение |

## Настройка логгера

### С полями

Создать дочерний логгер с постоянными полями.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `fields` | table | Поля для добавления ко всем логам |

**Возвращает:** `Logger`

### Именованный логгер

Создать именованный дочерний логгер.

```lua
local named = logger:named("auth")
named:info("message")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя логгера |

**Возвращает:** `Logger`

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустая строка имени | `errors.INVALID` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
