---
title: "Archivos estáticos"
description: "Sirve SPA, recursos y cargas de usuarios desde entradas de sistema de archivos con http.static."
---

# Archivos estáticos

Un handler `http.static` se monta directamente en un servidor y sirve SPA, recursos o cargas de usuarios desde una entrada de sistema de archivos.

**Clasificación: referencia de handler estático.** Los bloques YAML suponen que existe el servidor HTTP indicado. En estos ejemplos creados por el host, las rutas relativas de `fs.directory` se resuelven desde el directorio de trabajo del proyecto. Las entradas propiedad de un módulo resuelven en cambio las rutas relativas desde la raíz de origen del módulo propietario, salvo que se configuren con `base: project`. Los archivos referenciados deben crearse por separado.

## Configuración

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  static_options:
    spa: true
    index: index.html
    cache: "public, max-age=3600"
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `meta.server` | ID de Registro | Servidor HTTP padre |
| `path` | string | Ruta de montaje URL (debe comenzar con `/`) |
| `fs` | ID de Registro | Entrada de filesystem desde donde servir |
| `static_options.spa` | bool | Modo SPA - servir index para rutas no matcheadas |
| `static_options.index` | string | Archivo índice (obligatorio cuando `spa=true`) |
| `static_options.cache` | string | Valor del header Cache-Control |
| `middleware` | []string | Cadena de middleware |
| `options` | map | Opciones de middleware (notación de punto) |

<tip>
Los manejadores estáticos pueden montarse en cualquier ruta del servidor. Múltiples manejadores pueden coexistir—monte assets en <code>/static</code> y una SPA en <code>/</code>.
</tip>

## Integración con Filesystem

Los archivos estáticos se sirven desde entradas de filesystem. Cualquier tipo de filesystem funciona:

```yaml
entries:
  # Local directory
  - name: public
    kind: fs.directory
    directory: ./public

  # Static handler
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

La solicitud `/static/css/style.css` sirve `./public/css/style.css`.

Para servir un subdirectorio, apunta la referencia `fs` a una entrada de sistema de archivos arraigada allí; por ejemplo, una `fs.directory` cuyo campo `directory:` señale al subdirectorio:

```yaml
entries:
  - name: content
    kind: fs.directory
    directory: ./app/documentation/html

  - name: docs
    kind: http.static
    meta:
      server: gateway
    path: /docs
    fs: content
```

## Modo SPA

Las Aplicaciones de Página Única necesitan que todas las rutas sirvan el mismo archivo index para routing del lado del cliente:

```yaml
- name: spa
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:frontend
  static_options:
    spa: true
    index: index.html
```

| Solicitud | Respuesta |
|-----------|-----------|
| `/app.js` | Sirve `app.js` (archivo existe) |
| `/users/123` | Sirve `index.html` (fallback SPA) |
| `/api/data` | Sirve `index.html` (fallback SPA) |

<note>
Cuando <code>spa: true</code>, el archivo <code>index</code> es requerido. Los archivos existentes se sirven directamente; todas las demás rutas retornan el archivo index.
</note>

## Control de Caché

Establezca caching apropiado para diferentes tipos de assets:

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # Versioned assets - cache forever
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - short cache, must revalidate
  - name: app
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app_fs
    static_options:
      spa: true
      index: index.html
      cache: "public, max-age=0, must-revalidate"
```

Patrones comunes de caché:

- **Assets versionados**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **Uploads de usuario**: `private, max-age=3600`

## Middleware

Aplique middleware para compresión, CORS, u otro procesamiento:

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  middleware:
    - compress
    - cors
  options:
    compress.level: "best"
    cors.allow.origins: "*"
```

El middleware envuelve el manejador estático en orden—las solicitudes pasan a través de cada middleware antes de llegar al servidor de archivos.

<warning>
El matching de rutas es basado en prefijo. Un manejador en <code>/</code> captura todas las solicitudes no matcheadas. Use routers para endpoints de API para evitar conflictos.
</warning>

## Véase también

- [Servidor](http/server.md) - Configuración del servidor HTTP
- [Enrutamiento](http/router.md) - Routers y endpoints
- [Sistema de archivos](lua/storage/filesystem.md) - Módulo de sistema de archivos
- [Middleware](http/middleware.md) - Middleware disponible
