---
title: "Motor de plantillas"
description: "Renderiza plantillas Jet desde conjuntos de plantillas configurados."
---

# Motor de plantillas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

El módulo `templates` renderiza plantillas [Jet](https://github.com/CloudyKit/jet) desde conjuntos configurados. Las plantillas pueden usar herencia e inclusiones. Esta página es una referencia de API con ejemplos de renderizado aislados, no un despliegue independiente de plantillas. Los ID de registro y los orígenes de las plantillas ya deben estar configurados, y la entrada ejecutable debe habilitar `templates` y tener permiso `template.get` para el conjunto solicitado.

Para configurar conjuntos de plantillas, consulta [Motor de plantillas](../../system/template.md).

## Carga

```lua
local templates = require("templates")
```

## `templates.get`

Adquiere un conjunto de plantillas por su ID de registro:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Use the set...

return set:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de registro del conjunto de plantillas |

**Devuelve:** `Set, error`

## `set:render`

Renderizar una plantilla por nombre con datos:

```lua
local set, get_err = templates.get("app.views:emails")
if get_err then
    return nil, get_err
end

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.invalid/activate"
})

set:release()
if err then
    return nil, err
end

return html
```

El autor de la llamada es propietario de cada conjunto adquirido hasta que se llama a `release()`. Libéralo después del último renderizado, también en las rutas de error comprobadas; las liberaciones repetidas son seguras. El renderizado no hace que los valores proporcionados por la aplicación sean seguros para todos los contextos de salida. Mantén los secretos y las URL de un solo uso fuera de los registros y aplica el escape o saneamiento necesario donde se consuma la cadena renderizada.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Nombre de plantilla dentro del conjunto |
| `data` | table | Variables a pasar a la plantilla (opcional) |

**Devuelve:** `string, error`

## Resumen de métodos de Set

El handle del conjunto proporciona estos métodos:

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `render(name, data?)` | `string, error` | Renderizar plantilla con datos |
| `release()` | `boolean` | Liberar conjunto de vuelta al pool |

## Referencia de sintaxis Jet

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
{* Parent: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Child: page.jet *}
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

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID vacío | `errors.INVALID` | no |
| Nombre de plantilla vacío | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| El conjunto de plantillas falta, no está disponible o tiene un tipo de recurso incorrecto | `errors.INTERNAL` | no |
| Plantilla no encontrada | `errors.NOT_FOUND` | no |
| Error de renderizado | `errors.INTERNAL` | no |
| Intento de renderizar después de liberar el conjunto | `errors.INTERNAL` | no |

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
