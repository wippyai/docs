---
title: "Web ホストの概要"
description: "Wippy Web ホストは Feature-Sliced Design の方法論で構築された Vue 3 のシングルページアプリケーションで、CDN から配信されます…"
---

# Web ホストの概要

Wippy Web ホストは Feature-Sliced Design の方法論で構築された Vue 3 のシングルページアプリケーションで、`https://web-host.wippy.ai` の CDN から配信されます。Wippy アプリケーションのユーザー向けページと UI コンポーネントをすべてホストします。ビルドもデプロイも不要です — `wippy/facade` バックエンドモジュールを通じて設定すれば、自動的に読み込まれます。

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## 3層モデル

動作している Wippy アプリケーションは、入れ子になった3つの層で構成されます。

**層1 — `wippy/facade` が配信するページ。** これはバックエンドが描画する HTML ページです。`wippy/facade` モジュールは、Wippy のゲートウェイに静的ファイルサーバーと `/facade/config` エンドポイントを登録します。ユーザーがアプリケーションへアクセスすると、`wippy/facade` は CDN から Web ホストの JS モジュールエントリ（compat なら `module.js`、managed なら `managed-layout.js`）を読み込み、`/facade/config` の設定で初期化する薄い HTML ページを配信します。ページ自体は Vue も React も持ちません — 意図的に薄く保たれています。

**層2 — Web ホスト。** Web ホストのバンドルは、ページ全体とブラウザー履歴を引き継ぐ JS モジュールとして読み込まれます。Wippy のクローム、すなわちナビゲーションサイドバー、チャットパネル、セッション管理、ページ描画のサーフェスを所有します。設定一式はページの init 呼び出しから受け取り、バンドル自体にデプロイ固有の URL やトークンを一切含みません。これが、CDN でホストされるバンドルをデプロイ間で可搬にしています。（手動でファサードなしに埋め込む場合、同じホストを `iframe.html` エントリ経由で iframe の内側で動かすこともできます — 下のエントリーポイントの表を参照してください。）

**層3 — 子のマイクロフロントエンド。** Web ホストはさらに、ユーザーが定義したビューを入れ子の iframe（`view.page` モジュール）または Web コンポーネント（`view.component` モジュール）として埋め込みます。各子は分離された状態で動作します。Web ホストはプロキシスクリプトを注入し、子が自分のデプロイ先を知らなくても Wippy の API、認証コンテキスト、テーマ CSS、通信チャネルへアクセスできるようにします。

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page  → srcdoc iframe + proxy.js
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## エントリーポイント

Web ホストの CDN は、同じバージョン付きディレクトリからいくつかのエントリーポイントを配信します。どれが適切かは、統合の仕方によります。

各エントリは CDN の `<release-tag>/<entry>`（例: `/<release-tag>/module.js`）から配信されます。

| エントリ | ユースケース |
|-------|----------|
| `module.js` | **compat** モードのフルアプリ — 標準のナビサイドバー + ページ領域 + チャット右パネルのシェル。`window.initWippyApp()` によりページへ直接マウントされ、ページ全体とブラウザー履歴を引き継ぎます。現在の `wippy/facade` がデフォルトで配信するエントリです。 |
| `managed-layout.js` | **managed** モードのフルアプリ — 宣言的なマルチパネルレイアウト。`fe_mode = managed` のときにファサードが配信します。早期アクセスです（[マルチパネルレイアウト](./multi-panel-layout.md) を参照）。 |
| `iframe.html` | 分離や部分埋め込みのために **iframe の内側**で動かすフルアプリ。`SetConfig` の PostMessage ハンドシェイクで設定を渡す、手動のファサードなし埋め込みで使います。ファサード自体は、これではなく上記の JS モジュールエントリを読み込みます。 |
| `chat-iframe.html` | サイドバーやページのない最小限のチャットインターフェース。チャットに絞ったウィジェットの埋め込みに便利です。 |
| `chat.js` | チャットのストアと WebSocket クライアントを公開するヘッドレスの ESM モジュール。完全にカスタムな UI を作る場合に使います。 |
| `ws.js` | Vue も Pinia も依存しないスタンドアロンの WebSocket サービス。低レベルのリアルタイム統合に使います。 |

標準の `wippy/facade` ベースのデプロイでは、これらのパスを直接参照することはありません。ファサードは設定から `fe_facade_url` を読み、`fe_mode` に合った JS モジュールエントリ（compat なら `module.js`、managed なら `managed-layout.js`）を選び、正しい URL を自動的に組み立てます。

## CDN のバージョニング

Web ホストは git タグでバージョン管理されます。正典の本番 URL パターンは次のとおりです。

```
https://web-host.wippy.ai/<release-tag>/
```

ここで `<release-tag>` は Web ホストの git リリースタグで、安定版リリースかフィーチャーブランチのプレビューデプロイのいずれかです。ステージングの CDN は `https://web-host.staging.wippy.ai/<release-tag>/` です。

通常はバージョンをまったく設定しません。`wippy/facade` モジュールは、対応する Web ホストのビルドを指すデフォルトの `fe_facade_url` を同梱しているため、**Web ホストのバージョンはファサードモジュールとともに動きます** — 新しい Web ホストへ移るには `wippy/facade` を更新します。インポートマップ経由でベンダーライブラリを共有する子アプリは、そのビルドが提供するバージョンをそのまま受け取ります。

特定の Web ホストのバージョンにピン留めするには — 既知の良好なビルドに留まる、あるいはフィーチャーブランチ／早期アクセスのタグを選ぶには — `fe_facade_url` パラメーターをオーバーライドします。

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

これによりデプロイ全体がそのビルドにピン留めされます。実行時に設定するための `-o` / `--override` 構文については [CLI のオーバーライド](../../guides/cli.md) を参照してください。

## 技術スタック

Web ホストは Vue 3（Composition API）、UI コンポーネントに PrimeVue + Tailwind CSS 3、状態管理に Pinia、ナビゲーションに Vue Router、HTTP に Axios を使って構築されています。開発中は `<fe_facade_url>/import-map.json` を取得し、その `imports` オブジェクトのすべてのキーを、現在のアーティファクトがそのキーを import していなくても Rollup の externals に入れてください。import した依存関係をバンドルするのは、その正確な指定子が存在しない場合だけです。Web ホストのタグが変わったとき、または新しい依存関係を追加したときは再取得してください。

## 関連項目

- [ファサードのエントリーポイント](./entry-point.md) — ファサードが Web ホストをユーザーへどう届けるか、設定のフローはどうなっているか
- [ブートストラップのシーケンス](./bootstrap.md) — Web ホストが設定を受け取った後、内部で何が起きるか
- [マルチパネルレイアウト](./multi-panel-layout.md) — カスタムのマルチパネルシェル向けのマネージドレイアウトモード
- [パッケージ](./packages.md) — 子アプリの開発者が利用できる `@wippy-fe/*` npm パッケージ
- [ファサードモジュール](../../framework/facade.md) — `wippy/facade` のバックエンド設定
- [レンダリングエンジン](./render-engines.md) — 2つのページ描画エンジン（srcdoc iframe と Web Fragment）
