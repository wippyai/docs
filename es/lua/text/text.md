# Procesamiento de Texto
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Expresiones regulares, comparacion de texto y division semantica de texto.

## Carga

```lua
local text = require("text")
```

## Expresiones Regulares

### Compilar

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `pattern` | string | Patron regex compatible con RE2 |

**Devuelve:** `Regexp, error`

### Coincidencia

```lua
local ok = re:match_string("abc123")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a comparar |

**Devuelve:** `boolean`

### Buscar

```lua
local match = re:find_string("abc123def")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string | nil`

### Buscar Todas

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string[]`

### Buscar con Grupos

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string[] | nil` (coincidencia completa + grupos de captura)

### Buscar Todas con Grupos

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string[][]`

### Buscar Indice

```lua
local pos = re:find_string_index("abc123")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `table | nil` ({start, end}, basado en 1)

### Buscar Todos los Indices

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `table[]`

### Reemplazar

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String de entrada |
| `repl` | string | String de reemplazo |

**Devuelve:** `string`

### Dividir

```lua
local parts = re:split("a,b,c", -1)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `s` | string | String a dividir |
| `n` | integer | Partes maximas, -1 para todas |

**Devuelve:** `string[]`

### Conteo de Subexpresiones

```lua
local count = re:num_subexp()
```

**Devuelve:** `number`

### Nombres de Subexpresiones

```lua
local names = re:subexp_names()
```

**Devuelve:** `string[]`

### String de Patron

```lua
local pattern = re:string()
```

**Devuelve:** `string`

## Comparacion de Texto

Comparar versiones de texto y generar parches. Basado en [go-diff](https://github.com/sergi/go-diff) (diff-match-patch de Google).

### Crear Comparador

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Devuelve:** `Differ, error`

#### Opciones {id="diff-options"}

| Campo | Tipo | Predeterminado | Descripcion |
|-------|------|----------------|-------------|
| `diff_timeout` | number | 1.0 | Timeout en segundos |
| `diff_edit_cost` | integer | 4 | Costo de una edicion vacia |
| `match_threshold` | number | 0.5 | Tolerancia de coincidencia 0-1 |
| `match_distance` | integer | 1000 | Distancia a buscar para coincidencia |
| `patch_delete_threshold` | number | 0.5 | Umbral de eliminacion |
| `patch_margin` | integer | 4 | Margen de contexto |

### Comparar

Encontrar diferencias entre dos textos. Devuelve un array de operaciones describiendo como transformar text1 en text2.

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffs contiene:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Devuelve:** `table, error` (array de {operation, text})

Operaciones: `"equal"`, `"delete"`, `"insert"`

### Resumir

Contar caracteres cambiados entre versiones.

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6 (caracteres sin cambiar)
-- summary.deletions = 5 (caracteres eliminados)
-- summary.insertions = 5 (caracteres agregados)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `diffs` | table | Array de diff de compare |

**Devuelve:** `table` ({insertions, deletions, equals})

### Texto Formateado

Formatear diff con colores ANSI para visualizacion en terminal.

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `diffs` | table | Array de diff de compare |

**Devuelve:** `string, error`

### HTML Formateado

Formatear diff como HTML con tags `<del>` e `<ins>`.

```lua
local html, err = diff:pretty_html(diffs)
-- Devuelve: "hello <del>world</del><ins>there</ins>"
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `diffs` | table | Array de diff de compare |

**Devuelve:** `string, error`

### Crear Parches

Generar parches que pueden aplicarse para transformar un texto en otro. Los parches pueden serializarse y aplicarse despues.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Devuelve:** `table, error`

### Aplicar Parches

Aplicar parches para transformar texto. Devuelve el resultado y si todos los parches se aplicaron exitosamente.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `patches` | table | Parches de patch_make |
| `text` | string | Texto al cual aplicar parches |

**Devuelve:** `string, boolean`

## Division de Texto

Dividir documentos grandes en fragmentos mas pequenos preservando limites semanticos. Basado en el divisor de texto de [langchaingo](https://github.com/tmc/langchaingo).

### Divisor Recursivo

Divide texto usando una jerarquia de separadores. Primero intenta dividir en dobles nuevas lineas (parrafos), luego nuevas lineas simples, luego espacios, luego caracteres. Recurre a separadores mas pequenos cuando los fragmentos exceden el limite de tamano.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "This is a long text that needs splitting..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"This is a long...", "...text that needs...", "...splitting..."}
```

**Devuelve:** `Splitter, error`

#### Opciones {id="recursive-splitter-options"}

| Campo | Tipo | Predeterminado | Descripcion |
|-------|------|----------------|-------------|
| `chunk_size` | integer | 4000 | Caracteres maximos por fragmento |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre fragmentos adyacentes |
| `keep_separator` | boolean | false | Mantener separadores en salida |
| `separators` | string[] | nil | Lista de separadores personalizada |

### Divisor de Markdown

Divide documentos markdown respetando la estructura. Intenta mantener encabezados con su contenido, bloques de codigo intactos y filas de tabla juntas.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

**Devuelve:** `Splitter, error`

#### Opciones {id="markdown-splitter-options"}

| Campo | Tipo | Predeterminado | Descripcion |
|-------|------|----------------|-------------|
| `chunk_size` | integer | 4000 | Caracteres maximos por fragmento |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre fragmentos adyacentes |
| `code_blocks` | boolean | false | Mantener bloques de codigo juntos |
| `reference_links` | boolean | false | Preservar enlaces de referencia |
| `heading_hierarchy` | boolean | false | Respetar niveles de encabezado |
| `join_table_rows` | boolean | false | Mantener filas de tabla juntas |

### Dividir Texto

Dividir un solo documento en un array de fragmentos.

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- Procesar cada fragmento (ej., crear embedding, enviar a LLM)
    process(chunk)
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `text` | string | Texto a dividir |

**Devuelve:** `string[], error`

### Dividir Lote

Dividir multiples documentos preservando sus metadatos. Cada documento de entrada puede producir multiples fragmentos de salida. Todos los fragmentos heredan los metadatos de su documento fuente.

```lua
-- Entrada: paginas de un PDF con numeros de pagina
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- Salida: cada fragmento sabe de que pagina vino
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `pages` | table | Array de {content, metadata} |

**Devuelve:** `table, error` (array de {content, metadata})

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Sintaxis de patron invalida | `errors.INVALID` | no |
| Error interno | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
