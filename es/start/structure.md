---
title: "YAML y Estructura del Proyecto"
description: "Organización del proyecto, archivos de definición YAML y convenciones de nomenclatura."
---

# YAML y Estructura del Proyecto

Organización del proyecto, archivos de definición YAML y convenciones de nomenclatura.

## Estructura de Directorios

```
myapp/
├── .wippy.yaml          # Configuración del runtime
├── wippy.lock           # Directorios fuente y módulos bloqueados
├── .wippy/              # Módulos instalados
└── src/                 # Código fuente de la aplicación
    ├── _index.yaml      # Definiciones de entradas
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

### Estructura del Archivo

Cualquier archivo YAML con un `namespace` más un array `entries` o un `name`+`kind` de nivel superior es un archivo de definición válido. `version` es opcional:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Obtiene usuario por ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: Endpoint de API de usuario
    method: GET
    path: /users/{id}
    func: get_user
```

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `version` | no | Versión del esquema (actualmente `"1.0"`) |
| `namespace` | sí | Namespace de entradas para este archivo |
| `entries` | sí | Array de definiciones de entradas |

### Convención de Nomenclatura

Use puntos (`.`) para separación semántica y guiones bajos (`_`) para palabras:

```yaml
# Función y su endpoint
- name: get_user              # La función
- name: get_user.endpoint     # Su endpoint HTTP

# Múltiples endpoints para la misma función
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Router de API pública
- name: api.admin             # Router de API admin
```

<tip>
Patrón: <code>nombre_base.variante</code> - los puntos separan partes semánticas, los guiones bajos separan palabras dentro de una parte.
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

### El Archivo de Bloqueo

`wippy.lock` registra de dónde Wippy carga las definiciones y qué versiones de módulos están seleccionadas:

```yaml
directories:
  modules: .wippy
  src: ./src
options:
  unpack_modules: false
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
```

| Campo | Descripción |
|-------|-------------|
| `directories.src` | Directorio fuente de la aplicación, escaneado recursivamente en busca de archivos YAML de definición |
| `directories.modules` | Directorio base para módulos vendorizados; los packs quedan en `<modules>/vendor/` |
| `options.unpack_modules` | Extrae cada `.wapp` en un directorio junto a él en lugar de cargar el pack directamente (por defecto `false`) |
| `modules[].name` | Identificador del módulo en forma `org/module` |
| `modules[].version` | Versión seleccionada |
| `modules[].hash` | Digest del artefacto con el que el pack vendorizado debe coincidir |
| `modules[].root` | Marca la raíz de despliegue seleccionada; como máximo un módulo puede llevarla |

Los packs vendorizados se conservan como archivos `.wapp`. Con `unpack_modules: true`, cada módulo también se extrae en un directorio, y el `.wapp` verificado permanece junto a él — la instalación busca el pack, así que un directorio cuyo pack falta se descarga de nuevo.

Una sección `replacements:` en `wippy.lock` está obsoleta. Todavía se carga, con una advertencia; declare las sustituciones de módulos locales bajo `workspace.replacements` en un archivo de configuración de runtime en su lugar. Consulte [Gestión de Dependencias](guides/dependency-management.md#local-development-with-replacements).

## Definiciones de Entrada

Cada entrada en el array `entries`. Las propiedades están al nivel raíz (sin envoltorio `data:`):

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Retorna hola mundo
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Endpoint hello
    method: GET
    path: /hello
    func: hello
```

### Metadatos

Use `meta` para información amigable para la UI:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Procesador de Pagos
    comment: Maneja pagos de Stripe
  source: file://payment.lua
```

Convención: `meta.title` y `meta.comment` se renderizan bien en interfaces de gestión.

### Entradas de Aplicación

Use el kind `registry.entry` para configuración a nivel de aplicación:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Configuración de Aplicación
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Tipos de Entrada Comunes

| Tipo | Propósito |
|------|---------|
| `registry.entry` | Datos de propósito general |
| `function.lua` | Función Lua invocable |
| `process.lua` | Proceso de larga duración |
| `http.service` | Servidor HTTP |
| `http.router` | Grupo de rutas |
| `http.endpoint` | Manejador HTTP |
| `process.host` | Supervisor de procesos |

Consulte la [Guía de Tipos de Entrada](guides/entry-kinds.md) para la referencia completa.

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

Consulte la [Guía de Configuración](guides/configuration.md) para todas las opciones.

### wippy.lock

Directorios fuente y el grafo de módulos seleccionado — consulte [El Archivo de Bloqueo](#the-lock-file) más arriba.

## Referenciando Entradas

Referencie entradas por ID completo o nombre relativo. Los hijos se vinculan a su padre a través de `meta`, no mediante listas del lado del padre:

```yaml
# El router se declara contra un servidor
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# El endpoint referencia al router por ID de registro (cross-namespace funciona igual)
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

- [Arquitectura de Aplicaciones](concepts/architecture.md) - Cómo dividir una app en slices y capas
- [Guía de Tipos de Entrada](guides/entry-kinds.md) - Tipos de entrada disponibles
- [Guía de Configuración](guides/configuration.md) - Opciones del runtime
- [Tipos de Entrada Personalizados](internals/kinds.md) - Implementar manejadores (avanzado)
