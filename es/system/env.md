# Sistema de Entorno

Gestiona variables de entorno a traves de backends de almacenamiento configurables.

## Vision General

El sistema de entorno separa el almacenamiento del acceso:

- **Almacenes** - Donde se guardan los valores (SO, archivos, memoria)
- **Variables** - Referencias nombradas a valores en almacenes

Las variables pueden referenciarse por:
- **Nombre publico** - El valor del campo `variable` (debe ser unico en el sistema)
- **ID de Entrada** - Referencia completa `namespace:nombre`

Si no desea que una variable sea accesible publicamente por nombre, omita el campo `variable`.

## Tipos de Entrada

| Tipo | Descripcion |
|------|-------------|
| `env.storage.memory` | Almacenamiento clave-valor en memoria |
| `env.storage.file` | Almacenamiento basado en archivo (formato .env) |
| `env.storage.os` | Acceso de solo lectura al entorno del SO |
| `env.storage.router` | Encadena multiples almacenes |
| `env.variable` | Variable nombrada referenciando un almacen |

## Backends de Almacenamiento

### Almacen de Memoria

Almacenamiento volatil en memoria.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### Almacen de Archivo

Almacenamiento persistente usando formato de archivo `.env` (`KEY=VALUE` con comentarios `#`).

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| Propiedad | Tipo | Por Defecto | Descripcion |
|----------|------|---------|-------------|
| `file_path` | string | requerido | Ruta al archivo .env |
| `auto_create` | boolean | false | Crear archivo si no existe |
| `file_mode` | integer | 0644 | Permisos de archivo |
| `dir_mode` | integer | 0755 | Permisos de directorio |

### Almacen del SO

Acceso de solo lectura a variables de entorno del sistema operativo.

```yaml
- name: os_env
  kind: env.storage.os
```

Siempre de solo lectura. Las operaciones de escritura retornan `PERMISSION_DENIED`.

### Almacen Router

Encadena multiples almacenes. Las lecturas buscan en orden hasta encontrar. Las escrituras van solo al primer almacen.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primario (escribe aqui)
    - app.config:file      # Respaldo
    - app.config:os        # Respaldo
```

| Propiedad | Tipo | Descripcion |
|----------|------|-------------|
| `storages` | array | Lista ordenada de referencias de almacenes |

## Variables

Las variables proporcionan acceso nombrado a valores de almacenes.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| Propiedad | Tipo | Descripcion |
|----------|------|-------------|
| `variable` | string | Nombre de variable publica (opcional, debe ser unico) |
| `storage` | string | Referencia de almacen (`namespace:nombre`) |
| `default` | string | Valor por defecto si no se encuentra |
| `read_only` | boolean | Prevenir modificaciones |

### Nomenclatura de Variables

Los nombres de variables deben contener solo: `a-z`, `A-Z`, `0-9`, `_`

### Patrones de Acceso

```yaml
# Variable publica - accesible por nombre "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Variable privada - accesible solo por ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|-----------|
| Variable no encontrada | `errors.NOT_FOUND` | no |
| Almacen no encontrado | `errors.NOT_FOUND` | no |
| Variable es de solo lectura | `errors.PERMISSION_DENIED` | no |
| Almacen es de solo lectura | `errors.PERMISSION_DENIED` | no |
| Nombre de variable invalido | `errors.INVALID` | no |

## Acceso en Tiempo de Ejecucion

- [modulo env](lua-env.md) - Acceso en tiempo de ejecucion Lua

## Ver Tambien

- [Modelo de Seguridad](system-security.md) - Control de acceso para variables de entorno
- [Guia de Configuracion](guide-configuration.md) - Patrones de configuracion de aplicacion
