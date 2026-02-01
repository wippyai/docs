# Метрики и телеметрия
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Запись метрик приложения с использованием счётчиков, датчиков и гистограмм.

## Загрузка

```lua
local metrics = require("metrics")
```

## Счётчики

### Инкремент счётчика

```lua
metrics.counter_inc("requests_total", {method = "POST"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя метрики |
| `labels` | table? | Пары ключ-значение меток |

**Возвращает:** `boolean, error`

### Добавление к счётчику

```lua
metrics.counter_add("bytes_total", 1024, {direction = "out"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя метрики |
| `value` | number | Добавляемое значение |
| `labels` | table? | Пары ключ-значение меток |

**Возвращает:** `boolean, error`

## Датчики (Gauges)

### Установка датчика

```lua
metrics.gauge_set("queue_depth", 42, {queue = "emails"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя метрики |
| `value` | number | Текущее значение |
| `labels` | table? | Пары ключ-значение меток |

**Возвращает:** `boolean, error`

### Инкремент датчика

```lua
metrics.gauge_inc("connections", {pool = "db"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя метрики |
| `labels` | table? | Пары ключ-значение меток |

**Возвращает:** `boolean, error`

### Декремент датчика

```lua
metrics.gauge_dec("connections", {pool = "db"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя метрики |
| `labels` | table? | Пары ключ-значение меток |

**Возвращает:** `boolean, error`

## Гистограммы

### Запись наблюдения

```lua
metrics.histogram("duration_seconds", 0.123, {method = "GET"})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя метрики |
| `value` | number | Наблюдаемое значение |
| `labels` | table? | Пары ключ-значение меток |

**Возвращает:** `boolean, error`

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Коллектор недоступен | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
