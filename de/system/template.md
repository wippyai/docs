# Template-Engine
<secondary-label ref="external"/>

Template-Rendering mit [CloudyKit Jet](https://github.com/CloudyKit/jet).

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `template.set` | Template-Set mit gemeinsamer Konfiguration |
| `template.jet` | Einzelnes Template |

## Template-Sets

Ein Set ist ein Namespace der verwandte Templates enthält. Templates innerhalb eines Sets teilen sich die Konfiguration und können sich gegenseitig über den Namen referenzieren.

```yaml
- name: views
  kind: template.set
```

Alle Konfiguration ist optional mit sinnvollen Standardwerten:

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `engine.development_mode` | bool | false | Template-Caching deaktivieren |
| `engine.delimiters.left` | string | `{{` | Variablen-Öffnungstrennzeichen |
| `engine.delimiters.right` | string | `}}` | Variablen-Schließtrennzeichen |
| `engine.globals` | map | - | Variablen verfügbar für alle Templates |

## Templates

Templates gehören zu einem Set und werden für interne Auflösung über den Namen identifiziert.

```yaml
- name: layout
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <body>{{ yield content() }}</body>
    </html>

- name: home
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "layout" }}
    {{ block content() }}
      <h1>Willkommen, {{ name }}</h1>
    {{ end }}
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `set` | reference | Ja | Übergeordnetes Template-Set |
| `source` | string | Ja | Template-Inhalt |

## Template-Auflösung

Templates referenzieren sich gegenseitig über Namen, nicht Registry-IDs. Die Auflösung funktioniert wie ein virtuelles Dateisystem innerhalb des Sets:

1. Standardmäßig wird der Registry-Entry-Name (`entry.ID.Name`) zum Template-Namen
2. Mit `meta.name` für benutzerdefinierte Benennung überschreiben:

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Hallo {{ user }}!
```

Dieses Template wird als `welcome` im Set registriert, also verwenden andere Templates `{{ include "welcome" }}` oder `{{ extends "welcome" }}`.

## Vererbung

Templates können Eltern-Templates erweitern und Blöcke überschreiben:

```yaml
# Eltern definiert yield-Punkte
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Kind erweitert und füllt Blöcke
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}Meine Seite{{ end }}
    {{ block body() }}<p>Inhalt hier</p>{{ end }}
```

## Lua-API

Siehe [Template-Modul](lua/text/template.md) für Rendering-Operationen.
