---
title: "Motor de plantillas"
description: "Configure conjuntos de plantillas Jet, fuentes, nombres, herencia y ajustes compartidos del motor."
---

# Motor de Plantillas
<secondary-label ref="external"/>

Las entradas de plantillas configuran conjuntos y fuentes de plantillas de [CloudyKit Jet](https://github.com/CloudyKit/jet).

Esta página es una referencia de configuración. Sus fences YAML son fragmentos para una lista de entradas existente; combine cada plantilla con el `template.set` referenciado en el mismo proyecto o grafo de módulos instalados.

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

Toda la configuración del conjunto de plantillas es opcional:

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `engine.development_mode` | bool | false | Deshabilitar caché de plantillas |
| `engine.delimiters.left` | string | `{{` | Delimitador de apertura de variable |
| `engine.delimiters.right` | string | `}}` | Delimitador de cierre de variable |
| `engine.delimiters.comment_left` | string | `{*` | Delimitador de apertura de comentario validado; el loader actual no lo aplica |
| `engine.delimiters.comment_right` | string | `*}` | Delimitador de cierre de comentario validado; el loader actual no lo aplica |
| `engine.extensions` | string[] | `[.jet, .html.jet, .jet.html]` | Lista de extensiones validada; el loader actual no la usa para descubrir plantillas |
| `engine.globals` | map | - | Variables disponibles para todas las plantillas |

En tiempo de ejecución, `development_mode`, los delimitadores izquierdo y derecho de expresiones y `globals` configuran el conjunto Jet. Los campos de delimitadores de comentarios y extensiones se aceptan y validan en esta versión, pero el loader Jet en memoria no los aplica. Cambiarlos no altera el análisis ni descubre plantillas.

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
      <h1>Welcome, {{ name }}</h1>
    {{ end }}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `set` | referencia | Sí | Conjunto de plantillas padre |
| `source` | string | Sí | Contenido de plantilla en línea o referencia `file://` relativa al manifiesto |

Una referencia `file://` relativa se carga desde el manifiesto que contiene la entrada y no puede escapar de su sistema de archivos. Los marcadores de entorno dentro de la fuente de plantilla resultante se conservan como texto de plantilla en lugar de resolverse mediante el sistema de entorno.

## Resolución de Plantillas

Las plantillas se referencian entre sí por nombre, no por ID de registro. Los nombres se resuelven dentro del conjunto:

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
    Hello {{ user }}!
```

Esta plantilla se registra como `welcome` en el conjunto, así que otras plantillas usan `{{ include "welcome" }}` o `{{ extends "welcome" }}`.

## Herencia

Las plantillas pueden extender plantillas padre y sobrescribir bloques:

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

## API Lua

Consulte el [módulo Template](../lua/text/template.md) para las operaciones de renderizado.

## Ver También

- [Módulo Template](../lua/text/template.md) - Referencia de la API Lua
- [Filesystem](./filesystem.md) - Carga de plantillas desde disco
- [HTTP Endpoint](../http/endpoint.md) - Renderizado de plantillas desde handlers de solicitudes
