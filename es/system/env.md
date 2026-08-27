---
title: "Sistema de Entorno"
description: "Defina variables de entorno respaldadas por memoria, archivos, el sistema operativo, valores estáticos o routers de almacenamiento."
---

# Sistema de Entorno

Las entradas de entorno permiten que el código en tiempo de ejecución consulte configuración por el nombre público de una variable o por el ID de su entrada de registro.

Esta página es una referencia de configuración. Sus fences YAML son fragmentos de entradas salvo cuando muestran un documento contenedor.

## Almacenamiento y acceso

El sistema de entorno separa el almacenamiento del acceso:

- **Almacenes** - Donde se guardan los valores (SO, archivos, memoria)
- **Variables** - Referencias nombradas a valores en almacenes

Las variables pueden referenciarse por:
- **Nombre público** - El valor del campo `variable`
- **ID de Entrada** - Referencia completa `namespace:name`

Omita el campo `variable` cuando solo se deba acceder a una variable mediante su ID de entrada. La primera variable que reclama un nombre público conserva ese acceso abreviado. Una variable posterior con el mismo nombre público también se registra y sigue siendo accesible por su ID de entrada, pero no reemplaza el acceso abreviado existente.

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

Almacenamiento persistente con un formato sencillo `KEY=VALUE`. Se ignoran las líneas vacías y las que comienzan por `#`; el texto posterior a `#` en una línea de valor se trata como comentario. Los valores entre comillas y las secuencias de escape no reciben un análisis especial.

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

Un router encadena varios almacenes. Cuando no encuentra un valor, las lecturas los recorren en orden hasta hallarlo; el router almacena en caché el valor encontrado, por lo que los cambios directos posteriores en un almacén de respaldo dejan de ser visibles a través de ese router. Un error distinto de `NOT_FOUND` detiene la búsqueda alternativa. Las escrituras se dirigen únicamente al primer almacén.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primary (writes here)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| Propiedad | Tipo | Descripción |
|----------|------|-------------|
| `storages` | array | Lista ordenada, obligatoria y no vacía, de referencias de almacenes |

## Variables

Las variables asignan nombres públicos o ID de entradas a valores de un backend de almacenamiento.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  readonly: false
```

| Propiedad | Tipo | Descripción |
|----------|------|-------------|
| `variable` | string | Nombre público opcional de la variable |
| `storage` | string | Referencia obligatoria al almacén (`namespace:name`) |
| `default` | string | Valor por defecto si no se encuentra |
| `readonly` | boolean | Impedir modificaciones |

### Nomenclatura de Variables

Los nombres de variables deben contener solo: `a-z`, `A-Z`, `0-9`, `_`

### Patrones de Acceso

```yaml
# Public variable - accessible by name "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Private variable - accessible only by ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## Interpolación de Placeholders

Las variables registradas se incorporan a la configuración de las entradas con marcadores `${env:NAME}`, resueltos de forma central al decodificar contra este registro. Las cadenas de configuración se resuelven salvo cuando el tipo de entrada marca un campo como opaco. Los campos de fuente, como `template.jet.source`, son opacos para que el texto de plantillas o programas no se reescriba.

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

Un campo cuyo valor completo sea un único marcador adopta el tipo de su valor predeterminado en línea. Por ejemplo, `${env:PORT|8080}` produce un entero y convierte un valor almacenado a entero, mientras que `${env:PORT|"8080"}` sigue siendo una cadena. Un marcador mezclado con texto circundante siempre produce una cadena. El `default` propio de la variable se respeta antes que el `|default` en línea del marcador. Una referencia que no resuelve ningún valor y carece de valor predeterminado hace fallar la decodificación.

La resolución ocurre solo en el momento de la decodificación: la entrada almacenada en el registro conserva los placeholders sin resolver, de modo que los secretos resueltos nunca aparecen en los resultados de `registry.get` ni en el estado persistido. Las entradas que referencian `${env:...}` se ordenan automáticamente en el arranque después de los almacenes env y las variables de las que dependen.

<note>
Las configuraciones antiguas usan una directiva hermana <code>&lt;field&gt;_env</code> (por ejemplo <code>cert_env: app.env:tls_cert</code>) que se resuelve de la misma forma. Esta forma está <b>obsoleta</b>: mígrela al marcador <code>${env:NAME}</code>. Una clave <code>&lt;field&gt;_env</code> que nombra una variable no registrada no se trata como directiva y se deja tal cual; una que nombra una variable registrada pero vacía conserva el valor en línea de <code>&lt;field&gt;</code>. Solo un <code>${env:NAME}</code> explícito sin valor predeterminado falla de forma estricta ante una variable ausente.
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

- [Módulo env](../lua/system/env.md) - Acceso en tiempo de ejecución Lua

## Ver También

- [Modelo de seguridad](./security.md) - Control de acceso para variables de entorno
- [Guía de configuración](../guides/configuration.md) - Patrones de configuración de aplicaciones
