---
title: "Iconify 提供方"
description: "为 Web Host 配置在线 Iconify 源或显式本地集合。"
---

# Iconify 提供方

Web Host 默认使用在线 Iconify 源。只有部署需要其他源时，才配置 `AppConfig.iconify.providers`。本页介绍的本地 Tabler 集合是离线部署的显式选项，不会改变默认源。

## 配置提供方

`providers` 使用 Iconify 提供方 ID 作为键。内置提供方使用空键 (`""`)，命名提供方使用小写字母和连字符组成的 ID。每个值都包含非空且有顺序的 HTTP(S) 源数组 `resources`。Host 按顺序尝试这些源，不会向配置数组添加公共源。

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path` 默认为 `/`，并规范化为前后带斜线。`timeout` 默认为 5000 毫秒，接受不超过 60000 的正整数。资源值必须是源，不能包含凭据、查询、片段或基础路径。

## 离线使用 Wippy

离线部署必须自行在浏览器可访问的服务器上提供集合副本。Web Host 公共 CDN 是在线主机，不能离线提供应用或其他服务。Host 发布包包含 `iconify/tabler.json`。

```ts
const config = {
  iconify: {
    providers: {
      "": {
        resources: ["http://localhost:5173"],
        path: "/iconify/",
      },
    },
  },
}
```

本地测试时提供 Host 构建输出，使 `dist/iconify/tabler.json` 可通过 `/iconify/tabler.json` 访问。部署时使用自行管理的源和版本路径：

```ts
const deploymentConfig = { iconify: { providers: { "": { resources: ["https://wippy-host.internal"], path: "/webcomponents-<host-release>/iconify/" } } } }
```

将 `<host-release>` 替换为固定 Host 版本。服务器必须使用 `application/json` 返回 JSON，并允许来自应用源的浏览器请求。Iconify 会发送 `?icons=...`；静态集合会忽略该查询并返回完整集合。搜索不受支持。

集合基于 MIT 许可的 Tabler 3.41.1，作者为 Paweł Kuna。元数据声明 6092 个图标；固定源包含 6140 个图标定义和 184 个别名。SHA-256：`cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`。

### 正确提供镜像

静态服务器配置也是离线设置的一部分。服务器必须以 `application/json` 返回文件，通过 CORS 允许来自应用源的浏览器请求，在浏览器支持时压缩 JSON，并在集合不存在时返回真实的 404。不要把缺失文件当作成功响应缓存。版本化路径可以使用不可变缓存；未版本化路径必须使用 `ETag` 或 `Last-Modified` 重新验证。

此 Nginx 示例假定文件位于 `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json`，应用使用下方所示的精确源，并且 TLS 证书在此配置片段之外完成配置。请将源和根目录替换为部署值。此片段不会安装 Nginx 模块，也不会配置 TLS：

```nginx
server {
    location ~ ^/webcomponents-[^/]+/iconify/ {
        root /srv/wippy/host;
        default_type application/json;
        add_header Access-Control-Allow-Origin "https://app.example.com" always;
        add_header Vary Origin always;
        add_header Cache-Control "public, max-age=31536000, immutable";
        gzip on;
        gzip_types application/json;
        gzip_vary on;
        try_files $uri =404;
    }
}
```

未版本化路径应将不可变缓存策略替换为重新验证策略，例如 `Cache-Control: no-cache`，并启用 `ETag` 或 `Last-Modified`。使用镜像前，请确认已部署服务器确实压缩 JSON，并返回预期的缓存、CORS 和 MIME 响应，以及缺失文件时的真实 404。

## 命名提供方和图标名称

命名提供方使用 `@provider:prefix:name` 格式。Vue 组件和自定义元素使用相同名称。

```ts
const namedConfig = { iconify: { providers: { tenant: { resources: ["https://icons.example.internal"], path: "/tenant/" } } } }
```

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<Icon icon="@tenant:tabler:home" />
<iconify-icon icon="@tenant:tabler:settings"></iconify-icon>
```

该源仅处理图标集合请求。应用 API、字体和其他 Kickside 资源仍需单独支持离线使用。

## 重置和更新

初始配置省略 `iconify` 时使用在线默认值。后续更新省略该字段时则保留当前 Iconify 配置。`iconify: null` 或 `providers: null` 会重置整个配置段并移除命名配置。空键设为 `null` 只重置内置提供方。命名提供方设为 `null` 会禁用该命名空间。省略的键保留当前路由。空的 `providers` 对象不会重置配置。

验证器仅接受 `providers` 以及 `resources`、`path` 和 `timeout`。无效的初始配置会被忽略，无效更新会保留上次有效配置。`timeout` 为逻辑请求和所有已配置源设置一个共同截止时间。每次故障转移尝试都使用同一截止时间的剩余时长。只有与固定 Tabler 集合逐字节匹配且 Web Crypto SHA-256 可用时，响应才会被识别为完整集合。此类响应按去除查询参数的 endpoint URL 缓存。其他响应按包含查询参数的完整 URL 缓存。如果没有 `crypto.subtle`（例如不安全 HTTP），adapter 会按查询 URL 缓存，Iconify store 仍可使用其原生的逐图标缓存。adapter 两类缓存合计最多保留 32 个 URL。同一 URL 上替换集合不会清除已缓存的响应、已解析图标或 Iconify store 中的未命中结果。如果所有已配置源都失败，adapter 会返回暂时性错误，但原生 loader 可能会将未解析的名称缓存为未找到。更换 provider 不会再次请求该名称。要重新发起网络请求，请重新加载文档。Iconify 公共 API `addIcon` 和 `addCollection` 可以添加图标数据，但不会重置通用缓存。传输失败或响应无效时会尝试下一个源；有效响应中没有请求图标时会报告 not found。`iconifyIcons` 控制是否加载和注册 `<iconify-icon>` 自定义元素，不选择数据源。显式配置通过 AppConfig 传给子应用。Schema 2.0 和 2.1 输入会迁移到 2.2。请参阅[引导顺序](./bootstrap.md)、[CSS 注入](./css-injection.md)、[Proxy API](../micro-frontends/proxy-api.md)和[Facade](../../framework/facade.md)。

## Provider trust and updates

仅使用可信的 provider origin。页面会将图标内容作为 SVG 标记渲染。新的 `SetConfig` 请使用 `wippy-context-2.2`。带版本的 `wippy-context-2.0` 和 `wippy-context-2.1` 输入会被接受并迁移；不带 schema 的 1.0 输入无法包含新的 `iconify` 和 `importMap` 字段。更换 provider 只影响尚未加载的图标；缓存响应和已渲染图标不会清除。请打开新文档验证 provider 更换。

## Schema 版本

新配置请使用 `wippy-context-2.2`。带版本的 `wippy-context-2.0` 和 `wippy-context-2.1` 输入会向前迁移。不带 `$schema` 的输入会使用已弃用的 legacy 转换器。它会映射已知的旧字段，但不会传递新的 `iconify` 和 `importMap` 字段。生成的 schema 会检查 JSON 结构和字段限制。运行时还会检查 HTTP(S) 源和 Host 路径规则。因此，值可能通过 schema 检查，但仍被运行时拒绝。

## 开发 overlay

使用已启用 `@wippy-fe/vite-plugin` 的 Vite 运行消费应用；插件会将 `package.json` 中的 Wippy 设置提供给开发 overlay。点击悬浮的 **Wippy Dev** 按钮，打开 **Configuration**，在 **App Config (JSON)** 中添加 `iconify.providers`，然后点击 **Accept**。首次启动时，**Accept** 会让应用继续完成加载。浏览器会保存已接受的设置。更改已运行应用的设置后，请重新加载应用再检查更改，因为 **Accept** 只保存设置，不会更新应用当前正在使用的配置。启用 Auto-accept 时，控制台也会显示 `Config updated (reload to apply)`。
