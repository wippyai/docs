---
title: "Hello World"
---

# Hello World

Su primera aplicación Wippy: una API HTTP simple que retorna JSON.

## Qué Estamos Construyendo

Una API web mínima con un endpoint:

```
GET /hello → {"message": "hello world"}
```

## Estructura del Proyecto

```
hello-world/
├── wippy.lock           # Archivo lock generado
└── src/
    ├── _index.yaml      # Definiciones de entradas
    └── hello.lua        # Código del handler
```

## Paso 1: Crear Directorio del Proyecto

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Paso 2: Definiciones de Entradas

Cree `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Servidor HTTP
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /

  # Función handler
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Endpoint
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: app:hello
    path: /hello
```

**Cuatro entradas trabajan juntas:**

1. `gateway` - Servidor HTTP escuchando en puerto 8080
2. `api` - Router adjunto a gateway vía `meta.server`
3. `hello` - Función Lua que maneja solicitudes
4. `hello.endpoint` - Enruta `GET /hello` a la función

## Paso 3: Código del Handler

Cree `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

El módulo `http` proporciona acceso a objetos de request/response. La función retorna una tabla con el método `handler` exportado.

## Paso 4: Inicializar y Ejecutar

```bash
# Generar archivo lock desde fuente
wippy init

# Iniciar el runtime (-c para salida de consola colorida)
wippy run -c
```

Verá salida como:

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## Paso 5: Probarlo

```bash
curl http://localhost:8080/hello
```

Respuesta:

```json
{"message":"hello world"}
```

## Cómo Funciona

1. `gateway` acepta la conexión TCP en puerto 8080
2. `api` router matchea el prefijo de ruta `/`
3. `hello.endpoint` matchea `GET /hello`
4. La función `hello` se ejecuta y escribe respuesta JSON

## Referencia CLI

| Comando | Descripción |
|---------|-------------|
| `wippy init` | Generar archivo lock desde `src/` |
| `wippy run` | Iniciar runtime desde archivo lock |
| `wippy run -c` | Iniciar con salida de consola colorida |
| `wippy run -v` | Iniciar con logging de debug verboso |
| `wippy run -s` | Iniciar en modo silencioso (sin logs de consola) |

## Siguientes Pasos

- [Echo Service](tutorials/echo-service.md) - Manejar parámetros de solicitud
- [Task Queue](tutorials/task-queue.md) - API REST con procesamiento en background
- [HTTP Router](http/router.md) - Patrones de routing
