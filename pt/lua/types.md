# Sistema de Tipos

Wippy inclui um sistema de tipos gradual com checagem sensivel ao fluxo. Tipos sao nao-nulaveis por padrao.

## Primitivos

```lua
local n: number = 3.14
local i: integer = 42         -- integer e subtipo de number
local s: string = "hello"
local b: boolean = true
local a: any = "anything"     -- dinamico explicito (opt-out de checagem)
local u: unknown = something  -- deve estreitar antes de usar
```

### any vs unknown

```lua
-- any: opt-out de checagem de tipo
local a: any = get_data()
a.foo.bar.baz()              -- sem erro, pode crashar em runtime

-- unknown: desconhecido seguro, deve estreitar antes de usar
local u: unknown = get_data()
u.foo                        -- ERRO: nao pode acessar propriedade de unknown
if type(u) == "table" then
    -- u estreitado para table aqui
end
```

## Seguranca de Nil

Tipos sao nao-nulaveis por padrao. Use `?` para valores opcionais:

```lua
local x: number = nil         -- ERRO: nil nao atribuivel a number
local y: number? = nil        -- OK: number? significa "number ou nil"
local z: number? = 42         -- OK
```

### Estreitamento por Fluxo de Controle

O checador de tipos rastreia fluxo de controle:

```lua
local function process(x: number?): number
    if x ~= nil then
        return x              -- x e number aqui
    end
    return 0
end

-- Padrao de retorno antecipado
local user, err = get_user(123)
if err then return nil, err end
-- user estreitado para non-nil aqui

-- Ou padrao
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

## Tipos de Funcao

```lua
local function add(a: number, b: number): number
    return a + b
end

-- Multiplos retornos
local function div_mod(a: number, b: number): (number, number)
    return math.floor(a / b), a % b
end

-- Retornos de erro (idioma Lua)
local function fetch(url: string): (string?, error?)
    -- retorna (data, nil) ou (nil, error)
end

-- Tipos de funcao de primeira classe
local double: (number) -> number = function(x: number): number
    return x * 2
end
```

### Funcoes Variadicas

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

### Generics com Restricoes

```lua
type HasName = {name: string}

local function greet<T: HasName>(obj: T): string
    return "Hello, " .. obj.name
end

greet({name = "Alice"})       -- OK
greet({age = 30})             -- ERRO: faltando 'name'
```

## Tipos Intersection

Combine multiplos tipos:

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

`never` e o tipo bottom - nenhum valor existe:

```lua
function fail(msg: string): never
    error(msg)
end
```

## Padrao de Tratamento de Erros

O checador entende o idioma de erro Lua:

```lua
local value, err = call()
if err then
    -- value e nil aqui
    return nil, err
end
-- value e non-nil aqui, err e nil
print(value)
```

## Assertion Non-Nil

Use `!` para assertar que uma expressao e non-nil:

```lua
local user: User? = get_user()
local name = user!.name              -- assertar user e non-nil
```

Se o valor for nil em runtime, um erro e lancado. Use quando voce sabe que um valor nao pode ser nil mas o checador de tipos nao pode provar.

## Type Casts

### Cast Seguro (Validacao)

Chame um tipo como funcao para validar e fazer cast:

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

### Metodo Type:is()

Validar sem lancar, retorna `(value, nil)` ou `(nil, error)`:

```lua
type Point = {x: number, y: number}
local data: any = get_input()

local p, err = Point:is(data)
if p then
    local sum = p.x + p.y            -- p e Point valido
else
    return nil, err                  -- validacao falhou
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

Use com moderacao. Casts inseguros bypassam validacao e podem causar erros runtime se o valor nao corresponder ao tipo.

## Reflexao de Tipos

Tipos sao valores de primeira classe com metodos de introspeccao.

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

### Tipos de Colecao

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

### Tipos de Funcao

```lua
local fn: (number, string) -> boolean

local fnType = typeof(fn)
for param in fnType:params() do
    print(param:kind())
end
print(fnType:ret():kind())           -- "boolean"
```

### Comparacao de Tipos

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

## Anotacoes de Tipo

Adicione tipos a assinaturas de funcao:

```lua
-- Tipos de parametro e retorno
local function process(input: string): number
    return #input
end

-- Tipos de variavel local
local count: number = 0

-- Aliases de tipo
type StringArray = {string}
type StringMap = {[string]: number}
```

## Regras de Variancia

| Posicao | Variancia | Descricao |
|---------|-----------|-----------|
| Campo readonly | Covariante | Pode usar subtipo |
| Campo mutavel | Invariante | Deve corresponder exatamente |
| Parametro de funcao | Contravariante | Pode usar supertipo |
| Retorno de funcao | Covariante | Pode usar subtipo |

## Subtipagem

- `integer` e subtipo de `number`
- `never` e subtipo de todos os tipos
- Todos os tipos sao subtipos de `any`
- Subtipagem de union: `A` e subtipo de `A | B`

## Adocao Gradual

Adicione tipos incrementalmente - codigo sem tipos continua funcionando:

```lua
-- Codigo existente funciona sem alteracoes
function old_function(x)
    return x + 1
end

-- Novo codigo recebe tipos
function new_function(x: number): number
    return x + 1
end
```

Comece adicionando tipos a:
1. Assinaturas de funcao em limites de API
2. HTTP handlers e consumidores de fila
3. Logica de negocios critica

## Checagem de Tipos

Execute o checador de tipos:

```bash
wippy lint
```

Reporta erros de tipo sem executar codigo.
