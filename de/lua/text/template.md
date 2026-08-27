---
title: "Template-Engine"
description: "Jet-Templates aus konfigurierten Template-Sets rendern."
---

# Template-Engine
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

Das Modul `templates` rendert [Jet](https://github.com/CloudyKit/jet)-Templates aus konfigurierten Sets. Templates können Vererbung und Includes verwenden. Diese Seite ist eine API-Referenz mit einzelnen Rendering-Beispielen und keine eigenständige Template-Bereitstellung. Die Registry-IDs und Template-Quellen müssen bereits konfiguriert sein; der ausführbare Eintrag muss `templates` aktivieren und für das angeforderte Set die Berechtigung `template.get` besitzen.

Informationen zur Konfiguration von Template-Sets finden Sie unter [Template-Engine](../../system/template.md).

## Laden

```lua
local templates = require("templates")
```

## `templates.get`

Rufen Sie ein Template-Set anhand seiner Registry-ID ab:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Use the set...

return set:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Template-Set-Registry-ID |

**Gibt zurück:** `Set, error`

## `set:render`

Rendern Sie ein Template anhand seines Namens mit Daten:

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

Der Aufrufer ist für jedes abgerufene Set verantwortlich, bis `release()` aufgerufen wurde. Geben Sie es nach dem letzten Rendern auch auf geprüften Fehlerpfaden frei; wiederholte Freigaben sind sicher. Das Rendering macht von der Anwendung bereitgestellte Werte nicht für jeden Ausgabekontext sicher. Halten Sie Geheimnisse und einmalig verwendbare URLs aus Logs heraus und wenden Sie die Escaping- oder Bereinigungsregeln des Kontexts an, in dem die gerenderte Zeichenkette verwendet wird.

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Template-Name innerhalb des Sets |
| `data` | table | An Template zu übergebende Variablen (optional) |

**Gibt zurück:** `string, error`

## Übersicht der Set-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `render(name, data?)` | `string, error` | Template mit Daten rendern |
| `release()` | `boolean` | Set an Pool zurückgeben |

## Jet-Syntax-Referenz

Jet verwendet `{{ }}` für Ausdrücke und Kontrollstrukturen, `{* *}` für Kommentare.

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
| Template-Set fehlt, ist nicht verfügbar oder hat den falschen Ressourcentyp | `errors.INTERNAL` | nein |
| Template nicht gefunden | `errors.NOT_FOUND` | nein |
| Render-Fehler | `errors.INTERNAL` | nein |
| Rendering nach der Freigabe des Sets versucht | `errors.INTERNAL` | nein |

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](../core/errors.md).
