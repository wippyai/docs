---
title: "静的ファイル"
description: "http.staticを使用して、ファイルシステムエントリからSPA、アセット、ユーザーのアップロードを配信します。"
---

# 静的ファイル

`http.static`ハンドラはサーバーに直接マウントされ、ファイルシステムエントリからSPA、アセット、ユーザーのアップロードを配信します。

**分類：静的ハンドラリファレンス。** YAMLブロックは、指定されたHTTPサーバーが存在することを前提としています。これらのホスト作成の例では、相対的な`fs.directory`パスはプロジェクトの作業ディレクトリから解決されます。一方、モジュール所有のエントリでは、`base: project`を設定しない限り、所有モジュールのソースルートから相対パスを解決します。参照されるファイルは別途作成する必要があります。

## 設定

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

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `meta.server` | Registry ID | 親HTTPサーバー |
| `path` | string | URLマウントパス（`/`で始まる必要があります） |
| `fs` | Registry ID | 配信元のファイルシステムエントリ |
| `static_options.spa` | bool | SPAモード（一致しないパスにはindexを配信） |
| `static_options.index` | string | インデックスファイル（`spa=true`の場合は必須） |
| `static_options.cache` | string | Cache-Controlヘッダーの値 |
| `middleware` | []string | ミドルウェアチェーン |
| `options` | map | ミドルウェアオプション（ドット記法） |

<tip>
静的ハンドラはサーバー上の任意のパスにマウントできます。複数のハンドラを共存させ、アセットを<code>/static</code>に、SPAを<code>/</code>にマウントできます。
</tip>

## ファイルシステムとの統合

静的ファイルはファイルシステムエントリから配信されます。どのファイルシステムタイプでも使用できます：

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

リクエスト`/static/css/style.css`に対して`./public/css/style.css`が配信されます。

サブディレクトリを配信するには、その場所をルートとするファイルシステムエントリを`fs`から参照します。たとえば、`fs.directory`を使用し、その`directory:`をサブディレクトリに設定します：

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

## SPAモード

クライアント側ルーティングを行うSingle Page Applicationでは、すべてのルートから同じインデックスファイルを配信する必要があります：

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

| リクエスト | レスポンス |
|---------|----------|
| `/app.js` | `app.js`を配信（ファイルが存在） |
| `/users/123` | `index.html`を配信（SPAフォールバック） |
| `/api/data` | `index.html`を配信（SPAフォールバック） |

<note>
<code>spa: true</code>の場合、<code>index</code>ファイルは必須です。存在するファイルは直接配信され、それ以外のパスではすべてインデックスファイルが返されます。
</note>

## キャッシュ制御

アセットの種類ごとに適切なキャッシュを設定します：

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

一般的なキャッシュパターン：

- **バージョン付きアセット**：`public, max-age=31536000, immutable`
- **HTML／index**：`public, max-age=0, must-revalidate`
- **ユーザーのアップロード**：`private, max-age=3600`

## ミドルウェア

圧縮、CORS、その他の処理を行うミドルウェアを適用できます：

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

ミドルウェアは記載された順に静的ハンドラをラップします。リクエストはファイルサーバーに到達する前に各ミドルウェアを通過します。

<warning>
パスの照合はプレフィックスベースです。<code>/</code>に置かれたハンドラは、一致しなかったすべてのリクエストを受け取ります。APIエンドポイントとの競合を避けるにはルーターを使用してください。
</warning>

## 関連項目

- [サーバー](./server.md) - HTTPサーバー設定
- [ルーティング](./router.md) - ルーターとエンドポイント
- [ファイルシステム](../lua/storage/filesystem.md) - ファイルシステムモジュール
- [ミドルウェア](./middleware.md) - 利用可能なミドルウェア
