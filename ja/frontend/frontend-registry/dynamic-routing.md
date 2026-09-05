---
title: "動的ルーティング"
description: "Web ホストのルーターは静的に設定されているわけではありません。起動時にバックエンドから現在のページマウントルートの集合を取得し、それらを追加します…"
---

# 動的ルーティング

Web ホストのルーターは静的に設定されているわけではありません。起動時にバックエンドから現在のページマウントルートの集合を取得し、Vue Router インスタンスへ追加します。つまり、`mountRoute` を主張する新しい `view.page` エントリは、Web ホストのバンドル自体を一切変更することなく有効になります。

![Mount route sync](../diagrams/mountroute-sync.svg)

## 起動時のマウントルート同期

Web ホストアプリケーションが初期化されるとき、ナビゲーションをレンダリングする前に次を呼び出します。

```
GET /api/public/pages/routes
```

レスポンスは `{ success, count, routes }` というエンベロープで、`routes` はマウントルートのパターン → ページ ID のマップです（URL を主張しているものの、非表示・未告知のページも含みます）。ホストは各エントリについて、宣言されたパスをページローダーコンポーネントへマッピングする Vue Router のルートを登録し、それを `'app'` 親ルートの子として追加します。

```typescript
// Web ホストのブートストラップを簡略化したもの
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

この時点以降、`/home/anything` へ遷移すると、ルーターは `main` ページの iframe をレンダリングし、`/demo/anything` へ遷移すると `iframe-demo` ページの iframe をレンダリングします — ホストのバンドルにそれらのパスをハードコードした知識は一切ありません。

## `mountRoute` によるパスの主張

`view.page` エントリは、`_index.yaml` の `meta` ブロックで `mountRoute` を設定することにより、ホストのルーターパスを主張します。

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute` は、バックエンドのケーシングに関する不具合に対する現行の互換表記です。本来意図されているバックエンドのキーは `mount_route` です。バックエンドの修正が出るまでは `mountRoute` で記述し続けてください。

`mountRoute` はキャッチオール形式の `/:part(.*)*`（ルート）または `/<literal-prefix>/:part(.*)*` のみを受け付けます。プレフィックスは小文字英数字とハイフンからなるリテラルセグメント1つ以上で、末尾には必須のワイルドカード `:part(.*)*` が付きます。任意の Vue Router パターン — 名前付きパラメーター、カスタム正規表現、異なるパラメーター名（例: `/home/:id`、`/users/:userId(\d+)`）— は拒否されます。ホストは `syntax` のマウントルート競合を発生させ、バックエンドの `validate_mount_route_syntax` が失敗し、`GET /api/public/pages/routes` が HTTP 500 を返します（全画面の致命的エラーとして表示されます）。ワイルドカードセグメント `:part(.*)*` により、ホストが `/home` プレフィックスを所有したまま、子アプリケーションが自身のサブルート（例: `/home/settings`、`/home/profile/edit`）を管理できます。

2つのエントリが同じルートを主張してはなりません。2つの `view.page` エントリが**同じ** `mountRoute` を主張した場合、バックエンドのバリデーター（`page_registry.lua` の `validate_mount_routes`）が構文エラーと同じ issue リストにルート重複の競合を記録するため、`GET /api/public/pages/routes` は HTTP 500 を返し、Web ホストは全画面の致命的な `<wippy-error>` をレンダリングします — 不正な `mountRoute` の場合とまったく同じです。黙って無視されることは**ありません**。

先勝ちの挙動が唯一存在するのは、ルートのキャッチオール（`/:part(.*)*`）と、より具体的なシステムルート（`chat`、`c`、`web`、`page`、`keeper`、`login`、`logout`）または、より長いリテラルプレフィックスのマウントとの間における Vue Router の実行時優先順位です — より具体的なルートが先にマッチします。これはルート解決の優先順位であり、ルート重複の扱いではありません。

## URL 同期ループ

ページが iframe 内にロードされると、子アプリケーションは自身のルーターを使って内部的に遷移します。ブラウザーの戻るボタン、ブックマーク、URL のコピーがすべて正しく機能するよう、これらの内部遷移はホストの URL バーへ反映される必要があります。これは PostMessage のペアによって行われます。

![Frontend Registry](../diagrams/frontend-registry.svg)

### 子 → ホスト: `CmdRouteChanged`

子アプリケーションのルーターが遷移をコミットしたとき（例: ユーザーが `/home/settings` から `/home/profile` へ移動）、子は親ウィンドウへメッセージをポストします。

```typescript
// 子アプリケーション内、内部ルート変更時。
// アプリコードがこれらのメッセージを直接ポストしてはならない。プロキシ API を使うこと:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // 内部ルートのみ。マウントプレフィックスはホストが前置する。navId は省略可能な数値
```

プロキシはこれを内部のワイヤーエンベロープ上でシリアライズします。そのプロトコルはアプリケーション API ではありません。コピーしたり `window.parent.postMessage` を直接呼んだりしないでください。

ホストのメッセージハンドラーはこれを傍受し、`router.push(path)` を呼んで SPA のルート変更経由で URL バーを更新し（ブラウザー履歴エントリを追加）、ページ全体のリロードを起こさずに、次を送り返します。

### ホスト → 子: `UrlWasUpdatedInParent`

ホストが URL バーを更新した後、プロキシは子へ `@history` を送出します。`@wippy-fe/router` がそのイベントを受け取り、メモリールーターを整合させます。

ホストが送り返すのは子の**内部**ルート（マウントプレフィックスより後のサブパス）であり、ホストの完全なパスではありません — したがって往復は対称です。子が `internalRoute: '/profile'` をポストし、ホストは URL バーを `/home/profile` に設定し、`path: '/profile'` をそのまま送り返し、子のメモリールーターがそれをそのまま push します。子は `@history` イベントチャネルで待ち受け、ホストの URL が自身の内部状態と一致したことの確認として扱います。

この往復により、ホストが子の内部ルーティング構造について何も知る必要なく、ホストの URL バー、子のルーター、ブラウザーの履歴エントリが同期に保たれます。

## `classifyLink`

ページのプロキシインジェクションに `preventLinkClicks: true` がある場合（[view.page](./view-page.md) を参照）、ホストは iframe 内の `<a>` クリックをブラウザーが処理する前に傍受します。傍受された各リンクは `classifyLink` へ渡され、そこで扱い方が決まります。

| `LinkKind` | 条件 | アクション |
|---|---|---|
| `host-nav` | 先頭のパスセグメントが既知の `mountRoute` リテラル、組み込みのシステムルート（`chat`、`c`、`web`、`page`、`keeper`、`login`、`logout`）、またはルートマウントのキャッチオールに一致する | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | iframe 自身のルーターがそのパスを実在の（キャッチオールでない）ルートへ解決できる、または他の誰もそれを主張していない | サブアプリの `RouterLink` がアプリ内で判断する。ホストは `preventDefault` せず、iframe をリロードもしない |
| `external` | オリジンが異なる、または `http` 以外のスキーム（`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`） | ブラウザーのデフォルト（例: 新しいタブで開く） |
| `ignore` | `href` が空、または純粋なハッシュ（`#…`） | `preventDefault` |

分類器は iframe 自身のローカルルーターを最初に確認するため、子が自力で解決できるリンクはアプリ内に留まります。

`classifyLink` は起動時に取得したのと同じルート一覧を参照します。`/demo/step-2` へのリンクは、`/demo/:part(.*)*` が登録済みのマウントルートであるため `host-nav` に分類されます — ホストはページ全体のリロードではなく `iframe-demo` ページへ遷移します。

つまり子アプリケーションは、システム内の他のページについて知る必要がありません。通常の `<a href="/demo/step-2">` リンクをレンダリングすれば、ホストのリンク分類器が遷移を正しく処理します。
