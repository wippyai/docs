---
title: "Sistema de Entorno"
description: "Gestiona variables de entorno a través de backends de almacenamiento configurables."
---

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
| `env.storage.static` | Almacenamiento estático de solo lectura clave-valor |
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

### Almacén Estático

Almacenamiento de solo lectura con valores definidos directamente en la configuración. Los valores se integran en la entrada y no pueden cambiarse en tiempo de ejecución. Útil para constantes de configuración públicas que se distribuyen con un módulo o paquete.

```yaml
- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    PUBLIC_WS_HOST: "wss://api.example.com/ws"
    APP_ENV: "production"
```

| Propiedad | Tipo | Descripción |
|----------|------|-------------|
| `values` | map | Pares clave-valor (string a string) |

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

## Interpolación de Placeholders

Las variables registradas se incorporan a la configuración de las entradas con placeholders `${env:NAME}`, resueltos centralmente en el momento de la decodificación contra este registro. Cualquier campo string en los datos de una entrada puede referenciar una variable de esta forma.

| Sintaxis | Significado |
|----------|-------------|
| `${env:NAME}` | Resuelve `NAME` a través del registro env; error si no está definida y no hay valor por defecto |
| `${env:NAME\|default}` | Resuelve `NAME`, recurriendo a `default` cuando no está definida |
| `${NAME\|default}` | Forma abreviada; `NAME` debe ser upper-snake (`A-Z0-9_`) y el `\|default` es obligatorio — un `${VAR}` simple se deja intacto para que los fragmentos de shell/plantillas incrustados no se confundan con referencias |
| `$${` | `${` literal (escape) |

`NAME` es el nombre público de una variable registrada o su ID de entrada (forma de id de registro con puntos/dos puntos, ej. `app.env:tls_cert`). **No** es una variable de entorno cruda del SO: un valor del SO solo es alcanzable cuando una variable respaldada por `env.storage.os` está registrada bajo ese nombre.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

Un campo cuyo valor completo es un único placeholder toma el valor tipado de la variable (convertido a bool/int/float cuando se da un valor por defecto tipado); un placeholder mezclado con texto circundante se interpola en un string. El `default` propio de la variable se respeta antes que el `|default` en línea del placeholder. Una referencia que no resuelve a nada y no tiene valor por defecto hace fallar la decodificación.

La resolución ocurre solo en el momento de la decodificación: la entrada almacenada en el registro conserva los placeholders sin resolver, de modo que los secretos resueltos nunca aparecen en los resultados de `registry.get` ni en el estado persistido. Las entradas que referencian `${env:...}` se ordenan automáticamente en el arranque después de los almacenes env y las variables de las que dependen.

<note>
Las configuraciones antiguas usan una directiva hermana <code>&lt;field&gt;_env</code> (por ejemplo <code>cert_env: app.env:tls_cert</code>) que se resuelve de la misma forma. Esta forma está <b>deprecada</b> — migrala al placeholder <code>${env:NAME}</code>. Una clave <code>&lt;field&gt;_env</code> que nombra una variable no registrada no se trata como directiva y se deja tal cual; una que nombra una variable registrada pero vacía conserva el valor en línea de <code>&lt;field&gt;</code>. Solo un <code>${env:NAME}</code> explícito sin valor por defecto falla de forma estricta ante una variable ausente.
</note>

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
