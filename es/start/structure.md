# YAML y Estructura del Proyecto

Organización del proyecto, archivos de definición YAML y convenciones de nomenclatura.

## Estructura de Directorios

```
myapp/
├── .wippy.yaml          # Configuración del runtime
├── wippy.lock           # Configuración de directorios fuente
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

Cualquier archivo YAML con `version` y `namespace` es válido:

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
| `version` | sí | Versión del esquema (actualmente `"1.0"`) |
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

### Directorios Fuente

El archivo `wippy.lock` define de dónde Wippy carga las definiciones:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy escanea estos directorios recursivamente buscando archivos YAML.

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
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

Consulte la [Guía de Configuración](guides/configuration.md) para todas las opciones.

### wippy.lock

Define directorios fuente:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Referenciando Entradas

Referencie entradas por ID completo o nombre relativo:

```yaml
# ID completo (cross-namespace)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# Mismo namespace - solo use el nombre
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
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

- [Guía de Tipos de Entrada](guides/entry-kinds.md) - Tipos de entrada disponibles
- [Guía de Configuración](guides/configuration.md) - Opciones del runtime
- [Tipos de Entrada Personalizados](internals/kinds.md) - Implementar manejadores (avanzado)
