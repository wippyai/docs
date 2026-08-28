---
title: "Template-Engine"
description: "Konfigurieren Sie Jet-Template-Sets, Quellen, Namen, Vererbung und gemeinsame Engine-Einstellungen."
---

# Template-Engine
<secondary-label ref="external"/>

Template-Einträge konfigurieren Sets und Template-Quellen für [CloudyKit Jet](https://github.com/CloudyKit/jet).

Diese Seite ist eine Konfigurationsreferenz. Ihre YAML-Blöcke sind Fragmente für eine bestehende Entry-Liste; kombinieren Sie jedes Template im selben Projekt oder installierten Modulgraphen mit dem referenzierten `template.set`.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `template.set` | Template-Set mit gemeinsamer Konfiguration |
| `template.jet` | Einzelnes Template |

## Template-Sets

Ein Set ist ein Namespace, der verwandte Templates enthält. Templates innerhalb eines Sets teilen sich die Konfiguration und können sich gegenseitig über den Namen referenzieren.

```yaml
- name: views
  kind: template.set
```

Die gesamte Konfiguration eines Template-Sets ist optional:

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `engine.development_mode` | bool | false | Template-Caching deaktivieren |
| `engine.delimiters.left` | string | `{{` | Variablen-Öffnungstrennzeichen |
| `engine.delimiters.right` | string | `}}` | Variablen-Schließtrennzeichen |
| `engine.delimiters.comment_left` | string | `{*` | Validiertes öffnendes Kommentartrennzeichen; wird vom aktuellen Loader nicht angewendet |
| `engine.delimiters.comment_right` | string | `*}` | Validiertes schließendes Kommentartrennzeichen; wird vom aktuellen Loader nicht angewendet |
| `engine.extensions` | string[] | `[.jet, .html.jet, .jet.html]` | Validierte Erweiterungsliste; wird vom aktuellen Loader nicht zur Erkennung verwendet |
| `engine.globals` | map | - | Variablen verfügbar für alle Templates |

Zur Laufzeit konfigurieren `development_mode`, die linken und rechten Ausdruckstrennzeichen sowie `globals` das Jet-Set. Die Felder für Kommentartrennzeichen und Erweiterungen werden in dieser Version akzeptiert und validiert, aber vom In-Memory-Jet-Loader nicht angewendet. Änderungen daran beeinflussen weder das Parsing noch die Template-Erkennung.

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
      <h1>Welcome, {{ name }}</h1>
    {{ end }}
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `set` | reference | Ja | Übergeordnetes Template-Set |
| `source` | string | Ja | Inline-Template-Inhalt oder eine manifestrelative `file://`-Referenz |

Eine relative `file://`-Referenz wird relativ zu dem Manifest geladen, das den Eintrag enthält, und kann dessen Dateisystem nicht verlassen. Umgebungsplatzhalter in der resultierenden Template-Quelle bleiben als Template-Text erhalten und werden nicht vom Umgebungssystem aufgelöst.

## Template-Auflösung

Templates referenzieren sich gegenseitig über Namen statt über Registry-IDs. Namen werden innerhalb des Sets aufgelöst:

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
    Hello {{ user }}!
```

Dieses Template wird als `welcome` im Set registriert, also verwenden andere Templates `{{ include "welcome" }}` oder `{{ extends "welcome" }}`.

## Vererbung

Templates können Eltern-Templates erweitern und Blöcke überschreiben:

```yaml
# Parent defines yield points
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Child extends and fills blocks
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## Lua-API

Siehe [Template-Modul](lua/text/template.md) für Rendering-Operationen.

## Siehe auch

- [Template-Modul](lua/text/template.md) - Lua-API-Referenz
- [Dateisystem](system/filesystem.md) - Templates vom Datenträger laden
- [HTTP-Endpoint](http/endpoint.md) - Templates aus Request-Handlern rendern
