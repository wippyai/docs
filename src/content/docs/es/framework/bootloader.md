---
title: "Bootloader"
---

# Bootloader

El modulo `wippy/bootloader` orquesta la inicializacion de la aplicacion descubriendo y ejecutando funciones de bootloader en un orden definido al inicio. Otros modulos del framework (migraciones, encriptacion, refresco de indices) registran bootloaders para ejecutar sus propios pasos de inicializacion.

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/bootloader
wippy install
```

Declara la dependencia y el host de aplicacion requerido:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

El bootloader en si se ejecuta como `wippy.bootloader:bootloader.service` (un `process.service` con `auto_start: true`). No se requiere nada mas para activarlo.

## Como Funciona

Al inicio el bootloader:

1. Descubre cada entrada con `meta.type: bootloader` en el registro.
2. Las ordena por `meta.order` ascendente (la mas baja primero).
3. Ejecuta cada una secuencialmente como una funcion Lua.
4. Se detiene en el primer error que retorna `status = "error"`.
5. Reporta los conteos totales / exitosos / fallidos / omitidos al finalizar.

Los bootloaders son autonomos -- cada uno verifica sus propias condiciones, hace su trabajo y reporta un resultado estructurado.

## Definir un Bootloader

Un bootloader es cualquier entrada `function.lua` con `meta.type: bootloader`:

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| Campo | Requerido | Descripcion |
|-------|----------|-------------|
| `meta.type` | Si | Debe ser `bootloader` |
| `meta.order` | No | Orden de ejecucion (predeterminado `100`); el menor se ejecuta primero |
| `meta.description` | No | Resumen legible para humanos |
| `meta.requires` | No | Pistas de dependencia mostradas en los logs |

### Contrato de Retorno

El `method` retorna una tabla que describe el resultado:

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| Estado | Significado |
|--------|---------|
| `success` | Trabajo completado |
| `skipped` | Sin operacion (ya hecho, precondicion no cumplida) |
| `error` | Falla -- detiene la secuencia de arranque |

Un bootloader que lanza un error de Lua se trata como `error`.

## Orden de Ejecucion

Los valores de `order` mas bajos se ejecutan primero. Reserva ordenes bajos para infraestructura:

| Order | Uso Tipico |
|-------|-------------|
| `10` | Secretos y claves de encriptacion (proporcionado por el modulo) |
| `20` | Migraciones de esquema (proporcionado por `wippy/migration`) |
| `50` | Sembrado de datos, calentamiento de indices de busqueda |
| `100` | Predeterminado -- tareas a nivel de aplicacion |

Cuando dos bootloaders comparten un orden, el orden de ejecucion entre ellos no esta garantizado.

## Bootloaders Integrados

### Clave de Encriptacion (orden `10`)

Genera una `ENCRYPTION_KEY` de 256 bits y la almacena a traves del `env_storage` configurado si no hay valor presente. Otros modulos (seguridad, seguimiento de uso) leen esta variable para encriptacion de envoltura. Se omite cuando la variable ya existe.

### Bootloader de Migracion (orden `20`)

Proporcionado por `wippy/migration`. Descubre cada entrada con `meta.type: migration`, las agrupa por `meta.target_db` y aplica las pendientes. Ver [Migraciones](framework/migration.md).

## Observar el Estado de Arranque

El servicio registra una linea por bootloader (`SUCCESS`, `FAILED`, `SKIPPED`) con el ID de entrada, orden y duracion. La linea de resumen final reporta los conteos agregados. Un bootloader fallido aborta el inicio -- la politica de reinicio del supervisor entonces se aplica a `bootloader.service`.

<tip>
Manten los bootloaders idempotentes. Pueden ejecutarse de nuevo despues de un reinicio por crash, asi que verifica las precondiciones (fila existe, archivo presente, variable env establecida) antes de hacer el trabajo.
</tip>

## Ver Tambien

- [Migraciones](framework/migration.md) - Bootloader de migracion y DSL
- [Supervision](guides/supervision.md) - Ciclo de vida del servicio y politica de reinicio
- [Vision General del Framework](framework/overview.md) - Uso de modulos del framework
