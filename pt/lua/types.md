---
title: "Sistema de Tipos"
description: "Sintaxe e comportamento em runtime do sistema de tipos gradual do Wippy, incluindo unions, records, genéricos, validação e reflexão."
---

# Sistema de Tipos

> **Experimental.** O sistema de tipos ainda está evoluindo, e algumas limitações são esperadas.

O sistema de tipos gradual do Wippy aceita anotações incrementais e verificação sensível ao fluxo. Os tipos são não anuláveis por padrão.

Esta página é uma referência da linguagem, não um programa completo. Cada bloco de código é um exemplo isolado de verificação de tipos, e as alternativas dentro de um bloco não precisam ser combinadas. Nomes como `get_data`, `get_user`, `call` e `User` representam código da aplicação; linhas marcadas como `ERROR` demonstram diagnósticos intencionalmente. Esses exemplos usam a sintaxe da linguagem e valores de tipos integrados, portanto não exigem módulos do runtime.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer is subtype of number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dynamic member and method access
local u: unknown = { source = "example" }  -- must narrow before use
```

### `any` e `unknown`

```lua
-- any: dynamic member and method access
local a: any = get_data()
a.foo.bar.baz()              -- no error, may crash at runtime
local s: string = a          -- ERROR: any is not assignable to string

-- unknown: safe unknown, must narrow before use as a concrete type
local u: unknown = get_data()
u.foo                        -- no error: member access on unknown behaves like any
local n: number = u          -- ERROR: unknown not assignable to number, narrow first
if type(u) == "table" then
    -- u narrowed to table here
end
```

## Segurança contra Nil

Tipos são não-anuláveis por padrão. Use `?` para valores opcionais:

```lua
local x: number = nil         -- ERROR: nil not assignable to number
local y: number? = nil        -- OK: number? means "number or nil"
local z: number? = 42         -- OK
```

### Estreitamento por Fluxo de Controle

O verificador de tipos rastreia o fluxo de controle:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x is number here
    end
    return 0
end

-- Early return pattern
local user, err = get_user(123)
if err then return nil, err end
-- user narrowed to non-nil here

-- Or default
local val = get_value() or 0  -- val: number
```

## Tipos União

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
local s: Status = "invalid"   -- ERROR
```

## Tipos de Função

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Multiple returns
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Error returns (Lua idiom)
local function fetch(url: string): (string?, error?)
    -- returns (data, nil) or (nil, error)
end

-- First-class function types
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

## Genéricos

```lua
local function identity<T>(x: T): T
    return x
end

local n: number = identity(42)
local s: string = identity("hello")
```

### Genéricos Restritos

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERROR: missing 'name'
```

## Tipos Interseção

Combine múltiplos tipos:

```lua
type Named = {name: string}
type Aged = {age: number}
type Person = Named & Aged

local p: Person = {name = "Alice", age = 30}
```

## Uniões Discriminadas

```lua
type Result<T, E> =
    {ok: true, value: T}
    | {ok: false, error: E}

type LoadState =
    {status: "loading"}
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

## O Tipo `never`

`never` é o tipo bottom — nenhum valor existe:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Padrão de Tratamento de Erros

O verificador entende o padrão comum de retorno Lua `value, error`:

```lua
local value, err = call()
if err then
    -- value is nil here
    return nil, err
end
-- value is non-nil here, err is nil
print(value)
```

## Asserção de Não-Nil

Use `!` para afirmar que uma expressão é não-nil:

```lua
local user: User? = get_user()
local name = (user!).name            -- assert user is non-nil
```

Se o valor for nil em tempo de execução, um erro é levantado. Use quando souber que um valor não pode ser nil mas o verificador de tipos não consegue prová-lo.

## Conversões de Tipo

### Validação em Runtime

Chame um tipo como função para validar um valor. A validação retorna o valor original com o tipo estático solicitado; ela não converte nem faz coerção do valor:

```lua
local data: any = get_json()
local user = User(data)              -- validates and returns User
local name = user.name               -- safe field access
```

Funciona com primitivos e tipos personalizados:

```lua
local x: any = get_value()
local s = string(x)                  -- requires an existing string
local n = integer(x)                 -- requires an existing integer
local b = boolean(x)                 -- requires an existing boolean

type Point = {x: number, y: number}
local p = Point(data)                -- validates record structure
```

Por exemplo, `string(42)` lança um erro de validação; use `tostring(42)` quando a intenção for converter.

### Método `Type:is()`

`Type:is` valida sem lançar exceção e retorna `(value, nil)` ou `(nil, error)`:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p is valid Point
else
    return nil, err                  -- validation failed
end
```

O resultado é estreitado em condicionais:

```lua
if Point:is(data) then
    local p: Point = data            -- data narrowed to Point
end
```

### Conversão Insegura

Use `::` ou `as` para conversões não verificadas:

```lua
local data: any = get_data()
local user = data :: User            -- no runtime check
local user = data as User            -- same as ::
```

Use com moderação. Conversões inseguras ignoram a validação e podem causar erros em tempo de execução se o valor não corresponder ao tipo.

## Reflexão de Tipos

Tipos são valores de primeira classe com métodos de introspecção.

### Kind e Name

```lua
type NumberType = number
print(NumberType:kind())             -- "number"
print(Point:kind())                  -- "record"
print(Point:name())                  -- "Point"
```

### Campos de Record

Itera sobre campos do record:

```lua
type User = {name: string, age: number}

for name, typ in User:fields() do
    print(name, typ:kind())
end
-- name    string
-- age     number
```

Acessa tipos de campos individuais:

```lua
local nameType = User.name           -- type of 'name' field
print(nameType:kind())               -- "string"
```

### Tipos de Coleção

```lua
type NumberArray = {number}
print(NumberArray:elem():kind())     -- "number"

type NumberMap = {[string]: number}
print(NumberMap:key():kind())        -- "string"
print(NumberMap:val():kind())        -- "number"
```

### Tipos Opcionais

```lua
type OptionalNumber = number?
print(OptionalNumber:kind())         -- "optional"
print(OptionalNumber:inner():kind()) -- "number"
```

### Tipos União

```lua
type Status = "pending" | "active" | "done"

for variant in Status:variants() do
    print(variant)
end
```

### Tipos de Função

```lua
type Predicate = (number, string) -> boolean
for param in Predicate:params() do
    print(param:kind())
end
print(Predicate:ret():kind())        -- "boolean"
```

`typeof(expression)` é sintaxe de tipo, não uma função de reflexão em runtime. Use-a em um alias como `type Config = typeof(default_config)`; o alias resultante é o valor de tipo em runtime.

### Comparação de Tipos

```lua
type NumberType = number
type IntegerType = integer

print(NumberType == NumberType)      -- true
print(IntegerType <= NumberType)     -- true (subtype)
print(IntegerType < NumberType)      -- true (strict subtype)
```

### Tipos como Chaves de Tabela

```lua
type NumberType = number
type StringType = string

local handlers = {}
handlers[NumberType] = function() return "number handler" end
handlers[StringType] = function() return "string handler" end

local h = handlers[NumberType]
if h then h() end
```

## Anotações de Tipo

Adicione tipos a assinaturas de função:

```lua
-- Parameter and return types
local function process(input: string): number
    return #input
end

-- Local variable types
local count: number = 0

-- Type aliases
type StringArray = {string}
type StringMap = {[string]: number}
```

## Validadores de Tipo

Associe restrições de validação a aliases de tipos com anotações e chame o tipo ou use `Type:is()` para aplicá-las em runtime:

```lua
type NonNegative = number @min(0)
type Percentage = number @min(0) @max(100)
type Email = string @pattern("^.+@.+$")

local x = NonNegative(1)
local percent, err = Percentage:is(50)
local email = Email("test@example.com")
```

Uma anotação em uma variável local é verificada estaticamente pelo linter. Ela não insere uma verificação automática em runtime durante a atribuição; a aplicação em runtime ocorre quando um valor de tipo valida um valor.

### Validadores Embutidos

| Validador | Aplica-se a | Exemplo |
|-----------|------------|---------|
| `@min(n)` | number | `type Positive = number @min(1)` |
| `@max(n)` | number | `type Percentage = number @max(100)` |
| `@min_len(n)` | string, array | `type NonEmpty = string @min_len(1)` |
| `@max_len(n)` | string, array | `type ShortName = string @max_len(10)` |
| `@pattern(regex)` | string | `type Email = string @pattern("^.+@.+$")` |

### Validadores de Campos de Record

```lua
type User = {
    age: number @min(0) @max(150),
    name: string @min_len(1) @max_len(100)
}
```

### Validadores de Elementos de Array

```lua
local scores: {number @min(0) @max(100)} = {85, 90}
```

### Validadores de Membros de União

```lua
local id: number @min(1) | string @min_len(1) = 1
```

## Regras de Variância

| Posição | Variância | Descrição |
|----------|----------|-------------|
| Campo somente leitura | Covariante | Pode usar subtipo |
| Campo mutável | Quase invariante | Normalmente invariante; literais novos e refinamentos podem ampliar para o tipo base |
| Parâmetro de função | Contravariante | Pode usar supertipo |
| Retorno de função | Covariante | Pode usar subtipo |

## Subtipagem

- `integer` é um subtipo de `number`
- `never` é um subtipo de todos os tipos
- Todos os tipos são subtipos de `any`
- Subtipagem de união: `A` é subtipo de `A | B`

## Adoção Gradual

Adicione tipos incrementalmente — código sem tipos continua funcionando:

```lua
-- Existing code works unchanged
function old_function(x)
    return x + 1
end

-- New code gets types
function new_function(x: number): number
    return x + 1
end
```

Comece adicionando tipos a:
1. Assinaturas de função em fronteiras de API
2. Handlers HTTP e consumidores de fila
3. Lógica de negócio crítica

## Verificação de Tipos

Execute o verificador de tipos:

```bash
wippy lint
```

Reporta erros de tipo sem executar o código.
