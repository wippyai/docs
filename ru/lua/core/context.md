# Контекст запроса
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Доступ к значениям контекста уровня запроса. Контекст устанавливается через [Funcs](lua/core/funcs.md) или [Process](lua/core/process.md).

## Загрузка

```lua
local ctx = require("ctx")
```

## Доступ к контексту

### Получить значение

```lua
local value, err = ctx.get("key")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ контекста |

**Возвращает:** `any, error`

### Получить все значения

```lua
local values, err = ctx.all()
```

**Возвращает:** `table, error`

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ключ | `errors.INVALID` | нет |
| Ключ не найден | `errors.NOT_FOUND` | нет |
| Контекст недоступен | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
