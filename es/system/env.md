# Sistema de Entorno

Gestiona variables de entorno a través de backends de almacenamiento configurables.

## Visión General

El sistema de entorno separa el almacenamiento del acceso:

- **Almacenes** - Donde se guardan los valores (SO, archivos, memoria)
- **Variables** - Referencias nombradas a valores en almacenes

Las variables pueden referenciarse por:
- **Nombre público** - El valor del campo `variable` (debe ser único en el sistema)
- **ID de Entrada** - Referencia completa `namespace:nombre`

Si no desea que una variable sea accesible públicamente por nombre, omita el campo `variable`.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `env.storage.memory` | Almacenamiento clave-valor en memoria |
| `env.storage.file` | Almacenamiento basado en archivo (formato .env) |
| `env.storage.os` | Acceso de solo lectura al entorno del SO |
| `env.storage.router` | Encadena múltiples almacenes |
| `env.variable` | Variable nombrada referenciando un almacén |

## Backends de Almacenamiento

### Almacén de Memoria

Almacenamiento volátil en memoria.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### Almacén de Archivo

Almacenamiento persistente usando formato de archivo `.env` (`KEY=VALUE` con comentarios `#`).

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| Propiedad | Tipo | Por Defecto | Descripción |
|----------|------|---------|-------------|
| `file_path` | string | requerido | Ruta al archivo .env |
| `auto_create` | boolean | false | Crear archivo si no existe |
| `file_mode` | integer | 0644 | Permisos de archivo |
| `dir_mode` | integer | 0755 | Permisos de directorio |

### Almacén del SO

Acceso de solo lectura a variables de entorno del sistema operativo.

```yaml
- name: os_env
  kind: env.storage.os
```

Siempre de solo lectura. Las operaciones de escritura retornan `PERMISSION_DENIED`.

### Almacén Router

Encadena múltiples almacenes. Las lecturas buscan en orden hasta encontrar. Las escrituras van solo al primer almacén.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primario (escribe aquí)
    - app.config:file      # Respaldo
    - app.config:os        # Respaldo
```

| Propiedad | Tipo | Descripción |
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

| Propiedad | Tipo | Descripción |
|----------|------|-------------|
| `variable` | string | Nombre de variable pública (opcional, debe ser único) |
| `storage` | string | Referencia de almacén (`namespace:nombre`) |
| `default` | string | Valor por defecto si no se encuentra |
| `read_only` | boolean | Prevenir modificaciones |

### Nomenclatura de Variables

Los nombres de variables deben contener solo: `a-z`, `A-Z`, `0-9`, `_`

### Patrones de Acceso

```yaml
# Variable pública - accesible por nombre "PORT"
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

| Condición | Tipo | Reintentable |
|-----------|------|-----------|
| Variable no encontrada | `errors.NOT_FOUND` | no |
| Almacén no encontrado | `errors.NOT_FOUND` | no |
| Variable es de solo lectura | `errors.PERMISSION_DENIED` | no |
| Almacén es de solo lectura | `errors.PERMISSION_DENIED` | no |
| Nombre de variable inválido | `errors.INVALID` | no |

## Acceso en Tiempo de Ejecución

- [módulo env](lua/system/env.md) - Acceso en tiempo de ejecución Lua

## Ver También

- [Modelo de Seguridad](system/security.md) - Control de acceso para variables de entorno
- [Guía de Configuración](guides/configuration.md) - Patrones de configuración de aplicación
