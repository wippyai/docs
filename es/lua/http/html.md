# Sanitizacion HTML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Sanitizar HTML no confiable para prevenir ataques XSS. Basado en [bluemonday](https://github.com/microcosm-cc/bluemonday).

La sanitizacion funciona parseando HTML y filtrandolo a traves de una politica de lista blanca. Los elementos y atributos no permitidos explicitamente son eliminados. La salida siempre es HTML bien formado.

## Carga

```lua
local html = require("html")
```

## Politicas Preconfiguradas

Tres politicas integradas para casos de uso comunes:

| Politica | Caso de Uso | Permite |
|----------|-------------|---------|
| `new_policy` | Sanitizacion personalizada | Nada (construir desde cero) |
| `ugc_policy` | Comentarios de usuario, foros | Formato comun (`p`, `b`, `i`, `a`, listas, etc.) |
| `strict_policy` | Extraccion de texto plano | Nada (elimina todo HTML) |

### Politica Vacia

Crea una politica que no permite nada. Use esto para construir una lista blanca personalizada desde cero.

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Devuelve:** `Policy, error`

### Politica de Contenido de Usuario

Preconfigurada para contenido generado por usuarios. Permite elementos de formato comunes.

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Devuelve:** `Policy, error`

### Politica Estricta

Elimina todo HTML, devuelve solo texto plano.

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Devuelve:** `Policy, error`

## Control de Elementos

### Permitir Elementos

Lista blanca de elementos HTML especificos.

```lua
local policy = html.sanitize.new_policy()
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | string | Nombres de etiquetas de elementos |

**Devuelve:** `Policy`

## Control de Atributos

### Permitir Atributos

Iniciar permiso de atributos. Encadenar con `on_elements()` o `globally()`.

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | string | Nombres de atributos |

**Devuelve:** `AttrBuilder`

### En Elementos Especificos

Permitir atributos solo en elementos especificos.

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | string | Nombres de etiquetas de elementos |

**Devuelve:** `Policy`

### En Todos los Elementos

Permitir atributos globalmente en cualquier elemento permitido.

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**Devuelve:** `Policy`

### Con Coincidencia de Patron

Validar valores de atributos contra patron regex.

```lua
-- Solo permitir colores hex en style
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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `pattern` | string | Patron regex |

**Devuelve:** `AttrBuilder, error`

## Seguridad de URL

### URLs Estandar

Habilitar manejo de URL con valores predeterminados de seguridad.

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Devuelve:** `Policy`

### Esquemas de URL

Restringir que esquemas de URL estan permitidos.

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | string | Esquemas permitidos |

**Devuelve:** `Policy`

### URLs Relativas

Permitir o denegar URLs relativas.

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `allow` | boolean | Permitir URLs relativas |

**Devuelve:** `Policy`

### Enlaces Nofollow

Agregar `rel="nofollow"` a todos los enlaces. Previene spam SEO.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `require` | boolean | Agregar nofollow |

**Devuelve:** `Policy`

### Enlaces Noreferrer

Agregar `rel="noreferrer"` a todos los enlaces. Previene fuga de referrer.

```lua
policy:require_noreferrer_on_links(true)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `require` | boolean | Agregar noreferrer |

**Devuelve:** `Policy`

### Enlaces Externos en Nueva Pestana

Agregar `target="_blank"` a URLs completamente calificadas.

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `add` | boolean | Agregar target blank |

**Devuelve:** `Policy`

## Metodos de Conveniencia

### Permitir Imagenes

Permitir `<img>` con atributos estandar.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Devuelve:** `Policy`

### Permitir Imagenes Data URI

Permitir imagenes base64 incrustadas.

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**Devuelve:** `Policy`

### Permitir Listas

Permitir elementos de lista: `ul`, `ol`, `li`, `dl`, `dt`, `dd`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Devuelve:** `Policy`

### Permitir Tablas

Permitir elementos de tabla: `table`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`, `caption`.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Devuelve:** `Policy`

### Permitir Atributos Estandar

Permitir atributos comunes: `id`, `class`, `title`, `dir`, `lang`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**Devuelve:** `Policy`

## Sanitizar

Aplicar politica a string HTML.

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `html` | string | HTML a sanitizar |

**Devuelve:** `string`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Patron regex invalido | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
