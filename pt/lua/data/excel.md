---
title: "Planilhas Excel"
description: "Crie, abra, leia, transmita, modifique e grave workbooks Microsoft Excel XLSX."
---

# Planilhas Excel
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

O módulo `excel` cria e lê workbooks Microsoft Excel `.xlsx`, gerencia planilhas e células e grava workbooks em arquivos compatíveis com streams.

Esta página é uma referência de API com receitas parciais de workbook e filesystem. Os exemplos de I/O mais longos mostram a limpeza explícita; exemplos isolados de métodos omitem a limpeza final do workbook. O código de produção deve preservar o erro da operação principal enquanto ainda tenta executar a limpeza necessária.

## Carregamento

```lua
local excel = require("excel")
```

Adicione `excel` à lista `modules:` da entrada executável antes de carregá-lo. As receitas de filesystem também exigem `fs`.

## Criando e Abrindo Workbooks

### Criar um Workbook

Crie um workbook com a planilha padrão `Sheet1`:

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Create sheets and add data
local _, sheet_err = wb:new_sheet("Report")
if sheet_err then
    wb:close()
    return nil, sheet_err
end
local set_err = wb:set_cell_value("Report", "A1", "Title")
if set_err then
    wb:close()
    return nil, set_err
end

local close_err = wb:close()
if close_err then return nil, close_err end
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
    local _ = file:close()
    return nil, err
end

-- Read data from workbook
local rows, rows_err = wb:get_rows("Sheet1")
if rows_err then
    local _ = wb:close()
    local _ = file:close()
    return nil, rows_err
end
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

local wb_close_err = wb:close()
local file_close_err = file:close()
if wb_close_err then return nil, wb_close_err end
if file_close_err then return nil, file_close_err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `reader` | File | Deve implementar io.Reader (ex: fs.File) |

**Retorna:** `Workbook, error`

## Operações de Planilha

### Criar Planilha

Cria uma nova planilha ou retorna indice da planilha existente.

```lua
local wb, err = excel.new()
if err then return nil, err end

-- Create sheets
local idx1, err = wb:new_sheet("Summary")
if err then return nil, err end
local idx2, err = wb:new_sheet("Details")
if err then return nil, err end
local idx3, err = wb:new_sheet("Charts")
if err then return nil, err end

-- If sheet exists, returns its index
local existing, err = wb:new_sheet("Summary")  -- returns same as idx1
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome da planilha |

**Retorna:** `integer, error`

### Listar Planilhas

Retorna lista de todos os nomes de planilhas no workbook.

```lua
local wb, err = excel.new()
if err then return nil, err end
for _, name in ipairs({"Sales", "Expenses", "Summary"}) do
    local _, sheet_err = wb:new_sheet(name)
    if sheet_err then return nil, sheet_err end
end

local sheets, list_err = wb:get_sheet_list()
if list_err then return nil, list_err end
-- sheets = {"Sheet1", "Sales", "Expenses", "Summary"}

for _, name in ipairs(sheets) do
    print("Sheet:", name)
end
```

**Retorna:** `string[], error`

## Operações de Celula

### Definir Valor de Celula

Define valor de uma unica celula.

```lua
local wb, err = excel.new()
if err then return nil, err end
local _, sheet_err = wb:new_sheet("Data")
if sheet_err then return nil, sheet_err end

-- Set different value types
local cells = {
    {"A1", "Product Name"}, {"B1", "Price"}, {"C1", "In Stock"},
    {"A2", "Widget"}, {"B2", 29.99}, {"C2", true},
    {"A3", "Gadget"}, {"B3", 49.99}, {"C3", false},
    {"AA1", "Extended Column"}, {"AB100", "Far cell"}
}
for _, cell in ipairs(cells) do
    local set_err = wb:set_cell_value("Data", cell[1], cell[2])
    if set_err then return nil, set_err end
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sheet` | string | Nome da planilha |
| `cell` | string | Referência da celula ("A1", "B2", "AA100") |
| `value` | any | string, integer, numero ou boolean |

**Retorna:** `error`

### Obter Todas as Linhas

Obtem todas as linhas de uma planilha como array 2D.

```lua
local wb, err = excel.new()
if err then return nil, err end
local _, sheet_err = wb:new_sheet("Report")
if sheet_err then return nil, sheet_err end
for _, cell in ipairs({
    {"A1", "Name"}, {"B1", "Score"},
    {"A2", "Alice"}, {"B2", 95},
    {"A3", "Bob"}, {"B3", 87}
}) do
    local set_err = wb:set_cell_value("Report", cell[1], cell[2])
    if set_err then return nil, set_err end
end

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

Todos os valores de celula retornados como strings. Booleans como "TRUE" ou "FALSE", numeros como representação string.

### Streaming de Linhas

`wb:rows(sheet)` abre um cursor de streaming sobre uma planilha. A planilha é decodificada incrementalmente em memória constante, ao contrário de `get_rows` que materializa a planilha inteira:

```lua
local cursor, err = wb:rows("Report")
if err then
    return nil, err
end

while true do
    local batch, err = cursor:read(500)
    if err then
        local _ = cursor:close()
        return nil, err
    end
    if not batch then
        break                       -- end of sheet
    end
    for _, row in ipairs(batch) do
        process(row)
    end
end
local close_err = cursor:close()
if close_err then return nil, close_err end
```

| Método | Descrição |
|--------|-----------|
| `cursor:read(n?)` | Lê o próximo lote de até `n` linhas (default 1, máx 10000). Retorna `string[][], error`; `nil, nil` no fim da planilha |
| `cursor:close()` | Libera o cursor (idempotente; cursores também fecham com o workbook) |

Valores de celula são formatados de forma idêntica a `get_rows`. Linhas vazias retornam como tabelas vazias, e linhas vazias finais são preservadas em vez de cortadas. Após o fim da planilha ou um erro, leituras subsequentes continuam retornando esse mesmo estado.

## Operações de Arquivo

### Escrever em Arquivo

Escreve workbook para um objeto writer.

```lua
local fs = require("fs")
local wb, err = excel.new()
if err then return nil, err end

-- Build report
local _, sheet_err = wb:new_sheet("Monthly Report")
if sheet_err then
    wb:close()
    return nil, sheet_err
end
for _, cell in ipairs({
    {"A1", "Month"}, {"B1", "Revenue"},
    {"A2", "January"}, {"B2", 45000},
    {"A3", "February"}, {"B3", 52000}
}) do
    local set_err = wb:set_cell_value("Monthly Report", cell[1], cell[2])
    if set_err then
        wb:close()
        return nil, set_err
    end
end

-- Write to file
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

local write_err = wb:write_to(file)
local file_close_err = file:close()
local wb_close_err = wb:close()
if write_err then return nil, write_err end
if file_close_err then return nil, file_close_err end
if wb_close_err then return nil, wb_close_err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `writer` | File | Deve implementar io.Writer (ex: fs.File) |

**Retorna:** `error`

`write_to` não fecha o writer. Feche o arquivo separadamente, como no exemplo.

### Serializar em Bytes

Serialize o workbook como um arquivo `.xlsx` completo em uma string binária Lua:

```lua
local data, err = wb:bytes()
if err then
    return nil, err
end

-- For example, return `data` in an HTTP response or upload it to object storage.
```

**Retorna:** `string, error`

O workbook permanece aberto e utilizável após `bytes()`. O arquivo completo é materializado na memória; para workbooks grandes, use `write_to` quando houver um writer disponível.

### Fechar um Workbook

Fecha workbook e libera recursos.

```lua
local wb, err = excel.new()
if err then return nil, err end
-- ... work with workbook ...
local close_err = wb:close()
if close_err then return nil, close_err end

-- Safe to call multiple times
local second_close_err = wb:close()
if second_close_err then return nil, second_close_err end
```

**Retorna:** `error`

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sem contexto em `new` ou `open` | `errors.INTERNAL` | não |
| Arquivo Excel inválido ou vazio em `open` | `errors.INTERNAL` | não |
| Receiver de workbook inválido em `new_sheet`, `get_sheet_list`, `get_rows`, `rows` ou `bytes` | `errors.INVALID` | não |
| Receiver de workbook inválido em `set_cell_value`, `write_to` ou `close` | `errors.INTERNAL` | não |
| Workbook fechado em `rows` | `errors.INVALID` | não |
| Workbook fechado em outras operações | `errors.INTERNAL` | não |
| Falha ao criar planilha | `errors.INTERNAL` | não |
| Planilha ausente em `rows` | `errors.INVALID` | não |
| Planilha ausente em `get_rows` ou `set_cell_value` | `errors.INTERNAL` | não |
| Referência de célula inválida | `errors.INTERNAL` | não |
| Writer inválido ou falha de gravação | `errors.INTERNAL` | não |
| Cursor de linhas inválido ou fechado em `read`, ou tamanho de lote menor que 1 | `errors.INVALID` | não |
| Cursor de linhas inválido em `close` | `errors.INTERNAL` | não |
| Falha de leitura de linha, fechamento do cursor ou cancelamento do contexto | `errors.INTERNAL` | não |

Passar a `open` um valor que não seja `io.Reader`, ou passar a `write_to` um valor que não seja userdata, lança um erro de argumento Lua em vez de retornar um erro estruturado. Userdata de writer que não implementa `io.Writer` retorna `errors.INTERNAL`. Um lote de linhas maior que 10.000 é limitado a 10.000, não rejeitado.

Fechar um workbook também fecha seus cursores de linhas abertos. Workbooks são fechados automaticamente durante a limpeza do contexto de execução Lua, mas chamadas explícitas a `close()` liberam os recursos antes.

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.

## Veja Também

- [Filesystem](../storage/filesystem.md) - Operações de arquivo para leitura e gravação de arquivos Excel
