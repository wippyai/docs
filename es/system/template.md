# Motor de Plantillas
<secondary-label ref="external"/>

Renderizado de plantillas usando [CloudyKit Jet](https://github.com/CloudyKit/jet).

## Tipos de Entrada

| Tipo | Descripcion |
|------|-------------|
| `template.set` | Conjunto de plantillas con configuracion compartida |
| `template.jet` | Plantilla individual |

## Conjuntos de Plantillas

Un conjunto es un namespace que contiene plantillas relacionadas. Las plantillas dentro de un conjunto comparten configuracion y pueden referenciarse entre si por nombre.

```yaml
- name: views
  kind: template.set
```

Toda la configuracion es opcional con valores por defecto sensatos:

| Campo | Tipo | Por Defecto | Descripcion |
|-------|------|---------|-------------|
| `engine.development_mode` | bool | false | Deshabilitar cache de plantillas |
| `engine.delimiters.left` | string | `{{` | Delimitador de apertura de variable |
| `engine.delimiters.right` | string | `}}` | Delimitador de cierre de variable |
| `engine.globals` | map | - | Variables disponibles para todas las plantillas |

## Plantillas

Las plantillas pertenecen a un conjunto y se identifican por nombre para resolucion interna.

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

| Campo | Tipo | Requerido | Descripcion |
|-------|------|----------|-------------|
| `set` | referencia | Si | Conjunto de plantillas padre |
| `source` | string | Si | Contenido de la plantilla |

## Resolucion de Plantillas

Las plantillas se referencian entre si usando nombres, no IDs de registro. La resolucion funciona como un sistema de archivos virtual dentro del conjunto:

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

Esta plantilla se registra como `welcome` en el conjunto, asi que otras plantillas usan `{{ include "welcome" }}` o `{{ extends "welcome" }}`.

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
    {{ block title() }}Mi Pagina{{ end }}
    {{ block body() }}<p>Contenido aqui</p>{{ end }}
```

## API Lua

Ver [Modulo Template](lua-template.md) para operaciones de renderizado.
