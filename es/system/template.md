# Motor de Plantillas
<secondary-label ref="external"/>

Renderizado de plantillas usando [CloudyKit Jet](https://github.com/CloudyKit/jet).

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `template.set` | Conjunto de plantillas con configuración compartida |
| `template.jet` | Plantilla individual |

## Conjuntos de Plantillas

Un conjunto es un namespace que contiene plantillas relacionadas. Las plantillas dentro de un conjunto comparten configuración y pueden referenciarse entre sí por nombre.

```yaml
- name: views
  kind: template.set
```

Toda la configuración es opcional con valores por defecto sensatos:

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `engine.development_mode` | bool | false | Deshabilitar caché de plantillas |
| `engine.delimiters.left` | string | `{{` | Delimitador de apertura de variable |
| `engine.delimiters.right` | string | `}}` | Delimitador de cierre de variable |
| `engine.globals` | map | - | Variables disponibles para todas las plantillas |

## Plantillas

Las plantillas pertenecen a un conjunto y se identifican por nombre para resolución interna.

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
      <h1>Bienvenido, {{ name }}</h1>
    {{ end }}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `set` | referencia | Sí | Conjunto de plantillas padre |
| `source` | string | Sí | Contenido de la plantilla |

## Resolución de Plantillas

Las plantillas se referencian entre sí usando nombres, no IDs de registro. La resolución funciona como un sistema de archivos virtual dentro del conjunto:

1. Por defecto, el nombre de entrada del registro (`entry.ID.Name`) se convierte en el nombre de plantilla
2. Sobrescriba con `meta.name` para nomenclatura personalizada:

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Hola {{ user }}!
```

Esta plantilla se registra como `welcome` en el conjunto, así que otras plantillas usan `{{ include "welcome" }}` o `{{ extends "welcome" }}`.

## Herencia

Las plantillas pueden extender plantillas padre y sobrescribir bloques:

```yaml
# Padre define puntos de yield
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Hijo extiende y llena bloques
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}Mi Página{{ end }}
    {{ block body() }}<p>Contenido aquí</p>{{ end }}
```

## API Lua

Ver [Módulo Template](lua/text/template.md) para operaciones de renderizado.
