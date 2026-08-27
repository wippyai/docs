---
title: "Bootloader"
description: "El modulo wippy/bootloader orquesta la inicializacion de la aplicacion descubriendo y ejecutando funciones de bootloader en un orden definido al…"
---

# Bootloader

El módulo `wippy/bootloader` descubre y ejecuta funciones de inicialización de la aplicación en un orden definido durante el arranque. Los módulos del framework usan bootloaders para tareas como configurar claves de cifrado y ejecutar migraciones de base de datos.

Esta página es una receta de integración parcial y una referencia de API, no una aplicación autónoma. La definición siguiente está completa estructuralmente, pero `apply_seed()` representa código de aplicación que debe implementar la operación real de seed y su comprobación de idempotencia. Cualquier limpieza o reversión persistente depende de esa operación específica de la aplicación.

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

Un bootloader es cualquier entrada `function.*` con `meta.type: bootloader`. La mayoría de bootloaders de aplicación usan `function.lua`:

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
| `meta.order` | No | Orden de ejecución (predeterminado `999`); el menor se ejecuta primero |
| `meta.description` | No | Resumen legible para humanos |
| `meta.requires` | No | Un ID o array de IDs de bootloader/servicio. Los bootloaders anteriores deben haber devuelto `success` o `skipped`; los servicios deben existir en el registro. Un requisito incumplido detiene la secuencia restante. |

El tipo de dependencia se determina a partir de la entrada referenciada del registro: `meta.type: bootloader` identifica un bootloader y las demás entradas resueltas se tratan como servicios. Si un ID no se puede resolver, el fallback trata un namespace con punto como ID de bootloader y otro ID calificado con dos puntos como servicio. La comprobación de servicio espera hasta 20 intentos de 500 ms, pero comprueba la presencia en el registro, no la salud en runtime.

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

Un bootloader que lanza un error Lua, devuelve un error de ejecución o retorna un valor que no es una tabla se convierte en un resultado `error`. El orquestador mide y sobrescribe `duration`; conserva un valor `details` devuelto para el logging.

Usa exactamente las tres cadenas de estado. Otro valor se registra como `UNKNOWN`, no se incluye en ningún contador y actualmente no detiene los bootloaders posteriores.

## Orden de Ejecucion

Los valores de `order` mas bajos se ejecutan primero. Reserva ordenes bajos para infraestructura:

| Order | Uso Tipico |
|-------|-------------|
| `10` | Secretos y claves de encriptacion (proporcionado por el modulo) |
| `20` | Migraciones de esquema (proporcionado por `wippy/migration`) |
| `50` | Sembrado de datos, calentamiento de indices de busqueda |
| `100` | Tareas a nivel de aplicación (convención) |

Cuando dos bootloaders comparten un orden, se ejecutan alfabéticamente por su ID de entrada totalmente calificado.

## Bootloaders Integrados

### Clave de Encriptacion (orden `10`)

Genera una `ENCRYPTION_KEY` de 256 bits y la almacena a traves del `env_storage` configurado si no hay valor presente. Otros modulos (seguridad, seguimiento de uso) leen esta variable para encriptacion de envoltura. Se omite cuando la variable ya existe.

### Bootloader de Migracion (orden `20`)

Proporcionado por `wippy/migration`. Descubre cada entrada con `meta.type: migration`, las agrupa por `meta.target_db` y aplica las pendientes. Ver [Migraciones](./migration.md).

## Observar el Estado de Arranque

El servicio registra el recuento descubierto y después una línea por bootloader ejecutado (`SUCCESS`, `FAILED`, `SKIPPED`) con el ID de entrada, el orden y la duración. El resumen final informa los recuentos ejecutados y por estado. Un fallo detiene los bootloaders posteriores y hace que el orquestador devuelva `false` con sus estadísticas; por sí mismo no lanza un error del proceso Lua.

<tip>
Mantén los bootloaders idempotentes. Se ejecutan de nuevo cada vez que se inicia otra vez `bootloader.service`, así que comprueba las precondiciones (fila existente, archivo presente, variable de entorno definida) antes de realizar el trabajo.
</tip>

## Ver Tambien

- [Migraciones](./migration.md) - Bootloader de migracion y DSL
- [Supervision](../guides/supervision.md) - Ciclo de vida del servicio y politica de reinicio
- [Vision General del Framework](./overview.md) - Uso de modulos del framework
