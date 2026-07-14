---
title: "Sistema de Tipos"
description: "O Wippy inclui um sistema de tipos gradual com verificação sensível ao fluxo. Tipos são não-anuláveis por padrão."
---

# Sistema de Tipos

> **Experimental.** Algumas limitações são esperadas.

O Wippy inclui um sistema de tipos gradual com verificação sensível ao fluxo. Tipos são não-anuláveis por padrão.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer é subtipo de number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dinâmico explícito (opt-out da verificação)
local u: unknown = something  -- deve ser estreitado antes do uso
```

### any vs unknown

```lua
-- any: opt-out da verificação de tipos
local a: any = get_data()
a.foo.bar.baz()              -- sem erro, pode falhar em tempo de execução

-- unknown: desconhecido seguro, deve ser estreitado antes do uso
local u: unknown = get_data()
u.foo                        -- ERRO: não é possível acessar propriedade de unknown
if type(u) == "table" then
    -- u estreitado para table aqui
end
```

## Segurança contra Nil

Tipos são não-anuláveis por padrão. Use `?` para valores opcionais:

```lua
local x: number = nil         -- ERRO: nil não atribuível a number
local y: number? = nil        -- OK: number? significa "number ou nil"
local z: number? = 42         -- OK
```

### Estreitamento por Fluxo de Controle

O verificador de tipos rastreia o fluxo de controle:

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
-- user estreitado para não-nil aqui

-- Ou padrão
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
greet({age = 30})             -- ERRO: 'name' ausente
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

`never` é o tipo bottom — nenhum valor existe:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Padrão de Tratamento de Erros

O verificador entende o idioma de erro do Lua:

```lua
local value, err = call()
if err then
    -- value é nil aqui
    return nil, err
end
-- value é não-nil aqui, err é nil
print(value)
```

## Asserção de Não-Nil

Use `!` para afirmar que uma expressão é não-nil:

```lua
local user: User? = get_user()
local name = user!.name              -- afirma que user é não-nil
```

Se o valor for nil em tempo de execução, um erro é levantado. Use quando souber que um valor não pode ser nil mas o verificador de tipos não consegue prová-lo.

## Conversões de Tipo

### Conversão Segura (Validação)

Chame um tipo como uma função para validar e converter:

```lua
local data: any = get_json()
local user = User(data)              -- valida e retorna User
local name = user.name               -- acesso seguro a campo
```

Funciona com primitivos e tipos personalizados:

```lua
local x: any = get_value()
local s = string(x)                  -- converte para string
local n = integer(x)                 -- converte para integer
local b = boolean(x)                 -- converte para boolean

type Point = {x: number, y: number}
local p = Point(data)                -- valida estrutura do record
```

### Método Type:is()

Valida sem lançar exceção, retorna `(value, nil)` ou `(nil, error)`:

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

O resultado é estreitado em condicionais:

```lua
if Point:is(data) then
    local p: Point = data            -- data estreitado para Point
end
```

### Conversão Insegura

Use `::` ou `as` para conversões não verificadas:

```lua
local data: any = get_data()
local user = data :: User            -- sem verificação em tempo de execução
local user = data as User            -- igual a ::
```

Use com moderação. Conversões inseguras ignoram a validação e podem causar erros em tempo de execução se o valor não corresponder ao tipo.

## Reflexão de Tipos

Tipos são valores de primeira classe com métodos de introspecção.

### Kind e Name

```lua
print(Number:kind())                 -- "number"
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

### Tipos União

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

-- Tipos de variáveis locais
local count: number = 0

-- Aliases de tipo
type StringArray = {string}
type StringMap = {[string]: number}
```

## Validadores de Tipo

Adicione restrições de validação em tempo de execução aos tipos usando anotações:

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

### Validadores Embutidos

| Validador | Aplica-se a | Exemplo |
|-----------|------------|---------|
| `@min(n)` | number | `local x: number @min(0) = 1` |
| `@max(n)` | number | `local x: number @max(100) = 50` |
| `@min_len(n)` | string, array | `local s: string @min_len(1) = "hi"` |
| `@max_len(n)` | string, array | `local s: string @max_len(10) = "hi"` |
| `@pattern(regex)` | string | `local email: string @pattern("^.+@.+$") = "a@b.com"` |

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
| Campo mutável | Invariante | Deve corresponder exatamente |
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
-- Código existente funciona inalterado
function old_function(x)
    return x + 1
end

-- Novo código recebe tipos
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
