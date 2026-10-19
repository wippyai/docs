---
title: "Iconify プロバイダー"
description: "Web Host の Iconify オンラインソースまたは明示的なローカルコレクションを設定します。"
---

# Iconify プロバイダー

Web Host は既定で Iconify のオンラインソースを使います。別のソースが必要な場合に限り `AppConfig.iconify.providers` を設定してください。このページのローカル Tabler コレクションは、オフライン環境向けの明示的な選択肢です。既定ソースは変更されません。
`AppConfig.iconify` の直接利用について確認済みの Web Host リリース基準は 1.0.64 です。Facade 経由で設定する場合は、[Facade モジュール](../../framework/facade.md)の確認済み基準を参照してください。

## プロバイダーの設定

`providers` のキーは Iconify プロバイダー ID です。組み込みプロバイダーには空のキー (`""`) を使い、名前付きプロバイダーには小文字とハイフンの ID を使います。各値には空でない HTTP(S) origin 配列 `resources` が必要です。標準の Iconify はこれらを代替 origin として使用します。成功した origin を記憶し、後続のリクエストをそこから開始する場合があります。Host は設定した配列に公開ソースを追加しません。

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path` の既定値は `/` で、先頭と末尾にスラッシュが付くよう正規化されます。`timeout` の既定値は 5000 ミリ秒です。正の整数を指定でき、上限は 60000 です。`resources` はオリジンを指定します。認証情報、クエリ、フラグメント、ベースパスは含めないでください。

## オフラインで Wippy を使う方法

オフライン環境では、ブラウザーからアクセスできるサーバーでコレクションを配信します。公開 Web Host CDN はオンライン用であり、アプリや他のサービスをオフラインで提供しません。Host リリースには完全な静的 Tabler Iconify JSON が `iconify/tabler.json` に含まれます。

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

ローカルテストでは Host のビルド出力を配信し、`dist/iconify/tabler.json` を `/iconify/tabler.json` で利用できるようにします。デプロイ時は自分で管理するオリジンとバージョン付きパスを使います。

```ts
const deploymentConfig = { iconify: { providers: { "": { resources: ["https://wippy-host.internal"], path: "/webcomponents-<host-release>/iconify/" } } } }
```

`<host-release>` を固定した Host リリースに置き換えてください。サーバーは `application/json` で JSON を返し、アプリのオリジンからの要求を許可する必要があります。Iconify は選択名を示す `?icons=...` を送ります。静的ミラーはクエリを無視して完全なコレクションを返します。検索は未対応です。このコレクションは MIT ライセンスの Tabler 3.41.1 に基づき、作者は Paweł Kuna です。メタデータは 6092 個と宣言しますが、固定元は 6140 個の定義と 184 個のエイリアスを含みます。SHA-256: `cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`。

### ミラーを正しく配信する

静的サーバーの設定もオフライン構成の一部です。ファイルを `application/json` で返し、アプリのオリジンからのブラウザー要求を CORS で許可し、ブラウザーが対応する場合は JSON を圧縮し、コレクションがない場合は実際の 404 を返してください。存在しないファイルを成功応答としてキャッシュしないでください。バージョン付きパスでは不変キャッシュを使えます。バージョンなしのパスでは `ETag` または `Last-Modified` による再検証を必須にしてください。

この Nginx 例は、ファイルが `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json` にあり、アプリのオリジンが下記と完全に一致し、TLS 証明書がこの設定断片の外で設定済みであることを前提とします。実際の値に置き換えてください。この断片は Nginx モジュールをインストールせず、TLS も設定しません。

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

バージョンなしのパスでは不変キャッシュを `Cache-Control: no-cache` などの再検証ポリシーに置き換え、`ETag` または `Last-Modified` を有効にしてください。利用前に、配信サーバーが JSON を実際に圧縮し、期待するキャッシュ、CORS、MIME の応答と、ファイルがない場合の 404 を返すことを確認してください。

## 名前付きプロバイダーとアイコン名

名前付きプロバイダーには `@provider:prefix:name` 形式を使います。Vue コンポーネントとカスタム要素で同じ名前を使います。

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

このソースの対象はアイコンコレクション取得だけです。API、フォント、Kickside の他のリソースには別途オフライン対応が必要です。

## リセットと更新

初期設定で `iconify` を省略するとオンラインの既定値が使われます。後続の更新で省略した場合、現在の Iconify 設定は変わりません。`iconify: null` または `providers: null` は全体をオンライン既定値に戻し、名前付き設定を削除します。空キーの `null` は組み込みプロバイダーだけを戻します。名前付きプロバイダーの `null` はその名前空間を無効にします。省略したキーは現在のルートを維持し、空の `providers` はリセットではありません。

生成されたスキーマは JSON の形式とフィールドの上限を確認します。実行時検証では `resources` が HTTP(S) origin であることと、`path` が Host の規則に従うことも確認します。そのため、スキーマを通過した値が実行時に拒否される場合があります。検証器が受け付けるのは `providers` と、各プロバイダーの `resources`、`path`、`timeout` だけです。無効な初期設定は無視され、オンラインの既定値が使われます。無効な更新では最後の有効な Iconify 設定が保たれ、他の有効な AppConfig フィールドは更新できます。Host は `timeout` を標準 Iconify のプロバイダー API に渡し、各ストアを一度だけ設定します。標準の Iconify がアイコンの読み込み、リソース選択、再試行、キャッシュを処理します。成功した origin を記憶し、後続のリクエストをそこから開始する場合があります。プロバイダーの変更を適用するには document を再読み込みしてください。`iconifyIcons` は `<iconify-icon>` 要素の読み込みと登録を制御し、ソースは選びません。明示的な設定は AppConfig で子アプリに渡されます。Schema 2.0 と 2.1 は 2.2 に移行されます。[ブートストラップシーケンス](./bootstrap.md)、[CSS injection](./css-injection.md)、[Proxy API](../micro-frontends/proxy-api.md)、[Facade](../../framework/facade.md) を参照してください。

## Provider trust and updates

信頼できる provider origin のみを使用してください。ページはアイコン本体を SVG マークアップとして描画します。新しい `SetConfig` には `wippy-context-2.2` を使用してください。バージョン付きの `wippy-context-2.0` と `wippy-context-2.1` は受け入れられて移行されます。schema-less 1.0 の入力には新しい `iconify` と `importMap` フィールドを含められません。

## スキーマのバージョン

新しい設定には `wippy-context-2.2` を使用してください。バージョン付きの `wippy-context-2.0` と `wippy-context-2.1` は移行されます。`$schema` のない入力は非推奨の legacy 変換を通ります。既知の legacy フィールドは対応付けられますが、新しい `iconify` と `importMap` フィールドは引き継がれません。生成スキーマは JSON の形とフィールド範囲を検証します。実行時にはさらに HTTP(S) origin と Host のパス規則を検証するため、スキーマを通過した値も実行時に拒否される場合があります。

## 開発オーバーレイ

利用側アプリを `@wippy-fe/vite-plugin` を有効にした Vite で起動してください。プラグインは `package.json` の Wippy 設定を開発オーバーレイに渡します。浮動表示の **Wippy Dev** ボタンをクリックし、**Configuration** を開いて、**App Config (JSON)** に `iconify.providers` を追加してから **Accept** をクリックします。初回起動では **Accept** の後にアプリの読み込みが完了します。承認した設定はブラウザーに保存されます。起動済みアプリの設定を後から変更した場合は、確認前にアプリを再読み込みしてください。**Accept** は設定を保存しますが、すでに使用中のアプリ設定は更新しません。Auto-accept が有効な場合、コンソールにも `Config updated (reload to apply)` と表示されます。
