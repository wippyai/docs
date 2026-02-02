# Template Engine
<secondary-label ref="external"/>

Template rendering using [CloudyKit Jet](https://github.com/CloudyKit/jet).

## Entry Kinds

| Kind | Description |
|------|-------------|
| `template.set` | Template set with shared configuration |
| `template.jet` | Individual template |

## Template Sets

A set is a namespace containing related templates. Templates within a set share configuration and can reference each other by name.

```yaml
- name: views
  kind: template.set
```

All configuration is optional with sensible defaults:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `engine.development_mode` | bool | false | Disable template caching |
| `engine.delimiters.left` | string | `{{` | Variable opening delimiter |
| `engine.delimiters.right` | string | `}}` | Variable closing delimiter |
| `engine.globals` | map | - | Variables available to all templates |

## Templates

Templates belong to a set and are identified by name for internal resolution.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `set` | reference | Yes | Parent template set |
| `source` | string | Yes | Template content |

## Template Resolution

Templates reference each other using names, not registry IDs. The resolution works like a virtual filesystem within the set:

1. By default, the registry entry name (`entry.ID.Name`) becomes the template name
2. Override with `meta.name` for custom naming:

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

This template is registered as `welcome` in the set, so other templates use `{{ include "welcome" }}` or `{{ extends "welcome" }}`.

## Inheritance

Templates can extend parent templates and override blocks:

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

## Lua API

See [Template Module](lua/text/template.md) for rendering operations.
