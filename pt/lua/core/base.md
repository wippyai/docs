# Bibliotecas Lua Padrão
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Bibliotecas Lua centrais automaticamente disponíveis em todos os processos Wippy. Nenhum `require()` necessário.

## Funções Globais

### Tipo e Conversão

```lua
type(value)         -- Retorna: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Converter para número, base opcional (2-36)
tostring(value)     -- Converter para string, chama metamétodo __tostring
```

### Assertions e Erros

```lua
assert(v [,msg])    -- Lança erro se v for false/nil, retorna v caso contrário
error(msg [,level]) -- Lança erro no nível de stack específicado (padrão 1)
pcall(fn, ...)      -- Chamada protegida, retorna ok, resultado_ou_erro
xpcall(fn, errh)    -- Chamada protegida com função handler de erro
```

### Iteração de Tabela

```lua
pairs(t)            -- Iterar todos os pares chave-valor
ipairs(t)           -- Iterar porção array (1, 2, 3, ...)
next(t [,index])    -- Obter próximo par chave-valor após index
```

### Metatables

```lua
getmetatable(obj)       -- Obter metatable (ou campo __metatable se protegido)
setmetatable(t, mt)     -- Definir metatable, retorna t
```

### Acesso Raw a Tabela

Bypass de metamethods para acesso direto a tabela:

```lua
rawget(t, k)        -- Obter t[k] sem __index
rawset(t, k, v)     -- Definir t[k]=v sem __newindex
rawequal(a, b)      -- Comparar sem __eq
```

### Utilitários

```lua
select(index, ...)  -- Retornar args a partir do index
select("#", ...)    -- Retornar número de args
unpack(t [,i [,j]]) -- Retornar t[i] até t[j] como múltiplos valores
print(...)          -- Imprimir valores (usa logging estruturado no Wippy)
```

### Variáveis Globais

```lua
_G        -- A tabela de ambiente global
_VERSION  -- String da versão Lua
```

## Manipulação de Tabela

Funções para modificar tabelas:

```lua
table.insert(t, [pos,] value)  -- Inserir valor em pos (padrão: fim)
table.remove(t [,pos])         -- Remover e retornar elemento em pos (padrão: último)
table.concat(t [,sep [,i [,j]]]) -- Concatenar elementos array com separador
table.sort(t [,comp])          -- Ordenar in place, comp(a,b) retorna true se a < b
table.pack(...)                -- Empacotar varargs em tabela com campo 'n'
table.unpack(t [,i [,j]])      -- Desempacotar elementos de tabela como múltiplos valores
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, retorna "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Ordem decrescente
end)
```

## Operações de String

Funções de manipulação de string. Também disponíveis como métodos em valores string:

### Pattern Matching

```lua
string.find(s, pattern [,init [,plain]])   -- Encontrar pattern, retorna início, fim, capturas
string.match(s, pattern [,init])           -- Extrair substring correspondente
string.gmatch(s, pattern)                  -- Iterador sobre todas as correspondências
string.gsub(s, pattern, repl [,n])         -- Substituir correspondências, retorna string, contagem
```

### Conversão de Caso

```lua
string.upper(s)   -- Converter para maiúsculas
string.lower(s)   -- Converter para minúsculas
```

### Substrings e Caracteres

```lua
string.sub(s, i [,j])      -- Substring de i até j (índices negativos do fim)
string.len(s)              -- Tamanho da string (ou use #s)
string.byte(s [,i [,j]])   -- Códigos numéricos de caracteres
string.char(...)           -- Criar string de códigos de caractere
string.rep(s, n [,sep])    -- Repetir string n vezes com separador
string.reverse(s)          -- Inverter string
```

### Formatação

```lua
string.format(fmt, ...)    -- Formatação estilo printf
```

Específicadores de formato: `%d` (inteiro), `%f` (float), `%s` (string), `%q` (quoted), `%x` (hex), `%o` (octal), `%e` (científico), `%%` (% literal)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substituição
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Sintaxe de método
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

Funções e constantes matemáticas:

### Constantes {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinito
math.mininteger  -- Inteiro mínimo
math.maxinteger  -- Inteiro máximo
```

### Operações Básicas

```lua
math.abs(x)           -- Valor absoluto
math.min(...)         -- Mínimo dos argumentos
math.max(...)         -- Máximo dos argumentos
math.floor(x)         -- Arredondar para baixo
math.ceil(x)          -- Arredondar para cima
math.modf(x)          -- Partes inteira e fracionária
math.fmod(x, y)       -- Resto de ponto flutuante
```

### Potências e Raízes

```lua
math.sqrt(x)          -- Raiz quadrada
math.pow(x, y)        -- x^y (ou use operador x^y)
math.exp(x)           -- e^x
math.log(x [,base])   -- Log natural (ou log base n)
```

### Trigonometria

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radianos
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hiperbólico
math.deg(r)   -- Radianos para graus
math.rad(d)   -- Graus para radianos
```

### Números Aleatórios

```lua
math.random()         -- Float aleatório [0,1)
math.random(n)        -- Inteiro aleatório [1,n]
math.random(m, n)     -- Inteiro aleatório [m,n]
math.randomseed(x)    -- Definir seed aleatório
```

### Conversão de Tipo

```lua
math.tointeger(x)     -- Converter para inteiro ou nil
math.type(x)          -- "integer", "float", ou nil
math.ult(m, n)        -- Comparação unsigned less-than
```

## Corrotinas

Criação e controle de corrotinas. Veja [Channels and Coroutines](lua/core/channel.md) para channels e padrões concorrentes:

```lua
coroutine.create(fn)        -- Criar corrotina de função
coroutine.resume(co, ...)   -- Iniciar/continuar corrotina
coroutine.yield(...)        -- Suspender corrotina, retornar valores para resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Corrotina atual (nil se thread principal)
coroutine.wrap(fn)          -- Criar corrotina como função chamável
```

### Criando Corrotinas Concorrentes

Criar uma corrotina concorrente que executa independentemente (específico Wippy):

```lua
coroutine.spawn(fn)         -- Criar função como corrotina concorrente
```

```lua
-- Criar tarefa em background
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continuar execução principal imediatamente
process_request()
```

## Tratamento de Erros

Criação e classificação de erros estruturados. Veja [Error Handling](lua/core/errors.md) para documentação completa:

### Constantes {id="error-constants"}

```lua
errors.UNKNOWN           -- Erro não classificado
errors.INVALID           -- Argumento ou entrada inválido
errors.NOT_FOUND         -- Recurso não encontrado
errors.ALREADY_EXISTS    -- Recurso já existe
errors.PERMISSION_DENIED -- Permissão negada
errors.TIMEOUT           -- Operação expirou
errors.CANCELED          -- Operação cancelada
errors.UNAVAILABLE       -- Serviço indisponível
errors.INTERNAL          -- Erro interno
errors.CONFLICT          -- Conflito (ex: modificação concorrente)
errors.RATE_LIMITED      -- Limite de taxa excedido
```

### Funções {id="error-functions"}

```lua
-- Criar erro de string
local err = errors.new("something went wrong")

-- Criar erro com metadados
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Encapsular erro existente com contexto
local wrapped = errors.wrap(err, "failed to load profile")

-- Verificar tipo de erro
if errors.is(err, errors.NOT_FOUND) then
    -- tratar não encontrado
end

-- Obter call stack do erro
local stack = errors.call_stack(err)
```

### Métodos de Erro

```lua
err:message()    -- Obter string de mensagem de erro
err:kind()       -- Obter tipo de erro (ex: "NOT_FOUND")
err:retryable()  -- true, false, ou nil (desconhecido)
err:details()    -- Obter tabela de detalhes ou nil
err:stack()      -- Obter stack trace como string
```

## UTF-8 Unicode

Tratamento de strings UTF-8 Unicode:

### Constantes {id="utf8-constants"}

```lua
utf8.charpattern  -- Pattern correspondendo um único caractere UTF-8
```

### Funções {id="utf8-functions"}

```lua
utf8.char(...)           -- Criar string de codepoints Unicode
utf8.codes(s)            -- Iterador sobre codepoints: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- Obter codepoints nas posições i até j
utf8.len(s [,i [,j]])    -- Contar caracteres UTF-8 (não bytes)
utf8.offset(s, n [,i])   -- Posição em bytes do n-ésimo caractere a partir da posição i
```

```lua
local s = "Hello, 世界"

-- Contar caracteres (não bytes)
print(utf8.len(s))  -- 9

-- Iterar sobre codepoints
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- Obter codepoint na posição
local code = utf8.codepoint(s, 8)  -- Primeiro caractere chinês

-- Criar string de codepoints
local emoji = utf8.char(0x1F600)  -- Rosto sorridente
```

## Recursos Restritos

Os seguintes recursos Lua padrão NÃO estão disponíveis por segurança:

| Recurso | Alternativa |
|---------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Use módulo [Dynamic Evaluation](lua/dynamic/eval.md) |
| `collectgarbage` | GC automático |
| `rawlen` | Use operador `#` |
| `io.*` | Use módulo [File System](lua/storage/filesystem.md) |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | Use módulos [Command Execution](lua/dynamic/exec.md), [Environment](lua/system/env.md) |
| `debug.*` (exceto traceback) | Não disponível |
| `package.loadlib` | Bibliotecas nativas não suportadas |

## Veja Também

- [Channels and Coroutines](lua/core/channel.md) - Channels estilo Go para concorrência
- [Error Handling](lua/core/errors.md) - Criação e tratamento de erros estruturados
- [OS Time](lua/system/ostime.md) - Funções de tempo do sistema
