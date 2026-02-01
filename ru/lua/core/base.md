# Стандартные библиотеки Lua
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Базовые библиотеки Lua, автоматически доступные во всех процессах Wippy. Не требуют `require()`.

## Глобальные функции

### Типы и преобразование

```lua
type(value)         -- Возвращает: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Преобразовать в число, опциональное основание (2-36)
tostring(value)     -- Преобразовать в строку, вызывает метаметод __tostring
```

### Утверждения и ошибки

```lua
assert(v [,msg])    -- Выбрасывает ошибку если v false/nil, иначе возвращает v
error(msg [,level]) -- Выбрасывает ошибку на указанном уровне стека (по умолчанию 1)
pcall(fn, ...)      -- Защищённый вызов, возвращает ok, result_or_error
xpcall(fn, errh)    -- Защищённый вызов с функцией-обработчиком ошибок
```

### Итерация по таблицам

```lua
pairs(t)            -- Итерация по всем парам ключ-значение
ipairs(t)           -- Итерация по массивной части (1, 2, 3, ...)
next(t [,index])    -- Получить следующую пару ключ-значение после index
```

### Метатаблицы

```lua
getmetatable(obj)       -- Получить метатаблицу (или поле __metatable если защищено)
setmetatable(t, mt)     -- Установить метатаблицу, возвращает t
```

### Прямой доступ к таблице

Обход метаметодов для прямого доступа к таблице:

```lua
rawget(t, k)        -- Получить t[k] без __index
rawset(t, k, v)     -- Установить t[k]=v без __newindex
rawequal(a, b)      -- Сравнить без __eq
```

### Утилиты

```lua
select(index, ...)  -- Вернуть аргументы начиная с index
select("#", ...)    -- Вернуть количество аргументов
unpack(t [,i [,j]]) -- Вернуть t[i] до t[j] как множественные значения
print(...)          -- Вывести значения (использует структурированное логирование в Wippy)
```

### Глобальные переменные

```lua
_G        -- Глобальная таблица окружения
_VERSION  -- Строка версии Lua
```

## Работа с таблицами

Функции для модификации таблиц:

```lua
table.insert(t, [pos,] value)  -- Вставить значение в позицию pos (по умолчанию: конец)
table.remove(t [,pos])         -- Удалить и вернуть элемент в позиции pos (по умолчанию: последний)
table.concat(t [,sep [,i [,j]]]) -- Конкатенировать элементы массива с разделителем
table.sort(t [,comp])          -- Сортировать на месте, comp(a,b) возвращает true если a < b
table.pack(...)                -- Упаковать varargs в таблицу с полем 'n'
table.unpack(t [,i [,j]])      -- Распаковать элементы таблицы как множественные значения
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, возвращает "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- По убыванию
end)
```

## Строковые операции

Функции работы со строками. Также доступны как методы строковых значений:

### Поиск по паттернам

```lua
string.find(s, pattern [,init [,plain]])   -- Найти паттерн, возвращает start, end, captures
string.match(s, pattern [,init])           -- Извлечь соответствующую подстроку
string.gmatch(s, pattern)                  -- Итератор по всем совпадениям
string.gsub(s, pattern, repl [,n])         -- Заменить совпадения, возвращает строку, количество
```

### Регистр

```lua
string.upper(s)   -- Преобразовать в верхний регистр
string.lower(s)   -- Преобразовать в нижний регистр
```

### Подстроки и символы

```lua
string.sub(s, i [,j])      -- Подстрока от i до j (отрицательные индексы с конца)
string.len(s)              -- Длина строки (или используйте #s)
string.byte(s [,i [,j]])   -- Числовые коды символов
string.char(...)           -- Создать строку из кодов символов
string.rep(s, n [,sep])    -- Повторить строку n раз с разделителем
string.reverse(s)          -- Перевернуть строку
```

### Форматирование

```lua
string.format(fmt, ...)    -- Форматирование в стиле printf
```

Спецификаторы формата: `%d` (целое), `%f` (дробное), `%s` (строка), `%q` (в кавычках), `%x` (hex), `%o` (octal), `%e` (научная нотация), `%%` (буквальный %)

```lua
local s = "Hello, World!"

-- Поиск по паттерну
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Замена
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Синтаксис методов
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Паттерны

| Паттерн | Соответствует |
|---------|---------------|
| `.` | Любой символ |
| `%a` | Буквы |
| `%d` | Цифры |
| `%w` | Буквы и цифры |
| `%s` | Пробельные символы |
| `%p` | Пунктуация |
| `%c` | Управляющие символы |
| `%x` | Шестнадцатеричные цифры |
| `%z` | Ноль (null) |
| `[set]` | Класс символов |
| `[^set]` | Отрицание класса |
| `*` | 0 или более (жадный) |
| `+` | 1 или более (жадный) |
| `-` | 0 или более (ленивый) |
| `?` | 0 или 1 |
| `^` | Начало строки |
| `$` | Конец строки |
| `%b()` | Сбалансированная пара |
| `(...)` | Группа захвата |

Версии в верхнем регистре (`%A`, `%D` и т.д.) соответствуют дополнению.

## Математические функции

Математические функции и константы:

### Константы {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Бесконечность
math.mininteger  -- Минимальное целое
math.maxinteger  -- Максимальное целое
```

### Базовые операции

```lua
math.abs(x)           -- Абсолютное значение
math.min(...)         -- Минимум из аргументов
math.max(...)         -- Максимум из аргументов
math.floor(x)         -- Округление вниз
math.ceil(x)          -- Округление вверх
math.modf(x)          -- Целая и дробная части
math.fmod(x, y)       -- Остаток от деления с плавающей точкой
```

### Степени и корни

```lua
math.sqrt(x)          -- Квадратный корень
math.pow(x, y)        -- x^y (или используйте оператор x^y)
math.exp(x)           -- e^x
math.log(x [,base])   -- Натуральный логарифм (или логарифм по основанию n)
```

### Тригонометрия

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Радианы
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Гиперболические
math.deg(r)   -- Радианы в градусы
math.rad(d)   -- Градусы в радианы
```

### Случайные числа

```lua
math.random()         -- Случайное дробное [0,1)
math.random(n)        -- Случайное целое [1,n]
math.random(m, n)     -- Случайное целое [m,n]
math.randomseed(x)    -- Установить seed
```

### Преобразование типов

```lua
math.tointeger(x)     -- Преобразовать в целое или nil
math.type(x)          -- "integer", "float" или nil
math.ult(m, n)        -- Беззнаковое сравнение меньше
```

## Корутины

Создание и управление корутинами. См. [Каналы и корутины](lua-channel.md) для каналов и паттернов конкурентности:

```lua
coroutine.create(fn)        -- Создать корутину из функции
coroutine.resume(co, ...)   -- Запустить/продолжить корутину
coroutine.yield(...)        -- Приостановить корутину, вернуть значения в resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Текущая корутина (nil если главный поток)
coroutine.wrap(fn)          -- Создать корутину как вызываемую функцию
```

### Запуск конкурентных корутин

Запуск конкурентной корутины, работающей независимо (специфика Wippy):

```lua
coroutine.spawn(fn)         -- Запустить функцию как конкурентную корутину
```

```lua
-- Фоновая задача
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Продолжить основное выполнение немедленно
process_request()
```

## Обработка ошибок

Создание и классификация структурированных ошибок. См. [Обработка ошибок](lua-errors.md) для полной документации:

### Константы {id="error-constants"}

```lua
errors.UNKNOWN           -- Неклассифицированная ошибка
errors.INVALID           -- Неверный аргумент или ввод
errors.NOT_FOUND         -- Ресурс не найден
errors.ALREADY_EXISTS    -- Ресурс уже существует
errors.PERMISSION_DENIED -- Доступ запрещён
errors.TIMEOUT           -- Истекло время операции
errors.CANCELED          -- Операция отменена
errors.UNAVAILABLE       -- Сервис недоступен
errors.INTERNAL          -- Внутренняя ошибка
errors.CONFLICT          -- Конфликт (например, параллельная модификация)
errors.RATE_LIMITED      -- Превышен лимит запросов
```

### Функции {id="error-functions"}

```lua
-- Создать ошибку из строки
local err = errors.new("something went wrong")

-- Создать ошибку с метаданными
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Обернуть существующую ошибку с контекстом
local wrapped = errors.wrap(err, "failed to load profile")

-- Проверить тип ошибки
if errors.is(err, errors.NOT_FOUND) then
    -- обработать не найдено
end

-- Получить стек вызовов из ошибки
local stack = errors.call_stack(err)
```

### Методы ошибок

```lua
err:message()    -- Получить сообщение ошибки
err:kind()       -- Получить тип ошибки (например, "NOT_FOUND")
err:retryable()  -- true, false или nil (неизвестно)
err:details()    -- Получить таблицу деталей или nil
err:stack()      -- Получить стек трейс как строку
```

## UTF-8 Unicode

Обработка UTF-8 строк:

### Константы {id="utf8-constants"}

```lua
utf8.charpattern  -- Паттерн, соответствующий одному UTF-8 символу
```

### Функции {id="utf8-functions"}

```lua
utf8.char(...)           -- Создать строку из Unicode codepoints
utf8.codes(s)            -- Итератор по codepoints: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- Получить codepoints в позициях от i до j
utf8.len(s [,i [,j]])    -- Посчитать UTF-8 символы (не байты)
utf8.offset(s, n [,i])   -- Позиция в байтах n-го символа от позиции i
```

```lua
local s = "Hello, 世界"

-- Подсчёт символов (не байтов)
print(utf8.len(s))  -- 9

-- Итерация по codepoints
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- Получить codepoint в позиции
local code = utf8.codepoint(s, 8)  -- Первый китайский символ

-- Создать строку из codepoints
local emoji = utf8.char(0x1F600)  -- Улыбающееся лицо
```

## Ограниченные возможности

Следующие стандартные возможности Lua НЕ доступны из соображений безопасности:

| Возможность | Альтернатива |
|-------------|--------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Используйте модуль [Динамическое выполнение](lua-eval.md) |
| `collectgarbage` | Автоматический GC |
| `rawlen` | Используйте оператор `#` |
| `io.*` | Используйте модуль [Файловая система](lua-fs.md) |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | Используйте модули [Выполнение команд](lua-exec.md), [Окружение](lua-env.md) |
| `debug.*` (кроме traceback) | Недоступно |
| `package.loadlib` | Нативные библиотеки не поддерживаются |

## См. также

- [Каналы и корутины](lua-channel.md) — каналы в стиле Go для конкурентности
- [Обработка ошибок](lua-errors.md) — создание и обработка структурированных ошибок
- [Системное время](lua-ostime.md) — функции системного времени
