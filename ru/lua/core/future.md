# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Результаты асинхронных операций. Futures возвращаются `funcs.async()` и асинхронными вызовами контрактов.

## Загрузка

Не загружаемый модуль. Futures создаются асинхронными операциями:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## Канал ответа

Получить канал для получения результата:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` — псевдоним для `response()`.

## Проверка завершения

Неблокирующая проверка завершённости future:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Проверка отмены

Проверить, был ли вызван `cancel()`:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Получение результата

Получить закэшированный результат (неблокирующий):

```lua
local val, err = future:result()
```

**Возвращает:**
- Не завершён: `nil, nil`
- Отменён: `nil, error` (kind `CANCELED`)
- Ошибка: `nil, error`
- Успех: `Payload, nil` или `table, nil` (множественные payloads)

## Получение ошибки

Получить ошибку если future завершился неудачей:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Возвращает:** `error, boolean`

## Отмена

Отменить асинхронную операцию (best-effort):

```lua
future:cancel()
```

Операция может всё равно завершиться, если уже выполняется.

## Паттерн таймаута

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## Первый завершившийся

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- Отменить более медленный
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## Ошибки

| Условие | Kind |
|---------|------|
| Операция отменена | `CANCELED` |
| Асинхронная операция не удалась | varies |
