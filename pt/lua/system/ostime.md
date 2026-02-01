# OS Time
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Funcoes de tempo padrao Lua `os`. Fornece tempo de relogio de parede real para timestamps, formatacao de datas e calculos de tempo.

## Carregamento

Tabela global `os`. Nenhum require necessario.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Obtendo Timestamps

Obter timestamp Unix (segundos desde 1 de Jan, 1970 UTC):

```lua
-- Timestamp atual
local now = os.time()  -- 1718462445

-- Data/hora especifica
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Assinatura:** `os.time([spec]) -> integer`

**Parametros:**

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `year` | integer | ano atual | Ano de 4 digitos (ex: 2024) |
| `month` | integer | mes atual | Mes 1-12 |
| `day` | integer | dia atual | Dia do mes 1-31 |
| `hour` | integer | 0 | Hora 0-23 |
| `min` | integer | 0 | Minuto 0-59 |
| `sec` | integer | 0 | Segundo 0-59 |

Quando chamado sem argumentos, retorna timestamp Unix atual.

Quando chamado com uma tabela, qualquer campo ausente usa os padroes mostrados acima. Os campos `year`, `month` e `day` usam a data atual se nao especificados.

```lua
-- Apenas data (hora padrao e meia-noite)
os.time({year = 2024, month = 6, day = 15})

-- Parcial (preenche ano/mes atual)
os.time({day = 1})  -- primeiro do mes atual
```

## Formatando Datas

Formatar um timestamp como string ou retornar uma tabela de data:

<code-block lang="lua">
local now = os.time()

-- Formato padrao
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- Formato customizado
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- Hora UTC (prefixar formato com !)
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC ao inves de local

-- Tabela de data
local t = os.date("*t", now)
</code-block>

**Assinatura:** `os.date([format], [timestamp]) -> string | table`

| Parametro | Tipo | Padrao | Descricao |
|-----------|------|--------|-----------|
| `format` | string | `"%c"` | String de formato, `"*t"` para tabela |
| `timestamp` | integer | hora atual | Timestamp Unix para formatar |

### Especificadores de Formato

| Codigo | Saida | Exemplo |
|--------|-------|---------|
| `%Y` | Ano 4 digitos | 2024 |
| `%y` | Ano 2 digitos | 24 |
| `%m` | Mes (01-12) | 06 |
| `%d` | Dia (01-31) | 15 |
| `%H` | Hora 24h (00-23) | 14 |
| `%I` | Hora 12h (01-12) | 02 |
| `%M` | Minuto (00-59) | 30 |
| `%S` | Segundo (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | Nome do dia | Saturday |
| `%a` | Dia abreviado | Sat |
| `%B` | Nome do mes | June |
| `%b` | Mes abreviado | Jun |
| `%w` | Dia da semana (0-6, Domingo=0) | 6 |
| `%j` | Dia do ano (001-366) | 167 |
| `%U` | Numero da semana (00-53) | 24 |
| `%z` | Offset de fuso horario | -0700 |
| `%Z` | Nome do fuso horario | PDT |
| `%c` | Data/hora completa | Sat Jun 15 14:30:45 2024 |
| `%x` | Apenas data | 06/15/24 |
| `%X` | Apenas hora | 14:30:45 |
| `%%` | % literal | % |

### Tabela de Data

Quando formato e `"*t"`, retorna uma tabela:

```lua
local t = os.date("*t")
```

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| `year` | integer | Ano 4 digitos | 2024 |
| `month` | integer | Mes (1-12) | 6 |
| `day` | integer | Dia do mes (1-31) | 15 |
| `hour` | integer | Hora (0-23) | 14 |
| `min` | integer | Minuto (0-59) | 30 |
| `sec` | integer | Segundo (0-59) | 45 |
| `wday` | integer | Dia da semana (1-7, Domingo=1) | 7 |
| `yday` | integer | Dia do ano (1-366) | 167 |
| `isdst` | boolean | Horario de verao | false |

Use `"!*t"` para tabela de data UTC.

## Medindo Tempo Decorrido

Obter segundos decorridos desde o inicio do runtime Lua:

```lua
local start = os.clock()

-- fazer trabalho
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Levou %.3f segundos", elapsed))
```

**Assinatura:** `os.clock() -> number`

## Diferenca de Tempo

Obter diferenca entre dois timestamps em segundos:

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**Assinatura:** `os.difftime(t2, t1) -> number`

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `t2` | integer | Timestamp posterior |
| `t1` | integer | Timestamp anterior |

Retorna `t2 - t1` em segundos. Pode ser negativo se `t1 > t2`.

## Constante de Plataforma

Constante identificando o runtime:

```lua
os.platform  -- "wippy"
```
