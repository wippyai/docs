---
title: "YAML y Estructura del Proyecto"
description: "Organización del proyecto, archivos de definición YAML y convenciones de nomenclatura."
---

# YAML y Estructura del Proyecto

## Estructura de Directorios

```
myapp/
├── .wippy.yaml          # Runtime configuration
├── wippy.lock           # Source directories config
├── .wippy/              # Installed modules
└── src/                 # Application source
    ├── _index.yaml      # Entry definitions
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## Archivos de Definición YAML

<note>
Las definiciones YAML se cargan en el registro al iniciar. El registro es la fuente de verdad; los archivos YAML son una forma de poblarlo. Las entradas también pueden provenir de otras fuentes o crearse programáticamente.
</note>

### Formato del archivo de definición

Un archivo de definición contiene un `namespace` y, o bien un array `entries`, o bien los campos de nivel superior `name` y `kind`. El marcador opcional `version` usa por convención el valor `"1.0"`; el cargador de v0.3.32a no lo exige.

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Fetches user by ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: User API endpoint
    method: GET
    path: /users/{id}
    func: get_user
```

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `version` | No | Marcador de versión del manifiesto (por convención `"1.0"`) |
| `namespace` | Sí | Namespace de entradas para este archivo |
| `entries` | Condicional | Array de definiciones de entradas; se omite únicamente cuando se usan `name` y `kind` en el nivel superior |

### Convención de Nomenclatura

Use puntos (`.`) para separación semántica y guiones bajos (`_`) para palabras:

```yaml
# Function and its endpoint
- name: get_user              # The function
- name: get_user.endpoint     # Its HTTP endpoint

# Multiple endpoints for same function
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Public API router
- name: api.admin             # Admin API router
```

<tip>
Patrón: <code>base_name.variant</code> — los puntos separan partes semánticas, mientras que los guiones bajos separan palabras dentro de una parte.
</tip>

### Namespaces

Los namespaces son identificadores separados por puntos:

```
app
app.api
app.api.v2
app.workers
```

El ID completo de entrada combina namespace y nombre: `app.api:get_user`

### Directorios Fuente

El archivo `wippy.lock` nombra la raíz de código fuente de la aplicación y el directorio base usado para resolver módulos bloqueados:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy añade `directories.src` como ruta de carga de la aplicación. `directories.modules` no se escanea como un único árbol de código fuente sin procesar: cada módulo bloqueado se resuelve a su archivo `.wapp` versionado o a una ruta de módulo desempaquetado, y cada replacement se resuelve a su raíz de entradas configurada. El cargador escanea recursivamente el código fuente de la aplicación y las raíces seleccionadas de módulos o replacements basados en directorios en busca de manifiestos `.yaml`, `.yml` y `.json`; los módulos `.wapp` se leen como archivos. Solo los archivos con forma de objeto y un `namespace` se tratan como manifiestos del registro, y se omiten los directorios `node_modules`. `_index.yaml` es una convención del proyecto, no el único nombre de archivo aceptado.

## Definiciones de Entrada

Cada elemento del array `entries` define una entrada. Los campos específicos del kind pueden aparecer junto a `name`, `kind` y `meta`, como en este ejemplo:

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Returns hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello endpoint
    method: GET
    path: /hello
    func: hello
```

También se admite un campo `data:` explícito. Cuando está presente, su valor es la carga útil completa específica del kind, por lo que no debes mezclarlo con campos específicos del kind al mismo nivel:

```yaml
entries:
  - name: config
    kind: registry.entry
    data:
      environment: production
      features:
        dark_mode: true
```

### Metadatos

Use `meta` para información amigable para la UI:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Payment Processor
    comment: Handles Stripe payments
  source: file://payment.lua
```

Usa `meta.title` y `meta.comment` para información descriptiva que puedan mostrar los consumidores del registro y las interfaces de gestión.

### Entradas de Aplicación

Use el kind `registry.entry` para configuración a nivel de aplicación:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Application Settings
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Tipos de Entrada Comunes

| Tipo | Propósito |
|------|---------|
| `registry.entry` | Datos de propósito general almacenados sin el despacho normal de eventos |
| `function.lua` | Función Lua invocable |
| `process.lua` | Proceso de larga duración |
| `http.service` | Servidor HTTP |
| `http.router` | Grupo de rutas |
| `http.endpoint` | Manejador HTTP |
| `process.host` | Host de ejecución de procesos |

Consulta la [Guía de tipos de entrada](../guides/entry-kinds.md) para la referencia de tipos de entrada.

## Archivos de Configuración

### .wippy.yaml

Configuración del runtime en la raíz del proyecto:

```yaml
version: "1.0"

logger:
  encoding: json

logmanager:
  min_level: 0

supervisor:
  host:
    worker_count: 16
```

Consulta la [Guía de configuración](../guides/configuration.md) para los campos de configuración del runtime.

### wippy.lock

Define directorios fuente:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Referenciando Entradas

Referencia las entradas por ID completo o nombre relativo cuando el kind de entrada lo permita. Los routers HTTP y endpoints se adjuntan mediante `meta.server` y `meta.router`, no mediante listas de hijos en el padre:

```yaml
# Router declares itself against a server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpoint references router by registry ID (cross-namespace works the same way)
- name: get_user.endpoint
  kind: http.endpoint
  meta:
    router: app.api:api
  method: GET
  path: /users/{id}
  func: app.api:get_user
```

## Proyecto de Ejemplo

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## Ver También

- [Arquitectura de aplicaciones](../concepts/architecture.md) — organiza una aplicación en slices y capas
- [Guía de tipos de entrada](../guides/entry-kinds.md) — revisa los tipos de entrada disponibles
- [Guía de configuración](../guides/configuration.md) — configura las opciones del runtime
- [Tipos de entrada personalizados](../internals/kinds.md) — implementa handlers (avanzado)
