---
title: "Saneamiento de HTML"
description: "Sanea HTML no confiable con políticas predefinidas o personalizadas de elementos, atributos y URL."
---

# Saneamiento de HTML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `html` sanea HTML no confiable mediante políticas basadas en [bluemonday](https://github.com/microcosm-cc/bluemonday).

El saneamiento analiza un fragmento HTML y lo filtra mediante una política de elementos permitidos. Los elementos y atributos que la política no permite se eliminan, y el fragmento restante se normaliza durante la serialización.

Esta es una referencia de API. Los bloques de constructores son fragmentos de política autocontenidos; los bloques de métodos posteriores son fragmentos parciales de configuración que suponen que `policy` es una política ya creada. La salida saneada solo es adecuada para un contexto de contenido de elemento HTML. No es segura para interpolarla en JavaScript, CSS, URL ni atributos HTML; use un codificador apropiado para el contexto real de salida.

## Cargar el módulo

```lua
local html = require("html")
```

Añada `html` a la lista `modules:` de la entrada ejecutable antes de requerirlo.

## Políticas predefinidas

El módulo proporciona tres constructores de políticas predefinidas:

| Política | Caso de uso | Permite |
|----------|-------------|---------|
| `new_policy` | Saneamiento personalizado | Nada (se construye desde cero) |
| `ugc_policy` | Comentarios de usuario, foros | Formato comun (`p`, `b`, `i`, `a`, listas, etc.) |
| `strict_policy` | Extracción de texto plano | Nada (elimina todo HTML) |

Los tres constructores devuelven `Policy, nil`; actualmente la creación de políticas no falla.

### Política vacía

Cree una política vacía y añada los elementos y atributos que deba permitir:

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Devuelve:** `Policy, error`

### Política para contenido de usuario

Cree una política configurada para formatos habituales de contenido generado por usuarios:

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Devuelve:** `Policy, error`

### Política estricta

Cree una política estricta que elimine el HTML y devuelva texto plano:

```lua
local policy, err = html.sanitize.strict_policy()
if err then return nil, err end

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Devuelve:** `Policy, error`

## Control de elementos

### Permitir Elementos

Permita elementos HTML concretos:

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | string | Nombres de etiquetas de elementos |

**Devuelve:** `Policy`

## Control de atributos

### Permitir Atributos

Inicie una regla de atributos y aplíquela con `on_elements()` o `globally()`:

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | string | Nombres de atributos |

**Devuelve:** `AttrBuilder`

### En elementos específicos

Permita atributos solo en los elementos indicados:

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | string | Nombres de etiquetas de elementos |

**Devuelve:** `Policy`

### En todos los elementos

Permita atributos en todos los elementos admitidos:

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**Devuelve:** `Policy`

### Con coincidencia de patrón

Exija que los valores de los atributos coincidan con una expresión regular:

```lua
-- Only allow hex colors in style
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `pattern` | string | Expresión regular compatible con RE2 de Go |

**Devuelve:** `AttrBuilder, error`

## Seguridad de las URL

### URLs Estandar

Active la política estándar de tratamiento de URL. Exige URL analizables, permite URL relativas y los esquemas `mailto`, `http` y `https`, y añade `rel="nofollow"` a los elementos de enlace permitidos:

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Devuelve:** `Policy`

### Esquemas de URL

Permita esquemas de URL específicos:

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `...` | string | Esquemas permitidos |

**Devuelve:** `Policy`

### URLs Relativas

Configure si se permiten URL relativas:

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `allow` | boolean | Permitir URLs relativas |

**Devuelve:** `Policy`

### Requerir URLs Parseables

Rechace las URL que no se puedan analizar correctamente. Con `true`, las URL de atributos que el saneador HTML no puede analizar se eliminan en lugar de dejarse pasar.

```lua
policy:require_parseable_urls(true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `require` | boolean | Requerir que las URLs sean parseables |

**Devuelve:** `Policy`

### Enlaces Nofollow

Añada `rel="nofollow"` a los enlaces:

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `require` | boolean | Agregar nofollow |

**Devuelve:** `Policy`

### Enlaces Noreferrer

Añada `rel="noreferrer"` a los enlaces:

```lua
policy:require_noreferrer_on_links(true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `require` | boolean | Agregar noreferrer |

**Devuelve:** `Policy`

### Enlaces externos en una pestaña nueva

Añada `target="_blank"` a las URL completas:

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `add` | boolean | Agregar target blank |

**Devuelve:** `Policy`

Cuando abra enlaces no confiables en una pestaña nueva, active también `require_noreferrer_on_links(true)` para evitar la filtración del referente y mitigar el acceso a la ventana de origen.

## Métodos auxiliares

### Permitir imágenes

Permita `<img>` con `align`, `alt`, `height`, `width` y `src`. Este método también activa la política estándar de URL, pero no permite imágenes en URI de datos.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Devuelve:** `Policy`

### Permitir imágenes en URI de datos

Permita imágenes en URI de datos con Base64 sintácticamente válido y tipo `gif`, `jpeg`, `png`, `svg+xml` o `webp`. El saneador valida el tipo de medio y la codificación Base64, no el contenido decodificado de la imagen. Las URI de datos pueden transportar contenido activo; actívelas únicamente cuando confíe en los datos de la imagen:

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

local input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2O9sAAAAASUVORK5CYII=">'
policy:sanitize(input)
-- The data URI is preserved.
```

**Devuelve:** `Policy`

### Permitir Listas

Permita `ul`, `ol`, `li`, `dl`, `dt` y `dd`. El método también admite atributos `type` validados en `ul`, `ol` y `li`, además de un atributo entero `value` en `li`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Devuelve:** `Policy`

### Permitir Tablas

Permita `table`, `caption`, `col`, `colgroup`, `thead`, `tbody`, `tfoot`, `tr`, `td` y `th`. También admite las dimensiones, alineación, extensiones de celda, cabeceras, ámbitos y atributos de presentación relacionados que valida este método.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Devuelve:** `Policy`

### Permitir atributos estándar

Permita globalmente los atributos estándar `dir`, `id`, `lang` y `title`. Los valores están restringidos: `dir` es `ltr` o `rtl`, `lang` contiene entre 2 y 20 letras ASCII, y `id` y `title` deben coincidir con los patrones de caracteres seguros del saneador. Este método no permite `class`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" title="Introduction">Hello</p>'
```

**Devuelve:** `Policy`

## Sanear

Aplique una política a una cadena HTML:

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `html` | string | HTML a sanitizar |

**Devuelve:** `string`

`sanitize` solo devuelve una cadena. En el entorno de ejecución `v0.3.32a`, el analizador de fragmentos subyacente puede convertir en una cadena vacía una entrada mal formada que no puede analizar, y el envoltorio Lua no puede distinguir ese caso de una entrada válida cuyo contenido eliminó la política. Trate el saneamiento como filtrado de salida, no como validación de entrada; valide por separado el contenido obligatorio cuando un resultado vacío sea relevante.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Patrón de expresión regular no válido | `errors.INVALID` | no |

Consulte [Manejo de errores](../core/errors.md) para trabajar con errores.
