# 静的ファイル

`http.static`を使用して任意のファイルシステムから静的ファイルを配信します。静的ハンドラはサーバーに直接マウントし、任意のパスからSPA、アセット、またはユーザーアップロードを配信できます。

## 設定

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

| フィールド | 型 | 説明 |
|------------|-----|------|
| `meta.server` | Registry ID | 親HTTPサーバー |
| `path` | string | URLマウントパス（`/`で開始する必要があります） |
| `fs` | Registry ID | 配信元のファイルシステムエントリ |
| `directory` | string | ファイルシステム内のサブディレクトリ |
| `static_options.spa` | bool | SPAモード - マッチしないパスにindexを配信 |
| `static_options.index` | string | インデックスファイル（spa=trueの場合必須） |
| `static_options.cache` | string | Cache-Controlヘッダー値 |
| `middleware` | []string | ミドルウェアチェーン |
| `options` | map | ミドルウェアオプション（ドット記法） |

<tip>
静的ハンドラはサーバー上の任意のパスにマウントできます。複数のハンドラが共存できます—アセットを<code>/static</code>に、SPAを<code>/</code>にマウント。
</tip>

## ファイルシステム統合

静的ファイルはファイルシステムエントリから配信されます。任意のファイルシステムタイプが動作します：

```yaml
entries:
  # ローカルディレクトリ
  - name: public
    kind: fs.directory
    directory: ./public

  # 静的ハンドラ
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

リクエスト`/static/css/style.css`は`./public/css/style.css`を配信します。

`directory`フィールドはファイルシステム内のサブディレクトリを選択：

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
```

## SPAモード

シングルページアプリケーションはクライアントサイドルーティング用にすべてのルートで同じindexファイルを配信する必要があります：

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
|-----------|----------|
| `/app.js` | `app.js`を配信（ファイルが存在） |
| `/users/123` | `index.html`を配信（SPAフォールバック） |
| `/api/data` | `index.html`を配信（SPAフォールバック） |

<note>
<code>spa: true</code>の場合、<code>index</code>ファイルは必須です。既存のファイルは直接配信され、他のすべてのパスはindexファイルを返します。
</note>

## キャッシュ制御

異なるアセットタイプに適切なキャッシュを設定：

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # バージョン付きアセット - 永久キャッシュ
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    directory: assets
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - 短いキャッシュ、再検証必須
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
- **バージョン付きアセット**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **ユーザーアップロード**: `private, max-age=3600`

## ミドルウェア

圧縮、CORS、その他の処理にミドルウェアを適用：

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

ミドルウェアは静的ハンドラを順番にラップします—リクエストはファイルサーバーに到達する前に各ミドルウェアを通過します。

<warning>
パスマッチングはプレフィックスベースです。<code>/</code>のハンドラはすべてのマッチしないリクエストをキャッチします。競合を避けるためにAPIエンドポイントにはルーターを使用してください。
</warning>

## 関連項目

- [サーバー](http/server.md) - HTTPサーバー設定
- [ルーティング](http/router.md) - ルーターとエンドポイント
- [ファイルシステム](lua/storage/filesystem.md) - ファイルシステムモジュール
- [ミドルウェア](http/middleware.md) - 利用可能なミドルウェア
