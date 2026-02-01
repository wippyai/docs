# Motor de Plantillas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

Renderizar contenido dinamico usando el [motor de plantillas Jet](https://github.com/CloudyKit/jet). Construir paginas HTML, emails y documentos con herencia e inclusiones de plantillas.

Para configuracion de conjunto de plantillas, consulte [Motor de Plantillas](system-template.md).

## Carga

```lua
local templates = require("templates")
```

## Adquirir Conjuntos de Plantillas

Obtener un conjunto de plantillas por ID de registro para comenzar a renderizar:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Usar el conjunto...

set:release()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | string | ID de registro del conjunto de plantillas |

**Devuelve:** `Set, error`

## Renderizar Plantillas

Renderizar una plantilla por nombre con datos:

```lua
local set = templates.get("app.views:emails")

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.com/activate?token=abc"
})

if err then
    set:release()
    return nil, err
end

set:release()
return html
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `name` | string | Nombre de plantilla dentro del conjunto |
| `data` | table | Variables a pasar a la plantilla (opcional) |

**Devuelve:** `string, error`

## Metodos de Set

| Metodo | Devuelve | Descripcion |
|--------|----------|-------------|
| `render(name, data?)` | `string, error` | Renderizar plantilla con datos |
| `release()` | `boolean` | Liberar conjunto de vuelta al pool |

## Referencia de Sintaxis Jet

Jet usa `{{ }}` para expresiones y estructuras de control, `{* *}` para comentarios.

### Variables

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### Condicionales

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### Bucles

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### Herencia

```html
{* Padre: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Hijo: page.jet *}
{{ extends "layout" }}
{{ block title() }}My Page{{ end }}
{{ block body() }}<p>Content</p>{{ end }}
```

### Inclusiones

```html
{{ include "partials/header" }}
<main>Content</main>
{{ include "partials/footer" }}
```

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| ID vacio | `errors.INVALID` | no |
| Nombre de plantilla vacio | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Plantilla no encontrada | `errors.NOT_FOUND` | no |
| Error de renderizado | `errors.INTERNAL` | no |
| Conjunto ya liberado | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
