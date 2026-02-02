# Planilhas Excel
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Leia e escreva arquivos Microsoft Excel (.xlsx). Crie workbooks, gerencie planilhas, leia valores de celulas e gere relatorios com suporte a formatacao.

## Carregamento

```lua
local excel = require("excel")
```

## Criando Workbooks

### Novo Workbook

Cria um novo workbook Excel vazio.

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Criar planilhas e adicionar dados
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
```

**Retorna:** `Workbook, error`

### Abrir Workbook

Abre um workbook Excel de um objeto reader.

```lua
local fs = require("fs")

local vol, err = fs.get("app:data")
if err then
    return nil, err
end

local file, err = vol:open("/reports/sales.xlsx", "r")
if err then
    return nil, err
end

local wb, err = excel.open(file)
if err then
    file:close()
    return nil, err
end

-- Ler dados do workbook
local rows = wb:get_rows("Sheet1")
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `reader` | File | Deve implementar io.Reader (ex: fs.File) |

**Retorna:** `Workbook, error`

## Operacoes de Planilha

### Criar Planilha

Cria uma nova planilha ou retorna indice da planilha existente.

```lua
local wb = excel.new()

-- Criar planilhas
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- Se planilha existe, retorna seu indice
local existing = wb:new_sheet("Summary")  -- retorna mesmo que idx1
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da planilha |

**Retorna:** `integer, error`

### Listar Planilhas

Retorna lista de todos os nomes de planilhas no workbook.

```lua
local wb = excel.new()
wb:new_sheet("Sales")
wb:new_sheet("Expenses")
wb:new_sheet("Summary")

local sheets = wb:get_sheet_list()
-- sheets = {"Sheet1", "Sales", "Expenses", "Summary"}

for _, name in ipairs(sheets) do
    print("Sheet:", name)
end
```

**Retorna:** `string[], error`

## Operacoes de Celula

### Definir Valor de Celula

Define valor de uma unica celula.

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- Definir diferentes tipos de valor
wb:set_cell_value("Data", "A1", "Product Name")  -- string
wb:set_cell_value("Data", "B1", "Price")         -- string
wb:set_cell_value("Data", "C1", "In Stock")      -- string

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- numero
wb:set_cell_value("Data", "C2", true)            -- boolean

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- Referencias de celula suportam colunas alem de Z
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sheet` | string | Nome da planilha |
| `cell` | string | Referencia da celula ("A1", "B2", "AA100") |
| `value` | any | string, integer, numero ou boolean |

**Retorna:** `error`

### Obter Todas as Linhas

Obtem todas as linhas de uma planilha como array 2D.

```lua
local wb = excel.new()
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Name")
wb:set_cell_value("Report", "B1", "Score")
wb:set_cell_value("Report", "A2", "Alice")
wb:set_cell_value("Report", "B2", 95)
wb:set_cell_value("Report", "A3", "Bob")
wb:set_cell_value("Report", "B3", 87)

local rows, err = wb:get_rows("Report")
if err then
    return nil, err
end

-- rows[1] = {"Name", "Score"}
-- rows[2] = {"Alice", "95"}
-- rows[3] = {"Bob", "87"}

for i, row in ipairs(rows) do
    if i == 1 then
        print("Headers:", row[1], row[2])
    else
        print("Data:", row[1], "scored", row[2])
    end
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sheet` | string | Nome da planilha |

**Retorna:** `string[][], error`

Todos os valores de celula retornados como strings. Booleans como "TRUE" ou "FALSE", numeros como representacao string.

## Operacoes de Arquivo

### Escrever em Arquivo

Escreve workbook para um objeto writer.

```lua
local fs = require("fs")
local wb = excel.new()

-- Construir relatorio
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- Escrever em arquivo
local vol, err = fs.get("app:output")
if err then
    wb:close()
    return nil, err
end

local file, err = vol:open("/reports/monthly.xlsx", "w")
if err then
    wb:close()
    return nil, err
end

local err = wb:write_to(file)
file:close()
wb:close()

if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `writer` | File | Deve implementar io.Writer (ex: fs.File) |

**Retorna:** `error`

### Fechar Workbook

Fecha workbook e libera recursos.

```lua
local wb = excel.new()
-- ... trabalhar com workbook ...
wb:close()

-- Seguro chamar multiplas vezes
wb:close()
```

**Retorna:** `error`

## Erros

| Condição | Tipo | Retentavel |
|----------|------|------------|
| Sem contexto | `errors.INTERNAL` | não |
| Workbook invalido | `errors.INVALID` | não |
| Workbook fechado | `errors.INTERNAL` | não |
| Não e reader/writer | `errors.INTERNAL` | não |
| Arquivo Excel invalido | `errors.INTERNAL` | não |
| Planilha inexistente | `errors.INTERNAL` | não |
| Referencia de celula invalida | `errors.INTERNAL` | não |
| Escrita falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.

## Veja Também

- [Filesystem](lua-fs.md) - Operacoes de arquivo para leitura/escrita de arquivos Excel
