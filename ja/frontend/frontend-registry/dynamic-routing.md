---
title: "動的ルーティング"
description: "Web Host が backend の mount route を登録し、child navigation を同期し、runtime で link を分類する仕組み。"
---

# 動的ルーティング

Web Host は静的に定義された system route と、起動時に backend から取得する page mount route を組み合わせます。そのため、`mountRoute` claim を持つ新しい `view.page` entry は Web Host bundle を変更せずに有効になります。

![Mount route sync](../diagrams/mountroute-sync.svg)

## 起動時の Mount Route 同期

Web Host application は初期化時、navigation を描画する前に次を呼び出します。

```
GET /api/public/pages/routes
```

response は `{ success, count, routes }` envelope で、`routes` は mount-route pattern → page id の map です（URL を claim する hidden/unannounced page も含みます）。host は各 entry について、宣言された path を page loader component へ map する Vue Router route を登録し、`'app'` parent route の child として追加します。

```typescript
// Simplified from the Web Host bootstrap
const { data } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(data.routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

これ以降、`/home/anything` へ移動すると選択された engine で `main` page が描画され、`/demo/anything` では `iframe-demo` page が同様に描画されます。host bundle にこれらの path をハードコードする必要はありません。

## `mountRoute` で path を claim する

`view.page` entry は `_index.yaml` の `meta` block で `mountRoute` を設定し、host router path を claim します。

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
```

現在の registry schema は authored field を `mountRoute` として読み、registry 内部の `mount_route` field に保存し、API output では `mountRoute` を出力します。上記の lower-camel-case spelling を使用してください。

`mountRoute` が受け付けるのは、catch-all form `/:part(.*)*`（root）または `/<literal-prefix>/:part(.*)*` だけです。prefix は 1 つ以上の lowercase-alphanumeric-plus-hyphen literal segment で、最後に必須 wildcard `:part(.*)*` が続きます。任意の Vue Router pattern（named param、custom regex、別の param name。例：`/home/:id`、`/users/:userId(\d+)`）は拒否されます。backend の `view.page` entry では `validate_mount_route_syntax` により `GET /api/public/pages/routes` が HTTP 500 を返すため、entry が router に届く前に Host startup が停止します。response と configuration merge が成功した後、Host は syntax および system route との conflict を含む最終 route set を別途検証します。wildcard segment `:part(.*)*` により、host が `/home` prefix を所有しながら、child application が独自 sub-route（例：`/settings`、`/profile/edit`）を管理できます。

2 つの entry が同じ route を claim してはいけません。2 つの `view.page` entry が **同じ** `mountRoute` を claim すると、backend validator（`page_registry.lua` の `validate_mount_routes`）は syntax error と同じ issues list に duplicate-route conflict を記録します。`GET /api/public/pages/routes` は HTTP 500 を返し、Host startup は停止し、error は Host error handler を通じて relay されます。duplicate は暗黙に無視されません。

root catch-all（`/:part(.*)*`）と、より具体的な system route（`chat`、`c`、`web`、`page`、`keeper`、`login`、`logout`）またはより長い literal-prefix mount の間では、引き続き Vue Router の route-resolution precedence が適用され、より具体的な route が match します。この priority は duplicate-route handling ではありません。

## URL 同期ループ

page が runtime context に読み込まれると、child application は独自 router で内部 navigation を行います。host は navigation を URL bar に反映し、browser の back button、bookmark、copy した URL が正しく動作するようにします。proxy bridge は両方の page engine について 2 つの router を同期します。

![Frontend Registry](../diagrams/frontend-registry.svg)

### Child → Host：`CmdRouteChanged`

child application の router が navigation を commit すると（例：`/home` mount 配下で `/settings` から `/profile` へ移動）、proxy bridge を通じて internal route を報告します。iframe adapter は `window.parent` へ post し、Fragment adapter は同じ protocol を captured host window へ route します。

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

proxy はこれを internal wire envelope へ serialize します。この protocol は application API ではありません。コピーしたり、`window.parent.postMessage` を直接呼び出したりしないでください。

host の message handler はこれを intercept し、`router.push(path)` を呼んで full page reload を起こさない SPA route change として URL bar を更新し（browser-history entry を追加）、次を返します。

### Host → Child：`UrlWasUpdatedInParent`

host が URL bar を更新した後、proxy は child へ `@history` を emit します。`@wippy-fe/router` はその event を consume し、memory router を reconcile します。

host が返すのは full host path ではなく、child の **internal** route（mount prefix より後の sub-path）です。そのため round-trip は対称です。child が `internalRoute: '/profile'` を post すると、host は URL bar を `/home/profile` に設定し、`path: '/profile'` を echo します。child の memory router はそれをそのまま push します。child は `@history` event channel で listen し、host URL と internal state が一致したことの confirmation として扱います。

この round-trip により、host が child の内部 routing structure を知ることなく、host URL bar、child router、browser history entry が同期します。

## `classifyLink`

iframe engine では、`preventLinkClicks: true` によって document-level hook が導入され、browser が処理する前に raw `<a>` click を intercept します（[view.page](./view-page.md)を参照）。Web Host 1.0.56 の Web Fragment adapter はこの raw-click hook を導入しません。portable な Vue navigation には `@wippy-fe/router` の `AutoRouterLink` を使用してください。どちらの engine でも同じ `classifyLink` API を呼び出します。

classifier は次の 4 種類の結果を返します。

| `LinkKind` | 条件 | アクション |
|---|---|---|
| `host-nav` | top path segment が既知の `mountRoute` literal、組み込み system route（`chat`、`c`、`web`、`page`、`keeper`、`login`、`logout`）、または root-mount catch-all に match | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | child router が path を実在する（catch-all ではない）route として resolve、または他の何も claim していない | subapp の router が in-app で決定。host は `preventDefault` も page context の reload も行わない |
| `external` | origin が異なる、または非 `http` scheme（`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`） | browser default（例：new tab で開く） |
| `ignore` | 空の `href` または pure hash（`#…`） | `preventDefault` |

classifier は最初に page の local router を確認するため、child 自身が resolve できる link は in-app に留まります。

`classifyLink` は起動時に取得したものと同じ routes list を参照します。child router が `/demo/step-2` を claim しない場合、`/demo/:part(.*)*` が登録済み mount route なので link は `host-nav` に分類されます。host は full page reload を行わず `iframe-demo` page へ navigation します。

つまり、child application は system 内の他の page を知る必要がありません。`preventLinkClicks: true` の iframe では通常の `<a href="/demo/step-2">` が intercept され、分類されます。同じ navigation を両方の page engine で動作させる必要がある場合は `AutoRouterLink` を使用してください。
