---
title: "レンダリングエンジン"
description: "view.page application が srcdoc iframe または Web Fragment で動作する仕組み、選択ルール、互換性の制約。"
---

# レンダリングエンジン

このページは render-engine の選択と互換性に関する reference です。operator と package の設定を説明するもので、standalone deployment recipe ではありません。

Wippy Web Host は 2 種類の **page-render engine** のいずれかで micro frontend app（`view.page`）を render します。engine は operator switch で選ぶ delivery 上の関心事であり、page 単位の任意 override もあります。portable app は Wippy proxy と router API を使用し、特定の engine に依存しない behavior を実現します。

| エンジン | ページの描画方法 | 分離 | ルーティング |
|--------|--------------------|-----------|---------|
| **Iframe**（デフォルト） | `proxy.js` を注入した srcdoc `<iframe>` | 完全な document isolation | memory-history のみ（srcdoc に実 URL はない） |
| **Web Fragment** | [`reframed`](https://web-fragments.dev) の same-origin realm を `<web-fragment>` shadow root に反映し、`proxy-fragment.js` を使用 | realm isolation、共有 DOM tree | 実際の `window.history`（URL router が動作する） |

どちらの engine も portable app が使う Wippy application service をサポートします。authenticated API、WebSocket、host-mediated state、confirm/bridge dialog、`@history`/`@visibility` event、title propagation、error capture、platform CSS と theme delivery、content-mode auto-height、nested `<w-artifact>` embed です。delivery と control は engine 固有です。iframe CSS と error capture は proxy injection flag に従いますが、Fragment gateway は platform CSS と error capture を常に導入します。[CSS Injection](./css-injection.md)を参照してください。browser-history capability も表のとおり異なります。

どちらの engine でも動く app には、`@wippy-fe/router` の `createAppRouter()` を使います。現在の factory は memory history を使用し、初期 route を `AppConfig.context.route` から受け取り、host と `@history` で同期します。`createWebHistory()` を直接使う router は Fragment 専用であり、iframe や iframe に fallback し得る `auto` deployment には portable ではありません。

## Fragment の render 方法

fragment engine が選ばれた `view.page` は `<web-fragment src="/@fragment/{id}/">` として mount されます。`wippy/views` の [`/@fragment` gateway](../../framework/views.md) が reframing contract を配信します。`reframed` client は hidden same-origin realm iframe（`wf:<id>`）を作り、gateway が変換した HTML を fragment の shadow root へ stream し、realm 内で `proxy-fragment.js`（`@wippy-fe/proxy` adapter）を実行して `$W` proxy API を提供します。adapter は realm の patched `window.parent` に依存せず、共有 `postMessage` protocol を捕捉済み same-origin Host window へ route します。

iframe engine で同じ page を動かす場合は、`proxy.js` を注入した srcdoc `<iframe>` になります。[Proxy と分離](./proxy-isolation.md)を参照してください。

## Engine の選択

### Global switch（operator）

deployment 全体の engine は、facade の `render_engine` requirement → `hostConfig.renderEngine` で決まります。デフォルトは `iframe` で、exact string `fragment` だけが fragment engine を有効にします（typo を含むほかの値は `iframe` として扱われます）。

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

parameter は [Facade → Render engine](../../framework/facade.md)を参照してください。

### Page 単位の override（app author）

page は `package.json` の `wippy` block にある `wippy.renderEngine` で opt in / opt out します。

| 値 | 動作 |
|-------|----------|
| `"auto"`（デフォルト） | global switch に従う |
| `"iframe"` | switch にかかわらず常に srcdoc iframe で render し、fragment を opt out する |
| `"fragment"` | fragment エンジンを優先する。全体が `fragment` の配置では常に使用。全体が `iframe` の配置では実行時の**機能検査**（`GET /@fragment/{id}/`、セッション単位でキャッシュ）がゲートウェイとプロキシの存在を確認した場合のみ使用し、それ以外は安全に iframe へフォールバック |

[Micro Frontend App → Render engine](../frontend-registry/view-page.md#render-engine)も参照してください。

## Fragment の制約

一部の browser API は reframed realm 内で、**誤った動作をしても何も通知しません**。次のいずれかに依存する page は `wippy.renderEngine: "iframe"` に固定してください。

| API / 機能 | レルム内の動作 | 影響 |
|---------------|---------------------|--------|
| `document.elementFromPoint` | panel size に**かかわらず** `null` を返す | drag & drop、sortable list、Popper/floating-ui、virtual scroller の pointer hit-testing が壊れる |
| `matchMedia`、`vh`/`vw` unit、`position: fixed` | fragment panel ではなく **host** viewport に対して解決する | full-size panel では約 1px のずれ。小さい panel（sidebar/modal）では重大な誤差 |
| `window.scrollX/Y`、`scrollTo` | hidden realm window（常に `0`）を対象とする | scroll-driven UI が誤った geometry を読む |
| Web Workers、Canvas、WebGL、WASM | **正常に動作する** | — |

`vh`/`vw` と `matchMedia` がここに挙がるのは、**window** を基準にするためです。割り当てられた *surface*、つまり `wippy-surface` の container query と `--wippy-surface-*` variable を基準に size を決める app は、どちらの engine でも同じ結果になり pin は不要です。[Surface Portability](../micro-frontends/surface-portability.md)と、既存 app を変換する [Surface Migration](../micro-frontends/surface-migration.md)を参照してください。`position: fixed` と `elementFromPoint` に portable form はなく、pin が本当に必要です。

authoring 時に 2 種類の detector がこれらを表面化します（検出するのは *app-code incompatibility* であり deployment mistake ではありません）。

- **Build-time**（`@wippy-fe/vite-plugin`）: page source を scan し、API 名と `wippy.renderEngine: "iframe"` の提案を含む build **warning** を出す。
- **Dev-runtime**（fragment proxy、DEV のみ）: 対象 API を patch し、実際の call 時に一度だけ `console.warn` する。

## Fragment を有効にする — setup 概要

consumer application で fragment engine を有効にするには、互換性のある framework module と operator switch が必要です。追加の router や parameter wiring は不要です。

1. **Framework module** — `render_engine` switch と self-mounting fragment gateway を公開する、現在互換性のある `wippy/facade` と `wippy/views` の組み合わせを使います。exact release は現在の Wippy module documentation で確認してください。
2. **Switch** — facade の `render_engine` を `fragment` に設定（global）するか、page 単位に `wippy.renderEngine` で opt in します。

> `/@fragment` ゲートウェイは現在の `wippy/views` が直接提供します。モジュールがトップレベルルーターを宣言し、デフォルトで `app:gateway` を指す `server` 要件にバインドします。利用側で fragment の接続設定を追加する必要はなく、fragment が有効かどうかにかかわらず通常どおり iframe エンジンで起動します。`http.service` ID が `app:gateway` でない場合だけ `server` パラメータを上書きしてください。通常、全体が iframe の配置でページが個別に fragment を選ぶと、実行時の機能検査がゲートウェイと `proxy-fragment.js` を確認してから切り替え、確認できなければ iframe を維持します。全体の `render_engine: fragment` 切り替えは運用者を信頼し、検査しません。[Views → Web Fragment ゲートウェイ](../../framework/views.md)を参照してください。

frontend app 自体に fragment 固有 code は不要です。`proxy-fragment.js` は CDN から配信される host artifact であり、app が bundle するものではありません。

## 関連項目

- [Facade](../../framework/facade.md) — `render_engine` operator switch と `hostConfig.renderEngine`
- [Views](../../framework/views.md) — self-mounting `/@fragment` gateway と `server` binding
- [Micro Frontend App（view.page）](../frontend-registry/view-page.md) — page 単位の `wippy.renderEngine` field
- [Proxy と分離](./proxy-isolation.md) — shared proxy API（両 engine）と iframe engine
- [Web Host 概要](./overview.md) — Host が page を読み込み render する仕組み
