---
title: "ページレシピ"
description: "サポートされたルーティング、テーマ配信、依存関係、ビルド所有権を備えたポータブルな view.page レシピ。"
---

# ページレシピ

ページはViteでビルドされたアプリケーションで、`about:srcdoc` iframe内にレンダリングされます。そのルートとホストコンテキストは、ブラウザのlocationではなくWippyのAppConfigとパッケージから得られます。

## 必要なセットアップ

1. `view.page` と、それを配信するファイルシステム/ルーターのエントリを登録します。
2. 必要なCSS配信を有効にします。デフォルトのスクロールバーの一貫性のため、`iframe` CSSブロックは有効なままにします。
3. Vueのルーティングには `@wippy-fe/router` を使用します。
4. ページがPrimeVue的なコントロールをレンダリングする場合は、PrimeVueとWippyのPrimeVueプラグインをインストールします。
5. ページがTailwindユーティリティを記述する場合は、共有のWippy Tailwindプリセットを使用します。
6. ピン留めされたWeb Hostのimport-mapスナップショットからexternalsを生成します。
7. デプロイで選択された出力ディレクトリにビルドします。

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

エクスポートされる正確なシグネチャは、選択したパッケージバージョンに対して検証してください。ローカルなルーター同期レイヤーを作成してはいけません。

## テーマの注入

ページは、iframeに配信されたファサードのテーマを消費します。公開されたPrimeVueコンポーネント、公開テーマ変数、ドキュメント化されたランタイム連動のTailwindユーティリティ、および明示的に不変とされるコンパイル時ユーティリティを使用してください。

ホストのクエリパラメータをアプリケーションのフィクスチャとして使用してはいけません。ホストコンテキストはAppConfigが所有します。

## ビルド

Wippyモジュールリポジトリの Make ターゲットを実行します。そのレシピは、
デプロイ出力に対して次を供給します:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` は相対アセットの挙動を保ち、デプロイ用の `outDir` をハードコードしません。

基盤となるパッケージマネージャやViteのビルドコマンドを直接実行してはいけません。
Windowsでは `make.bat` を実行します。これはターゲットの `make.ps1`
実装に委譲します。

[ビルドと依存関係の契約](./build-system.md)、[プラットフォームトポロジー](../platform-topology.md)、[設定とケーシング](./configuration-casing.md)を参照してください。
