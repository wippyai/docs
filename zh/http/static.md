# 静态文件

使用 `http.static` 从任意文件系统提供静态文件。静态处理器直接挂载到服务器上，可以从任意路径提供 SPA、资源或用户上传的文件。

## 配置

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

| 字段 | 类型 | 说明 |
|------|------|------|
| `meta.server` | Registry ID | 父级 HTTP 服务器 |
| `path` | string | URL 挂载路径 (必须以 `/` 开头) |
| `fs` | Registry ID | 要提供服务的文件系统条目 |
| `directory` | string | 文件系统中的子目录 |
| `static_options.spa` | bool | SPA 模式 - 未匹配路径返回 index 文件 |
| `static_options.index` | string | Index 文件 (spa=true 时必填) |
| `static_options.cache` | string | Cache-Control 头的值 |
| `middleware` | []string | 中间件链 |
| `options` | map | 中间件选项 (点号表示法) |

<tip>
静态处理器可以挂载到服务器的任意路径。多个处理器可以共存，例如将资源挂载到 <code>/static</code>，将 SPA 挂载到 <code>/</code>。
</tip>

## 文件系统集成

静态文件从文件系统条目提供。任何文件系统类型都可以使用：

```yaml
entries:
  # 本地目录
  - name: public
    kind: fs.directory
    directory: ./public

  # 静态处理器
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

请求 `/static/css/style.css` 会提供 `./public/css/style.css`。

`directory` 字段选择文件系统中的子目录：

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
```

## SPA 模式

单页应用需要所有路由返回相同的 index 文件以支持客户端路由：

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

| 请求 | 响应 |
|------|------|
| `/app.js` | 提供 `app.js` (文件存在) |
| `/users/123` | 提供 `index.html` (SPA 回退) |
| `/api/data` | 提供 `index.html` (SPA 回退) |

<note>
当 <code>spa: true</code> 时，<code>index</code> 文件是必填的。存在的文件直接提供，其他所有路径返回 index 文件。
</note>

## 缓存控制

为不同资源类型设置适当的缓存：

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # 版本化资源 - 永久缓存
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    directory: assets
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - 短缓存，必须重新验证
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

常见缓存模式：
- **版本化资源**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **用户上传**: `private, max-age=3600`

## 中间件

应用中间件进行压缩、CORS 或其他处理：

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

中间件按顺序包装静态处理器，请求在到达文件服务器之前依次通过每个中间件。

<warning>
路径匹配基于前缀。挂载在 <code>/</code> 的处理器会捕获所有未匹配的请求。使用路由器处理 API 端点以避免冲突。
</warning>

## 参见

- [服务器](http/server.md) - HTTP 服务器配置
- [路由](http/router.md) - 路由器和端点
- [文件系统](lua/storage/filesystem.md) - 文件系统模块
- [中间件](http/middleware.md) - 可用的中间件
