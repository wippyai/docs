# Template-Engine
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

Rendern Sie dynamische Inhalte mit der [Jet Template Engine](https://github.com/CloudyKit/jet). Erstellen Sie HTML-Seiten, E-Mails und Dokumente mit Template-Vererbung und Includes.

Für Template-Set-Konfiguration siehe [Template-Engine](system-template.md).

## Laden

```lua
local templates = require("templates")
```

## Template-Sets abrufen

Holen Sie ein Template-Set anhand der Registry-ID, um mit dem Rendern zu beginnen:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Set verwenden...

set:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Template-Set-Registry-ID |

**Gibt zurück:** `Set, error`

## Templates rendern

Rendern Sie ein Template nach Namen mit Daten:

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

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Template-Name innerhalb des Sets |
| `data` | table | An Template zu ubergebende Variablen (optional) |

**Gibt zurück:** `string, error`

## Set-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `render(name, data?)` | `string, error` | Template mit Daten rendern |
| `release()` | `boolean` | Set an Pool zuruckgeben |

## Jet-Syntax-Referenz

Jet verwendet `{{ }}` für Ausdrucke und Kontrollstrukturen, `{* *}` für Kommentare.

### Variablen

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### Bedingungen

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### Schleifen

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### Vererbung

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

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere ID | `errors.INVALID` | nein |
| Leerer Template-Name | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Template nicht gefunden | `errors.NOT_FOUND` | nein |
| Render-Fehler | `errors.INTERNAL` | nein |
| Set bereits freigegeben | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
