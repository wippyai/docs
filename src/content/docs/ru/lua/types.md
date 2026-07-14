---
title: "Система типов"
---

# Система типов

> **Экспериментально.** Возможны некоторые ограничения.

Wippy включает постепенную систему типов с потоково-чувствительной проверкой. Типы по умолчанию non-nullable.

## Примитивы

```lua
local n: number = 3.14
local i: integer = 42         -- integer — подтип number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- явная динамика (отказ от проверки)
local u: unknown = something  -- нужно сузить перед использованием
```

### any vs unknown

```lua
-- any: отказ от проверки типов
local a: any = get_data()
a.foo.bar.baz()              -- нет ошибки, может упасть в runtime

-- unknown: безопасный неизвестный тип, нужно сузить перед использованием
local u: unknown = get_data()
u.foo                        -- ОШИБКА: нельзя обращаться к полю unknown
if type(u) == "table" then
    -- u сужено до table здесь
end
```

## Безопасность nil

Типы по умолчанию non-nullable. Используйте `?` для опциональных значений:

```lua
local x: number = nil         -- ОШИБКА: nil не присваивается number
local y: number? = nil        -- OK: number? означает "number или nil"
local z: number? = 42         -- OK
```

### Сужение по потоку управления

Проверщик типов отслеживает поток управления:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x — number здесь
    end
    return 0
end

-- Паттерн раннего возврата
local user, err = get_user(123)
if err then return nil, err end
-- user сужено до non-nil здесь

-- Или значение по умолчанию
local val = get_value() or 0  -- val: number
```

## Union-типы

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### Литеральные типы

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- ОШИБКА
```

## Типы функций

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Несколько возвратов
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Возврат ошибки (идиома Lua)
local function fetch(url: string): (string?, error?)
    -- возвращает (data, nil) или (nil, error)
end

-- Функциональные типы первого класса
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### Variadic-функции

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## Record-типы

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### Опциональные поля

```lua
type Config = {
    host: string,
    port: number,
    timeout?: number,
    debug?: boolean
}

local cfg: Config = {host = "localhost", port = 8080}  -- OK
```

## Generics

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### Generics с ограничениями

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ОШИБКА: отсутствует 'name'
```

## Intersection-типы

Объединяют несколько типов:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## Tagged-юнионы

```lua
type Result<T, E> =
    | {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    | {status: "loading"}
    | {status: "loaded", data: User}
    | {status: "error", message: string}

local function render(state: LoadState): string
    if state.status == "loading" then
        return "Loading..."
    elseif state.status == "loaded" then
        return "Hello, " .. state.data.name
    elseif state.status == "error" then
        return "Error: " .. state.message
    end
end
```

## Тип never

`never` — нижний тип, не имеет значений:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Паттерн обработки ошибок

Проверщик понимает идиому ошибок Lua:

```lua
local value, err = call()
if err then
    -- value — nil здесь
    return nil, err
end
-- value — non-nil здесь, err — nil
print(value)
```

## Утверждение non-nil

Используйте `!` для утверждения, что выражение не nil:

```lua
local user: User? = get_user()
local name = user!.name              -- утверждаем, что user не nil
```

Если значение во время выполнения nil, возникает ошибка. Используйте, когда вы знаете, что значение не может быть nil, но проверщик типов не может это доказать.

## Приведения типов

### Безопасное приведение (валидация)

Вызовите тип как функцию для валидации и приведения:

```lua
local data: any = get_json()
local user = User(data)              -- валидирует и возвращает User
local name = user.name               -- безопасный доступ к полю
```

Работает с примитивами и пользовательскими типами:

```lua
local x: any = get_value()
local s = string(x)                  -- приведение к string
local n = integer(x)                 -- приведение к integer
local b = boolean(x)                 -- приведение к boolean

type Point = {x: number, y: number}
local p = Point(data)                -- валидирует структуру record
```

### Метод Type:is()

Валидирует без выброса ошибки, возвращает `(value, nil)` или `(nil, error)`:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p — валидный Point
else
    return nil, err                  -- валидация не прошла
end
```

Результат сужается в условиях:

```lua
if Point:is(data) then
    local p: Point = data            -- data сужено до Point
end
```

### Небезопасное приведение

Используйте `::` или `as` для непроверяемых приведений:

```lua
local data: any = get_data()
local user = data :: User            -- без проверки в runtime
local user = data as User            -- то же что и ::
```

Используйте редко. Небезопасные приведения обходят валидацию и могут вызвать ошибки в runtime, если значение не соответствует типу.

## Рефлексия типов

Типы — значения первого класса с методами интроспекции.

### Kind и Name

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Поля record

Итерация по полям record:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Доступ к типам отдельных полей:

```lua
local nameType = User.name           -- тип поля 'name'
print(nameType:kind())               -- "string"
```

### Типы коллекций

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### Опциональные типы

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
```

### Union-типы

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### Типы функций

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### Сравнение типов

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (подтип)
print(Integer < Number)              -- true (строгий подтип)
```

### Типы как ключи таблиц

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## Аннотации типов

Добавляйте типы в сигнатуры функций:

```lua
-- Типы параметров и возврата
local function process(input: string): number
    return #input
end

-- Типы локальных переменных
local count: number = 0

-- Псевдонимы типов
type StringArray = {string}
type StringMap = {[string]: number}
```

## Валидаторы типов

Добавляйте runtime-ограничения валидации к типам с помощью аннотаций:

```lua
-- Один валидатор
local x: number @min(0) = 1

-- Несколько валидаторов
local x: number @min(0) @max(100) = 50

-- Шаблон строки
local email: string @pattern("^.+@.+$") = "test@example.com"

-- Валидатор без аргументов
local x: number @integer = 42
```

### Встроенные валидаторы

| Валидатор | Применяется к | Пример |
|-----------|------------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string, array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string, array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

### Валидаторы полей record

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### Валидаторы элементов массива

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### Валидаторы членов union

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## Правила вариантности

| Позиция | Вариантность | Описание |
|----------|----------|-------------|
| Readonly-поле | Ковариантно | Можно использовать подтип |
| Mutable-поле | Инвариантно | Должно совпадать точно |
| Параметр функции | Контравариантно | Можно использовать супертип |
| Возврат функции | Ковариантно | Можно использовать подтип |

## Подтипизация

- `integer` — подтип `number`
- `never` — подтип всех типов
- Все типы — подтипы `any`
- Подтипизация union: `A` — подтип `A | B`

## Постепенное внедрение

Добавляйте типы постепенно — нетипизированный код продолжает работать:

```lua
-- Существующий код работает без изменений
function old_function(x)
    return x + 1
end

-- Новый код получает типы
function new_function(x: number): number
    return x + 1
end
```

Начните с добавления типов:
1. В сигнатурах функций на границах API
2. В HTTP-обработчиках и потребителях очередей
3. В критической бизнес-логике

## Проверка типов

Запустите проверщик типов:

```bash
wippy lint
```

Сообщает об ошибках типов без выполнения кода.
