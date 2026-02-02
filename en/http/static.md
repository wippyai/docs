# Static Files

Serve static files from any filesystem using `http.static`. Static handlers mount directly on the server and can serve SPAs, assets, or user uploads from any path.

## Configuration

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

| Field | Type | Description |
|-------|------|-------------|
| `meta.server` | Registry ID | Parent HTTP server |
| `path` | string | URL mount path (must start with `/`) |
| `fs` | Registry ID | Filesystem entry to serve from |
| `directory` | string | Subdirectory within filesystem |
| `static_options.spa` | bool | SPA mode - serve index for unmatched paths |
| `static_options.index` | string | Index file (required when spa=true) |
| `static_options.cache` | string | Cache-Control header value |
| `middleware` | []string | Middleware chain |
| `options` | map | Middleware options (dot notation) |

<tip>
Static handlers can be mounted to any path on the server. Multiple handlers can coexist—mount assets at <code>/static</code> and an SPA at <code>/</code>.
</tip>

## Filesystem Integration

Static files are served from filesystem entries. Any filesystem type works:

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

Request `/static/css/style.css` serves `./public/css/style.css`.

The `directory` field selects a subdirectory within the filesystem:

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
```

## SPA Mode

Single Page Applications need all routes to serve the same index file for client-side routing:

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

| Request | Response |
|---------|----------|
| `/app.js` | Serves `app.js` (file exists) |
| `/users/123` | Serves `index.html` (SPA fallback) |
| `/api/data` | Serves `index.html` (SPA fallback) |

<note>
When <code>spa: true</code>, the <code>index</code> file is required. Existing files are served directly; all other paths return the index file.
</note>

## Cache Control

Set appropriate caching for different asset types:

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
    directory: assets
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

Common cache patterns:
- **Versioned assets**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **User uploads**: `private, max-age=3600`

## Middleware

Apply middleware for compression, CORS, or other processing:

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

Middleware wraps the static handler in order—requests pass through each middleware before reaching the file server.

<warning>
Path matching is prefix-based. A handler at <code>/</code> catches all unmatched requests. Use routers for API endpoints to avoid conflicts.
</warning>

## See Also

- [Server](http/server.md) - HTTP server configuration
- [Routing](http/router.md) - Routers and endpoints
- [Filesystem](lua/storage/filesystem.md) - Filesystem module
- [Middleware](http/middleware.md) - Available middleware
