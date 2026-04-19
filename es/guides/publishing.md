# Publicación de Módulos

Comparta código reutilizable en el Wippy Hub.

## Requisitos Previos

1. Cree una cuenta en [hub.wippy.ai](https://hub.wippy.ai)
2. Cree una organización o únase a una
3. Registre el nombre de su módulo bajo su organización

## Estructura del Módulo

```
mymodule/
├── wippy.yaml      # Manifiesto del módulo
├── src/
│   ├── _index.yaml # Definiciones de entradas
│   └── *.lua       # Archivos fuente
└── README.md       # Documentación (opcional)
```

## wippy.yaml

Manifiesto del módulo:

```yaml
organization: acme
module: http-utils
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `organization` | Sí | Nombre de su organización en el hub |
| `module` | Sí | Nombre del módulo |
| `description` | No | Descripción breve |
| `license` | No | Identificador SPDX (MIT, Apache-2.0) |
| `repository` | No | URL del repositorio fuente |
| `homepage` | No | Página principal del proyecto |
| `keywords` | No | Palabras clave de búsqueda |

## Definiciones de Entradas

Las entradas se definen en `_index.yaml`:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Dependencias

Declare dependencias de otros módulos:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

Restricciones de versión:

| Restricción | Significado |
|-------------|-------------|
| `*` | Cualquier versión |
| `1.0.0` | Versión exacta |
| `>=1.0.0` | Versión mínima |
| `^1.0.0` | Compatible (misma mayor) |

## Requisitos

Defina la configuración que los consumidores deben proporcionar:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Los targets especifican dónde se inyecta el valor:
- `entry` - ID completo de la entrada a configurar
- `path` - JSONPath para la inyección del valor

Los consumidores configuran mediante override. La bandera `-o` toma una tripleta `namespace:entry:field=value`:

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## Imports

Referencie otras entradas:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # Mismo namespace
    utils: acme.utils:helpers          # Namespace diferente
    base_registry: :registry           # Integrado
```

En Lua:

```lua
local client = require("client")
local utils = require("utils")
```

## Contratos

Defina interfaces públicas:

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## Flujo de Publicación

### 1. Autenticarse

```bash
wippy auth login
```

### 2. Preparar

```bash
wippy init
wippy update
wippy lint
```

### 3. Validar

```bash
wippy publish --dry-run
```

### 4. Publicar

```bash
wippy publish --version 1.0.0
```

Con notas de versión:

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### Banderas Adicionales

| Bandera | Descripción |
|---------|-------------|
| `--label <name>` | Publicar como etiqueta mutable (ej. `latest`, `beta`) en lugar de una versión inmutable |
| `--protected` | Marcar la versión publicada como protegida (no puede eliminarse ni sobrescribirse) |
| `--registry <url>` | Anular la URL del registro para esta publicación |
| `--config <dir>` | Directorio que contiene `wippy.yaml` (predeterminado: directorio actual) |

### Empaquetado de Archivos Estáticos

Los módulos con entradas `fs.directory` (assets estáticos, plantillas, archivos públicos) deben usar `--embed` para incluirlos en el paquete publicado. Sin él, las entradas `fs.directory` se excluyen.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

La bandera `--embed` acepta IDs de entrada o nombres que coincidan con entradas `fs.directory`. La misma bandera está disponible en `wippy pack`.

## Uso de Módulos Publicados

### Agregar Dependencia

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### Configurar Requisitos

Anular valores en tiempo de ejecución:

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

O en `.wippy.yaml`:

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### Importar en Su Código

```yaml
# su src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## Ejemplo Completo

**wippy.yaml:**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: "1000"

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

Publicar:

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## Véase También

- [Referencia CLI](guides/cli.md)
- [Tipos de Entrada](guides/entry-kinds.md)
- [Configuración](guides/configuration.md)
