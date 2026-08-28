---
title: "Web Host 概要"
description: "CDN-hosted Web Host、facade page、child micro frontend が Wippy application 内でどう連携するか。"
---

# Web Host 概要

このページは architecture reference です。deployment boundary と entry point を説明します。setup はリンク先の facade と micro-frontend guide を参照してください。

Wippy Web Host は Feature-Sliced Design methodology で構築された Vue 3 single-page application で、`https://web-host.wippy.ai` から配信されます。Wippy application の user-facing page と UI component を host します。設定は backend module `wippy/facade` から行い、application と一緒に build や deploy はしません。

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## 3 レイヤーモデル

実行中の Wippy application は、入れ子になった 3 つのレイヤーで構成されます。

**Layer 1 — `wippy/facade` が配信するページ。** backend-rendered HTML page です。`wippy/facade` module は Wippy gateway に static file server と `/facade/config` endpoint を登録します。user が application を開くと、`wippy/facade` は CDN から Web Host JS-module entry（compat は `module.js`、managed は `managed-layout.js`）を読み込む薄い HTML page を配信し、`/facade/config` の設定で初期化します。page 自体に Vue や React はなく、意図的に最小限です。

**Layer 2 — Web Host。** Web Host bundle は JS module として読み込まれ、page 全体と browser history を引き継ぎます。navigation、chat、session management、page rendering surface といった Wippy chrome を所有します。全設定を page の init call から受け取り、deployment 固有の URL や token は内包しません。そのため同じ CDN bundle を異なる deployment で利用できます。facade を使わない manual embedding では、後述の `iframe.html` entry により host を iframe 内で実行できます。

**Layer 3 — Child micro-frontend。** Web Host は、設定済み page engine（legacy srcdoc iframe または Web Fragment）を通して `view.page` module を render します。`view.component` module は custom element として mount します。iframe engine は独立した browsing context を提供します。Web Fragment は host document に反映される reframed realm を使い、isolation boundary ではありません。component の shadow root が分離するのは selector であり authority ではありません。各 surface は、deployment 固有 URL を必要とせずに Wippy API access、authentication context、theme delivery、communication を利用できる適切な proxy adapter を受け取ります。

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page → srcdoc iframe or Web Fragment + proxy adapter
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## Entry Point

Web Host CDN は、同じ versioned directory から複数の entry point を配信します。integration に応じて選びます。各 entry は `/<release-tag>/module.js` のように `<release-tag>/<entry>` で利用できます。

| エントリ | ユースケース |
|-------|----------|
| `module.js` | **compat** mode の full app。標準的な nav-sidebar + page-area + chat-right-panel shell。`window.initWippyApp()` により page へ直接 mount し、page 全体と browser history を引き継ぐ。現在の `wippy/facade` がデフォルトで配信する entry |
| `managed-layout.js` | **managed** mode の full app。宣言的な multi-panel layout。`fe_mode = managed` の場合に facade が配信する。early access（[Multi-Panel Layout](./multi-panel-layout.md)参照） |
| `iframe.html` | isolation または partial-page embedding のため、**iframe 内**で動く full app。`SetConfig` PostMessage handshake で設定を渡す、facade を使わない manual embedding 向け。facade 自身はこれではなく上記 JS-module entry を読み込む |
| `chat-iframe.html` | sidebar や page のない最小 chat interface。focused chat widget の embedding 向け |
| `chat.js` | chat store と WebSocket client を公開する headless ESM module。完全に custom な UI の構築向け |
| `ws.js` | Vue や Pinia に依存しない standalone WebSocket service。low-level real-time integration 向け |

標準的な `wippy/facade` deployment では、これらの path を直接参照しません。facade が設定から `fe_facade_url` を読み、`fe_mode` に合う JS-module entry（compat は `module.js`、managed は `managed-layout.js`）を選択し、正しい URL を自動的に構成します。

## CDN バージョン管理 :id=cdn-versioning

Web Host は git tag で versioning されます。production URL の canonical pattern は次のとおりです。

```
https://web-host.wippy.ai/<release-tag>/
```

`<release-tag>` は Web Host の git release tag で、stable release または feature-branch preview deploy です。staging CDN は `https://web-host.staging.wippy.ai/<release-tag>/` にあります。

通常、`wippy/facade` module は default の `fe_facade_url` を通して version を選択します。これは対応する Web Host build を指します。そのため `wippy/facade` を更新すると deployment も対応する Web Host version に移ります。import map 経由で vendor library を共有する child app は、その build が提供する version を受け取ります。

既知の安定版に留める、または feature-branch / early-access tag を利用するために特定の Web Host version を pin する場合は、`fe_facade_url` parameter を上書きします。

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

これにより deployment 全体がその build に固定されます。runtime で設定する `-o` / `--override` syntax は [CLI override](../../guides/cli.md)を参照してください。

## 技術スタック :id=tech-stack

Web Host は Vue 3（Composition API）、UI component に PrimeVue + Tailwind CSS 3、state management に Pinia、navigation に Vue Router、HTTP に Axios を使用します。

### Child dependency の externalization

開発時は `<fe_facade_url>/import-map.json` を取得し、現在の artifact がその key を import しているかにかかわらず、`imports` object の全 key を Rollup externals に指定します。import する dependency の exact specifier がない場合だけ bundle に含めます。Web Host tag が変わったとき、または新しい dependency を追加したときは再取得してください。

## 関連項目

- [Facade Entry Point](./entry-point.md) — facade が Web Host を user に配信する仕組みと config flow
- [Bootstrap Sequence](./bootstrap.md) — Web Host が設定を受け取った後に内部で起きること
- [Multi-Panel Layout](./multi-panel-layout.md) — custom multi-panel shell 向けの managed layout mode
- [Packages](./packages.md) — child app developer が利用できる `@wippy-fe/*` npm package
- [Facade module](../../framework/facade.md) — `wippy/facade` の backend setup
- [Render Engines](./render-engines.md) — 2 つの page-render engine（srcdoc iframe と Web Fragment）
