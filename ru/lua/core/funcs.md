# Вызов функций
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Основной способ вызова других функций в Wippy. Выполнение зарегистрированных функций синхронно или асинхронно между процессами с полной поддержкой распространения контекста, учётных данных безопасности и таймаутов. Этот модуль центральный для построения распределённых приложений, где компоненты должны взаимодействовать.

## Загрузка

```lua
local funcs = require("funcs")
```

## call

Синхронный вызов зарегистрированной функции. Используйте, когда нужен немедленный результат и можете его ждать.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `target` | string | ID функции в формате "namespace:name" |
| `...args` | any | Аргументы, передаваемые функции |

**Возвращает:** `result, error`

Строка target следует паттерну `namespace:name`, где namespace идентифицирует модуль, а name — конкретную функцию.

## async

Запускает асинхронный вызов функции и немедленно возвращает Future. Используйте для долгих операций, где не хотите блокироваться, или когда хотите запустить несколько операций параллельно.

```lua
-- Запуск тяжёлых вычислений без блокировки
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Делаем другую работу пока вычисления идут...

-- Ждём результат когда готовы
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `target` | string | ID функции в формате "namespace:name" |
| `...args` | any | Аргументы, передаваемые функции |

**Возвращает:** `Future, error`

## new

Создаёт новый Executor для построения вызовов с пользовательским контекстом. Используйте, когда нужно распространить контекст запроса, установить учётные данные безопасности или настроить таймауты.

```lua
local exec = funcs.new()
```

**Возвращает:** `Executor, error`

## Executor

Builder для вызовов функций с опциями контекста. Методы возвращают новые экземпляры Executor (иммутабельная цепочка), так что можно переиспользовать базовую конфигурацию.

### with_context

Добавляет значения контекста, которые будут доступны вызываемой функции. Используйте для распространения данных уровня запроса: trace ID, пользовательских сессий, feature flags.

```lua
-- Распространение контекста запроса в downstream-сервисы
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `values` | table | Пары ключ-значение для добавления в контекст |

**Возвращает:** `Executor, error`

### with_actor

Устанавливает актора безопасности для проверок авторизации в вызываемой функции. Используйте при вызове функции от имени конкретного пользователя.

```lua
local security = require("security")
local actor = security.actor()  -- Получить актора текущего пользователя

-- Вызов админской функции с учётными данными пользователя
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `actor` | Actor | Актор безопасности (из модуля security) |

**Возвращает:** `Executor, error`

### with_scope

Устанавливает область безопасности для вызываемых функций. Области определяют доступные разрешения для вызова.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `scope` | Scope | Область безопасности (из модуля security) |

**Возвращает:** `Executor, error`

### with_options

Устанавливает опции вызова: таймаут и приоритет. Используйте для операций, которым нужны временные ограничения.

```lua
-- Установить таймаут 5 секунд для вызова внешнего API
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Обработать таймаут или другую ошибку
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `options` | table | Опции, специфичные для реализации |

**Возвращает:** `Executor, error`

### call / async

Версии Executor для call и async, использующие настроенный контекст.

```lua
-- Создать переиспользуемый executor с контекстом
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- Несколько вызовов с тем же контекстом
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

Возвращается вызовами `async()`. Представляет выполняющуюся асинхронную операцию.

### response / channel

Возвращает базовый канал для получения результата.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- или future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Возвращает:** `Channel`

### is_complete

Неблокирующая проверка завершённости future.

```lua
while not future:is_complete() do
    -- делаем другую работу
    time.sleep("100ms")
end
local result, err = future:result()
```

**Возвращает:** `boolean`

### is_canceled

Возвращает true если `cancel()` был вызван на этом future.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Возвращает:** `boolean`

### result

Возвращает закэшированный результат если завершён, или nil если ещё выполняется.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**Возвращает:** `Payload|nil, error|nil`

### error

Возвращает ошибку если future завершился неудачей.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Возвращает:** `error|nil, boolean`

### cancel

Отменяет асинхронную операцию.

```lua
future:cancel()
```

## Параллельные операции

Запуск нескольких операций конкурентно с async и channel.select.

```lua
-- Запуск нескольких операций параллельно
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- Ждём завершения всех через каналы
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
end
```

## Разрешения

Операции с функциями подчиняются вычислению политики безопасности.

| Action | Resource | Описание |
|--------|----------|----------|
| `funcs.call` | ID функции | Вызов конкретной функции |
| `funcs.context` | `context` | Использовать `with_context()` для установки контекста |
| `funcs.security` | `security` | Использовать `with_actor()` или `with_scope()` |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Target пустой | `errors.INVALID` | нет |
| Отсутствует namespace | `errors.INVALID` | нет |
| Отсутствует name | `errors.INVALID` | нет |
| Разрешение отклонено | `errors.PERMISSION_DENIED` | нет |
| Подписка не удалась | `errors.INTERNAL` | нет |
| Ошибка функции | varies | varies |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
