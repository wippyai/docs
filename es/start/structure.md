# YAML y Estructura del Proyecto

Organizacion del proyecto, archivos de definicion YAML y convenciones de nomenclatura.

## Estructura de Directorios

```
myapp/
├── .wippy.yaml          # Configuracion del runtime
├── wippy.lock           # Configuracion de directorios fuente
├── .wippy/              # Modulos instalados
└── src/                 # Codigo fuente de la aplicacion
    ├── _index.yaml      # Definiciones de entradas
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## Archivos de Definicion YAML

<note>
Las definiciones YAML se cargan en el registro al iniciar. El registro es la fuente de verdad - los archivos YAML son una forma de poblarlo. Las entradas tambien pueden provenir de otras fuentes o crearse programaticamente.
</note>

### Estructura del Archivo

Cualquier archivo YAML con `version` y `namespace` es valido:

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

| Campo | Requerido | Descripcion |
|-------|----------|-------------|
| `version` | si | Version del esquema (actualmente `"1.0"`) |
| `namespace` | si | Namespace de entradas para este archivo |
| `entries` | si | Array de definiciones de entradas |

### Convencion de Nomenclatura

Use puntos (`.`) para separacion semantica y guiones bajos (`_`) para palabras:

```yaml
# Funcion y su endpoint
- name: get_user              # La funcion
- name: get_user.endpoint     # Su endpoint HTTP

# Multiples endpoints para la misma funcion
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Router de API publica
- name: api.admin             # Router de API admin
```

<tip>
Patron: <code>nombre_base.variante</code> - los puntos separan partes semanticas, los guiones bajos separan palabras dentro de una parte.
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

El archivo `wippy.lock` define de donde Wippy carga las definiciones:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy escanea estos directorios recursivamente buscando archivos YAML.

## Definiciones de Entrada

Cada entrada en el array `entries`. Las propiedades estan al nivel raiz (sin envoltorio `data:`):

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

Use `meta` para informacion amigable para UI:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Procesador de Pagos
    comment: Maneja pagos de Stripe
  source: file://payment.lua
```

Convencion: `meta.title` y `meta.comment` se renderizan bien en interfaces de gestion.

### Entradas de Aplicacion

Use el kind `registry.entry` para configuracion a nivel de aplicacion:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Configuracion de Aplicacion
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Tipos de Entrada Comunes

| Tipo | Proposito |
|------|---------|
| `registry.entry` | Datos de proposito general |
| `function.lua` | Funcion Lua invocable |
| `process.lua` | Proceso de larga duracion |
| `http.service` | Servidor HTTP |
| `http.router` | Grupo de rutas |
| `http.endpoint` | Manejador HTTP |
| `process.host` | Supervisor de procesos |

Consulte la [Guia de Tipos de Entrada](guide-entry-kinds.md) para referencia completa.

## Archivos de Configuracion

### .wippy.yaml

Configuracion del runtime en la raiz del proyecto:

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

Consulte la [Guia de Configuracion](guide-configuration.md) para todas las opciones.

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

## Ver Tambien

- [Guia de Tipos de Entrada](guide-entry-kinds.md) - Tipos de entrada disponibles
- [Guia de Configuracion](guide-configuration.md) - Opciones del runtime
- [Tipos de Entrada Personalizados](internal-kinds.md) - Implementar manejadores (avanzado)
