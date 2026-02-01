# Archivos Estaticos

Sirva archivos estaticos desde cualquier filesystem usando `http.static`. Los manejadores estaticos se montan directamente en el servidor y pueden servir SPAs, assets, o uploads de usuarios desde cualquier ruta.

## Configuracion

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  directory: dist
  static_options:
    spa: true
    index: index.html
    cache: "public, max-age=3600"
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `meta.server` | ID de Registro | Servidor HTTP padre |
| `path` | string | Ruta de montaje URL (debe comenzar con `/`) |
| `fs` | ID de Registro | Entrada de filesystem desde donde servir |
| `directory` | string | Subdirectorio dentro del filesystem |
| `static_options.spa` | bool | Modo SPA - servir index para rutas no matcheadas |
| `static_options.index` | string | Archivo index (requerido cuando spa=true) |
| `static_options.cache` | string | Valor del header Cache-Control |
| `middleware` | []string | Cadena de middleware |
| `options` | map | Opciones de middleware (notacion de punto) |

<tip>
Los manejadores estaticos pueden montarse en cualquier ruta del servidor. Multiples manejadores pueden coexistir—monte assets en <code>/static</code> y una SPA en <code>/</code>.
</tip>

## Integracion con Filesystem

Los archivos estaticos se sirven desde entradas de filesystem. Cualquier tipo de filesystem funciona:

```yaml
entries:
  # Directorio local
  - name: public
    kind: fs.directory
    directory: ./public

  # Manejador estatico
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

La solicitud `/static/css/style.css` sirve `./public/css/style.css`.

El campo `directory` selecciona un subdirectorio dentro del filesystem:

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
```

## Modo SPA

Las Aplicaciones de Pagina Unica necesitan que todas las rutas sirvan el mismo archivo index para routing del lado del cliente:

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
Cuando <code>spa: true</code>, el archivo <code>index</code> es requerido. Los archivos existentes se sirven directamente; todas las demas rutas retornan el archivo index.
</note>

## Control de Cache

Establezca caching apropiado para diferentes tipos de assets:

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # Assets versionados - cachear indefinidamente
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    directory: assets
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - cache corto, debe revalidar
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

Patrones comunes de cache:
- **Assets versionados**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **Uploads de usuario**: `private, max-age=3600`

## Middleware

Aplique middleware para compresion, CORS, u otro procesamiento:

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

El middleware envuelve el manejador estatico en orden—las solicitudes pasan a traves de cada middleware antes de llegar al servidor de archivos.

<warning>
El matching de rutas es basado en prefijo. Un manejador en <code>/</code> captura todas las solicitudes no matcheadas. Use routers para endpoints de API para evitar conflictos.
</warning>

## Ver Tambien

- [Servidor](http-server.md) - Configuracion del servidor HTTP
- [Routing](http-router.md) - Routers y endpoints
- [Filesystem](lua-fs.md) - Modulo Filesystem
- [Middleware](http-middleware.md) - Middleware disponible
