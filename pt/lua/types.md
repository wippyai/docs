# Sistema de Tipos

Wippy inclui um sistema de tipos gradual com checagem sensível ao fluxo. Tipos são não-nuláveis por padrão.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer é subtipo de number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dinâmico explícito (opt-out de checagem)
local u: unknown = something  -- deve estreitar antes de usar
```

### any vs unknown

```lua
-- any: opt-out de checagem de tipo
local a: any = get_data()
a.foo.bar.baz()              -- sem erro, pode crashar em runtime

-- unknown: desconhecido seguro, deve estreitar antes de usar
local u: unknown = get_data()
u.foo                        -- ERRO: não pode acessar propriedade de unknown
if type(u) == "table" then
    -- u estreitado para table aqui
end
```

## Segurança de Nil

Tipos são não-nuláveis por padrão. Use `?` para valores opcionais:

```lua
local x: number = nil         -- ERRO: nil não atribuível a number
local y: number? = nil        -- OK: number? significa "number ou nil"
local z: number? = 42         -- OK
```

### Estreitamento por Fluxo de Controle

O checador de tipos rastreia fluxo de controle:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x é number aqui
    end
    return 0
end

-- Padrão de retorno antecipado
local user, err = get_user(123)
if err then return nil, err end
-- user estreitado para non-nil aqui

-- Ou padrão
local val = get_value() or 0  -- val: number
```

## Tipos Union

```lua
local val: number | string = get_value()

if type(val) == "number" then
    print(val + 1)            -- val: number
else
    print(val:upper())        -- val: string
end
```

### Tipos Literais

```lua
type Status = "pending" | "active" | "done"

local s: Status = "pending"   -- OK
local s: Status = "invalid"   -- ERRO
```

## Tipos de Função

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Múltiplos retornos
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Retornos de erro (idioma Lua)
local function fetch(url: string): (string?, error?)
    -- retorna (data, nil) ou (nil, error)
end

-- Tipos de função de primeira classe
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### Funções Variádicas

```lua
local function sum(...: number): number
    local total: number = 0
    for _, v in ipairs({...}) do
        total = total + v
    end
    return total
end
```

## Tipos Record

```lua
type User = {name: string, age: number}

local u: User = {name = "alice", age = 25}
```

### Campos Opcionais

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

### Generics com Restrições

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERRO: faltando 'name'
```

## Tipos Intersection

Combine múltiplos tipos:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## Unions Taggeadas

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

## O Tipo never

`never` é o tipo bottom - nenhum valor existe:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Padrão de Tratamento de Erros

O checador entende o idioma de erro Lua:

```lua
local value, err = call()
if err then
    -- value é nil aqui
    return nil, err
end
-- value é non-nil aqui, err é nil
print(value)
```

## Assertion Non-Nil

Use `!` para assertar que uma expressão é non-nil:

```lua
local user: User? = get_user()
local name = user!.name              -- assertar user é non-nil
```

Se o valor for nil em runtime, um erro é lançado. Use quando você sabe que um valor não pode ser nil mas o checador de tipos não pode provar.

## Type Casts

### Cast Seguro (Validação)

Chame um tipo como função para validar e fazer cast:

```lua
local data: any = get_json()
local user = User(data)              -- valida e retorna User
local name = user.name               -- acesso seguro a campo
```

Funciona com primitivos e tipos customizados:

```lua
local x: any = get_value()
local s = string(x)                  -- cast para string
local n = integer(x)                 -- cast para integer
local b = boolean(x)                 -- cast para boolean

type Point = {x: number, y: number}
local p = Point(data)                -- valida estrutura record
```

### Método Type:is()

Validar sem lançar, retorna `(value, nil)` ou `(nil, error)`:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p é Point válido
else
    return nil, err                  -- validação falhou
end
```

O resultado estreita em condicionais:

```lua
if Point:is(data) then
    local p: Point = data            -- data estreitado para Point
end
```

### Cast Inseguro

Use `::` ou `as` para casts sem checagem:

```lua
local data: any = get_data()
local user = data :: User            -- sem checagem runtime
local user = data as User            -- mesmo que ::
```

Use com moderação. Casts inseguros bypassam validação e podem causar erros runtime se o valor não corresponder ao tipo.

## Reflexão de Tipos

Tipos são valores de primeira classe com métodos de introspecção.

### Kind e Name

```lua
print(Number:kind())                 -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Campos de Record

Itere sobre campos de record:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Acesse tipos de campos individuais:

```lua
local nameType = User.name           -- tipo do campo 'name'
print(nameType:kind())               -- "string"
```

### Tipos de Coleção

```lua
local arr: {number} = {1, 2, 3}
local arrType = typeof(arr)
print(arrType:elem():kind())         -- "number"

local map: {[string]: number} = {}
local mapType = typeof(map)
print(mapType:key():kind())          -- "string"
print(mapType:val():kind())          -- "number"
```

### Tipos Opcionais

```lua
local opt: number? = nil
local optType = typeof(opt)
print(optType:kind())                -- "optional"
print(optType:inner():kind())        -- "number"
```

### Tipos Union

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### Tipos de Função

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### Comparação de Tipos

```lua
print(Number == Number)              -- true
print(Integer <= Number)             -- true (subtipo)
print(Integer < Number)              -- true (subtipo estrito)
```

### Tipos como Chaves de Tabela

```lua
local handlers = {}
handlers[Number] = function() return "number handler" end
handlers[String] = function() return "string handler" end

local h = handlers[typeof(value)]
if h then h() end
```

## Anotações de Tipo

Adicione tipos a assinaturas de função:

```lua
-- Tipos de parâmetro e retorno
local function process(input: string): number
    return #input
end

-- Tipos de variável local
local count: number = 0

-- Aliases de tipo
type StringArray = {string}
type StringMap = {[string]: number}
```

## Validadores de Tipo

Adicione restrições de validação em runtime a tipos usando anotações:

```lua
-- Validador único
local x: number @min(0) = 1

-- Múltiplos validadores
local x: number @min(0) @max(100) = 50

-- Padrão de string
local email: string @pattern("^.+@.+$") = "test@example.com"

-- Validador sem argumentos
local x: number @integer = 42
```

### Validadores Incorporados

| Validador | Aplica-se a | Exemplo |
|-----------|-------------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string, array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string, array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

### Validadores de Campo de Record

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### Validadores de Elemento de Array

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### Validadores de Membro de Union

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## Regras de Variância

| Posição | Variância | Descrição |
|---------|-----------|-----------|
| Campo readonly | Covariante | Pode usar subtipo |
| Campo mutável | Invariante | Deve corresponder exatamente |
| Parâmetro de função | Contravariante | Pode usar supertipo |
| Retorno de função | Covariante | Pode usar subtipo |

## Subtipagem

- `integer` é subtipo de `number`
- `never` é subtipo de todos os tipos
- Todos os tipos são subtipos de `any`
- Subtipagem de union: `A` é subtipo de `A | B`

## Adoção Gradual

Adicione tipos incrementalmente - código sem tipos continua funcionando:

```lua
-- Código existente funciona sem alterações
function old_function(x)
    return x + 1
end

-- Novo código recebe tipos
function new_function(x: number): number
    return x + 1
end
```

Comece adicionando tipos a:
1. Assinaturas de função em limites de API
2. HTTP handlers e consumidores de fila
3. Lógica de negócios crítica

## Checagem de Tipos

Execute o checador de tipos:

```bash
wippy lint
```

Reporta erros de tipo sem executar código.
