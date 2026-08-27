---
title: "Publicación de Módulos"
description: "Comparta código reutilizable en el Wippy Hub."
---

# Publicación de Módulos

La publicación empaqueta un módulo y hace que una versión o etiqueta mutable esté disponible mediante Wippy Hub.

Este documento es un flujo de publicación y una referencia. Los módulos `acme/*`, las URL, los tokens, las credenciales y el código fuente de ejemplo son ilustrativos; sustitúyelos por recursos que pertenezcan a tu organización.

## Requisitos Previos

1. Crea una cuenta en [hub.wippy.ai](https://hub.wippy.ai).
2. Crea una organización o únete a una.
3. Elige un nombre de módulo. La primera publicación puede registrar un nombre ausente si tu cuenta tiene permiso; usa `--create` para registrarlo antes de la carga y definir sus propiedades explícitamente.

## Estructura del Módulo

```
mymodule/
├── wippy.yaml      # Module manifest
├── src/
│   ├── _index.yaml # Entry definitions
│   └── *.lua       # Source files
└── README.md       # Documentation (optional)
```

## wippy.yaml

Define los metadatos del módulo en `wippy.yaml`:

```yaml
organization: acme
module: http-utils
type: library
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
| `type` | No | Tipo de módulo: `library`, `application`, `agent` o `plugin` |
| `description` | No | Descripción breve |
| `license` | No | Identificador SPDX (MIT, Apache-2.0) |
| `repository` | No | URL del repositorio fuente |
| `homepage` | No | Página principal del proyecto |
| `keywords` | No | Palabras clave de búsqueda |

`type` es la fuente de verdad de cómo el hub clasifica el módulo y puede cambiarse en una publicación posterior; `--module-type` lo sobrescribe para una única publicación. Cuando se omite, los módulos recién creados usan `application` por defecto con una advertencia de deprecación.

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
    readme: file://README.md
    wiki:
      GUIDE.md: file://docs/GUIDE.md
      examples/auth.md: file://docs/auth.md

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

El mapa `wiki:` en `ns.definition` publica páginas de documentación adicionales junto al readme: las claves son rutas de página, los valores son referencias `file://`. Los contenidos se incrustan en el momento del empaquetado y el hub los sirve como una wiki navegable por módulo.

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

`default` acepta cualquier tipo escalar — `default: 20` fluye hacia un target numérico como número, no como cadena. Lo mismo aplica a `parameters[].value` en entradas `ns.dependency`, y ambos aceptan referencias `${env:NAME}`, transportadas literalmente y resueltas cuando la entrada de destino se decodifica.

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
    client: acme.http:client           # Same namespace
    utils: acme.utils:helpers          # Different namespace
    base_registry: :registry           # Built-in
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
| `--create` | Registrar el módulo en el hub si aún no existe, luego publicar |
| `--module-visibility <v>` | Visibilidad para `--create`: `private` (predeterminado) o `public` |
| `--module-type <t>` | Tipo de módulo: `library`, `application`, `agent` o `plugin` (sobrescribe `type:` en wippy.yaml) |
| `--module-display-name <n>` | Nombre visible para `--create` |

### Empaquetado de Archivos Estáticos

Selecciona una entrada `fs.directory` para incrustarla mediante `--embed` o mediante la lista persistente `embed:` del manifiesto del proyecto. Las entradas seleccionadas se transforman en recursos `fs.embed`. Una entrada `fs.directory` no seleccionada permanece en el pack, pero no se incluye el contenido del directorio al que hace referencia.

```yaml
# wippy.yaml
embed:
  - app:public_files
  - app:assets
```

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

La lista del manifiesto y la bandera `--embed` aceptan IDs de entrada o nombres que coincidan con entradas `fs.directory`. La bandera puede repetirse y cada valor puede ser una lista separada por comas. La misma bandera de CLI está disponible en `wippy pack`; una selección explícita mediante CLI sustituye la lista del manifiesto para esa invocación.

### Primera Publicación

La primera vez que publicas un módulo se registra en el hub automáticamente (privado por defecto) y la publicación se reintenta una vez. Pasa `--create` para registrarlo de antemano y establecer sus propiedades:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` es idempotente — para un módulo ya registrado, el paso de creación no hace nada. Si tu cuenta no puede crear módulos en la organización, el hub devuelve un error de permiso en lugar de publicar.

### Publicar en un Hub Local

Apunta `--registry` a un hub que se ejecute localmente para publicar e instalar sin el registro público. Se permite HTTP plano solo para hosts locales — `localhost`, `127.0.0.1` y los alias de contenedor `host.docker.internal` (Docker Desktop / OrbStack) y `host.containers.internal` (Podman); cualquier otro host debe usar HTTPS.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

El registro y el token también pueden provenir de las variables de entorno `WIPPY_REGISTRY` y `WIPPY_TOKEN`. Cuando no se establecen, el registro toma por defecto `https://hub.wippy.ai`.

### Cuotas

Si la cuota de módulos privados de la organización está agotada, la publicación falla con un mensaje como `cannot publish: Private-module quota exhausted (5 of 5)...`. Haz el módulo público o pide a un administrador de la organización que aumente la cuota. Las cargas y descargas se reintentan automáticamente ante errores de red transitorios.

## Publicar Valores por Defecto de Runtime {#publishing-runtime-defaults}

Las aplicaciones (solo `type: application`) pueden distribuir valores por defecto de configuración de runtime dentro de sus packs mediante `publish.runtime` en `wippy.yaml`:

```yaml
type: application
publish:
  runtime:
    source: .wippy.yaml            # default: .wippy.yaml
    sections: [security, registry, override]
    vars: [public_url]
```

| Campo | Descripción |
|-------|-------------|
| `source` | Archivo de configuración del que se leen las secciones (por defecto: `.wippy.yaml`) |
| `sections` | Secciones de configuración de runtime copiadas a los metadatos del pack como valores por defecto |
| `vars` | Lista explícita de variables a empaquetar incluso cuando no se referencian |

Reglas:

- Solo se empaquetan las variables referenciadas por las secciones seleccionadas o los perfiles publicados (seguidas transitivamente); todo lo demás necesita una entrada en `vars`.
- Las referencias `${env:...}` en la configuración exportada se rechazan — el entorno del publicador nunca se filtra a un pack.
- Las secciones locales de máquina `boot`, `extensions` y `workspace` no pueden exportarse.
- Solo el pack de la aplicación principal proporciona valores por defecto de runtime del host; los metadatos de runtime en los packs de dependencias se ignoran.

En el destino, la configuración se aplica de menor a mayor: valores por defecto del pack de la app, valores por defecto integrados del runtime, archivos de configuración locales, perfiles seleccionados, sobrescrituras de CLI.

## Publicar Perfiles {#publishing-profiles}

Los perfiles de la aplicación raíz se exportan a los metadatos `runtime.profiles` del pack. Publicar no selecciona ni fija un perfil — los consumidores eligen uno en tiempo de ejecución con `wippy run --profile <name>`:

```yaml
publish:
  profiles:
    enabled: true
    source: config/profiles.yaml   # default: .wippy.yaml
    include: [production]          # omit to publish all non-workspace profiles
```

`include: []` no publica ninguno; un nombre desconocido hace fallar la publicación. Las subsecciones `workspace` nunca se exportan, ni siquiera dentro de un perfil publicado. Ver [Configuración](./configuration.md#profiles) para declarar perfiles.

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
# your src/_index.yaml
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
type: library
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

  - name: cache
    kind: library.lua
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}

function cache.set(key, value, ttl)
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
wippy init
wippy update
wippy lint
wippy publish --version 1.0.0
```

## Véase También

- [Referencia CLI](./cli.md)
- [Tipos de Entrada](./entry-kinds.md)
- [Configuración](./configuration.md)
