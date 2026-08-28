---
title: "Hola mundo"
description: "Crea y ejecuta una API HTTP mínima de Wippy que devuelve JSON."
---

# Hola mundo

Crea una aplicación Wippy mínima con un endpoint HTTP que devuelve JSON.

**Clasificación:** tutorial ejecutable. Proporciona el registro y el código fuente Lua completos para una aplicación HTTP local, además de los comandos de inicio y verificación.

## Qué Estamos Construyendo

Una API web mínima con un endpoint:

```
GET /hello → {"message": "hello world"}
```

## Requisitos previos

- Entorno de ejecución Wippy `v0.3.32a` disponible como `wippy`. Confírmalo con `wippy version --short`.
- `curl` u otro cliente HTTP.
- Puerto 8080 disponible en el equipo local.

## Estructura del Proyecto

```
hello-world/
├── wippy.lock           # Generated lock file
└── src/
    ├── _index.yaml      # Entry definitions
    └── hello.lua        # Handler code
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
  # HTTP server
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

  # Handler function
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

La aplicación utiliza cuatro entradas:

1. `gateway` - Servidor HTTP escuchando en puerto 8080
2. `api` - Router adjunto a gateway vía `meta.server`
3. `hello` - Función Lua que maneja solicitudes
4. `hello.endpoint` - Enruta `GET /hello` a la función

## Paso 3: Código del Handler

Cree `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res, response_err = http.response()
    if response_err then
        error("cannot create response: " .. tostring(response_err))
    end

    local content_type_err = res:set_content_type(http.CONTENT.JSON)
    if content_type_err then
        error("cannot set content type: " .. tostring(content_type_err))
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then
        error("cannot set status: " .. tostring(status_err))
    end

    local write_err = res:write_json({message = "hello world"})
    if write_err then
        error("cannot write response: " .. tostring(write_err))
    end
end

return {
    handler = handler
}
```

El módulo `http` proporciona acceso a objetos de request/response. La función retorna una tabla con el método `handler` exportado.

## Paso 4: Inicializar y Ejecutar

```bash
# Generate lock file from source
wippy init

# Start the runtime (-c for colorful console output)
wippy run -c
```

`wippy init` escribe `wippy.lock`. Mantén `wippy run -c` en ejecución mientras pruebas el endpoint. El formato de los logs varía según la compilación, así que utiliza la respuesta HTTP que aparece a continuación como comprobación de disponibilidad.

## Paso 5: Probarlo

```bash
curl http://localhost:8080/hello
```

Respuesta esperada:

```json
{"message":"hello world"}
```

La solicitud debe devolver el estado HTTP 200 con `Content-Type: application/json`.

## Cómo Funciona

1. `gateway` acepta la conexión TCP en puerto 8080
2. `api` router matchea el prefijo de ruta `/`
3. `hello.endpoint` matchea `GET /hello`
4. La función `hello` se ejecuta y escribe respuesta JSON

## Referencia CLI

| Comando | Descripción |
|---------|-------------|
| `wippy init` | Crear `wippy.lock` usando `./src` como directorio de origen |
| `wippy run` | Iniciar runtime desde archivo lock |
| `wippy run -c` | Iniciar con salida de consola colorida |
| `wippy run -v` | Iniciar con logging de debug verboso |
| `wippy run -s` | Iniciar en modo silencioso (sin logs de consola) |

## Solución de problemas y limpieza

- Si `wippy init` no encuentra las entradas, ejecútalo desde `hello-world/` y comprueba que existe `src/_index.yaml`.
- Si el inicio indica que la dirección ya está en uso, detén el proceso que utiliza el puerto 8080 o cambia `addr` y la URL de prueba al mismo puerto libre.
- Una respuesta 404 suele indicar que la entrada del router o del endpoint difiere de las definiciones anteriores. Comprueba exactamente `meta.server`, `meta.router` y `/hello`.
- Pulsa Ctrl+C en el terminal del entorno de ejecución para detener la aplicación. Después de salir del directorio, elimina `hello-world/` si solo era un ejercicio desechable.

## Siguientes Pasos

- [Servicio Echo](tutorials/echo-service.md) — Crea un servicio CLI multiproceso
- [Cola de tareas](tutorials/task-queue.md) — Combina una API REST con procesamiento en segundo plano
- [Router HTTP](http/router.md) — Consulta los patrones de enrutamiento
