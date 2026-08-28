---
title: "Procesamiento de texto"
description: "Compila expresiones regulares, compara texto, crea parches y divide documentos en fragmentos."
---

# Procesamiento de texto
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `text` proporciona expresiones regulares, comparación y aplicación de parches de texto y división de documentos. Esta página es una referencia de API. Sus bloques cortos son llamadas aisladas; los bloques de división más largos son recetas parciales cuyos documentos, recursos de sistema de archivos configurados y procesamiento posterior pertenecen a la aplicación contenedora.

## Carga

```lua
local text = require("text")
```

## Expresiones regulares

### `text.regexp.compile`

Compila una expresión regular compatible con RE2.

```lua
local re, err = text.regexp.compile("[0-9]+")
if err then
    return nil, err
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `pattern` | string | Patrón regex compatible con RE2 |

**Devuelve:** `Regexp, error`

### `re:match_string`

Comprueba si una cadena coincide con la expresión compilada.

```lua
local ok = re:match_string("abc123")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a comparar |

**Devuelve:** `boolean`

### `re:find_string`

Busca la primera subcadena coincidente.

```lua
local match = re:find_string("abc123def")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string | nil`

En esta versión del runtime, una coincidencia de cadena vacía también se representa como `nil`; usa un patrón que consuma al menos un carácter cuando sea necesario distinguir una coincidencia vacía de la ausencia de coincidencia.

### `re:find_all_string`

Busca todas las subcadenas coincidentes.

```lua
local matches = re:find_all_string("a1b2c3")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string[]`

### `re:find_string_submatch`

Busca la primera coincidencia y sus grupos de captura.

```lua
local match = re:find_string_submatch("user@example.com")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string[] | nil` (coincidencia completa + grupos de captura)

### `re:find_all_string_submatch`

Busca todas las coincidencias y sus grupos de captura.

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `string[][]`

### `re:find_string_index`

Busca los límites basados en 1 de la primera coincidencia.

```lua
local pos = re:find_string_index("abc123")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `table | nil` ({start, end}, basado en 1)

### `re:find_all_string_index`

Busca los límites de todas las coincidencias.

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a buscar |

**Devuelve:** `table[] | nil` (nil cuando no hay coincidencias)

### `re:replace_all_string`

Reemplaza todas las subcadenas coincidentes.

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String de entrada |
| `repl` | string | String de reemplazo |

**Devuelve:** `string`

### `re:split`

Divide una cadena en las coincidencias de la expresión compilada.

```lua
local parts = re:split("a,b,c", -1)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `s` | string | String a dividir |
| `n` | integer | Partes maximas, -1 para todas |

**Devuelve:** `string[]`

### `re:num_subexp`

Devuelve el número de subexpresiones de captura.

```lua
local count = re:num_subexp()
```

**Devuelve:** `number`

### `re:subexp_names`

Devuelve los nombres de las subexpresiones de captura.

```lua
local names = re:subexp_names()
```

**Devuelve:** `string[]`

### `re:string`

Devuelve la cadena del patrón compilado.

```lua
local pattern = re:string()
```

**Devuelve:** `string`

## Comparación de texto

Comparar versiones de texto y generar parches. Basado en [go-diff](https://github.com/sergi/go-diff) (diff-match-patch de Google).

### `text.diff.new`

Crea un comparador de texto con opciones predeterminadas o personalizadas.

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Devuelve:** `Differ, error`

#### Opciones {id="diff-options"}

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `diff_timeout` | number | 1.0 | Timeout en segundos |
| `diff_edit_cost` | integer | 4 | Costo de una edicion vacia |
| `match_threshold` | number | 0.5 | Tolerancia de coincidencia 0-1 |
| `match_distance` | integer | 1000 | Distancia a buscar para coincidencia |
| `patch_delete_threshold` | number | 0.5 | Umbral de eliminacion |
| `patch_margin` | integer | 4 | Margen de contexto |

### `diff:compare`

Compara dos cadenas y devuelve las operaciones que transforman `text1` en `text2`.

```lua
local diff, diff_err = text.diff.new()
if diff_err then
    return nil, diff_err
end
local diffs, err = diff:compare("hello world", "hello there")
if err then
    return nil, err
end

-- diffs contains:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Devuelve:** `table, error` (array de {operation, text})

Operaciones: `"equal"`, `"delete"`, `"insert"`

### `diff:summarize`

Cuenta los bytes UTF-8 sin cambios, insertados y eliminados. Para texto no ASCII, estos totales no son recuentos de puntos de código Unicode ni de grafemas.

```lua
-- `diffs` is the checked result from diff:compare.
local summary = diff:summarize(diffs)

-- summary.equals = 6 (bytes unchanged)
-- summary.deletions = 5 (bytes removed)
-- summary.insertions = 5 (bytes added)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `diffs` | table | Array de diff de compare |

**Devuelve:** `table` ({insertions, deletions, equals})

### `diff:pretty_text`

Formatear diff con colores ANSI para visualizacion en terminal.

```lua
local formatted, err = diff:pretty_text(diffs)
if err then
    return nil, err
end
print(formatted)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `diffs` | table | Array de diff de compare |

**Devuelve:** `string, error`

### `diff:pretty_html`

Formatear diff como HTML con tags `<del>` e `<ins>`.

```lua
local html, err = diff:pretty_html(diffs)
if err then
    return nil, err
end
-- `html` is an HTML fragment with equal, deleted, and inserted spans.
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `diffs` | table | Array de diff de compare |

**Devuelve:** `string, error`

### `diff:patch_make`

Generar parches que pueden aplicarse para transformar un texto en otro. Los parches pueden serializarse y aplicarse despues.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
if err then
    return nil, err
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `text1` | string | Texto original |
| `text2` | string | Texto modificado |

**Devuelve:** `table, error`

### `diff:patch_apply`

Aplica parches a una cadena y devuelve el resultado e indica si todos los parches se aplicaron correctamente.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

Comprueba `success` antes de tratar `result` como la transformación solicitada. Pasa tablas de parches producidas por `patch_make`; en esta versión del runtime, el texto de parche serializado con formato incorrecto dentro de una tabla construida manualmente puede omitirse en vez de notificarse por separado.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `patches` | table | Parches de patch_make |
| `text` | string | Texto al cual aplicar parches |

**Devuelve:** `string, boolean`

## División de texto

Dividir documentos grandes en fragmentos mas pequenos preservando limites semanticos. Basado en el divisor de texto de [langchaingo](https://github.com/tmc/langchaingo).

### `text.splitter.recursive`

Divide texto usando una jerarquia de separadores. Primero intenta dividir en dobles nuevas lineas (parrafos), luego nuevas lineas simples, luego espacios, luego caracteres. Recurre a separadores mas pequenos cuando los fragmentos exceden el limite de tamano.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})
if err then
    return nil, err
end

local long_text = "This is a long text that needs splitting..."
local chunks, split_err = splitter:split_text(long_text)
if split_err then
    return nil, split_err
end
```

**Devuelve:** `Splitter, error`

#### Opciones {id="recursive-splitter-options"}

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `chunk_size` | integer | 4000 | Caracteres maximos por fragmento |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre fragmentos adyacentes |
| `keep_separator` | boolean | false | Mantener separadores en salida |
| `separators` | string[] | nil | Lista de separadores personalizada |

### `text.splitter.markdown`

Divide documentos markdown respetando la estructura. Intenta mantener encabezados con su contenido, bloques de código intactos y filas de tabla juntas.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})
if err then
    return nil, err
end

local fs = require("fs")
local docs, docs_err = fs.get("app:docs")
if docs_err then
    return nil, docs_err
end
local readme, read_err = docs:readfile("README.md")
if read_err then
    return nil, read_err
end
local chunks, split_err = splitter:split_text(readme)
if split_err then
    return nil, split_err
end
```

Esta receta parcial requiere que la entrada habilite tanto `text` como `fs`, un recurso de sistema de archivos `app:docs` configurado y un archivo `README.md` legible dentro de ese recurso.

**Devuelve:** `Splitter, error`

#### Opciones {id="markdown-splitter-options"}

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `chunk_size` | integer | 4000 | Caracteres maximos por fragmento |
| `chunk_overlap` | integer | 200 | Caracteres repetidos entre fragmentos adyacentes |
| `code_blocks` | boolean | false | Mantener bloques de código juntos |
| `reference_links` | boolean | false | Preservar enlaces de referencia |
| `heading_hierarchy` | boolean | false | Respetar niveles de encabezado |
| `join_table_rows` | boolean | false | Mantener filas de tabla juntas |

### `splitter:split_text`

Dividir un solo documento en un array de fragmentos.

```lua
local chunks, err = splitter:split_text(document)
if err then
    return nil, err
end

for i, chunk in ipairs(chunks) do
    -- Process each chunk (e.g., create embedding, send to LLM)
    process(chunk)
end
```

Aquí, `splitter` es un divisor creado correctamente, mientras que `document` y `process` son proporcionados por la aplicación.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `text` | string | Texto a dividir |

**Devuelve:** `string[], error`

### `splitter:split_batch`

Dividir multiples documentos preservando sus metadatos. Cada documento de entrada puede producir multiples fragmentos de salida. Todos los fragmentos heredan los metadatos de su documento fuente.

```lua
-- Input: pages from a PDF with page numbers
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)
if err then
    return nil, err
end

-- Output: each chunk knows which page it came from
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `pages` | table | Array de {content, metadata} |

**Devuelve:** `table, error` (array de {content, metadata})

`split_batch` omite silenciosamente un elemento cuando este no es una tabla, falta su campo `content`, está vacío o no es una cadena, o falla la división de ese elemento. Aun así, devuelve los fragmentos restantes con un error `nil`. Valida cada elemento de entrada antes de la llamada y comprueba en el código de la aplicación cualquier requisito de cardinalidad; no trates una llamada correcta como prueba de que se representaron todas las entradas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Sintaxis de patrón no válida | `errors.INVALID` | no |
| Error interno | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
