# Template Engine
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

Render dynamic content using the [Jet template engine](https://github.com/CloudyKit/jet). Build HTML pages, emails, and documents with template inheritance and includes.

For template set configuration, see [Template Engine](system-template.md).

## Loading

```lua
local templates = require("templates")
```

## Acquiring Template Sets

Get a template set by registry ID to start rendering:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Use the set...

set:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template set registry ID |

**Returns:** `Set, error`

## Rendering Templates

Render a template by name with data:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Template name within the set |
| `data` | table | Variables to pass to template (optional) |

**Returns:** `string, error`

## Set Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `render(name, data?)` | `string, error` | Render template with data |
| `release()` | `boolean` | Release set back to pool |

## Jet Syntax Reference

Jet uses `{{ }}` for expressions and control structures, `{* *}` for comments.

### Variables

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### Conditionals

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### Loops

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### Inheritance

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

### Includes

```html
{{ include "partials/header" }}
<main>Content</main>
{{ include "partials/footer" }}
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty ID | `errors.INVALID` | no |
| Empty template name | `errors.INVALID` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Template not found | `errors.NOT_FOUND` | no |
| Render error | `errors.INTERNAL` | no |
| Set already released | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.
