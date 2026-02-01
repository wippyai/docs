# Bibliotecas Lua Padrao
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Bibliotecas Lua centrais automaticamente disponiveis em todos os processos Wippy. Nenhum `require()` necessario.

## Funcoes Globais

### Tipo e Conversao

```lua
type(value)         -- Retorna: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Converter para numero, base opcional (2-36)
tostring(value)     -- Converter para string, chama metametodo __tostring
```

### Assertions e Erros

```lua
assert(v [,msg])    -- Lanca erro se v for false/nil, retorna v caso contrario
error(msg [,level]) -- Lanca erro no nivel de stack especificado (padrao 1)
pcall(fn, ...)      -- Chamada protegida, retorna ok, resultado_ou_erro
xpcall(fn, errh)    -- Chamada protegida com funcao handler de erro
```

### Iteracao de Tabela

```lua
pairs(t)            -- Iterar todos os pares chave-valor
ipairs(t)           -- Iterar porcao array (1, 2, 3, ...)
next(t [,index])    -- Obter proximo par chave-valor apos index
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

### Utilitarios

```lua
select(index, ...)  -- Retornar args a partir do index
select("#", ...)    -- Retornar numero de args
unpack(t [,i [,j]]) -- Retornar t[i] ate t[j] como multiplos valores
print(...)          -- Imprimir valores (usa logging estruturado no Wippy)
```

### Variaveis Globais

```lua
_G        -- A tabela de ambiente global
_VERSION  -- String da versao Lua
```

## Manipulacao de Tabela

Funcoes para modificar tabelas:

```lua
table.insert(t, [pos,] value)  -- Inserir valor em pos (padrao: fim)
table.remove(t [,pos])         -- Remover e retornar elemento em pos (padrao: ultimo)
table.concat(t [,sep [,i [,j]]]) -- Concatenar elementos array com separador
table.sort(t [,comp])          -- Ordenar in place, comp(a,b) retorna true se a < b
table.pack(...)                -- Empacotar varargs em tabela com campo 'n'
table.unpack(t [,i [,j]])      -- Desempacotar elementos de tabela como multiplos valores
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

## Operacoes de String

Funcoes de manipulacao de string. Tambem disponiveis como metodos em valores string:

### Pattern Matching

```lua
string.find(s, pattern [,init [,plain]])   -- Encontrar pattern, retorna inicio, fim, capturas
string.match(s, pattern [,init])           -- Extrair substring correspondente
string.gmatch(s, pattern)                  -- Iterador sobre todas as correspondencias
string.gsub(s, pattern, repl [,n])         -- Substituir correspondencias, retorna string, contagem
```

### Conversao de Caso

```lua
string.upper(s)   -- Converter para maiusculas
string.lower(s)   -- Converter para minusculas
```

### Substrings e Caracteres

```lua
string.sub(s, i [,j])      -- Substring de i ate j (indices negativos do fim)
string.len(s)              -- Tamanho da string (ou use #s)
string.byte(s [,i [,j]])   -- Codigos numericos de caracteres
string.char(...)           -- Criar string de codigos de caractere
string.rep(s, n [,sep])    -- Repetir string n vezes com separador
string.reverse(s)          -- Inverter string
```

### Formatacao

```lua
string.format(fmt, ...)    -- Formatacao estilo printf
```

Especificadores de formato: `%d` (inteiro), `%f` (float), `%s` (string), `%q` (quoted), `%x` (hex), `%o` (octal), `%e` (cientifico), `%%` (% literal)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substituicao
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Sintaxe de metodo
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Patterns

| Pattern | Corresponde |
|---------|-------------|
| `.` | Qualquer caractere |
| `%a` | Letras |
| `%d` | Digitos |
| `%w` | Alfanumerico |
| `%s` | Espaco em branco |
| `%p` | Pontuacao |
| `%c` | Caracteres de controle |
| `%x` | Digitos hexadecimais |
| `%z` | Zero (nulo) |
| `[set]` | Classe de caractere |
| `[^set]` | Classe negada |
| `*` | 0 ou mais (greedy) |
| `+` | 1 ou mais (greedy) |
| `-` | 0 ou mais (lazy) |
| `?` | 0 ou 1 |
| `^` | Inicio da string |
| `$` | Fim da string |
| `%b()` | Par balanceado |
| `(...)` | Grupo de captura |

Versoes maiusculas (`%A`, `%D`, etc.) correspondem ao complemento.

## Funcoes Math

Funcoes e constantes matematicas:

### Constantes {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinito
math.mininteger  -- Inteiro minimo
math.maxinteger  -- Inteiro maximo
```

### Operacoes Basicas

```lua
math.abs(x)           -- Valor absoluto
math.min(...)         -- Minimo dos argumentos
math.max(...)         -- Maximo dos argumentos
math.floor(x)         -- Arredondar para baixo
math.ceil(x)          -- Arredondar para cima
math.modf(x)          -- Partes inteira e fracionaria
math.fmod(x, y)       -- Resto de ponto flutuante
```

### Potencias e Raizes

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
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hiperbolico
math.deg(r)   -- Radianos para graus
math.rad(d)   -- Graus para radianos
```

### Numeros Aleatorios

```lua
math.random()         -- Float aleatorio [0,1)
math.random(n)        -- Inteiro aleatorio [1,n]
math.random(m, n)     -- Inteiro aleatorio [m,n]
math.randomseed(x)    -- Definir seed aleatorio
```

### Conversao de Tipo

```lua
math.tointeger(x)     -- Converter para inteiro ou nil
math.type(x)          -- "integer", "float", ou nil
math.ult(m, n)        -- Comparacao unsigned less-than
```

## Corrotinas

Criacao e controle de corrotinas. Veja [Channels and Coroutines](lua-channel.md) para channels e padroes concorrentes:

```lua
coroutine.create(fn)        -- Criar corrotina de funcao
coroutine.resume(co, ...)   -- Iniciar/continuar corrotina
coroutine.yield(...)        -- Suspender corrotina, retornar valores para resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Corrotina atual (nil se thread principal)
coroutine.wrap(fn)          -- Criar corrotina como funcao chamavel
```

### Criando Corrotinas Concorrentes

Criar uma corrotina concorrente que executa independentemente (especifico Wippy):

```lua
coroutine.spawn(fn)         -- Criar funcao como corrotina concorrente
```

```lua
-- Criar tarefa em background
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continuar execucao principal imediatamente
process_request()
```

## Tratamento de Erros

Criacao e classificacao de erros estruturados. Veja [Error Handling](lua-errors.md) para documentacao completa:

### Constantes {id="error-constants"}

```lua
errors.UNKNOWN           -- Erro nao classificado
errors.INVALID           -- Argumento ou entrada invalido
errors.NOT_FOUND         -- Recurso nao encontrado
errors.ALREADY_EXISTS    -- Recurso ja existe
errors.PERMISSION_DENIED -- Permissao negada
errors.TIMEOUT           -- Operacao expirou
errors.CANCELED          -- Operacao cancelada
errors.UNAVAILABLE       -- Servico indisponivel
errors.INTERNAL          -- Erro interno
errors.CONFLICT          -- Conflito (ex: modificacao concorrente)
errors.RATE_LIMITED      -- Limite de taxa excedido
```

### Funcoes {id="error-functions"}

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
    -- tratar nao encontrado
end

-- Obter call stack do erro
local stack = errors.call_stack(err)
```

### Metodos de Erro

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
utf8.charpattern  -- Pattern correspondendo um unico caractere UTF-8
```

### Funcoes {id="utf8-functions"}

```lua
utf8.char(...)           -- Criar string de codepoints Unicode
utf8.codes(s)            -- Iterador sobre codepoints: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- Obter codepoints nas posicoes i ate j
utf8.len(s [,i [,j]])    -- Contar caracteres UTF-8 (nao bytes)
utf8.offset(s, n [,i])   -- Posicao em bytes do n-esimo caractere a partir da posicao i
```

```lua
local s = "Hello, 世界"

-- Contar caracteres (nao bytes)
print(utf8.len(s))  -- 9

-- Iterar sobre codepoints
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- Obter codepoint na posicao
local code = utf8.codepoint(s, 8)  -- Primeiro caractere chines

-- Criar string de codepoints
local emoji = utf8.char(0x1F600)  -- Rosto sorridente
```

## Recursos Restritos

Os seguintes recursos Lua padrao NAO estao disponiveis por seguranca:

| Recurso | Alternativa |
|---------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Use modulo [Dynamic Evaluation](lua-eval.md) |
| `collectgarbage` | GC automatico |
| `rawlen` | Use operador `#` |
| `io.*` | Use modulo [File System](lua-fs.md) |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | Use modulos [Command Execution](lua-exec.md), [Environment](lua-env.md) |
| `debug.*` (exceto traceback) | Nao disponivel |
| `package.loadlib` | Bibliotecas nativas nao suportadas |

## Veja Tambem

- [Channels and Coroutines](lua-channel.md) - Channels estilo Go para concorrencia
- [Error Handling](lua-errors.md) - Criacao e tratamento de erros estruturados
- [OS Time](lua-ostime.md) - Funcoes de tempo do sistema
