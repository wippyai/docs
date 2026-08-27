---
title: "OS Time"
description: "Leia o tempo do runtime, formate datas e calcule diferenças de tempo com a tabela global os do Lua."
---

# OS Time
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

A tabela global `os` fornece timestamps, formatação de datas, medição de tempo decorrido e cálculos de diferença de tempo. Em um workflow, as leituras do tempo atual usam a referência de tempo do workflow; fora de um workflow, usam o relógio do sistema.

Esta é uma referência de API. Os timestamps literais e as saídas formatadas são ilustrativos; os valores atuais dependem do relógio e do fuso horário do runtime ou do workflow.

## Carregamento

A tabela `os` é global e não precisa ser carregada com `require`.

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## Obtendo Timestamps

Obter timestamp Unix (segundos desde 1 de Jan, 1970 UTC):

```lua
-- Current timestamp
local now = os.time()  -- 1718462445

-- Specific date/time
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**Assinatura:** `os.time([spec]) -> number`

**Parametros:**

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `year` | number | ano atual | Ano de 4 digitos (ex: 2024) |
| `month` | number | mes atual | Mes 1-12 |
| `day` | number | dia atual | Dia do mes 1-31 |
| `hour` | number | 0 | Hora 0-23 |
| `min` | number | 0 | Minuto 0-59 |
| `sec` | number | 0 | Segundo 0-59 |

Sem argumentos, `os.time()` retorna o timestamp Unix atual.

Quando chamado com uma tabela, qualquer campo ausente usa os padroes mostrados acima. Os campos `year`, `month` e `day` usam a data atual se não específicados.

```lua
-- Just date (time defaults to midnight)
os.time({year = 2024, month = 6, day = 15})

-- Partial (fills in current year/month)
os.time({day = 1})  -- first of current month
```

## Formatando Datas

Formatar um timestamp como string ou retornar uma tabela de data:

<code-block lang="lua">
local now = os.time()

-- Formato padrão
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

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `format` | string | `"%c"` | String de formato, `"*t"` para tabela |
| `timestamp` | number | hora atual | Timestamp Unix para formatar |

### Específicadores de Formato

| Código | Saida | Exemplo |
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
| `%U` | Número da semana ISO 8601 (01-53, semana começa na segunda-feira) | 24 |
| `%W` | Número da semana ISO 8601 (01-53, semana começa na segunda-feira) | 24 |
| `%z` | Offset de fuso horario | -0700 |
| `%Z` | Nome do fuso horario | PDT |
| `%c` | Data/hora completa | Sat Jun 15 14:30:45 2024 |
| `%x` | Apenas data | 06/15/24 |
| `%X` | Apenas hora | 14:30:45 |
| `%%` | % literal | % |

### Tabela de Data

Quando o formato é `"*t"`, `os.date()` retorna uma tabela:

```lua
local t = os.date("*t")
```

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `year` | number | Ano 4 digitos | 2024 |
| `month` | number | Mes (1-12) | 6 |
| `day` | number | Dia do mes (1-31) | 15 |
| `hour` | number | Hora (0-23) | 14 |
| `min` | number | Minuto (0-59) | 30 |
| `sec` | number | Segundo (0-59) | 45 |
| `wday` | number | Dia da semana (1-7, Domingo=1) | 7 |
| `yday` | number | Dia do ano (1-366) | 167 |
| `isdst` | boolean | `true` quando o deslocamento UTC do fuso não é zero nesta versão; não é um indicador confiável de horário de verão | false |

Use `"!*t"` para tabela de data UTC.

## Medindo Tempo Decorrido

Obtém os segundos entre a referência de tempo atual do runtime e o momento de inicialização do módulo de tempo do SO:

```lua
local start = os.clock()

-- do work
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**Assinatura:** `os.clock() -> number`

Ao contrário da definição de tempo de CPU do Lua padrão, esta implementação se baseia no tempo decorrido. Em workflows, usa a referência de tempo do workflow.

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `t2` | number | Timestamp posterior |
| `t1` | number | Timestamp anterior |

Retorna `t2 - t1` em segundos. Pode ser negativo se `t1 > t2`.

## Constante de Plataforma

A constante `os.platform` identifica o runtime:

```lua
os.platform  -- "wippy"
```
