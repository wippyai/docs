---
title: "Bibliotecas Lua Padrão"
description: "APIs globais integradas de Lua, incluindo table, string, math, coroutine e erros estruturados, disponíveis nas entradas do Wippy."
---

# Bibliotecas Lua Padrão
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Essas bibliotecas centrais de Lua estão disponíveis em todas as entradas Lua executáveis sem `require()`.

Esta página é uma referência de API. Os blocos de assinaturas listam as funções disponíveis; os blocos mais longos são exemplos isolados ou padrões parciais, não entradas completas. Nomes como `check_health` e `process_request` representam callbacks da aplicação.

## Funções Globais Integradas

### Tipo e Conversão

```lua
type(value)         -- Returns: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convert to number, optional base (2-36)
tostring(value)     -- Convert to string, calls __tostring metamethod
```

### Assertions e Erros

```lua
assert(v [,msg])    -- Raises error if v is false/nil, returns v otherwise
error(msg [,level]) -- Raises error at specified stack level (default 1)
pcall(fn, ...)      -- Protected call, returns ok, result_or_error
xpcall(fn, errh)    -- Protected call with error handler function
```

### Iteração de Tabela

```lua
pairs(t)            -- Iterate all key-value pairs
ipairs(t)           -- Iterate array portion (1, 2, 3, ...)
next(t [,index])    -- Get next key-value pair after index
```

### Metatables

```lua
getmetatable(obj)       -- Get metatable (or __metatable field if protected)
setmetatable(t, mt)     -- Set metatable, returns t
```

### Acesso Raw a Tabela

Bypass de metamethods para acesso direto a tabela:

```lua
rawget(t, k)        -- Get t[k] without __index
rawset(t, k, v)     -- Set t[k]=v without __newindex
rawequal(a, b)      -- Compare without __eq
```

### Utilitários

```lua
select(index, ...)  -- Return args from index onwards
select("#", ...)    -- Return number of args
unpack(t [,i [,j]]) -- Return t[i] through t[j] as multiple values
print(...)          -- Print values (uses structured logging in Wippy)
```

### Variáveis Globais

```lua
_G        -- The global environment table
_VERSION  -- Lua version string
```

## Manipulação de Tabela

A biblioteca `table` fornece operações in-place sobre arrays, ordenação, concatenação e desempacotamento:

```lua
table.insert(t, [pos,] value)  -- Insert value at pos (default: end)
table.remove(t [,pos])         -- Remove and return element at pos (default: last)
table.concat(t [,sep [,i [,j]]]) -- Concatenate array elements with separator
table.sort(t [,comp])          -- Sort in place, comp(a,b) returns true if a < b
table.unpack(t [,i [,j]])      -- Unpack table elements as multiple values
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, returns "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Descending order
end)
```

## Operações de String

As funções de string também estão disponíveis como métodos nos valores string.

### Pattern Matching

```lua
string.find(s, pattern [,init [,plain]])   -- Find pattern, returns start, end, captures
string.match(s, pattern [,init])           -- Extract matching substring
string.gmatch(s, pattern)                  -- Iterator over all matches
string.gsub(s, pattern, repl [,n])         -- Replace matches, returns string, count
```

### Conversão de Caso

```lua
string.upper(s)   -- Convert to uppercase
string.lower(s)   -- Convert to lowercase
```

### Substrings e Caracteres

```lua
string.sub(s, i [,j])      -- Substring from i to j (negative indexes from end)
string.len(s)              -- String length (or use #s)
string.byte(s [,i [,j]])   -- Numeric codes of characters
string.char(...)           -- Create string from character codes
string.rep(s, n)           -- Repeat string n times
string.reverse(s)          -- Reverse string
```

### Formatação

```lua
string.format(fmt, ...)    -- Printf-style formatting
```

Específicadores de formato: `%d` (inteiro), `%f` (float), `%s` (string), `%q` (quoted), `%x` (hex), `%o` (octal), `%e` (científico), `%%` (% literal)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Method syntax
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Patterns

| Pattern | Corresponde |
|---------|-------------|
| `.` | Qualquer caractere |
| `%a` | Letras |
| `%d` | Dígitos |
| `%w` | Alfanumérico |
| `%s` | Espaço em branco |
| `%p` | Pontuação |
| `%c` | Caracteres de controle |
| `%x` | Dígitos hexadecimais |
| `%z` | Zero (nulo) |
| `[set]` | Classe de caractere |
| `[^set]` | Classe negada |
| `*` | 0 ou mais (greedy) |
| `+` | 1 ou mais (greedy) |
| `-` | 0 ou mais (lazy) |
| `?` | 0 ou 1 |
| `^` | Início da string |
| `$` | Fim da string |
| `%b()` | Par balanceado |
| `(...)` | Grupo de captura |

Versões maiúsculas (`%A`, `%D`, etc.) correspondem ao complemento.

## Funções Math

A biblioteca `math` fornece constantes numéricas e operações matemáticas comuns.

### Constantes {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinity
math.mininteger  -- Minimum integer
math.maxinteger  -- Maximum integer
```

### Operações Básicas

```lua
math.abs(x)           -- Absolute value
math.min(...)         -- Minimum of arguments
math.max(...)         -- Maximum of arguments
math.floor(x)         -- Round down
math.ceil(x)          -- Round up
math.modf(x)          -- Integer and fractional parts
math.fmod(x, y)       -- Floating-point remainder
```

### Potências e Raízes

```lua
math.sqrt(x)          -- Square root
math.pow(x, y)        -- x^y (or use x^y operator)
math.exp(x)           -- e^x
math.log(x)           -- Natural log
math.log10(x)         -- Base-10 log
```

### Trigonometria

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radians
math.asin(x)  math.acos(x)  math.atan(x)
math.atan2(y, x)                            -- Arc tangent of y/x
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hyperbolic
math.deg(r)   -- Radians to degrees
math.rad(d)   -- Degrees to radians
```

### Números Aleatórios

```lua
math.random()         -- Random float [0,1)
math.random(n)        -- Random integer [1,n]
math.random(m, n)     -- Random integer [m,n]
math.randomseed(x)    -- Compatibility no-op; does not seed math.random
```

`math.random` não é determinístico. Não o use em decisões que precisem ser reproduzidas de forma idêntica em um workflow; `math.randomseed` não pode torná-lo determinístico.

### Conversão de Tipo

```lua
math.tointeger(x)     -- Convert to integer or nil
math.type(x)          -- "integer", "float", or nil
math.ult(m, n)        -- Unsigned less-than comparison
```

## Corrotinas

A biblioteca `coroutine` fornece criação e controle de corrotinas. Veja [Channels e Corrotinas](channel.md) para padrões de concorrência baseados em channels.

```lua
coroutine.create(fn)        -- Create coroutine from function
coroutine.resume(co, ...)   -- Start/continue coroutine
coroutine.yield(...)        -- Suspend coroutine, return values to resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Current coroutine (nil if main thread)
coroutine.wrap(fn)          -- Create coroutine as callable function
```

### Criando Corrotinas Concorrentes

O Wippy acrescenta `coroutine.spawn` para trabalho concorrente gerenciado pelo scheduler:

```lua
coroutine.spawn(fn)         -- Spawn function as concurrent coroutine
```

```lua
local time = require("time")

-- Spawn background task
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continue main execution immediately
process_request()
```

Esse padrão parcial pressupõe que a entrada liste `time` em `modules:` e forneça as funções `check_health` e `process_request`. A corrotina criada é executada concorrentemente no mesmo processo Lua; `process_request()` é alcançada imediatamente, e cada verificação de integridade é seguida por uma pausa de 30 segundos.

## Tratamento de Erros

A tabela global `errors` cria e classifica erros estruturados. Veja [Tratamento de Erros](errors.md) para a API completa.

### Constantes {id="error-constants"}

```lua
errors.UNKNOWN           -- Unclassified error
errors.INVALID           -- Invalid argument or input
errors.NOT_FOUND         -- Resource not found
errors.ALREADY_EXISTS    -- Resource already exists
errors.PERMISSION_DENIED -- Permission denied
errors.TIMEOUT           -- Operation timed out
errors.CANCELED          -- Operation cancelled
errors.UNAVAILABLE       -- Service unavailable
errors.INTERNAL          -- Internal error
errors.CONFLICT          -- Conflict (e.g., concurrent modification)
errors.RATE_LIMITED      -- Rate limit exceeded
```

### Funções {id="error-functions"}

```lua
-- Create error from string
local err = errors.new("something went wrong")

-- Create error with metadata
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Wrap existing error with context
local wrapped = errors.wrap(err, "failed to load profile")

-- Check error kind
if errors.is(err, errors.NOT_FOUND) then
    -- handle not found
end

-- Get call stack from error
local stack = errors.call_stack(err)
```

### Métodos de Erro

```lua
err:message()    -- Get error message string
err:kind()       -- Get error kind (e.g., "NOT_FOUND")
err:retryable()  -- true, false, or nil (unknown)
err:details()    -- Get details table or nil
err:stack()      -- Get stack trace as string
```

## Recursos Restritos

Os seguintes recursos padrão de Lua não estão disponíveis nos processos do Wippy:

| Recurso | Alternativa |
|---------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Use o módulo [Avaliação Dinâmica](../dynamic/eval.md) |
| `collectgarbage` | GC automático |
| `rawlen` | Use operador `#` |
| `string.dump` | Não suportado |
| `io.*` | Use [Filesystem](../storage/filesystem.md) para arquivos ou [I/O de Terminal](../system/io.md) para streams de terminal |
| `os.execute` | Use [Execução de Comandos](../dynamic/exec.md) |
| `os.remove`, `os.rename` | Use [Filesystem](../storage/filesystem.md) |
| `os.exit`, `os.tmpname` | Sem equivalente direto na biblioteca padrão |
| `debug.*` | Não disponível |
| `utf8.*` | Não disponível |
| `package.loadlib` | Bibliotecas nativas não suportadas |

## Veja Também

- [Channels e Corrotinas](channel.md) - Channels no estilo Go para concorrência
- [Tratamento de Erros](errors.md) - Criação e tratamento de erros estruturados
- [Tempo do SO](../system/ostime.md) - Funções de tempo do sistema
