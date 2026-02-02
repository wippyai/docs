# Hojas de Calculo Excel
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Leer y escribir archivos Microsoft Excel (.xlsx). Crear libros de trabajo, gestionar hojas, leer valores de celdas y generar reportes con soporte de formato.

## Carga

```lua
local excel = require("excel")
```

## Crear Libros de Trabajo

### Nuevo Libro de Trabajo

Crea un nuevo libro de trabajo Excel vacio.

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Crear hojas y agregar datos
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
```

**Devuelve:** `Workbook, error`

### Abrir Libro de Trabajo

Abre un libro de trabajo Excel desde un objeto reader.

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

-- Leer datos del libro de trabajo
local rows = wb:get_rows("Sheet1")
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `reader` | File | Debe implementar io.Reader (ej., fs.File) |

**Devuelve:** `Workbook, error`

## Operaciones de Hoja

### Crear Hoja

Crea una nueva hoja o devuelve indice de hoja existente.

```lua
local wb = excel.new()

-- Crear hojas
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- Si la hoja existe, devuelve su indice
local existing = wb:new_sheet("Summary")  -- devuelve igual que idx1
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de hoja |

**Devuelve:** `integer, error`

### Listar Hojas

Devuelve lista de todos los nombres de hojas en el libro de trabajo.

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

**Devuelve:** `string[], error`

## Operaciones de Celda

### Establecer Valor de Celda

Establece el valor de una celda individual.

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- Establecer diferentes tipos de valor
wb:set_cell_value("Data", "A1", "Product Name")  -- string
wb:set_cell_value("Data", "B1", "Price")         -- string
wb:set_cell_value("Data", "C1", "In Stock")      -- string

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- número
wb:set_cell_value("Data", "C2", true)            -- boolean

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- Referencias de celda soportan columnas mas alla de Z
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sheet` | string | Nombre de hoja |
| `cell` | string | Referencia de celda ("A1", "B2", "AA100") |
| `value` | any | string, integer, number o boolean |

**Devuelve:** `error`

### Obtener Todas las Filas

Obtiene todas las filas de una hoja como array 2D.

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sheet` | string | Nombre de hoja |

**Devuelve:** `string[][], error`

Todos los valores de celda se devuelven como strings. Booleanos como "TRUE" o "FALSE", numeros como representacion string.

## Operaciones de Archivo

### Escribir a Archivo

Escribe libro de trabajo a un objeto writer.

```lua
local fs = require("fs")
local wb = excel.new()

-- Construir reporte
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- Escribir a archivo
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `writer` | File | Debe implementar io.Writer (ej., fs.File) |

**Devuelve:** `error`

### Cerrar Libro de Trabajo

Cierra libro de trabajo y libera recursos.

```lua
local wb = excel.new()
-- ... trabajar con libro de trabajo ...
wb:close()

-- Seguro llamar multiples veces
wb:close()
```

**Devuelve:** `error`

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Sin contexto | `errors.INTERNAL` | no |
| Libro de trabajo invalido | `errors.INVALID` | no |
| Libro de trabajo cerrado | `errors.INTERNAL` | no |
| No es un reader/writer | `errors.INTERNAL` | no |
| Archivo Excel invalido | `errors.INTERNAL` | no |
| Hoja no existente | `errors.INTERNAL` | no |
| Referencia de celda invalida | `errors.INTERNAL` | no |
| Escritura fallida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Vea También

- [Sistema de Archivos](lua/storage/filesystem.md) - Operaciones de archivo para leer/escribir archivos Excel
